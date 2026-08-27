/**
 * Baralho e cartas — a base de tudo no módulo de pôquer.
 *
 * Uma carta é `{ rank, suit }` com rank numérico (2..14) porque toda a lógica
 * do jogo compara ranks: sequência, kicker, gap do Chen. Guardar 'K' como texto
 * obrigaria a converter em cada comparação.
 */

export type Suit = 's' | 'h' | 'd' | 'c'

export interface Card {
  /** 2..14, onde 11=J, 12=Q, 13=K, 14=A. */
  rank: number
  suit: Suit
}

export const SUITS: Suit[] = ['s', 'h', 'd', 'c']

/** Símbolo de cada naipe, para renderizar. */
export const SUIT_SYMBOL: Record<Suit, string> = {
  s: '♠',
  h: '♥',
  d: '♦',
  c: '♣',
}

export const SUIT_NAME: Record<Suit, string> = {
  s: 'espadas',
  h: 'copas',
  d: 'ouros',
  c: 'paus',
}

/** Copas e ouros são vermelhos — usado pela UI e pela acessibilidade. */
export const RED_SUITS: Suit[] = ['h', 'd']

export const isRed = (suit: Suit) => suit === 'h' || suit === 'd'

/** Rótulo curto do rank: 2..9, T, J, Q, K, A. */
export function rankLabel(rank: number): string {
  if (rank <= 9) return String(rank)
  return { 10: 'T', 11: 'J', 12: 'Q', 13: 'K', 14: 'A' }[rank] ?? '?'
}

/** Nome por extenso, para os textos de feedback ("um par de Damas"). */
export function rankName(rank: number, plural = false): string {
  const names: Record<number, [string, string]> = {
    2: ['Dois', 'Dois'],
    3: ['Três', 'Três'],
    4: ['Quatro', 'Quatros'],
    5: ['Cinco', 'Cincos'],
    6: ['Seis', 'Seis'],
    7: ['Sete', 'Setes'],
    8: ['Oito', 'Oitos'],
    9: ['Nove', 'Noves'],
    10: ['Dez', 'Dez'],
    11: ['Valete', 'Valetes'],
    12: ['Dama', 'Damas'],
    13: ['Rei', 'Reis'],
    14: ['Ás', 'Ases'],
  }
  const pair = names[rank]
  if (!pair) return '?'
  return plural ? pair[1] : pair[0]
}

/** Identificador textual no formato do PokerStars: `As`, `Th`, `2c`. */
export function cardId(card: Card): string {
  return `${rankLabel(card.rank)}${card.suit}`
}

const RANK_FROM_LABEL: Record<string, number> = {
  '2': 2,
  '3': 3,
  '4': 4,
  '5': 5,
  '6': 6,
  '7': 7,
  '8': 8,
  '9': 9,
  T: 10,
  '10': 10,
  J: 11,
  Q: 12,
  K: 13,
  A: 14,
}

/** Lê `As`, `10h`, `td` — devolve `null` em vez de lançar: entrada de arquivo é suja. */
export function parseCard(text: string): Card | null {
  const clean = text.trim()
  if (clean.length < 2) return null

  const suitChar = clean.slice(-1).toLowerCase()
  if (!SUITS.includes(suitChar as Suit)) return null

  const rank = RANK_FROM_LABEL[clean.slice(0, -1).toUpperCase()]
  if (!rank) return null

  return { rank, suit: suitChar as Suit }
}

/** Lê uma sequência de cartas separadas por espaço: `[Ah Kd]` ou `Ah Kd`. */
export function parseCards(text: string): Card[] {
  return text
    .replace(/[[\]]/g, ' ')
    .split(/\s+/)
    .filter(Boolean)
    .map(parseCard)
    .filter((c): c is Card => c !== null)
}

export function createDeck(): Card[] {
  const deck: Card[] = []
  for (const suit of SUITS) {
    for (let rank = 2; rank <= 14; rank += 1) deck.push({ rank, suit })
  }
  return deck
}

/** Fonte de aleatoriedade injetável — os testes precisam de resultado repetível. */
export type Rng = () => number

/** Fisher-Yates: embaralhamento uniforme, sem viés das ordenações "aleatórias". */
export function shuffle<T>(items: T[], rng: Rng = Math.random): T[] {
  const copy = items.slice()
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1))
    ;[copy[i], copy[j]] = [copy[j], copy[i]]
  }
  return copy
}

/** Gerador determinístico (mulberry32) para testes e simulações reproduzíveis. */
export function seededRng(seed: number): Rng {
  let state = seed >>> 0
  return () => {
    state = (state + 0x6d2b79f5) >>> 0
    let t = state
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** Baralho sem as cartas já conhecidas — usado pelo Monte Carlo. */
export function deckWithout(known: Card[]): Card[] {
  const blocked = new Set(known.map(cardId))
  return createDeck().filter((card) => !blocked.has(cardId(card)))
}

export function sameCard(a: Card, b: Card): boolean {
  return a.rank === b.rank && a.suit === b.suit
}

/** Duas cartas do mesmo naipe (suited). */
export function isSuited(a: Card, b: Card): boolean {
  return a.suit === b.suit
}

/** Notação de mão inicial: `AKs`, `AKo`, `77`. */
export function holeNotation(a: Card, b: Card): string {
  const [high, low] = a.rank >= b.rank ? [a, b] : [b, a]
  if (high.rank === low.rank) return `${rankLabel(high.rank)}${rankLabel(low.rank)}`
  return `${rankLabel(high.rank)}${rankLabel(low.rank)}${isSuited(a, b) ? 's' : 'o'}`
}
