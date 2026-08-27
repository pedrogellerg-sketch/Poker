/**
 * Parser de hand history do PokerStars.
 *
 * O arquivo que o cliente salva é texto corrido, uma mão atrás da outra, com
 * marcadores fixos (`*** FLOP ***`, `*** SHOW DOWN ***`). Isso é bom: dá para
 * ler linha a linha sem gramática nenhuma.
 *
 * Três decisões que valem explicação:
 *
 * 1. **Nada lança exceção.** Um arquivo real tem mão de torneio, de cash game,
 *    de variante que não sabemos ler e linha cortada no meio. Uma mão que não
 *    dá para entender é descartada; as outras 400 continuam valendo.
 * 2. **As blinds ficam fora da lista de ações.** Elas são obrigatórias — não
 *    são decisão de ninguém, e a análise só julga decisões.
 * 3. **O pote e o valor a pagar são recalculados** enquanto lemos as ações. O
 *    arquivo não traz esses números por ação, e sem eles não existe pot odds.
 */

import { todayISO } from './date'

import type { Card } from './cards'
import { parseCards } from './cards'
import type { Position } from './chen'
import { seatLabel } from './tournament'

export type ParsedStreet = 'preflop' | 'flop' | 'turn' | 'river'

export type ParsedActionType = 'fold' | 'check' | 'call' | 'bet' | 'raise'

export interface ParsedAction {
  player: string
  type: ParsedActionType
  /** Fichas que esta ação colocou no pote. */
  amount: number
  /** Para bet/raise: total apostado na rua depois da ação. */
  to: number
  allIn: boolean
  /** Pote antes da ação — base do cálculo de pot odds. */
  potBefore: number
  /** Quanto era preciso pagar para continuar. */
  toCall: number
}

export interface ParsedPlayer {
  seat: number
  name: string
  stack: number
  position: Position
  isHero: boolean
  /** Total que colocou no pote (já descontada a aposta devolvida). */
  contributed: number
  collected: number
}

export interface ParsedHand {
  id: string
  /** Cabeçalho original, útil para mostrar a mão "crua". */
  raw: string
  isTournament: boolean
  tournamentId: string | null
  tableName: string
  playedAt: string
  /** Data local `YYYY-MM-DD` da mão — a chave por onde a evolução a agrupa. */
  playedOn: string
  smallBlind: number
  bigBlind: number
  currency: string
  buttonSeat: number
  players: ParsedPlayer[]
  heroName: string
  heroCards: Card[]
  heroPosition: Position
  heroContributed: number
  heroCollected: number
  /** Lucro (positivo) ou prejuízo (negativo) do herói nesta mão. */
  heroNet: number
  streets: Record<ParsedStreet, ParsedAction[]>
  /** Board conhecido ao final de cada rua. */
  boards: Record<ParsedStreet, Card[]>
  board: Card[]
  showdown: boolean
  shown: { name: string; cards: Card[] }[]
  winners: { name: string; amount: number }[]
  totalPot: number
  rake: number
  /** Aposta não paga devolvida ao herói. */
  uncalledReturned: number
}

export interface ParseReport {
  hands: ParsedHand[]
  /** Blocos que não deram para ler — número e o motivo mais provável. */
  skipped: number
  reasons: string[]
}

const HEADER = /^(?:PokerStars|POKERSTARS)[^\n]*?Hand\s+#(\d+)/

/** Quebra o arquivo em blocos, um por mão. */
export function splitHands(text: string): string[] {
  const normalized = text.replace(/\r\n?/g, '\n')
  const lines = normalized.split('\n')
  const blocks: string[] = []
  let current: string[] = []

  for (const line of lines) {
    if (HEADER.test(line)) {
      if (current.length) blocks.push(current.join('\n'))
      current = [line]
    } else if (current.length) {
      current.push(line)
    }
  }
  if (current.length) blocks.push(current.join('\n'))

  return blocks.filter((b) => b.trim().length > 0)
}

/** Lê o texto inteiro e devolve só as mãos que deram para entender. */
export function parseHandHistory(text: string): ParsedHand[] {
  return parseHandHistoryWithReport(text).hands
}

export function parseHandHistoryWithReport(text: string): ParseReport {
  const blocks = splitHands(text)
  const hands: ParsedHand[] = []
  const reasons = new Set<string>()
  let skipped = 0

  for (const block of blocks) {
    const parsed = parseSingleHand(block)
    if (parsed.hand) hands.push(parsed.hand)
    else {
      skipped += 1
      if (parsed.reason) reasons.add(parsed.reason)
    }
  }

  return { hands, skipped, reasons: [...reasons] }
}

