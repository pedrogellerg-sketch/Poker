/**
 * Equity: quanto do pote é "seu" antes das cartas acabarem.
 *
 * Duas contas convivem aqui de propósito:
 *
 * 1. A regra de 4 e 2 — a aproximação que o jogador faz de cabeça na mesa. É o
 *    que o treino de outs/pot odds ensina.
 * 2. Monte Carlo — a conta honesta, usada pelos bots e pela análise das mãos
 *    reais, onde não existe "número redondo o bastante para a cabeça".
 *
 * Manter as duas separadas evita a confusão comum de achar que a regra de 4 e 2
 * é exata: ela é um atalho, e o app mostra os dois números quando isso importa.
 */

import type { Card, Rng } from './cards'
import { deckWithout, shuffle } from './cards'
import { evaluate7 } from './evaluator'

/** Equity aproximada pela regra de 4 e 2 (em %). */
export function ruleOf42(outs: number, cardsToCome: 1 | 2): number {
  const raw = cardsToCome === 2 ? outs * 4 : outs * 2
  // Acima de ~15 outs a regra de 4 superestima bastante; o teto evita prometer
  // 100% de equity para um duplo projeto, o que seria mentira perigosa.
  return Math.min(raw, 95)
}

/** Equity necessária para pagar (em %): aposta / (pote + aposta). */
export function requiredEquity(pot: number, bet: number): number {
  if (bet <= 0) return 0
  return (bet / (pot + bet)) * 100
}

/** Pot odds no formato "3,5 : 1", que é como a mesa fala. */
export function potOddsRatio(pot: number, bet: number): string {
  if (bet <= 0) return '—'
  return `${(pot / bet).toFixed(1).replace('.', ',')} : 1`
}

export interface EquityResult {
  /** % de vitórias. */
  win: number
  /** % de empates. */
  tie: number
  /** win + tie/2 — o valor que se compara com as pot odds. */
  equity: number
  iterations: number
}

export interface MonteCarloOptions {
  hole: Card[]
  board?: Card[]
  /** Quantos adversários com mão desconhecida. */
  opponents: number
  iterations?: number
  rng?: Rng
  /** Cartas conhecidas que não estão no baralho (mãos já mostradas). */
  dead?: Card[]
}

/**
 * Estima a equity contra N mãos aleatórias completando o board.
 *
 * "Mão aleatória" superestima a equity contra um adversário que só continua com
 * mãos boas — a heurística dos bots compensa isso exigindo folga na decisão, em
 * vez de fingir precisão que a simulação não tem.
 */
export function monteCarloEquity({
  hole,
  board = [],
  opponents,
  iterations = 120,
  rng = Math.random,
  dead = [],
}: MonteCarloOptions): EquityResult {
  if (hole.length !== 2) throw new Error('monteCarloEquity espera 2 cartas na mão')
  if (opponents < 1) return { win: 100, tie: 0, equity: 100, iterations: 0 }

  const known = [...hole, ...board, ...dead]
  const remaining = deckWithout(known)
  const boardNeeded = 5 - board.length
  const cardsNeeded = boardNeeded + opponents * 2

  if (cardsNeeded > remaining.length) {
    return { win: 0, tie: 0, equity: 0, iterations: 0 }
  }

  let wins = 0
  let ties = 0

  for (let i = 0; i < iterations; i += 1) {
    const drawn = drawWithoutReplacement(remaining, cardsNeeded, rng)
    const fullBoard = board.concat(drawn.slice(0, boardNeeded))
    const heroScore = evaluate7([...hole, ...fullBoard]).score

    let best = heroScore
    let tiedWith = 0

    for (let o = 0; o < opponents; o += 1) {
      const offset = boardNeeded + o * 2
      const villain = evaluate7([drawn[offset], drawn[offset + 1], ...fullBoard]).score
      if (villain > best) {
        best = villain
        tiedWith = 0
      } else if (villain === best) {
        tiedWith += 1
      }
    }

    if (best > heroScore) continue
    if (tiedWith > 0) ties += 1
    else wins += 1
  }

  const win = (wins / iterations) * 100
  const tie = (ties / iterations) * 100
  return { win, tie, equity: win + tie / 2, iterations }
}

/**
 * Retira `count` cartas sem repetição.
 *
 * Embaralhar as ~45 cartas restantes a cada iteração seria desperdício: só
 * precisamos das primeiras `count`, então o Fisher-Yates é interrompido cedo.
 */
function drawWithoutReplacement(pool: Card[], count: number, rng: Rng): Card[] {
  if (count >= pool.length) return shuffle(pool, rng)

  const copy = pool.slice()
  const drawn: Card[] = []
  for (let i = 0; i < count; i += 1) {
    const j = i + Math.floor(rng() * (copy.length - i))
    ;[copy[i], copy[j]] = [copy[j], copy[i]]
    drawn.push(copy[i])
  }
  return drawn
}

/**
 * Conta os outs contra uma mão conhecida do adversário.
 *
 * "Out" só existe em relação a alguém: uma carta que melhora a sua mão mas
 * continua perdendo não é out, e uma carta que melhora a mão dele junto é o
 * contrário de um out. Por isso a assinatura exige as cartas do vilão — a
 * versão sem adversário contaria qualquer par como progresso e devolveria
 * números absurdos.
 *
 * Usada no replay das mãos importadas, onde o showdown revela a mão do
 * adversário: ali dá para dizer exatamente quantas cartas salvavam o pote.
 */
export function countOuts(hole: Card[], board: Card[], villain: Card[]): number {
  if (board.length < 3 || board.length > 4) return 0
  if (villain.length !== 2) return 0

  const behind = evaluate7([...hole, ...board]).score <= evaluate7([...villain, ...board]).score
  if (!behind) return 0

  const remaining = deckWithout([...hole, ...board, ...villain])

  let outs = 0
  for (const card of remaining) {
    const mine = evaluate7([...hole, ...board, card]).score
    const theirs = evaluate7([...villain, ...board, card]).score
    if (mine > theirs) outs += 1
  }
  return outs
}
