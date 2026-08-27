/**
 * Análise das mãos importadas — onde o ciclo do app se fecha.
 *
 * A régua não é um solver: é o mesmo "manual" que os módulos de treino
 * ensinam. O pré-flop é julgado pela fórmula de Chen contra o limiar da
 * posição; o pós-flop, por pot odds contra equity estimada. Usar a mesma régua
 * dos treinos é o ponto: o erro apontado aqui tem um exercício correspondente
 * do outro lado do app, e o usuário sabe exatamente o que praticar.
 *
 * Onde a régua não alcança, ela se cala. Não sinalizamos nada sobre uma rua em
 * que as cartas do herói não aparecem, nem tentamos adivinhar o range do
 * adversário: um alerta errado destrói mais confiança do que dez alertas
 * ausentes.
 */

import type { Card, Rng } from './cards'
import { chenScore, OPEN_THRESHOLDS } from './chen'
import type { Position } from './chen'
import { monteCarloEquity, requiredEquity } from './equity'
import type { ParsedHand, ParsedStreet } from './pokerstars'

export type NoteCode =
  | 'abertura-fraca'
  | 'fold-forte'
  | 'call-fraco-preflop'
  | 'sem-3bet-premium'
  | 'call-sem-odds'
  | 'fold-com-odds'
  | 'call-com-odds'
  | 'abertura-correta'

export type NoteSeverity = 'erro' | 'atencao' | 'acerto'

export type TrainingTab = 'preflop' | 'postflop'

export interface HandNote {
  code: NoteCode
  severity: NoteSeverity
  street: ParsedStreet
  /** Índice da ação dentro da rua — o replay usa para destacar o momento. */
  actionIndex: number
  title: string
  detail: string
  /** Aba de treino que ataca esse erro. */
  trainingTab: TrainingTab
  /** Posição a treinar, quando o erro é posicional. */
  trainingPosition?: Position
}

export interface HandReport {
  hand: ParsedHand
  notes: HandNote[]
  /** Pior severidade encontrada — usada para ordenar e filtrar a lista. */
  worst: NoteSeverity | null
}

export interface AnalysisOptions {
  iterations?: number
  rng?: Rng
}

/** Folga antes de acusar um call ruim: a estimativa tem ruído, o alerta não pode ter. */
const CALL_MARGIN = 8
/** Folga maior para acusar fold: só apontamos o fold que era claramente errado. */
const FOLD_MARGIN = 15

export function analyseHand(hand: ParsedHand, options: AnalysisOptions = {}): HandReport {
  const notes: HandNote[] = []

  if (hand.heroCards.length === 2) {
    notes.push(...analysePreflop(hand))
    notes.push(...analysePostflop(hand, options))
  }

  return { hand, notes, worst: worstSeverity(notes) }
}

/**
 * A observação mais grave de uma mão.
 *
 * Exportada porque a análise é guardada em disco: ao recarregar, o relatório é
 * remontado a partir das observações salvas, sem repetir o Monte Carlo — e ele
 * precisa deste mesmo resumo.
 */
export function worstSeverity(notes: HandNote[]): NoteSeverity | null {
  if (notes.some((n) => n.severity === 'erro')) return 'erro'
  if (notes.some((n) => n.severity === 'atencao')) return 'atencao'
  return notes.length > 0 ? 'acerto' : null
}

function analysePreflop(hand: ParsedHand): HandNote[] {
  const actions = hand.streets.preflop
  const index = actions.findIndex((a) => a.player === hand.heroName)
  if (index < 0) return []

  const action = actions[index]
  const position = hand.heroPosition
  const threshold = OPEN_THRESHOLDS[position]
  const { score, notation } = chenScore(hand.heroCards[0], hand.heroCards[1])

  // Pote ainda não aumentado: a única aposta em jogo é a big blind.
  const raisedBefore = actions.slice(0, index).some((a) => a.type === 'raise' || a.type === 'bet')

  const note = (
    code: NoteCode,
    severity: NoteSeverity,
    title: string,
    detail: string,
  ): HandNote => ({
    code,
    severity,
    street: 'preflop',
    actionIndex: index,
    title,
    detail,
    trainingTab: 'preflop',
    trainingPosition: position,
  })

  if (!raisedBefore) {
    if (action.type === 'raise' || action.type === 'bet') {
      if (score < threshold) {
        return [
          note(
            'abertura-fraca',
            'erro',
            `Abriu ${notation} no ${position}`,
            `${notation} vale ${fmt(score)} na fórmula de Chen e o ${position} pede ${threshold}. Abrir daqui com essa mão é entrar em pote fora de posição com a pior mão na média.`,
          ),
        ]
      }
      return [
        note(
          'abertura-correta',
          'acerto',
          `Abertura correta de ${notation}`,
          `${fmt(score)} contra limiar ${threshold} do ${position}: dentro do range.`,
        ),
      ]
    }

    if (action.type === 'fold' && score >= threshold + 2 && position !== 'BB') {
      return [
        note(
          'fold-forte',
          'erro',
          `Descartou ${notation} no ${position}`,
          `${notation} vale ${fmt(score)}, bem acima do limiar ${threshold} do ${position}. Mão dessa força abre — descartar aqui é deixar dinheiro na mesa.`,
        ),
      ]
    }
    return []
  }

  // Houve aumento antes do herói.
  if (score >= 10.5 && action.type === 'call') {
    return [
      note(
        'sem-3bet-premium',
        'atencao',
        `Só pagou com ${notation}`,
        `${notation} vale ${fmt(score)} — está entre as melhores mãos do baralho. Pagar mantém a mesa inteira no pote; o 3-bet isola o agressor e cresce o pote com a melhor mão.`,
      ),
    ]
  }

  if (action.type === 'call' && score < threshold) {
    return [
      note(
        'call-fraco-preflop',
        'erro',
        `Pagou aumento com ${notation}`,
        `${notation} vale ${fmt(score)} e nem abriria do ${position} (limiar ${threshold}). Contra um aumento, a mão precisa ser mais forte, não menos.`,
      ),
    ]
  }

  return []
}

