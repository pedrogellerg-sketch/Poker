/**
 * Motor do torneio — regras de Texas Hold'em no-limit, sem interface.
 *
 * O estado é tratado como imutável: cada ação devolve um estado novo. Isso
 * custa algumas cópias por mão (irrelevante para 9 jogadores) e paga em
 * previsibilidade: o React re-renderiza porque a referência mudou, e um bug de
 * "o estado mudou pelas costas" simplesmente não existe.
 *
 * O que este arquivo NÃO faz: decidir por bots (fica em `bots.ts`) e desenhar
 * mesa (fica na tela). Assim o motor é testável sozinho.
 */

import type { Card, Rng } from './cards'
import { cardId, createDeck, shuffle } from './cards'
import type { HandResult } from './evaluator'
import { describeHand, evaluate7 } from './evaluator'
import type { Position } from './chen'

export type Street = 'preflop' | 'flop' | 'turn' | 'river'

export type BotStyle = 'apertado' | 'equilibrado' | 'agressivo' | 'frouxo'

export interface TournamentPlayer {
  id: string
  name: string
  isHuman: boolean
  stack: number
  hole: Card[]
  /** Recebeu cartas nesta mão. */
  inHand: boolean
  folded: boolean
  allIn: boolean
  /** Fichas apostadas na rua atual. */
  betThisRound: number
  /** Fichas apostadas na mão inteira — base do cálculo de side pots. */
  committed: number
  hasActed: boolean
  /**
   * A última ação do jogador, como dado e não como frase.
   *
   * O motor não sabe — e não deve saber — se a mesa está exibindo fichas ou big
   * blinds. Guardando `{ tipo, valor }`, quem desenha compõe o texto na unidade
   * escolhida; com uma string pronta, o balão do assento dizia "AUMENTOU 50"
   * enquanto o resto da mesa falava em BB.
   */
  lastAct: { kind: ActionType; amount: number } | null
  style: BotStyle
  /** Colocação final (1 = campeão). Definido quando quebra. */
  place: number | null
}

export type ActionType = 'fold' | 'check' | 'call' | 'bet' | 'raise' | 'allin'

export interface PlayerAction {
  type: ActionType
  /** Para bet/raise: valor TOTAL da aposta na rua (raise "to"), não o incremento. */
  amount?: number
}

export interface LogEntry {
  id: number
  text: string
  kind: 'action' | 'street' | 'result' | 'system'
}

export interface PotShare {
  amount: number
  eligible: string[]
  label: string
}

export interface ShowdownEntry {
  playerId: string
  hand: HandResult
  description: string
}

export interface HandOutcome {
  showdown: boolean
  board: Card[]
  shown: ShowdownEntry[]
  payouts: { playerId: string; amount: number }[]
  /** Frase pronta para o topo da mesa: "Bruna leva 640 com dois pares". */
  headline: string
  busted: string[]
}

export interface BlindLevel {
  sb: number
  bb: number
}

export interface TournamentConfig {
  botCount: number
  startingStack: number
  handsPerLevel: number
  levels: BlindLevel[]
}

export type Phase = 'acting' | 'handOver' | 'over'

export interface TournamentState {
  config: TournamentConfig
  players: TournamentPlayer[]
  buttonIndex: number
  street: Street
  board: Card[]
  deck: Card[]
  /** Maior aposta da rua atual. */
  currentBet: number
  /** Tamanho do último aumento — piso para o próximo. */
  minRaise: number
  lastAggressorId: string | null
  /** Índice do jogador que deve agir; `null` quando ninguém deve. */
  actorIndex: number | null
  handNumber: number
  levelIndex: number
  handsAtLevel: number
  log: LogEntry[]
  phase: Phase
  outcome: HandOutcome | null
  /** Colocações já definidas, do campeão para baixo. */
  finished: string[]
  nextLogId: number
}

export const DEFAULT_LEVELS: BlindLevel[] = [
  { sb: 10, bb: 20 },
  { sb: 15, bb: 30 },
  { sb: 25, bb: 50 },
  { sb: 50, bb: 100 },
  { sb: 75, bb: 150 },
  { sb: 100, bb: 200 },
  { sb: 150, bb: 300 },
  { sb: 200, bb: 400 },
  { sb: 300, bb: 600 },
  { sb: 500, bb: 1000 },
]