interface SingleResult {
  hand: ParsedHand | null
  reason?: string
}

function parseSingleHand(block: string): SingleResult {
  const lines = block.split('\n')
  const header = lines[0] ?? ''

  const idMatch = header.match(HEADER)
  if (!idMatch) return { hand: null, reason: 'cabeçalho não reconhecido' }

  if (!/Hold'?em No Limit/i.test(header)) {
    return { hand: null, reason: 'só lemos Texas Hold\'em no-limit' }
  }

  const isTournament = /Tournament\s+#(\d+)/i.test(header)
  const tournamentId = header.match(/Tournament\s+#(\d+)/i)?.[1] ?? null

  // Blinds: torneio traz `Level III (25/50)`, cash traz `($0.05/$0.10 USD)`.
  const blindMatch =
    header.match(/\((?:[^)]*?)?([\d.,]+)\s*\/\s*[^\d]*([\d.,]+)[^)]*\)\s*-\s*\d{4}\//) ??
    header.match(/\(\$?([\d.,]+)\/\$?([\d.,]+)/)
  if (!blindMatch) return { hand: null, reason: 'blinds não encontradas no cabeçalho' }

  const smallBlind = toNumber(blindMatch[1])
  const bigBlind = toNumber(blindMatch[2])
  const currency = /\$/.test(header) && !isTournament ? '$' : 'fichas'
  const playedAt = header.match(/(\d{4}\/\d{2}\/\d{2}\s+\d{2}:\d{2}:\d{2})/)?.[1] ?? ''
  // `2024/03/15 20:11:03` → `2024-03-15`. Sem data no cabeçalho (formato
  // estranho, arquivo truncado), a mão conta no dia em que foi importada: é
  // melhor que sumir da linha do tempo.
  const playedOn = playedAt ? playedAt.slice(0, 10).replace(/\//g, '-') : todayISO()

  const tableLine = lines.find((l) => l.startsWith('Table '))
  const tableName = tableLine?.match(/Table\s+'([^']+)'/)?.[1] ?? '—'
  const buttonSeat = Number(tableLine?.match(/Seat\s+#(\d+)\s+is the button/)?.[1] ?? 0)

  const seats: { seat: number; name: string; stack: number }[] = []
  for (const line of lines) {
    const seatMatch = line.match(/^Seat\s+(\d+):\s+(.+?)\s+\(\$?([\d.,]+)\s+in chips\)/)
    if (!seatMatch) continue
    if (/is sitting out/i.test(line)) continue
    seats.push({
      seat: Number(seatMatch[1]),
      name: seatMatch[2].trim(),
      stack: toNumber(seatMatch[3]),
    })
  }
  if (seats.length < 2) return { hand: null, reason: 'menos de dois jogadores na mesa' }

  const heroName = block.match(/Dealt to (.+?) \[/)?.[1]?.trim() ?? ''
  const heroCards = parseCards(block.match(/Dealt to .+? \[([^\]]+)\]/)?.[1] ?? '')

  // Posições saem da ordem dos assentos a partir do botão.
  const ordered = orderFromButton(seats, buttonSeat)
  const positionByName = new Map<string, Position>()
  ordered.forEach((entry, index) => {
    positionByName.set(entry.name, seatLabel(index, ordered.length))
  })

  const contributions = new Map<string, number>()
  const addContribution = (name: string, amount: number) => {
    contributions.set(name, (contributions.get(name) ?? 0) + amount)
  }

  // Antes e blinds entram no pote, mas não entram na lista de decisões.
  //
  // A distinção importa na hora de calcular o que falta pagar: o ante é pago
  // por todos e não conta como aposta, enquanto a big blind conta — quem só
  // pagou o ante ainda deve a blind inteira.
  const postedBlinds = new Map<string, number>()
  for (const line of lines) {
    const post = line.match(
      /^(.+?): posts (?:the )?(ante|small blind|big blind|small & big blinds) \$?([\d.,]+)/,
    )
    if (!post) continue
    const name = post[1].trim()
    const amount = toNumber(post[3])
    addContribution(name, amount)
    if (post[2] !== 'ante') postedBlinds.set(name, (postedBlinds.get(name) ?? 0) + amount)
  }

  const streets: Record<ParsedStreet, ParsedAction[]> = {
    preflop: [],
    flop: [],
    turn: [],
    river: [],
  }
  const boards: Record<ParsedStreet, Card[]> = { preflop: [], flop: [], turn: [], river: [] }

  let street: ParsedStreet | 'setup' | 'showdown' | 'summary' = 'setup'
  // Aposta de cada jogador na rua corrente — precisa zerar a cada rua nova.
  let streetBets = new Map<string, number>()
  let streetMax = 0
  const shown: { name: string; cards: Card[] }[] = []
  const winners: { name: string; amount: number }[] = []
  let uncalledReturned = 0
  let totalPot = 0
  let rake = 0
  let showdown = false
  const collected = new Map<string, number>()

  const potSoFar = () => [...contributions.values()].reduce((a, b) => a + b, 0)

  for (const line of lines) {
    if (line.startsWith('*** HOLE CARDS')) {
      street = 'preflop'
      streetBets = new Map(postedBlinds)
      streetMax = Math.max(0, ...postedBlinds.values())
      continue
    }
    if (line.startsWith('*** FLOP')) {
      street = 'flop'
      streetBets = new Map()
      streetMax = 0
      boards.flop = parseCards(line.match(/\[([^\]]+)\]\s*$/)?.[1] ?? '')
      continue
    }
    if (line.startsWith('*** TURN')) {
      street = 'turn'
      streetBets = new Map()
      streetMax = 0
      boards.turn = [...boards.flop, ...parseCards(line.match(/\[([^\]]+)\]\s*$/)?.[1] ?? '')]
      continue
    }
    if (line.startsWith('*** RIVER')) {
      street = 'river'
      streetBets = new Map()
      streetMax = 0
      boards.river = [...boards.turn, ...parseCards(line.match(/\[([^\]]+)\]\s*$/)?.[1] ?? '')]
      continue
    }
    if (line.startsWith('*** SHOW DOWN')) {
      street = 'showdown'
      showdown = true
      continue
    }
    if (line.startsWith('*** SUMMARY')) {
      street = 'summary'
      continue
    }
    if (line.startsWith('***')) continue

    const uncalled = line.match(/^Uncalled bet \(\$?([\d.,]+)\) returned to (.+)$/)
    if (uncalled) {
      const amount = toNumber(uncalled[1])
      const name = uncalled[2].trim()
      addContribution(name, -amount)
      if (name === heroName) uncalledReturned += amount
      continue
    }

    const won = line.match(/^(.+?) collected \$?([\d.,]+) from(?: the)? pot/)
    if (won) {
      const name = won[1].trim()
      const amount = toNumber(won[2])
      collected.set(name, (collected.get(name) ?? 0) + amount)
      continue
    }

    // No resumo o vencedor aparece como `... and won ($1300) with ...`.
    const summaryWon = line.match(/^Seat \d+: (.+?)(?:\s+\([^)]*\))? (?:showed|mucked).*?won \(\$?([\d.,]+)\)/)
    if (summaryWon && !collected.has(summaryWon[1].trim())) {
      collected.set(summaryWon[1].trim(), toNumber(summaryWon[2]))
    }

    const pot = line.match(/^Total pot \$?([\d.,]+)(?:.*?\|\s*Rake \$?([\d.,]+))?/)
    if (pot) {
      totalPot = toNumber(pot[1])
      rake = pot[2] ? toNumber(pot[2]) : 0
      continue
    }

    const showsMatch = line.match(/^(.+?): (?:shows|mucks) \[([^\]]+)\]/) ?? line.match(/^Seat \d+: (.+?)(?:\s+\([^)]*\))? (?:showed|mucked) \[([^\]]+)\]/)
    if (showsMatch) {
      const name = showsMatch[1].trim()
      if (!shown.some((s) => s.name === name)) {
        shown.push({ name, cards: parseCards(showsMatch[2]) })
      }
      continue
    }

    if (street !== 'preflop' && street !== 'flop' && street !== 'turn' && street !== 'river') {
      continue
    }

    const action = parseActionLine(line)
    if (!action) continue

    const already = streetBets.get(action.player) ?? 0
    const toCall = Math.max(0, streetMax - already)
    const potBefore = potSoFar()

    let amount = 0
    let to = already

    switch (action.type) {
      case 'fold':
      case 'check':
        break
      case 'call':
        amount = action.value
        to = already + amount
        break
      case 'bet':
        amount = action.value
        to = already + amount
        break
      case 'raise':
        // `raises 100 to 150`: o total da rua é o segundo número.
        to = action.to ?? already + action.value
        amount = to - already
        break
    }

    if (amount > 0) {
      addContribution(action.player, amount)
      streetBets.set(action.player, to)
      if (to > streetMax) streetMax = to
    }

    streets[street].push({
      player: action.player,
      type: action.type,
      amount,
      to,
      allIn: action.allIn,
      potBefore,
      toCall,
    })
  }

  boards.preflop = []
  const summaryBoard = parseCards(block.match(/^Board \[([^\]]+)\]/m)?.[1] ?? '')
  const board = summaryBoard.length ? summaryBoard : boards.river.length ? boards.river : boards.turn.length ? boards.turn : boards.flop

  for (const [name, amount] of collected) winners.push({ name, amount })
  winners.sort((a, b) => b.amount - a.amount)

  if (totalPot === 0) totalPot = potSoFar()

  const players: ParsedPlayer[] = ordered.map((entry) => ({
    seat: entry.seat,
    name: entry.name,
    stack: entry.stack,
    position: positionByName.get(entry.name) ?? 'MP',
    isHero: entry.name === heroName,
    contributed: contributions.get(entry.name) ?? 0,
    collected: collected.get(entry.name) ?? 0,
  }))

  const heroContributed = contributions.get(heroName) ?? 0
  const heroCollected = collected.get(heroName) ?? 0

  if (!heroName) return { hand: null, reason: 'mão sem "Dealt to" — não dá para saber quem é você' }

  return {
    hand: {
      id: idMatch[1],
      raw: block,
      isTournament,
      tournamentId,
      tableName,
      playedAt,
      playedOn,
      smallBlind,
      bigBlind,
      currency,
      buttonSeat,
      players,
      heroName,
      heroCards,
      heroPosition: positionByName.get(heroName) ?? 'MP',
      heroContributed,
      heroCollected,
      heroNet: heroCollected - heroContributed,
      streets,
      boards,
      board,
      showdown,
      shown,
      winners,
      totalPot,
      rake,
      uncalledReturned,
    },
  }
}