function analysePostflop(hand: ParsedHand, options: AnalysisOptions): HandNote[] {
  const notes: HandNote[] = []
  const streets: ParsedStreet[] = ['flop', 'turn', 'river']

  for (const street of streets) {
    const board = hand.boards[street]
    if (board.length < 3) continue

    const actions = hand.streets[street]
    actions.forEach((action, actionIndex) => {
      if (action.player !== hand.heroName) return
      if (action.type !== 'call' && action.type !== 'fold') return
      if (action.toCall <= 0) return

      const opponents = countLiveOpponents(hand, street, actionIndex)
      if (opponents < 1) return

      const equity = estimateEquity(hand.heroCards, board, opponents, options)
      const required = requiredEquity(action.potBefore, action.toCall)
      const gap = equity - required

      const math = `Pote ${fmt(action.potBefore)}, aposta ${fmt(action.toCall)} → precisava de ${required.toFixed(0)}% de equity. Sua mão tinha ~${equity.toFixed(0)}%.`

      if (action.type === 'call' && gap < -CALL_MARGIN) {
        notes.push({
          code: 'call-sem-odds',
          severity: 'erro',
          street,
          actionIndex,
          title: `Pagou sem odds no ${streetName(street)}`,
          detail: `${math} Faltavam ${Math.abs(gap).toFixed(0)} pontos: no longo prazo esse pagamento perde fichas.`,
          trainingTab: 'postflop',
        })
      } else if (action.type === 'call' && gap > CALL_MARGIN) {
        notes.push({
          code: 'call-com-odds',
          severity: 'acerto',
          street,
          actionIndex,
          title: `Pagamento certo no ${streetName(street)}`,
          detail: `${math} Sobravam ${gap.toFixed(0)} pontos de equity: pagar foi lucro.`,
          trainingTab: 'postflop',
        })
      } else if (action.type === 'fold' && gap > FOLD_MARGIN) {
        notes.push({
          code: 'fold-com-odds',
          severity: 'atencao',
          street,
          actionIndex,
          title: `Desistiu com preço no ${streetName(street)}`,
          detail: `${math} Havia ${gap.toFixed(0)} pontos de folga — o pote pagava para continuar.`,
          trainingTab: 'postflop',
        })
      }
    })
  }

  return notes
}

/**
 * Quantos adversários ainda estavam na mão quando o herói decidiu.
 *
 * Vale a contagem por rua: quem desistiu no flop não pressiona mais no turn, e
 * a equity contra dois adversários é bem diferente da equity contra quatro.
 */
function countLiveOpponents(hand: ParsedHand, street: ParsedStreet, actionIndex: number): number {
  const order: ParsedStreet[] = ['preflop', 'flop', 'turn', 'river']
  const upTo = order.indexOf(street)
  const folded = new Set<string>()

  for (let i = 0; i <= upTo; i += 1) {
    const actions = hand.streets[order[i]]
    const limit = i === upTo ? actionIndex : actions.length
    for (let j = 0; j < limit; j += 1) {
      if (actions[j].type === 'fold') folded.add(actions[j].player)
    }
  }

  const seen = new Set<string>()
  for (const key of order.slice(0, upTo + 1)) {
    for (const action of hand.streets[key]) seen.add(action.player)
  }
  // Quem nunca agiu numa rua pós-flop já não estava lá.
  const alive = hand.players.filter(
    (p) => p.name !== hand.heroName && !folded.has(p.name) && seen.has(p.name),
  )
  return alive.length
}