const BOT_NAMES = [
  'Bruna',
  'Otávio',
  'Lia',
  'Ravi',
  'Dedé',
  'Nina',
  'Caio',
  'Sol',
  'Vitor',
] as const

const BOT_STYLES: BotStyle[] = ['apertado', 'equilibrado', 'agressivo', 'frouxo']

export const HERO_ID = 'hero'

export function createTournament(
  config: Partial<TournamentConfig> = {},
  rng: Rng = Math.random,
): TournamentState {
  const full: TournamentConfig = {
    botCount: config.botCount ?? 5,
    startingStack: config.startingStack ?? 1500,
    handsPerLevel: config.handsPerLevel ?? 6,
    levels: config.levels ?? DEFAULT_LEVELS,
  }

  const players: TournamentPlayer[] = [
    blankPlayer(HERO_ID, 'Você', true, full.startingStack, 'equilibrado'),
  ]
  for (let i = 0; i < full.botCount; i += 1) {
    players.push(
      blankPlayer(
        `bot${i + 1}`,
        BOT_NAMES[i % BOT_NAMES.length],
        false,
        full.startingStack,
        BOT_STYLES[i % BOT_STYLES.length],
      ),
    )
  }

  const state: TournamentState = {
    config: full,
    players,
    // Último assento: a primeira mão avança o botão e ele cai no assento 0.
    buttonIndex: players.length - 1,
    street: 'preflop',
    board: [],
    deck: [],
    currentBet: 0,
    minRaise: 0,
    lastAggressorId: null,
    actorIndex: null,
    handNumber: 0,
    levelIndex: 0,
    handsAtLevel: 0,
    log: [],
    phase: 'handOver',
    outcome: null,
    finished: [],
    nextLogId: 1,
  }

  return startHand(state, rng)
}

function blankPlayer(
  id: string,
  name: string,
  isHuman: boolean,
  stack: number,
  style: BotStyle,
): TournamentPlayer {
  return {
    id,
    name,
    isHuman,
    stack,
    hole: [],
    inHand: false,
    folded: false,
    allIn: false,
    betThisRound: 0,
    committed: 0,
    hasActed: false,
    lastAct: null,
    style,
    place: null,
  }
}

function clone(state: TournamentState): TournamentState {
  return {
    ...state,
    players: state.players.map((p) => ({ ...p, hole: p.hole.slice() })),
    board: state.board.slice(),
    deck: state.deck.slice(),
    log: state.log.slice(),
    finished: state.finished.slice(),
  }
}

function log(state: TournamentState, text: string, kind: LogEntry['kind'] = 'action') {
  state.log.push({ id: state.nextLogId, text, kind })
  state.nextLogId += 1
  // O log é da mão atual: guardar mil linhas só faz a lista crescer sem uso.
  if (state.log.length > 120) state.log = state.log.slice(-120)
}

export function blindsOf(state: TournamentState): BlindLevel {
  const levels = state.config.levels
  return levels[Math.min(state.levelIndex, levels.length - 1)]
}

export function potSize(state: TournamentState): number {
  return state.players.reduce((sum, p) => sum + p.committed, 0)
}

export function alivePlayers(state: TournamentState): TournamentPlayer[] {
  return state.players.filter((p) => p.stack > 0 || (p.inHand && !p.folded))
}

/** Jogadores que ainda podem ganhar a mão. */
function contenders(state: TournamentState): TournamentPlayer[] {
  return state.players.filter((p) => p.inHand && !p.folded)
}

/** Jogadores que ainda têm decisão a tomar (não desistiram e não estão all-in). */
function actors(state: TournamentState): TournamentPlayer[] {
  return contenders(state).filter((p) => !p.allIn)
}

function nextOccupiedIndex(
  state: TournamentState,
  from: number,
  predicate: (p: TournamentPlayer) => boolean,
): number {
  const n = state.players.length
  for (let step = 1; step <= n; step += 1) {
    const idx = (from + step) % n
    if (predicate(state.players[idx])) return idx
  }
  return -1
}

