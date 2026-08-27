/**
 * Avaliador de mãos — a peça de que tudo mais depende.
 *
 * Estratégia: avaliar 5 cartas produz um número único ("score"); avaliar 7
 * cartas é escolher o maior score entre as C(7,5)=21 combinações possíveis.
 * É força bruta, mas 21 avaliações por mão é barato até dentro do Monte Carlo
 * dos bots, e a correção é fácil de verificar em teste — o que importa mais
 * aqui do que microssegundos.
 *
 * O score é um inteiro em base 15: categoria como dígito mais significativo,
 * seguida dos cinco ranks em ordem de importância. Assim comparar duas mãos é
 * `a > b`, sem regra especial de desempate espalhada pelo código.
 */

import type { Card } from './cards'
import { rankName } from './cards'

export const HandCategory = {
  HIGH_CARD: 0,
  PAIR: 1,
  TWO_PAIR: 2,
  TRIPS: 3,
  STRAIGHT: 4,
  FLUSH: 5,
  FULL_HOUSE: 6,
  QUADS: 7,
  STRAIGHT_FLUSH: 8,
} as const

export type HandCategoryValue = (typeof HandCategory)[keyof typeof HandCategory]

export const CATEGORY_NAME: Record<number, string> = {
  0: 'Carta alta',
  1: 'Um par',
  2: 'Dois pares',
  3: 'Trinca',
  4: 'Sequência',
  5: 'Flush',
  6: 'Full house',
  7: 'Quadra',
  8: 'Straight flush',
}

export interface HandResult {
  /** Número comparável: maior é melhor. */
  score: number
  category: number
  /** Os cinco ranks em ordem de importância para desempate. */
  ranks: number[]
  /** As cinco cartas que formam a mão (útil para destacar na mesa). */
  cards: Card[]
}

const BASE = 15

function encode(category: number, ranks: number[]): number {
  let score = category
  for (let i = 0; i < 5; i += 1) score = score * BASE + (ranks[i] ?? 0)
  return score
}

/**
 * Avalia exatamente 5 cartas.
 *
 * Exportada porque o teste do avaliador de 7 cartas se apoia nela, e porque o
 * módulo de Ranking de Mãos usa para rotular exemplos.
 */
export function evaluate5(cards: Card[]): HandResult {
  if (cards.length !== 5) throw new Error('evaluate5 espera exatamente 5 cartas')

  const ranks = cards.map((c) => c.rank).sort((a, b) => b - a)
  const isFlush = cards.every((c) => c.suit === cards[0].suit)

  // Contagem por rank, ordenada por (quantidade, rank) — resolve par/trinca/full
  // e já entrega os kickers na ordem certa.
  const counts = new Map<number, number>()
  for (const rank of ranks) counts.set(rank, (counts.get(rank) ?? 0) + 1)

  const groups = [...counts.entries()].sort((a, b) => b[1] - a[1] || b[0] - a[0])
  const shape = groups.map(([, count]) => count)
  const ordered = groups.flatMap(([rank, count]) => Array<number>(count).fill(rank))

  const straightHigh = straightHighCard(ranks)

  if (isFlush && straightHigh) {
    return result(HandCategory.STRAIGHT_FLUSH, [straightHigh, 0, 0, 0, 0], cards)
  }
  if (shape[0] === 4) return result(HandCategory.QUADS, [ordered[0], ordered[4], 0, 0, 0], cards)
  if (shape[0] === 3 && shape[1] === 2) {
    return result(HandCategory.FULL_HOUSE, [ordered[0], ordered[3], 0, 0, 0], cards)
  }
  if (isFlush) return result(HandCategory.FLUSH, ranks, cards)
  if (straightHigh) return result(HandCategory.STRAIGHT, [straightHigh, 0, 0, 0, 0], cards)
  if (shape[0] === 3) {
    return result(HandCategory.TRIPS, [ordered[0], ordered[3], ordered[4], 0, 0], cards)
  }
  if (shape[0] === 2 && shape[1] === 2) {
    return result(HandCategory.TWO_PAIR, [ordered[0], ordered[2], ordered[4], 0, 0], cards)
  }
  if (shape[0] === 2) {
    return result(HandCategory.PAIR, [ordered[0], ordered[2], ordered[3], ordered[4], 0], cards)
  }
  return result(HandCategory.HIGH_CARD, ranks, cards)
}