function estimateEquity(
  hole: Card[],
  board: Card[],
  opponents: number,
  options: AnalysisOptions,
): number {
  return monteCarloEquity({
    hole,
    board,
    opponents,
    iterations: options.iterations ?? 600,
    rng: options.rng,
  }).equity
}

function streetName(street: ParsedStreet): string {
  return { preflop: 'pré-flop', flop: 'flop', turn: 'turn', river: 'river' }[street]
}

function fmt(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(1)
}

export interface Leak {
  code: NoteCode
  severity: NoteSeverity
  label: string
  /** O que fazer a respeito — texto curto, imperativo. */
  advice: string
  count: number
  trainingTab: TrainingTab
  /** Posições em que o erro aparece, da mais frequente para a menos. */
  positions: { position: Position; count: number }[]
  /** IDs das mãos onde ocorreu, para o link "ver mãos". */
  handIds: string[]
}

const LEAK_LABELS: Record<NoteCode, { label: string; advice: string }> = {
  'abertura-fraca': {
    label: 'Abre mãos fracas demais',
    advice: 'Treine abertura por posição até o limiar virar automático.',
  },
  'fold-forte': {
    label: 'Descarta mão que devia abrir',
    advice: 'Range apertado demais custa os potes fáceis. Treine o limiar da posição.',
  },
  'call-fraco-preflop': {
    label: 'Paga aumento com mão de abrir, não de pagar',
    advice: 'Contra aumento, o range aperta. Treine pré-flop e pense em 3-bet ou fold.',
  },
  'sem-3bet-premium': {
    label: 'Não faz 3-bet com mão premium',
    advice: 'Mão premium quer pote grande e mesa vazia. Treine o topo do range.',
  },
  'call-sem-odds': {
    label: 'Paga sem pot odds',
    advice: 'Treine outs e pot odds até a conta sair antes da decisão.',
  },
  'fold-com-odds': {
    label: 'Desiste quando o pote pagava',
    advice: 'Treine a conta de equity necessária: às vezes o preço obriga a pagar.',
  },
  'call-com-odds': { label: 'Pagamentos com preço correto', advice: 'Continue assim.' },
  'abertura-correta': { label: 'Aberturas dentro do range', advice: 'Continue assim.' },
}

/**
 * Agrega os erros por tipo — o painel de leaks.
 *
 * Uma lista de mãos mostra episódios; o que muda o jogo é ver que 14 deles são
 * o mesmo erro. Por isso a agregação guarda também as posições: "abre demais"
 * é um diagnóstico vago, "abre demais no UTG" é um treino.
 */
export function aggregateLeaks(reports: HandReport[]): Leak[] {
  const byCode = new Map<NoteCode, Leak>()

  for (const report of reports) {
    for (const note of report.notes) {
      if (note.severity === 'acerto') continue

      let leak = byCode.get(note.code)
      if (!leak) {
        leak = {
          code: note.code,
          severity: note.severity,
          label: LEAK_LABELS[note.code].label,
          advice: LEAK_LABELS[note.code].advice,
          count: 0,
          trainingTab: note.trainingTab,
          positions: [],
          handIds: [],
        }
        byCode.set(note.code, leak)
      }

      leak.count += 1
      if (leak.handIds.length < 40) leak.handIds.push(report.hand.id)

      const position = note.trainingPosition ?? report.hand.heroPosition
      const entry = leak.positions.find((p) => p.position === position)
      if (entry) entry.count += 1
      else leak.positions.push({ position, count: 1 })
    }
  }

  const leaks = [...byCode.values()]
  for (const leak of leaks) leak.positions.sort((a, b) => b.count - a.count)
  return leaks.sort((a, b) => b.count - a.count)
}

export interface SessionSummary {
  hands: number
  analysed: number
  net: number
  won: number
  lost: number
  vpip: number
  errors: number
}

/** Números do topo da tela: o resumo que responde "como foi a sessão?". */
export function summarise(reports: HandReport[]): SessionSummary {
  const hands = reports.length
  let net = 0
  let won = 0
  let lost = 0
  let voluntary = 0
  let errors = 0

  for (const { hand, notes } of reports) {
    net += hand.heroNet
    if (hand.heroNet > 0) won += 1
    else if (hand.heroNet < 0) lost += 1

    const put = hand.streets.preflop.some(
      (a) => a.player === hand.heroName && (a.type === 'call' || a.type === 'raise' || a.type === 'bet'),
    )
    if (put) voluntary += 1

    errors += notes.filter((n) => n.severity === 'erro').length
  }

  return {
    hands,
    analysed: reports.filter((r) => r.hand.heroCards.length === 2).length,
    net,
    won,
    lost,
    vpip: hands > 0 ? (voluntary / hands) * 100 : 0,
    errors,
  }
}