/** Começa uma mão nova: move o botão, embaralha, distribui e posta as blinds. */
export function startHand(state: TournamentState, rng: Rng = Math.random): TournamentState {
  const next = clone(state)

  const withChips = next.players.filter((p) => p.stack > 0)
  if (withChips.length <= 1) return finishTournament(next)

  // Nível de blinds sobe por número de mãos: é o relógio do torneio.
  if (next.handNumber > 0) {
    next.handsAtLevel += 1
    if (next.handsAtLevel >= next.config.handsPerLevel) {
      next.handsAtLevel = 0
      next.levelIndex = Math.min(next.levelIndex + 1, next.config.levels.length - 1)
    }
  }

  next.handNumber += 1
  next.street = 'preflop'
  next.board = []
  next.outcome = null
  next.phase = 'acting'
  next.log = []
  next.deck = shuffle(createDeck(), rng)

  for (const p of next.players) {
    p.hole = []
    p.inHand = p.stack > 0
    p.folded = false
    p.allIn = false
    p.betThisRound = 0
    p.committed = 0
    p.hasActed = false
    p.lastAct = null
  }

  next.buttonIndex = nextOccupiedIndex(next, next.buttonIndex, (p) => p.inHand)

  const { sb, bb } = blindsOf(next)
  log(next, `Mão ${next.handNumber} — blinds ${sb}/${bb}`, 'street')

  const heads = withChips.length === 2
  // Heads-up inverte a ordem: o botão é a small blind e fala primeiro no
  // pré-flop, mas por último em todas as ruas seguintes.
  const sbIndex = heads
    ? next.buttonIndex
    : nextOccupiedIndex(next, next.buttonIndex, (p) => p.inHand)
  const bbIndex = nextOccupiedIndex(next, sbIndex, (p) => p.inHand)

  postBlind(next, sbIndex, sb, 'small blind')
  postBlind(next, bbIndex, bb, 'big blind')

  next.currentBet = bb
  next.minRaise = bb
  next.lastAggressorId = next.players[bbIndex].id

  for (const p of next.players) {
    if (!p.inHand) continue
    for (let i = 0; i < 2; i += 1) {
      const card = next.deck.pop()
      if (card) p.hole.push(card)
    }
  }

  // `actorIndex` guarda quem falou por último, e a busca sempre anda para a
  // frente: apontar para a big blind faz a ação abrir em quem vem depois dela
  // — que no heads-up, com só dois assentos, é o próprio botão/small blind.
  next.actorIndex = bbIndex

  return settleIfRoundOver(next)
}

function postBlind(state: TournamentState, index: number, amount: number, label: string) {
  const player = state.players[index]
  const paid = Math.min(amount, player.stack)
  player.stack -= paid
  player.betThisRound += paid
  player.committed += paid
  if (player.stack === 0) player.allIn = true
  log(state, `${player.name} paga ${label} de ${paid}${player.allIn ? ' (all-in)' : ''}`)
}

export function currentActor(state: TournamentState): TournamentPlayer | null {
  if (state.phase !== 'acting') return null
  if (state.actorIndex === null || state.actorIndex < 0) return null
  return state.players[state.actorIndex] ?? null
}

export interface ActionOptions {
  canFold: boolean
  canCheck: boolean
  /** Fichas necessárias para pagar (0 se pode passar). */
  callAmount: number
  /** Menor "raise to" legal; 0 quando não é possível aumentar. */
  minRaiseTo: number
  /** Maior "raise to" possível — o all-in do jogador. */
  maxRaiseTo: number
  /** Aumento de ~2/3 do pote, o tamanho padrão sugerido. */
  potRaiseTo: number
  isAllInCall: boolean
}

export function actionOptions(state: TournamentState, player: TournamentPlayer): ActionOptions {
  const toCall = Math.min(state.currentBet - player.betThisRound, player.stack)
  const canCheck = state.currentBet <= player.betThisRound
  const maxRaiseTo = player.betThisRound + player.stack

  const wanted = state.currentBet > 0 ? state.currentBet + state.minRaise : blindsOf(state).bb
  const minRaiseTo = maxRaiseTo > state.currentBet ? Math.min(wanted, maxRaiseTo) : 0

  const pot = potSize(state)
  const target =
    state.currentBet > 0
      ? state.currentBet + Math.round((pot + toCall) * 0.7)
      : Math.max(Math.round(pot * 0.66), blindsOf(state).bb)

  return {
    canFold: true,
    canCheck,
    callAmount: toCall,
    minRaiseTo,
    maxRaiseTo,
    potRaiseTo: minRaiseTo ? clamp(roundChips(target), minRaiseTo, maxRaiseTo) : 0,
    isAllInCall: toCall >= player.stack && toCall > 0,
  }
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value))
}