interface RawAction {
  player: string
  type: ParsedActionType
  value: number
  to?: number
  allIn: boolean
}

function parseActionLine(line: string): RawAction | null {
  const match = line.match(
    /^(.+?): (folds|checks|calls|bets|raises)(?:\s+\$?([\d.,]+))?(?:\s+to\s+\$?([\d.,]+))?(.*)$/,
  )
  if (!match) return null

  const [, player, verb, first, second, tail] = match
  const allIn = /and is all-in/i.test(tail ?? '')

  const type: ParsedActionType = {
    folds: 'fold' as const,
    checks: 'check' as const,
    calls: 'call' as const,
    bets: 'bet' as const,
    raises: 'raise' as const,
  }[verb as 'folds' | 'checks' | 'calls' | 'bets' | 'raises']

  return {
    player: player.trim(),
    type,
    value: first ? toNumber(first) : 0,
    to: second ? toNumber(second) : undefined,
    allIn,
  }
}

/**
 * Assentos em ordem de ação, começando na small blind.
 *
 * O arquivo lista os assentos por número, que não é a ordem da mesa: quem fala
 * primeiro depende de onde está o botão. Sem essa rotação, toda posição
 * calculada sairia errada — e a análise do pré-flop inteira depende dela.
 */
function orderFromButton<T extends { seat: number }>(seats: T[], buttonSeat: number): T[] {
  const sorted = seats.slice().sort((a, b) => a.seat - b.seat)
  const buttonIndex = sorted.findIndex((s) => s.seat === buttonSeat)
  if (buttonIndex < 0) return sorted
  return [...sorted.slice(buttonIndex + 1), ...sorted.slice(0, buttonIndex + 1)]
}

/** Aceita `1.500`, `1,500`, `12.50` — o formato varia com a moeda do arquivo. */
function toNumber(text: string): number {
  const clean = text.replace(/\s/g, '')
  // Vírgula como separador de milhar é o caso do PokerStars em inglês.
  if (/^\d{1,3}(,\d{3})+(\.\d+)?$/.test(clean)) return Number(clean.replace(/,/g, ''))
  return Number(clean.replace(',', '.'))
}
