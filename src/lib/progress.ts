/**
 * Evolução no tempo — agregação pura, sem React e sem storage.
 *
 * A pergunta que esta camada responde não é "quantos acertos eu tenho", que o
 * placar da sessão já responde. É "estou melhorando?" — e isso só existe
 * comparando períodos. Por isso tudo aqui é série, nunca total isolado.
 *
 * Períodos vazios entram na série. Um mês sem treino é informação: o buraco no
 * gráfico é a resposta honesta para "por que parei de melhorar".
 */

import type { ISODate } from './date'
import { addDays, fromISODate, startOfWeek, toISODate, todayISO } from './date'

import type { DrillEvent, DrillKind } from './storage'

export type Bucket = 'semana' | 'mes'

export interface KindStat {
  total: number
  correct: number
}

export interface PeriodPoint {
  /** Chave estável do período: `2026-03-16` (segunda) ou `2026-03`. */
  key: string
  /** Rótulo curto para o eixo: `16/03` ou `mar`. */
  label: string
  start: ISODate
  end: ISODate
  drills: KindStat
  byKind: Record<DrillKind, KindStat>
  /** Erros apontados nas mãos importadas jogadas neste período. */
  handErrors: number
  hands: number
}

/** O que a análise das mãos importadas devolve para a linha do tempo. */
export interface HandStat {
  at: ISODate
  errors: number
}

const MONTH_SHORT = [
  'jan',
  'fev',
  'mar',
  'abr',
  'mai',
  'jun',
  'jul',
  'ago',
  'set',
  'out',
  'nov',
  'dez',
]

const KINDS: DrillKind[] = ['preflop', 'outs', 'cenario']

export const KIND_LABEL: Record<DrillKind, string> = {
  preflop: 'Pré-flop',
  outs: 'Outs e pot odds',
  cenario: 'Leitura de jogo',
}

/** Primeiro dia do período que contém a data. */
export function periodStart(iso: ISODate, bucket: Bucket): ISODate {
  if (bucket === 'semana') return startOfWeek(iso)
  return `${iso.slice(0, 7)}-01`
}

function periodEnd(start: ISODate, bucket: Bucket): ISODate {
  if (bucket === 'semana') return addDays(start, 6)
  const date = fromISODate(start)
  // Dia 0 do mês seguinte é o último dia deste mês — evita a tabela de 28/30/31.
  return toISODate(new Date(date.getFullYear(), date.getMonth() + 1, 0))
}

function previousPeriod(start: ISODate, bucket: Bucket): ISODate {
  if (bucket === 'semana') return addDays(start, -7)
  const date = fromISODate(start)
  return toISODate(new Date(date.getFullYear(), date.getMonth() - 1, 1))
}

function labelFor(start: ISODate, bucket: Bucket): string {
  if (bucket === 'semana') return `${start.slice(8, 10)}/${start.slice(5, 7)}`
  return MONTH_SHORT[fromISODate(start).getMonth()]
}

function emptyPoint(start: ISODate, bucket: Bucket): PeriodPoint {
  return {
    key: start,
    label: labelFor(start, bucket),
    start,
    end: periodEnd(start, bucket),
    drills: { total: 0, correct: 0 },
    byKind: {
      preflop: { total: 0, correct: 0 },
      outs: { total: 0, correct: 0 },
      cenario: { total: 0, correct: 0 },
    },
    handErrors: 0,
    hands: 0,
  }
}

/**
 * Os últimos `count` períodos, do mais antigo para o mais recente.
 *
 * A série termina sempre no período de hoje, mesmo vazio: ver a semana atual
 * zerada é o empurrão para treinar, e escondê-la faria o gráfico parecer
 * atualizado quando não está.
 */
export function buildSeries(
  drills: DrillEvent[],
  hands: HandStat[],
  bucket: Bucket,
  count: number,
  today: ISODate = todayISO(),
): PeriodPoint[] {
  const starts: ISODate[] = []
  let cursor = periodStart(today, bucket)
  for (let i = 0; i < count; i += 1) {
    starts.unshift(cursor)
    cursor = previousPeriod(cursor, bucket)
  }

  const points = new Map<string, PeriodPoint>()
  for (const start of starts) points.set(start, emptyPoint(start, bucket))

  const first = starts[0]

  for (const event of drills) {
    const start = periodStart(event.at, bucket)
    if (start < first) continue
    const point = points.get(start)
    if (!point) continue

    point.drills.total += 1
    point.byKind[event.kind].total += 1
    if (event.correct) {
      point.drills.correct += 1
      point.byKind[event.kind].correct += 1
    }
  }

  for (const hand of hands) {
    const start = periodStart(hand.at, bucket)
    if (start < first) continue
    const point = points.get(start)
    if (!point) continue

    point.hands += 1
    point.handErrors += hand.errors
  }

  return starts.map((start) => points.get(start) as PeriodPoint)
}