/** Arredonda para múltiplos legíveis — ninguém aposta 337 fichas na vida real. */
function roundChips(value: number): number {
  if (value < 100) return Math.round(value / 5) * 5
  if (value < 1000) return Math.round(value / 25) * 25
  return Math.round(value / 50) * 50
}

/**
 * Aplica a ação do jogador da vez e leva o estado até a próxima decisão.
 *
 * Não recebe fonte de aleatoriedade: o baralho já foi embaralhado no início da
 * mão, então nada aqui dentro sorteia coisa alguma. Quem sorteia é a decisão do
 * bot, e isso é responsabilidade de quem chama.
 */
export function applyAction(state: TournamentState, action: PlayerAction): TournamentState {
  const actor = currentActor(state)
  if (!actor) return state

  const next = clone(state)
  const player = next.players[next.actorIndex as number]
  const options = actionOptions(next, player)

  switch (action.type) {
    case 'fold': {
      player.folded = true
      player.lastAct = { kind: 'fold', amount: 0 }
      log(next, `${player.name} desiste`)
      break
    }
    case 'check': {
      if (!options.canCheck) return state
      player.lastAct = { kind: 'check', amount: 0 }
      log(next, `${player.name} passa`)
      break
    }
    case 'call': {
      const paid = commit(player, options.callAmount)
      player.lastAct = paid > 0 ? { kind: 'call', amount: paid } : { kind: 'check', amount: 0 }
      log(
        next,
        paid > 0
          ? `${player.name} paga ${paid}${player.allIn ? ' (all-in)' : ''}`
          : `${player.name} passa`,
      )
      break
    }
    case 'bet':
    case 'raise':
    case 'allin': {
      const requested =
        action.type === 'allin' ? options.maxRaiseTo : (action.amount ?? options.minRaiseTo)
      const floor = Math.min(options.minRaiseTo || 1, options.maxRaiseTo)
      const raiseTo = clamp(requested, floor, options.maxRaiseTo)

      // Stack curto demais para aumentar: o all-in vira só um pagamento
      // parcial, e o texto precisa dizer isso em vez de anunciar uma aposta.
      if (raiseTo <= player.betThisRound || raiseTo <= next.currentBet) {
        const paid = commit(player, options.callAmount)
        player.lastAct = paid > 0 ? { kind: 'call', amount: paid } : { kind: 'check', amount: 0 }
        log(
          next,
          paid > 0
            ? `${player.name} paga ${paid}${player.allIn ? ' (all-in)' : ''}`
            : `${player.name} passa`,
        )
        break
      }

      const increment = raiseTo - player.betThisRound
      const paid = commit(player, increment)
      const previousBet = next.currentBet
      const isRaise = previousBet > 0

      if (player.betThisRound > previousBet) {
        const raiseSize = player.betThisRound - previousBet
        // Um all-in curto (menor que o aumento mínimo) sobe a aposta, mas não
        // deveria reabrir a ação de quem já pagou. Aqui a regra é simplificada:
        // só um aumento cheio zera o `hasActed` da mesa.
        if (raiseSize >= next.minRaise) {
          next.minRaise = raiseSize
          for (const other of next.players) {
            if (other.id !== player.id && other.inHand && !other.folded && !other.allIn) {
              other.hasActed = false
            }
          }
        }
        next.currentBet = player.betThisRound
        next.lastAggressorId = player.id
      }

      const verb = isRaise ? 'aumenta para' : 'aposta'
      player.lastAct = {
        kind: isRaise ? 'raise' : 'bet',
        amount: player.betThisRound,
      }
      log(
        next,
        `${player.name} ${verb} ${player.betThisRound}${player.allIn ? ' (all-in)' : ''} [+${paid}]`,
      )
      break
    }
  }

  player.hasActed = true
  return settleIfRoundOver(next)
}

