import { useMemo, useState } from 'react'

import type { ChartPoint } from '../components/PeriodChart'
import { PeriodChart } from '../components/PeriodChart'
import type { Position } from '../lib/chen'
import type { Bucket, PeriodPoint } from '../lib/progress'
import { KINDS, KIND_LABEL, accuracy, buildSeries, compareLast, lifetime, weakestPositions } from '../lib/progress'
import type { HandStat } from '../lib/progress'
import type { DrillEvent, DrillKind, SaveResult } from '../lib/storage'

interface Props {
  drills: DrillEvent[]
  handStats: HandStat[]
  storageOn: boolean
  saveStatus: SaveResult
  onClearAll: () => void
  onTrain: (tab: 'preflop' | 'postflop', position?: Position) => void
}

/** Quantos períodos a série mostra — 8 semanas ou 6 meses cabem em 380px. */
const SPAN: Record<Bucket, number> = { semana: 8, mes: 6 }

/**
 * Evolução — a aba que responde "estou melhorando?".
 *
 * Nenhum número aqui é isolado: cada um vem com o período anterior ao lado. Um
 * "72% de acerto" sozinho não diz nada; "72%, contra 61% na semana passada" é a
 * única forma dessa tela ter função.
 */
export function Evolution({
  drills,
  handStats,
  storageOn,
  saveStatus,
  onClearAll,
  onTrain,
}: Props) {
  const [bucket, setBucket] = useState<Bucket>('semana')
  const [focus, setFocus] = useState<DrillKind | 'todos'>('todos')
  const [showTable, setShowTable] = useState(false)
  const [confirmClear, setConfirmClear] = useState(false)

  const series = useMemo(
    () => buildSeries(drills, handStats, bucket, SPAN[bucket]),
    [drills, handStats, bucket],
  )
  const stats = useMemo(() => lifetime(drills), [drills])
  const comparison = useMemo(
    () => compareLast(series, focus === 'todos' ? undefined : focus),
    [series, focus],
  )
  const weakest = useMemo(() => weakestPositions(drills), [drills])

  const lifetimeAccuracy = stats.total > 0 ? (stats.correct / stats.total) * 100 : null

  if (drills.length === 0 && handStats.length === 0) {
    return <EmptyState storageOn={storageOn} />
  }

  const accuracyPoints: ChartPoint[] = series.map((point) => {
    const stat = focus === 'todos' ? point.drills : point.byKind[focus]
    return {
      key: point.key,
      label: point.label,
      value: accuracy(stat),
      sample: stat.total,
      caption:
        stat.total === 0
          ? `sem treino ${periodName(point, bucket)}`
          : `de acerto ${periodName(point, bucket)} — ${stat.correct} de ${stat.total} decisões`,
    }
  })

  const errorPoints: ChartPoint[] = series.map((point) => ({
    key: point.key,
    label: point.label,
    value: point.hands === 0 ? null : point.handErrors,
    sample: point.hands,
    caption:
      point.hands === 0
        ? `nenhuma mão importada ${periodName(point, bucket)}`
        : `erros em ${point.hands} ${point.hands === 1 ? 'mão jogada' : 'mãos jogadas'} ${periodName(point, bucket)}`,
  }))

  const hasHands = handStats.length > 0
  // Uma sessão importada de meses atrás não aparece na janela de 8 semanas. Sem
  // aviso, o gráfico vazio pareceria bug — ou pior, pareceria "zero erros".
  const outsideWindow = hasHands && errorPointsAllEmpty(series)

  return (
    <>
      <div className="pk-card">
        <div className="pk-stat-grid">
          <div>
            <span className="pk-stat-value">
              {lifetimeAccuracy === null ? '—' : `${Math.round(lifetimeAccuracy)}%`}
            </span>
            <span className="pk-stat-label">ACERTO GERAL</span>
          </div>
          <div>
            <span className="pk-stat-value">{stats.total}</span>
            <span className="pk-stat-label">DECISÕES</span>
          </div>
          <div>
            <span className="pk-stat-value" style={{ color: 'var(--pk-gold)' }}>
              {stats.streak}
            </span>
            <span className="pk-stat-label">
              {stats.streak === 1 ? 'DIA SEGUIDO' : 'DIAS SEGUIDOS'}
            </span>
          </div>
        </div>
        <p className="pk-note" style={{ marginTop: 10 }}>
          {stats.days === 0
            ? 'Nenhum treino registrado ainda.'
            : `Treinou em ${stats.days} ${
                stats.days === 1 ? 'dia' : 'dias diferentes'
              }${stats.firstDay ? `, desde ${formatDay(stats.firstDay)}` : ''}.`}
        </p>
      </div>

      <div className="pk-card">
        <div className="pk-chips">
          {(['semana', 'mes'] as Bucket[]).map((option) => (
            <button
              key={option}
              type="button"
              className="pk-pill"
              aria-pressed={bucket === option}
              onClick={() => setBucket(option)}
            >
              {option === 'semana' ? 'Por semana' : 'Por mês'}
            </button>
          ))}
        </div>
        <div className="pk-chips" style={{ marginTop: 6 }}>
          <button
            type="button"
            className="pk-pill"
            aria-pressed={focus === 'todos'}
            onClick={() => setFocus('todos')}
          >
            Tudo
          </button>
          {KINDS.map((kind) => (
            <button
              key={kind}
              type="button"
              className="pk-pill"
              aria-pressed={focus === kind}
              onClick={() => setFocus(kind)}
            >
              {KIND_LABEL[kind]}
            </button>
          ))}
        </div>
      </div>

      <div className="pk-card">
        <h2 style={{ margin: 0 }}>Acerto por {bucket === 'semana' ? 'semana' : 'mês'}</h2>
        {/* A comparação fica em linha própria: ao lado do título ela empurrava a
            quebra do cabeçalho em telas de 380px. */}
        <p style={{ margin: '2px 0 0' }}>
          <Delta comparison={comparison} bucket={bucket} />
        </p>

        <PeriodChart
          points={accuracyPoints}
          scale="percent"
          reference={
            lifetimeAccuracy !== null
              ? { value: lifetimeAccuracy, label: `média ${Math.round(lifetimeAccuracy)}%` }
              : null
          }
        />

        <button
          type="button"
          className="pk-pill"
          style={{ marginTop: 10 }}
          aria-pressed={showTable}
          onClick={() => setShowTable((v) => !v)}
        >
          {showTable ? 'Esconder números' : 'Ver números'}
        </button>

        {showTable && <NumbersTable series={series} focus={focus} bucket={bucket} />}
      </div>

      {hasHands && (
        <div className="pk-card">
          <h2>Erros nas mãos reais</h2>
          <p className="pk-note">
            Contados sobre as mãos importadas do PokerStars, na data em que foram jogadas — não na
            data em que você importou o arquivo.
          </p>
          {outsideWindow ? (
            <p className="pk-note" style={{ marginTop: 8, color: 'var(--pk-parchment)' }}>
              As {handStats.length} mãos importadas são anteriores a este período — nenhuma delas
              cai {bucket === 'semana' ? 'nas últimas 8 semanas' : 'nos últimos 6 meses'}.
            </p>
          ) : (
            <PeriodChart
              points={errorPoints}
              scale="count"
              format={(v) => String(Math.round(v))}
              emptyMessage="Nenhuma mão importada neste período."
            />
          )}
        </div>
      )}

      {weakest.length > 0 && (
        <div className="pk-card">
          <h2>Posições que mais erram</h2>
          <p className="pk-note" style={{ marginBottom: 10 }}>
            Só entram posições com pelo menos cinco decisões respondidas — abaixo disso é sorte,
            não tendência.
          </p>
          {weakest.slice(0, 4).map((entry) => (
            <div key={entry.position} style={{ padding: '8px 0', borderBottom: '1px solid var(--pk-border)' }}>
              <div className="pk-row-between">
                <span style={{ fontSize: 14, fontWeight: 600 }}>{entry.position}</span>
                <span className="pk-num" style={{ fontSize: 13 }}>
                  {Math.round(entry.accuracy)}%
                </span>
              </div>
              <div className="pk-bar" style={{ margin: '6px 0' }}>
                <span style={{ width: `${Math.max(3, entry.accuracy)}%` }} />
              </div>
              <div className="pk-row-between">
                <span className="pk-note">
                  {entry.correct} de {entry.total} decisões
                </span>
                <button
                  type="button"
                  className="pk-pill"
                  onClick={() => onTrain('preflop', entry.position as Position)}
                >
                  Treinar {entry.position}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="pk-card">
        <p className="pk-eyebrow">Seus dados</p>
        <p className="pk-note">
          {!storageOn
            ? 'Este navegador não deixa salvar nada (modo privado?). O que você treinar hoje some ao fechar a aba.'
            : saveStatus === 'drills-only'
              ? 'O espaço do navegador acabou: os treinos continuam salvos, mas as mãos importadas não couberam.'
              : saveStatus === 'trimmed'
                ? 'Espaço apertado: as mãos mais antigas foram descartadas para caber. Os treinos estão todos salvos.'
                : 'Tudo salvo neste aparelho, sem servidor nenhum. Ninguém além de você vê estes números.'}
        </p>
        {confirmClear ? (
          <div className="pk-btn-row" style={{ marginTop: 10 }}>
            <button type="button" className="pk-btn" onClick={() => setConfirmClear(false)}>
              Cancelar
            </button>
            <button
              type="button"
              className="pk-btn is-danger"
              onClick={() => {
                onClearAll()
                setConfirmClear(false)
              }}
            >
              Apagar mesmo
            </button>
          </div>
        ) : (
          <button
            type="button"
            className="pk-btn is-danger"
            style={{ marginTop: 10 }}
            onClick={() => setConfirmClear(true)}
          >
            Apagar histórico
          </button>
        )}
      </div>
    </>
  )
}

function Delta({ comparison, bucket }: { comparison: ReturnType<typeof compareLast>; bucket: Bucket }) {
  const { delta, current } = comparison
  const period = bucket === 'semana' ? 'semana' : 'mês'

  if (current.total === 0) {
    return (
      <span className="pk-note">
        {bucket === 'semana' ? 'sem treino nesta semana' : 'sem treino neste mês'}
      </span>
    )
  }
  if (delta === null) {
    return (
      <span className="pk-note">
        {bucket === 'semana' ? 'primeira semana' : 'primeiro mês'}
      </span>
    )
  }

  const rounded = Math.round(delta)
  if (rounded === 0) return <span className="pk-note">igual ao {period} anterior</span>

  return (
    <span className={`pk-delta ${rounded > 0 ? 'is-up' : 'is-down'}`}>
      {rounded > 0 ? '▲' : '▼'} {Math.abs(rounded)} pt vs. {period} anterior
    </span>
  )
}

function NumbersTable({
  series,
  focus,
  bucket,
}: {
  series: PeriodPoint[]
  focus: DrillKind | 'todos'
  bucket: Bucket
}) {
  return (
    <table className="pk-table-view">
      <thead>
        <tr>
          <th>{bucket === 'semana' ? 'Semana de' : 'Mês'}</th>
          <th>Decisões</th>
          <th>Acerto</th>
        </tr>
      </thead>
      <tbody>
        {series
          .slice()
          .reverse()
          .map((point) => {
            const stat = focus === 'todos' ? point.drills : point.byKind[focus]
            const value = accuracy(stat)
            return (
              <tr key={point.key}>
                <td>{point.label}</td>
                <td>{stat.total || '—'}</td>
                <td>{value === null ? '—' : `${Math.round(value)}%`}</td>
              </tr>
            )
          })}
      </tbody>
    </table>
  )
}

function EmptyState({ storageOn }: { storageOn: boolean }) {
  return (
    <div className="pk-card">
      <h2>Ainda não há o que comparar</h2>
      <p className="pk-note">
        Esta aba guarda cada decisão que você toma nos treinos de pré-flop, de outs e de leitura de
        jogo, e mostra a evolução por semana e por mês. Responda algumas mãos nos treinos e volte
        aqui.
      </p>
      <p className="pk-note" style={{ marginTop: 8 }}>
        {storageOn
          ? 'Os números ficam salvos neste aparelho — pode fechar o app e voltar amanhã.'
          : 'Atenção: este navegador não permite salvar dados (modo privado?), então o histórico não vai sobreviver ao fechar a aba.'}
      </p>
    </div>
  )
}

/** Já vem com preposição: as legendas encaixam sem remendo de concordância. */
function errorPointsAllEmpty(series: PeriodPoint[]): boolean {
  return series.every((point) => point.hands === 0)
}

function periodName(point: PeriodPoint, bucket: Bucket): string {
  return bucket === 'semana' ? `na semana de ${point.label}` : `em ${point.label}`
}

function formatDay(iso: string): string {
  return `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}`
}