/** Percentual de acerto, ou `null` quando não houve resposta no período. */
export function accuracy(stat: KindStat): number | null {
  return stat.total > 0 ? (stat.correct / stat.total) * 100 : null
}

export interface Comparison {
  current: KindStat
  previous: KindStat
  /** Diferença em pontos percentuais, ou `null` se faltar base de comparação. */
  delta: number | null
}

/**
 * Compara o último período fechado com o anterior.
 *
 * Usa a série já construída, e não uma consulta nova, para que o número do
 * cabeçalho e a última barra do gráfico nunca discordem.
 */
export function compareLast(series: PeriodPoint[], kind?: DrillKind): Comparison {
  const pick = (point: PeriodPoint | undefined): KindStat =>
    !point ? { total: 0, correct: 0 } : kind ? point.byKind[kind] : point.drills

  const current = pick(series[series.length - 1])
  const previous = pick(series[series.length - 2])

  const a = accuracy(current)
  const b = accuracy(previous)

  return { current, previous, delta: a !== null && b !== null ? a - b : null }
}

export interface LifetimeStats {
  total: number
  correct: number
  byKind: Record<DrillKind, KindStat>
  /** Dias distintos com pelo menos uma resposta. */
  days: number
  /** Dias seguidos treinando, contando de hoje (ou de ontem, se hoje ainda não treinou). */
  streak: number
  firstDay: ISODate | null
}

export function lifetime(drills: DrillEvent[], today: ISODate = todayISO()): LifetimeStats {
  const byKind: Record<DrillKind, KindStat> = {
    preflop: { total: 0, correct: 0 },
    outs: { total: 0, correct: 0 },
    cenario: { total: 0, correct: 0 },
  }

  const days = new Set<ISODate>()
  let correct = 0
  let firstDay: ISODate | null = null

  for (const event of drills) {
    byKind[event.kind].total += 1
    if (event.correct) {
      byKind[event.kind].correct += 1
      correct += 1
    }
    days.add(event.at)
    if (!firstDay || event.at < firstDay) firstDay = event.at
  }

  return {
    total: drills.length,
    correct,
    byKind,
    days: days.size,
    streak: streakOf(days, today),
    firstDay,
  }
}

/**
 * Sequência de dias treinando.
 *
 * Começa em ontem quando hoje ainda está vazio: às dez da manhã, uma sequência
 * de doze dias não deveria aparecer como zero só porque o treino de hoje ainda
 * não aconteceu. Ela só quebra quando um dia inteiro passa em branco.
 */
export function streakOf(days: Set<ISODate>, today: ISODate): number {
  let cursor = days.has(today) ? today : addDays(today, -1)
  if (!days.has(cursor)) return 0

  let streak = 0
  while (days.has(cursor)) {
    streak += 1
    cursor = addDays(cursor, -1)
  }
  return streak
}

/** Onde o treino de pré-flop mais erra — o leak que vem do próprio treino. */
export function weakestPositions(
  drills: DrillEvent[],
): { position: string; total: number; correct: number; accuracy: number }[] {
  const byPosition = new Map<string, KindStat>()

  for (const event of drills) {
    if (event.kind !== 'preflop' || !event.position) continue
    const stat = byPosition.get(event.position) ?? { total: 0, correct: 0 }
    stat.total += 1
    if (event.correct) stat.correct += 1
    byPosition.set(event.position, stat)
  }

  return [...byPosition.entries()]
    .map(([position, stat]) => ({
      position,
      total: stat.total,
      correct: stat.correct,
      accuracy: (stat.correct / stat.total) * 100,
    }))
    // Poucas respostas não fazem diagnóstico: exigir 5 evita apontar "leak" em
    // quem errou a primeira e acertou as duas seguintes.
    .filter((entry) => entry.total >= 5)
    .sort((a, b) => a.accuracy - b.accuracy)
}

export { KINDS }