function commit(player: TournamentPlayer, amount: number): number {
  const paid = Math.max(0, Math.min(amount, player.stack))
  player.stack -= paid
  player.betThisRound += paid
  player.committed += paid
  if (player.stack === 0) player.allIn = true
  return paid
}

/**
 * Depois de cada ação: ou existe alguém para agir, ou a rua acabou.
 *
 * Quando a rua acaba com menos de dois jogadores capazes de apostar (todos
 * all-in), não há mais decisão nenhuma — o board é aberto até o river de uma
 * vez e a mão vai direto para o showdown.
 */
function settleIfRoundOver(state: TournamentState): TournamentState {
  let next = state

  for (;;) {
    if (contenders(next).length <= 1) return finishHand(next)

    const pending = nextPendingIndex(next)
    if (pending >= 0) {
      next.actorIndex = pending
      next.phase = 'acting'
      return next
    }

    // Rua encerrada.
    if (next.street === 'river') return finishHand(next)

    const canStillBet = actors(next).filter((p) => p.stack > 0)
    const everyoneCommitted = canStillBet.length <= 1

    next = openNextStreet(next)

    if (everyoneCommitted) {
      // Ninguém mais aposta: corre o board inteiro e mostra as cartas.
      while (next.street !== 'river') next = openNextStreet(next)
      return finishHand(next)
    }
  }
}

/**
 * Próximo jogador que deve agir, a partir de quem agiu por último.
 *
 * "Deve agir" = está na mão, não está all-in e ou ainda não falou nesta rua ou
 * tem aposta a pagar. A big blind entra nesse critério pelo `hasActed`: mesmo
 * sem aposta a pagar, ela ainda não falou, e é isso que lhe dá a opção.
 */
function nextPendingIndex(state: TournamentState): number {
  const n = state.players.length
  const start = state.actorIndex === null || state.actorIndex < 0 ? state.buttonIndex : state.actorIndex

  for (let step = 1; step <= n; step += 1) {
    const idx = (start + step) % n
    const p = state.players[idx]
    if (!p.inHand || p.folded || p.allIn) continue
    if (!p.hasActed || p.betThisRound < state.currentBet) return idx
  }
  return -1
}

function openNextStreet(state: TournamentState): TournamentState {
  const next = state
  const order: Street[] = ['preflop', 'flop', 'turn', 'river']
  const idx = order.indexOf(next.street)
  next.street = order[Math.min(idx + 1, order.length - 1)]

  // Queimar carta antes de cada rua não muda a matemática, mas é a regra da
  // mesa e mantém o baralho coerente com o que se vê num hand history real.
  next.deck.pop()
  const count = next.street === 'flop' ? 3 : 1
  for (let i = 0; i < count; i += 1) {
    const card = next.deck.pop()
    if (card) next.board.push(card)
  }

  for (const p of next.players) {
    p.betThisRound = 0
    p.hasActed = false
    p.lastAct = null
  }
  next.currentBet = 0
  next.minRaise = blindsOf(next).bb
  next.lastAggressorId = null
  // Pós-flop a ação começa à esquerda do botão.
  next.actorIndex = next.buttonIndex

  const label = { flop: 'FLOP', turn: 'TURN', river: 'RIVER', preflop: 'PRÉ-FLOP' }[next.street]
  log(next, `${label} — ${next.board.map(cardId).join(' ')}`, 'street')

  return next
}

/**
 * Divide o pote em camadas por contribuição total.
 *
 * As fichas de quem desistiu continuam no pote (por isso a soma usa todos os
 * jogadores), mas ele não é elegível a receber nenhuma camada.
 */
export function buildPots(players: TournamentPlayer[]): PotShare[] {
  const levels = [...new Set(players.map((p) => p.committed).filter((c) => c > 0))].sort(
    (a, b) => a - b,
  )

  const pots: PotShare[] = []
  let previous = 0

  for (const level of levels) {
    let amount = 0
    for (const p of players) {
      amount += Math.max(0, Math.min(p.committed, level) - Math.min(p.committed, previous))
    }
    const eligible = players
      .filter((p) => !p.folded && p.inHand && p.committed >= level)
      .map((p) => p.id)

    if (amount > 0 && eligible.length > 0) {
      pots.push({
        amount,
        eligible,
        label: pots.length === 0 ? 'Pote principal' : `Pote lateral ${pots.length}`,
      })
    }
    previous = level
  }

  return pots
}

