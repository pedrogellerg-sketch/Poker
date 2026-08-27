/**
 * Persistência do módulo de pôquer.
 *
 * O que se salva e o que não se salva foi escolhido pelo custo em bytes contra
 * o valor para quem estuda:
 *
 * - **Respostas dos treinos** — minúsculas (menos de 100 bytes cada) e são a
 *   matéria-prima de toda a evolução. Guardamos milhares.
 * - **Mãos importadas** — o texto cru do PokerStars, que é a forma mais compacta
 *   e fiel de guardar uma mão: reparsear é barato, e assim nenhum campo do
 *   parser precisa de migração quando muda.
 * - **Observações da análise** — junto com as mãos, porque recalculá-las custa
 *   Monte Carlo em cada decisão: centenas de mãos levariam dezenas de segundos
 *   a cada abertura do app.
 *
 * A chave é própria (`sistema-fernando:poker`), separada do estado do app de
 * estudo: estourar a cota aqui não pode derrubar meses de progresso escolar.
 */

import type { ISODate } from './date'

import type { HandNote } from './analysis'
import type { Position } from './chen'
import type { ChipDisplay } from './format'

export type DrillKind = 'preflop' | 'outs' | 'cenario'

export interface DrillEvent {
  /** Data local `YYYY-MM-DD` — a hora não interessa para nenhuma pergunta que o app faz. */
  at: ISODate
  kind: DrillKind
  correct: boolean
  /** Pré-flop: a posição sorteada, para saber de onde vem o erro. */
  position?: Position
  /** Drill de outs: quantos outs a situação tinha. */
  outs?: number
  scenarioId?: string
}

export interface StoredHand {
  id: string
  /** Data em que a mão foi jogada (a do arquivo), não a da importação. */
  at: ISODate
  /** Texto cru da mão — fonte de verdade, reparseável. */
  text: string
}

export interface PokerSettings {
  /** Fichas ou big blinds na mesa e nas listas. */
  chipDisplay: ChipDisplay
}

export interface PokerRecord {
  version: number
  /** Muda quando as regras da análise mudam: obriga a recalcular as observações. */
  analysisVersion: number
  drills: DrillEvent[]
  hands: StoredHand[]
  notes: Record<string, HandNote[]>
  settings: PokerSettings
}

export const DEFAULT_SETTINGS: PokerSettings = { chipDisplay: 'fichas' }

export const STORAGE_KEY = 'sistema-fernando:poker'
export const RECORD_VERSION = 1
/** Suba este número ao mudar qualquer regra de `analysis.ts`. */
export const ANALYSIS_VERSION = 1

/** Tetos que mantêm o armazenamento previsível. */
const MAX_DRILLS = 4000
const MAX_HANDS = 300

export function emptyRecord(): PokerRecord {
  return {
    version: RECORD_VERSION,
    analysisVersion: ANALYSIS_VERSION,
    drills: [],
    hands: [],
    notes: {},
    settings: { ...DEFAULT_SETTINGS },
  }
}

/**
 * O armazenamento existe?
 *
 * Falha em dois cenários reais: modo privado do Safari (o acesso lança) e
 * publicação como Artifact do Claude (onde `localStorage` não é suportado). Nos
 * dois casos o módulo continua funcionando — só não lembra de nada.
 */
export function storageAvailable(): boolean {
  try {
    const probe = '__pk__'
    localStorage.setItem(probe, '1')
    localStorage.removeItem(probe)
    return true
  } catch {
    return false
  }
}

export function loadRecord(): PokerRecord {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return emptyRecord()

    const parsed = JSON.parse(raw) as Partial<PokerRecord>
    if (parsed.version !== RECORD_VERSION) return emptyRecord()

    const record: PokerRecord = {
      version: RECORD_VERSION,
      analysisVersion: parsed.analysisVersion ?? 0,
      drills: Array.isArray(parsed.drills) ? parsed.drills : [],
      hands: Array.isArray(parsed.hands) ? parsed.hands : [],
      notes: parsed.notes ?? {},
      // Campo novo em registro antigo: preenche com o padrão em vez de exigir
      // uma versão nova, que apagaria o histórico de quem já usava o app.
      settings: { ...DEFAULT_SETTINGS, ...(parsed.settings ?? {}) },
    }

    // Regras de análise mudaram desde que isto foi salvo: as observações antigas
    // diriam coisas que o app não diz mais. Melhor recalcular do que mentir.
    if (record.analysisVersion !== ANALYSIS_VERSION) {
      record.notes = {}
      record.analysisVersion = ANALYSIS_VERSION
    }

    return record
  } catch {
    return emptyRecord()
  }
}

export type SaveResult = 'ok' | 'trimmed' | 'drills-only' | 'unavailable'

/**
 * Salva, cedendo espaço em vez de desistir.
 *
 * A cota do navegador não é anunciada: só se descobre que acabou quando a
 * escrita falha. Em vez de perder tudo, o registro encolhe pelas mãos mais
 * antigas — que são o que ocupa espaço — e tenta de novo. As respostas dos
 * treinos são as últimas a cair, porque são a memória longa do usuário.
 */
export function saveRecord(record: PokerRecord): SaveResult {
  const trimmed: PokerRecord = {
    ...record,
    drills: record.drills.slice(-MAX_DRILLS),
    hands: record.hands.slice(-MAX_HANDS),
  }
  trimmed.notes = pickNotes(trimmed.notes, trimmed.hands)

  if (write(trimmed)) {
    return record.hands.length > MAX_HANDS ? 'trimmed' : 'ok'
  }

  let hands = trimmed.hands
  for (let attempt = 0; attempt < 4 && hands.length > 0; attempt += 1) {
    hands = hands.slice(Math.ceil(hands.length / 2))
    const smaller: PokerRecord = { ...trimmed, hands, notes: pickNotes(trimmed.notes, hands) }
    if (write(smaller)) return 'trimmed'
  }

  return write({ ...trimmed, hands: [], notes: {} }) ? 'drills-only' : 'unavailable'
}

export function clearRecord() {
  try {
    localStorage.removeItem(STORAGE_KEY)
  } catch {
    /* nada a fazer */
  }
}

function write(record: PokerRecord): boolean {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(record))
    return true
  } catch {
    return false
  }
}

/** Observação órfã (de mão que não está mais guardada) é só peso. */
function pickNotes(
  notes: Record<string, HandNote[]>,
  hands: StoredHand[],
): Record<string, HandNote[]> {
  const kept: Record<string, HandNote[]> = {}
  for (const hand of hands) {
    const found = notes[hand.id]
    if (found) kept[hand.id] = found
  }
  return kept
}
