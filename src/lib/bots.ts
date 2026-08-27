/**
 * Decisão dos bots.
 *
 * Duas cabeças diferentes, de propósito:
 *
 * - **Pré-flop** roda pela fórmula de Chen, a mesma que o app ensina. Um bot
 *   que abre por Monte Carlo entra com qualquer lixo (contra cinco mãos
 *   aleatórias quase tudo tem equity parecida) e o treino vira mentira.
 * - **Pós-flop** roda por Monte Carlo, comparando a probabilidade de vencer com
 *   as pot odds que ele está recebendo.
 *
 * Os bots não são fortes — são *plausíveis*. Eles apertam cedo, alargam no
 * botão, blefam pouco e desistem quando a conta não fecha. É o suficiente para
 * o usuário sentir posição, pote e agressão sem enfrentar um solver.
 */

import type { Rng } from './cards'
import { chenScore, OPEN_THRESHOLDS } from './chen'
import { monteCarloEquity } from './equity'
import type { BotStyle, PlayerAction, TournamentPlayer, TournamentState } from './tournament'
import { actionOptions, blindsOf, positionOf, potSize } from './tournament'

interface StyleProfile {
  /** Ajuste no limiar de abertura pré-flop: negativo = abre mais mãos. */
  openShift: number
  /** Probabilidade de vencer a partir da qual aposta/aumenta pós-flop. */
  betAt: number
  /** Folga (em pontos percentuais) exigida acima das pot odds para pagar. */
  callMargin: number
  /** Chance de blefar quando a mesa passa. */
  bluff: number
}

const PROFILES: Record<BotStyle, StyleProfile> = {
  apertado: { openShift: 1, betAt: 68, callMargin: 6, bluff: 0.04 },
  equilibrado: { openShift: 0, betAt: 62, callMargin: 3, bluff: 0.08 },
  agressivo: { openShift: -1, betAt: 56, callMargin: 1, bluff: 0.16 },
  frouxo: { openShift: -2, betAt: 60, callMargin: -4, bluff: 0.1 },
}

/** Iterações do Monte Carlo por rua: quanto mais board conhecido, menos ruído. */
function iterationsFor(state: TournamentState): number {
  switch (state.street) {
    case 'flop':
      return 140
    case 'turn':
      return 120
    default:
      return 100
  }
}

export function decideBotAction(
  state: TournamentState,
  player: TournamentPlayer,
  rng: Rng = Math.random,
): PlayerAction {
  const options = actionOptions(state, player)
  const opponents = state.players.filter(
    (p) => p.inHand && !p.folded && p.id !== player.id,
  ).length

  if (opponents === 0) return { type: options.canCheck ? 'check' : 'call' }

  return state.street === 'preflop'
    ? preflopDecision(state, player, rng, opponents)
    : postflopDecision(state, player, rng, opponents)
}

function preflopDecision(
  state: TournamentState,
  player: TournamentPlayer,
  rng: Rng,
  opponents: number,
): PlayerAction {
  const profile = PROFILES[player.style]
  const options = actionOptions(state, player)
  const { bb } = blindsOf(state)
  const { score } = chenScore(player.hole[0], player.hole[1])

  const position = positionOf(state, player.id) ?? 'MP'
  const threshold = OPEN_THRESHOLDS[position] + profile.openShift
  const stackInBb = player.stack / bb

  // Ninguém aumentou ainda: a aposta em jogo é só a big blind.
  const unopened = state.currentBet <= bb

  // Stack curto não tem pós-flop: ou entra all-in, ou desiste. Fingir jogo
  // normal com 8 big blinds é o erro clássico que deixa o bot irreal.
  if (stackInBb <= 10 && score >= threshold - 1) {
    return { type: 'allin' }
  }

  if (unopened) {
    // A folga do blefe deixa o bot abrir um pouco fora do range de vez em
    // quando. Sem isso, todo raise dele seria legível como mão feita, e o
    // usuário aprenderia a jogar contra um adversário que não existe.
    const bluffOpen = score >= threshold - 1.5 && rng() < profile.bluff
    if (score >= threshold || bluffOpen) {
      const openTo = Math.min(bb * (position === 'SB' ? 3 : 2.5), options.maxRaiseTo)
      return { type: 'raise', amount: Math.max(openTo, options.minRaiseTo) }
    }
    return options.canCheck ? { type: 'check' } : { type: 'fold' }
  }

  // Já houve aumento: 3-bet só com mão premium, pagar com mão de jogar.
  if (score >= 10.5 && options.minRaiseTo > 0) {
    return { type: 'raise', amount: options.minRaiseTo + bb }
  }

  const priceInBb = options.callAmount / bb
  const callable = score >= threshold + (priceInBb > 6 ? 2 : 1) - (opponents > 2 ? 0.5 : 0)
  if (callable) return { type: 'call' }

  return options.canCheck ? { type: 'check' } : { type: 'fold' }
}

function postflopDecision(
  state: TournamentState,
  player: TournamentPlayer,
  rng: Rng,
  opponents: number,
): PlayerAction {
  const profile = PROFILES[player.style]
  const options = actionOptions(state, player)

  const { equity } = monteCarloEquity({
    hole: player.hole,
    board: state.board,
    opponents,
    iterations: iterationsFor(state),
    rng,
  })

  // Ninguém apostou: a escolha é entre passar e tomar a iniciativa.
  if (options.callAmount === 0) {
    if (equity >= profile.betAt && options.potRaiseTo > 0) {
      return { type: 'bet', amount: options.potRaiseTo }
    }
    if (rng() < profile.bluff && options.potRaiseTo > 0) {
      return { type: 'bet', amount: options.potRaiseTo }
    }
    return { type: 'check' }
  }

  const pot = potSize(state)
  const required = (options.callAmount / (pot + options.callAmount)) * 100

  // Mão muito forte: aumenta para construir pote, all-in se o stack for curto.
  if (equity >= profile.betAt + 12 && options.minRaiseTo > 0) {
    const raiseTo = Math.max(options.potRaiseTo, options.minRaiseTo)
    return raiseTo >= options.maxRaiseTo * 0.8
      ? { type: 'allin' }
      : { type: 'raise', amount: raiseTo }
  }

  if (equity >= required + profile.callMargin) return { type: 'call' }

  // Blefe de aumento: raro, e só quando o pote ainda é pequeno em relação ao
  // stack — blefar all-in com 5% de equity não é estilo, é doação.
  if (
    rng() < profile.bluff / 2 &&
    options.minRaiseTo > 0 &&
    options.callAmount < player.stack * 0.25
  ) {
    return { type: 'raise', amount: options.minRaiseTo }
  }

  return { type: 'fold' }
}