function finishHand(state: TournamentState): TournamentState {
  const next = state
  next.phase = 'handOver'
  next.actorIndex = null

  refundUncalled(next)

  const live = contenders(next)
  const pots = buildPots(next.players)
  const payouts = new Map<string, number>()
  const shown: ShowdownEntry[] = []
  const showdown = live.length > 1

  if (showdown) {
    for (const p of live) {
      const hand = evaluate7([...p.hole, ...next.board])
      shown.push({ playerId: p.id, hand, description: describeHand(hand) })
    }
  }

  const scoreById = new Map(shown.map((s) => [s.playerId, s.hand.score]))

  for (const pot of pots) {
    const eligible = live.filter((p) => pot.eligible.includes(p.id))
    if (eligible.length === 0) continue

    let winners: TournamentPlayer[]
    if (!showdown) {
      winners = eligible
    } else {
      const best = Math.max(...eligible.map((p) => scoreById.get(p.id) ?? 0))
      winners = eligible.filter((p) => (scoreById.get(p.id) ?? 0) === best)
    }

    const share = Math.floor(pot.amount / winners.length)
    // A sobra de divisão vai para o primeiro vencedor à esquerda do botão, que
    // é a convenção da mesa — e evita que fichas somem do torneio.
    let remainder = pot.amount - share * winners.length

    for (const winner of winners) {
      const extra = remainder > 0 ? 1 : 0
      remainder -= extra
      const amount = share + extra
      winner.stack += amount
      payouts.set(winner.id, (payouts.get(winner.id) ?? 0) + amount)
    }
  }

  const headline = buildHeadline(next, payouts, shown, showdown)
  log(next, headline, 'result')

  const busted = next.players.filter((p) => p.inHand && p.stack === 0).map((p) => p.id)
  recordEliminations(next, busted)

  next.outcome = {
    showdown,
    board: next.board.slice(),
    shown,
    payouts: [...payouts.entries()].map(([playerId, amount]) => ({ playerId, amount })),
    headline,
    busted,
  }

  const stillPlaying = next.players.filter((p) => p.stack > 0)
  if (stillPlaying.length <= 1) return finishTournament(next)

  return next
}

/**
 * Devolve a parte da aposta que ninguém cobriu.
 *
 * Sem isso, quem aposta 500 num pote onde o adversário só tinha 200 "ganharia"
 * as próprias 300 de volta como se fossem lucro — e o log mentiria sobre o
 * tamanho do pote.
 */
function refundUncalled(state: TournamentState) {
  const committed = state.players.map((p) => p.committed).sort((a, b) => b - a)
  if (committed.length < 2) return
  const cap = committed[1]
  for (const p of state.players) {
    if (p.committed > cap) {
      const back = p.committed - cap
      p.committed = cap
      p.stack += back
      if (p.stack > 0) p.allIn = false
      log(state, `Aposta não paga de ${back} volta para ${p.name}`)
    }
  }
}

function buildHeadline(
  state: TournamentState,
  payouts: Map<string, number>,
  shown: ShowdownEntry[],
  showdown: boolean,
): string {
  const entries = [...payouts.entries()].sort((a, b) => b[1] - a[1])
  if (entries.length === 0) return 'Mão encerrada.'

  const describe = ([id, amount]: [string, number]) => {
    const player = state.players.find((p) => p.id === id)
    const name = player?.isHuman ? 'Você' : (player?.name ?? '?')
    const hand = shown.find((s) => s.playerId === id)
    if (showdown && hand) return `${name} leva ${amount} com ${hand.description.toLowerCase()}`
    return `${name} leva ${amount} sem showdown`
  }

  if (entries.length === 1) return describe(entries[0])
  return `Pote dividido: ${entries.map(describe).join(' · ')}`
}