function result(category: number, ranks: number[], cards: Card[]): HandResult {
  return { score: encode(category, ranks), category, ranks, cards }
}

/**
 * Carta mais alta da sequência, ou 0 se não há sequência.
 *
 * A roda (A-2-3-4-5) é o caso especial que todo avaliador ingênuo erra: o Ás
 * vale 14 em toda parte, menos aqui, onde a sequência é encabeçada pelo 5.
 */
function straightHighCard(sortedDesc: number[]): number {
  const unique = [...new Set(sortedDesc)]
  if (unique.length !== 5) return 0

  if (unique[0] - unique[4] === 4) return unique[0]
  if (unique[0] === 14 && unique[1] === 5 && unique[4] === 2) return 5

  return 0
}

/** Índices das 21 combinações de 5 cartas dentro de 7 — calculado uma vez. */
const COMBOS_7_5: number[][] = (() => {
  const combos: number[][] = []
  for (let a = 0; a < 7; a += 1) {
    for (let b = a + 1; b < 7; b += 1) {
      for (let c = b + 1; c < 7; c += 1) {
        for (let d = c + 1; d < 7; d += 1) {
          for (let e = d + 1; e < 7; e += 1) combos.push([a, b, c, d, e])
        }
      }
    }
  }
  return combos
})()

/** Melhor mão de 5 cartas dentro de 6 ou 7 cartas (2 na mão + board). */
export function evaluate7(cards: Card[]): HandResult {
  if (cards.length === 5) return evaluate5(cards)
  if (cards.length < 5) throw new Error('É preciso ao menos 5 cartas para avaliar')

  if (cards.length === 7) {
    let best: HandResult | null = null
    for (const combo of COMBOS_7_5) {
      const hand = evaluate5([
        cards[combo[0]],
        cards[combo[1]],
        cards[combo[2]],
        cards[combo[3]],
        cards[combo[4]],
      ])
      if (!best || hand.score > best.score) best = hand
    }
    return best as HandResult
  }

  // 6 cartas (turn com mão incompleta, ou análise de mão importada): mesma
  // ideia, combinações geradas na hora.
  let best: HandResult | null = null
  const n = cards.length
  for (let a = 0; a < n; a += 1) {
    for (let b = a + 1; b < n; b += 1) {
      for (let c = b + 1; c < n; c += 1) {
        for (let d = c + 1; d < n; d += 1) {
          for (let e = d + 1; e < n; e += 1) {
            const hand = evaluate5([cards[a], cards[b], cards[c], cards[d], cards[e]])
            if (!best || hand.score > best.score) best = hand
          }
        }
      }
    }
  }
  return best as HandResult
}

/** Descrição em português da mão avaliada: "Dois pares, Reis e Setes". */
export function describeHand(hand: HandResult): string {
  const [r1, r2] = hand.ranks

  switch (hand.category) {
    case HandCategory.STRAIGHT_FLUSH:
      return r1 === 14 ? 'Royal flush' : `Straight flush até ${rankName(r1)}`
    case HandCategory.QUADS:
      return `Quadra de ${rankName(r1, true)}`
    case HandCategory.FULL_HOUSE:
      return `Full house, ${rankName(r1, true)} com ${rankName(r2, true)}`
    case HandCategory.FLUSH:
      return `Flush, ${rankName(r1)} alto`
    case HandCategory.STRAIGHT:
      return `Sequência até ${rankName(r1)}`
    case HandCategory.TRIPS:
      return `Trinca de ${rankName(r1, true)}`
    case HandCategory.TWO_PAIR:
      return `Dois pares, ${rankName(r1, true)} e ${rankName(r2, true)}`
    case HandCategory.PAIR:
      return `Par de ${rankName(r1, true)}`
    default:
      return `${rankName(r1)} alto`
  }
}
