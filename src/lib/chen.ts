/**
 * Fórmula de Chen — força da mão inicial em um número só.
 *
 * Não é a verdade absoluta do pré-flop (o certo seria uma tabela de ranges),
 * mas é aritmética que cabe na cabeça de quem está aprendendo: dá para refazer
 * a conta na mesa e entender *por que* K7o não abre no UTG. Um range decorado
 * não ensina isso.
 */

import type { Card } from './cards'
import { holeNotation, isSuited } from './cards'

export type Position = 'UTG' | 'MP' | 'CO' | 'BTN' | 'SB' | 'BB'

/** Limiar de abertura (raise se score >= limiar). Quanto mais cedo, mais apertado. */
export const OPEN_THRESHOLDS: Record<Position, number> = {
  UTG: 9,
  MP: 8,
  CO: 7,
  BTN: 5,
  SB: 6,
  // O BB nunca "abre" — quando chega nele, ou houve raise ou ele fecha o pote
  // no check. Fica com o limiar do SB só para não deixar o tipo incompleto.
  BB: 6,
}

/** Posições que o treino sorteia — o BB fica de fora porque não tem abertura. */
export const TRAINABLE_POSITIONS: Position[] = ['UTG', 'MP', 'CO', 'BTN', 'SB']

export const POSITION_NAME: Record<Position, string> = {
  UTG: 'UTG (primeiro a falar)',
  MP: 'MP (meio da mesa)',
  CO: 'CO (cutoff)',
  BTN: 'BTN (botão)',
  SB: 'SB (small blind)',
  BB: 'BB (big blind)',
}

export const POSITION_HINT: Record<Position, string> = {
  UTG: 'Fala primeiro e tem a mesa inteira atrás: só mão forte sobrevive.',
  MP: 'Ainda há gente para agir depois — abertura apertada.',
  CO: 'Só o botão e as blinds atrás: já dá para abrir mais largo.',
  BTN: 'Melhor posição da mesa: age por último em todas as ruas.',
  SB: 'Fora de posição em todas as ruas seguintes; abre menos do que parece.',
  BB: 'Já pagou a aposta obrigatória — a decisão aqui é defender, não abrir.',
}

/** Pontos da carta mais alta, como define a fórmula. */
function highCardPoints(rank: number): number {
  if (rank === 14) return 10
  if (rank === 13) return 8
  if (rank === 12) return 7
  if (rank === 11) return 6
  return rank / 2
}

export interface ChenBreakdown {
  score: number
  notation: string
  /** Linhas da conta, na ordem, para mostrar o cálculo ao usuário. */
  steps: string[]
}

/** Score de Chen com o passo a passo do cálculo. */
export function chenScore(a: Card, b: Card): ChenBreakdown {
  const [high, low] = a.rank >= b.rank ? [a, b] : [b, a]
  const paired = high.rank === low.rank
  const suited = isSuited(a, b)
  const steps: string[] = []

  let score = highCardPoints(high.rank)
  steps.push(`Carta mais alta: ${points(score)}`)

  if (paired) {
    const doubled = Math.max(score * 2, 5)
    steps.push(`Par: dobra para ${formatPoints(doubled)} (mínimo 5)`)
    score = doubled
  } else if (suited) {
    score += 2
    steps.push('Mesmo naipe: +2')
  } else {
    // Dizer que não houve bônus é tão importante quanto dizer que houve: sem
    // esta linha, a conta parece pular um passo.
    steps.push('Naipes diferentes: sem bônus')
  }

  const gap = paired ? 0 : high.rank - low.rank - 1
  if (!paired) {
    const penalty = gapPenalty(gap)
    if (penalty !== 0) {
      score += penalty
      steps.push(`Intervalo de ${gap === 1 ? '1 carta' : `${gap} cartas`}: ${penalty}`)
    } else {
      steps.push('Cartas conectadas: sem desconto')
    }

    // Bônus de conectividade: mãos baixas e ligadas ganham valor porque fazem
    // sequência, mas só quando nenhuma das cartas é figura alta demais para o
    // desconto de intervalo já ter sido justo.
    if (gap <= 1 && high.rank <= 12) {
      score += 1
      steps.push('Conectada e sem carta acima de Q: +1')
    }
  }

  score = Math.max(0, Math.round(score * 2) / 2)
  steps.push(`Total: ${formatPoints(score)}`)

  return { score, notation: holeNotation(a, b), steps }
}

function gapPenalty(gap: number): number {
  if (gap <= 0) return 0
  if (gap === 1) return -1
  if (gap === 2) return -2
  if (gap === 3) return -4
  return -5
}

function formatPoints(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(1)
}

function points(value: number): string {
  return `${formatPoints(value)} ${value === 1 ? 'ponto' : 'pontos'}`
}

export type PreflopAdvice = 'raise' | 'fold'

export interface PreflopVerdict {
  advice: PreflopAdvice
  score: number
  threshold: number
  notation: string
  steps: string[]
  explanation: string
}

/** A recomendação do "manual": abre se o score alcança o limiar da posição. */
export function preflopVerdict(a: Card, b: Card, position: Position): PreflopVerdict {
  const { score, notation, steps } = chenScore(a, b)
  const threshold = OPEN_THRESHOLDS[position]
  const advice: PreflopAdvice = score >= threshold ? 'raise' : 'fold'

  const distance = Math.abs(score - threshold)
  const explanation =
    advice === 'raise'
      ? `${notation} vale ${formatPoints(score)} e o ${position} pede ${threshold}: é abertura, com ${formatPoints(distance)} de folga.`
      : `${notation} vale ${formatPoints(score)} e o ${position} pede ${threshold}: faltam ${formatPoints(distance)} pontos. Descarte sem dó.`

  return { advice, score, threshold, notation, steps, explanation }
}