function recordEliminations(state: TournamentState, busted: string[]) {
  if (busted.length === 0) return

  // Quem quebra na mesma mão empata na colocação; desempatamos por stack no
  // início da mão (quem tinha mais, cai melhor colocado).
  const remaining = state.players.filter((p) => p.stack > 0).length
  const ordered = busted.slice().sort((a, b) => {
    const pa = state.players.find((p) => p.id === a)
    const pb = state.players.find((p) => p.id === b)
    return (pb?.committed ?? 0) - (pa?.committed ?? 0)
  })

  ordered.forEach((id, i) => {
    const player = state.players.find((p) => p.id === id)
    if (player && player.place === null) {
      player.place = remaining + 1 + i
      log(state, `${player.name} está eliminado em ${player.place}º`, 'system')
    }
  })
}

function finishTournament(state: TournamentState): TournamentState {
  const next = state
  next.phase = 'over'
  next.actorIndex = null

  const champion = next.players.find((p) => p.stack > 0)
  if (champion && champion.place === null) champion.place = 1

  next.finished = next.players
    .slice()
    .sort((a, b) => (a.place ?? 99) - (b.place ?? 99))
    .map((p) => p.id)

  return next
}

/** Nome do assento do jogador nesta mão — o que a mesa mostra. */
export function seatNameOf(state: TournamentState, playerId: string): string | null {
  const seat = seatIndexOf(state, playerId)
  return seat === null ? null : seatName(seat, state.players.filter((p) => p.inHand).length)
}

/** Posição do jogador na mesa desta mão — o balde usado pela análise. */
export function positionOf(state: TournamentState, playerId: string): Position | null {
  const seat = seatIndexOf(state, playerId)
  if (seat === null) return null
  return seatLabel(seat, state.players.filter((p) => p.inHand).length)
}

/**
 * Assento do jogador contado a partir do botão.
 *
 * O índice 0 é a small blind e o último é o botão — a ordem em que se fala
 * depois do flop, que é a ordem que define posição.
 */
function seatIndexOf(state: TournamentState, playerId: string): number | null {
  const index = state.players.findIndex((p) => p.id === playerId)
  if (index < 0 || !state.players[index].inHand) return null

  const order: number[] = []
  const n = state.players.length
  for (let step = 1; step <= n; step += 1) {
    const idx = (state.buttonIndex + step) % n
    if (state.players[idx].inHand) order.push(idx)
  }
  const seat = order.indexOf(index)
  return seat < 0 ? null : seat
}

/**
 * Nome do assento na mesa, relativo ao botão.
 *
 * `seat` 0 é a small blind e o último assento é o botão. Entre a big blind e o
 * cutoff ficam os assentos do meio, e o nome deles depende de quantos são: numa
 * mesa de nove existem UTG, UTG+1, MP, MP+1 e HJ, enquanto num 5-max só existe
 * o UTG. Rotular três assentos seguidos como "MP" — que era o que acontecia —
 * apaga justamente a diferença que a posição deveria ensinar.
 */
const MIDDLE_SEATS: Record<number, string[]> = {
  1: ['UTG'],
  2: ['UTG', 'MP'],
  3: ['UTG', 'MP', 'HJ'],
  4: ['UTG', 'UTG+1', 'MP', 'HJ'],
  5: ['UTG', 'UTG+1', 'MP', 'MP+1', 'HJ'],
}

export function seatName(seat: number, tableSize: number): string {
  if (tableSize <= 2) return seat === 0 ? 'SB' : 'BB'
  if (seat === 0) return 'SB'
  if (seat === 1) return 'BB'
  if (seat === tableSize - 1) return 'BTN'
  if (seat === tableSize - 2) return 'CO'

  const middle = MIDDLE_SEATS[tableSize - 4]
  return middle?.[seat - 2] ?? 'MP'
}

/**
 * O balde da fórmula de Chen para um assento.
 *
 * Deriva do nome do assento para que os dois nunca discordem: a mesa mostra
 * "HJ" e o treino cobra o limiar de MP, mas é a mesma decisão de range. UTG+1
 * cai em UTG e o HJ cai em MP — a escolha conservadora, já que nenhum dos dois
 * tem a liberdade do cutoff.
 */
export function seatLabel(seat: number, tableSize: number): Position {
  const name = seatName(seat, tableSize)
  if (name.startsWith('UTG')) return 'UTG'
  if (name.startsWith('MP') || name === 'HJ') return 'MP'
  return name as Position
}
