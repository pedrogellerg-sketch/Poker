import { useEffect, useMemo, useRef, useState } from 'react'

import type { ISODate } from './lib/date'
import { todayISO } from './lib/date'

import type { HandNote, HandReport } from './lib/analysis'
import { analyseHand, worstSeverity } from './lib/analysis'
import type { HandStat } from './lib/progress'
import type { ParsedHand } from './lib/pokerstars'
import { parseHandHistory, parseHandHistoryWithReport } from './lib/pokerstars'
import type { DrillEvent, PokerSettings, SaveResult, StoredHand } from './lib/storage'
import {
  ANALYSIS_VERSION,
  RECORD_VERSION,
  clearRecord,
  loadRecord,
  saveRecord,
  storageAvailable,
} from './lib/storage'

/** Quantas mãos analisar por quadro — mantém a tela respondendo. */
const CHUNK = 4
/** Iterações do Monte Carlo por decisão. Menos precisão, muito mais mãos por segundo. */
const ITERATIONS = 250
/** Espera antes de gravar, para não escrever a cada resposta de um drill rápido. */
const SAVE_DEBOUNCE_MS = 400

export interface HandLibrary {
  hands: ParsedHand[]
  reports: HandReport[]
  notice: string | null
  /** 0 a 1 — fração das mãos já analisadas. */
  progress: number
  importText: (text: string, label: string) => void
  reset: () => void
}

export interface PokerData {
  library: HandLibrary
  drills: DrillEvent[]
  settings: PokerSettings
  updateSettings: (patch: Partial<PokerSettings>) => void
  /** Estatística por mão para a linha do tempo (data + quantos erros). */
  handStats: HandStat[]
  recordDrill: (event: Omit<DrillEvent, 'at'>) => void
  clearAll: () => void
  /** `false` em modo privado do Safari ou onde não há `localStorage`. */
  storageOn: boolean
  saveStatus: SaveResult
}

/**
 * Todo o estado do módulo que sobrevive ao recarregar.
 *
 * Um hook só, e não um por assunto, porque tudo vai para a mesma chave de
 * armazenamento: dois donos gravando o mesmo registro se sobrescreveriam, e o
 * bug apareceria como "o app esqueceu meus treinos" na semana seguinte.
 *
 * As mãos importadas ficam guardadas como texto cru e são reparseadas na
 * abertura — reparsear custa milissegundos, enquanto reanalisar custaria Monte
 * Carlo em cada decisão. Por isso as observações da análise vão junto.
 */
export function usePokerData(): PokerData {
  // Lido uma vez: o registro em disco é o ponto de partida, não uma dependência.
  const initial = useRef(loadRecord()).current

  const [drills, setDrills] = useState<DrillEvent[]>(initial.drills)
  const [storedHands, setStoredHands] = useState<StoredHand[]>(initial.hands)
  const [notes, setNotes] = useState<Record<string, HandNote[]>>(initial.notes)
  const [reports, setReports] = useState<HandReport[]>([])
  const [notice, setNotice] = useState<string | null>(null)
  const [settings, setSettings] = useState<PokerSettings>(initial.settings)
  const [saveStatus, setSaveStatus] = useState<SaveResult>('ok')
  const storageOn = useRef(storageAvailable()).current

  // A análise lê as observações já salvas sem depender delas: se `notes` entrasse
  // na lista de dependências do efeito, cada fatia analisada reiniciaria o ciclo.
  const notesRef = useRef(notes)
  notesRef.current = notes

  const hands = useMemo(
    () => storedHands.flatMap((stored) => parseHandHistory(stored.text).slice(0, 1)),
    [storedHands],
  )

  /**
   * A análise roda em fatias.
   *
   * Cada decisão pós-flop dispara uma simulação de Monte Carlo, e um arquivo de
   * sessão tem centenas de mãos. Tudo de uma vez congelaria a aba por vários
   * segundos — no celular, o navegador mataria a página. Em fatias, a barra de
   * progresso anda e as primeiras mãos já podem ser lidas.
   */
  useEffect(() => {
    const present = new Set(hands.map((hand) => hand.id))
    // Mãos apagadas deixam relatórios órfãos para trás.
    if (reports.some((report) => !present.has(report.hand.id))) {
      setReports((prev) => prev.filter((report) => present.has(report.hand.id)))
      return
    }

    // A fila é por identidade, não por índice: uma importação nova reordena a
    // lista por data, e continuar de `reports.length` analisaria a mão errada.
    const done = new Set(reports.map((report) => report.hand.id))
    const pending = hands.filter((hand) => !done.has(hand.id)).slice(0, CHUNK)
    if (pending.length === 0) return

    const id = window.setTimeout(() => {
      const fresh: HandReport[] = []
      const discovered: Record<string, HandNote[]> = {}

      for (const hand of pending) {
        const cached = notesRef.current[hand.id]
        if (cached) {
          fresh.push({ hand, notes: cached, worst: worstSeverity(cached) })
        } else {
          const report = analyseHand(hand, { iterations: ITERATIONS })
          fresh.push(report)
          discovered[hand.id] = report.notes
        }
      }

      setReports((prev) => [...prev, ...fresh])
      if (Object.keys(discovered).length > 0) {
        setNotes((prev) => ({ ...prev, ...discovered }))
      }
    }, 0)

    return () => window.clearTimeout(id)
  }, [hands, reports])

  /**
   * Gravação adiada.
   *
   * Responder um drill muda o estado; gravar na hora serializaria o registro
   * inteiro (mãos inclusive) a cada toque de botão. O atraso agrupa a rajada da
   * análise em fatias numa escrita só.
   */
  useEffect(() => {
    if (!storageOn) return

    const id = window.setTimeout(() => {
      setSaveStatus(
        saveRecord({
          version: RECORD_VERSION,
          analysisVersion: ANALYSIS_VERSION,
          drills,
          hands: storedHands,
          notes,
          settings,
        }),
      )
    }, SAVE_DEBOUNCE_MS)

    return () => window.clearTimeout(id)
  }, [drills, storedHands, notes, settings, storageOn])

  const updateSettings = (patch: Partial<PokerSettings>) => {
    setSettings((prev) => ({ ...prev, ...patch }))
  }

  const recordDrill = (event: Omit<DrillEvent, 'at'>) => {
    setDrills((prev) => [...prev, { at: todayISO(), ...event }])
  }

  const importText = (text: string, label: string) => {
    const { hands: parsed, skipped, reasons } = parseHandHistoryWithReport(text)

    if (parsed.length === 0) {
      setNotice(
        `Nenhuma mão reconhecida em ${label}. O arquivo precisa ser o histórico de texto do PokerStars, de Hold'em no-limit.`,
      )
      return
    }

    let added = 0
    setStoredHands((prev) => {
      // Reimportar o mesmo arquivo é comum: o cliente do PokerStars vai
      // acrescentando mãos ao arquivo da sessão enquanto ela acontece.
      const seen = new Set(prev.map((h) => h.id))
      const fresh: StoredHand[] = parsed
        .filter((hand) => !seen.has(hand.id))
        .map((hand) => ({ id: hand.id, at: hand.playedOn as ISODate, text: hand.raw }))

      added = fresh.length
      if (fresh.length === 0) return prev

      // Ordenadas por data: os cortes por cota descartam sempre as mais antigas.
      return [...prev, ...fresh].sort((a, b) => a.at.localeCompare(b.at))
    })

    setNotice(
      [
        `${added} ${added === 1 ? 'mão nova' : 'mãos novas'} de ${label}`,
        parsed.length !== added ? `${parsed.length - added} já estavam aqui` : '',
        skipped > 0 ? `${skipped} ignoradas (${reasons.join('; ')})` : '',
      ]
        .filter(Boolean)
        .join(' · ') + '.',
    )
  }

  const reset = () => {
    setStoredHands([])
    setNotes({})
    setReports([])
    setNotice(null)
  }

  const clearAll = () => {
    reset()
    setDrills([])
    clearRecord()
  }

  const handStats = useMemo<HandStat[]>(
    () =>
      reports.map((report) => ({
        at: report.hand.playedOn as ISODate,
        errors: report.notes.filter((note) => note.severity === 'erro').length,
      })),
    [reports],
  )

  return {
    library: {
      hands,
      reports,
      notice,
      progress: hands.length > 0 ? reports.length / hands.length : 1,
      importText,
      reset,
    },
    drills,
    settings,
    updateSettings,
    handStats,
    recordDrill,
    clearAll,
    storageOn,
    saveStatus,
  }
}
