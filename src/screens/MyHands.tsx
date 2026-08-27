import { useMemo, useRef, useState } from 'react'

import { CardRow } from '../components/PlayingCard'
import type { HandNote, HandReport, Leak } from '../lib/analysis'
import { aggregateLeaks, summarise } from '../lib/analysis'
import type { ParsedStreet } from '../lib/pokerstars'
import type { Position } from '../lib/chen'
import type { ChipDisplay } from '../lib/format'
import { formatAmount, formatResult } from '../lib/format'
import type { HandLibrary } from '../usePokerData'

interface Props {
  onTrain: (tab: 'preflop' | 'postflop', position?: Position) => void
  /** Importação e análise vivem no shell — ver `usePokerData`. */
  library: HandLibrary
  display: ChipDisplay
  onDisplayChange: (display: ChipDisplay) => void
}

export function MyHands({ onTrain, library, display, onDisplayChange }: Props) {
  const { hands, reports, notice, progress, importText, reset } = library
  const [selected, setSelected] = useState<string | null>(null)

  const chosen = reports.find((r) => r.hand.id === selected) ?? null

  if (chosen) {
    return <HandReplay report={chosen} onBack={() => setSelected(null)} display={display} />
  }

  return (
    <>
      {hands.length === 0 ? (
        <Importer onText={importText} notice={notice} />
      ) : (
        <>
          <div className="pk-card">
            <div className="pk-row-between">
              <p className="pk-eyebrow" style={{ margin: 0 }}>
                {hands.length} {hands.length === 1 ? 'mão importada' : 'mãos importadas'}
              </p>
              <button
                type="button"
                className="pk-back"
                onClick={() => {
                  reset()
                  setSelected(null)
                }}
              >
                Limpar
              </button>
            </div>
            {progress < 1 && (
              <div style={{ marginTop: 10 }}>
                <div className="pk-bar">
                  <span style={{ width: `${Math.round(progress * 100)}%` }} />
                </div>
                <p className="pk-note" style={{ marginTop: 6 }}>
                  Analisando {reports.length} de {hands.length}…
                </p>
              </div>
            )}
          </div>

          <Summary reports={reports} display={display} onDisplayChange={onDisplayChange} />
          <LeaksPanel reports={reports} onTrain={onTrain} />
          <HandList reports={reports} onSelect={setSelected} display={display} />

          <div className="pk-card">
            <Importer onText={importText} notice={notice} compact />
          </div>
        </>
      )}
    </>
  )
}

interface ImporterProps {
  onText: (text: string, label: string) => void
  notice: string | null
  compact?: boolean
}

function Importer({ onText, notice, compact }: ImporterProps) {
  const [dragging, setDragging] = useState(false)
  const [pasted, setPasted] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  const readFiles = (files: FileList | null) => {
    if (!files) return
    for (const file of Array.from(files)) {
      const reader = new FileReader()
      reader.onload = () => onText(String(reader.result ?? ''), file.name)
      reader.readAsText(file)
    }
  }

  return (
    <>
      {!compact && (
        <div className="pk-card">
          <h2>Suas mãos de verdade</h2>
          <p className="pk-note">
            O PokerStars grava um arquivo de texto por sessão na pasta de Histórico de Mãos. Traga
            esse arquivo para cá: o app refaz cada mão, recalcula as decisões pela mesma régua dos
            treinos e mostra onde você saiu dela.
          </p>
          <p className="pk-note" style={{ marginTop: 8 }}>
            Nada sai do aparelho — a leitura acontece no navegador, sem enviar arquivo para lugar
            nenhum e sem pedir sua senha do site.
          </p>
        </div>
      )}

      <div
        className={`pk-drop${dragging ? ' is-over' : ''}`}
        onDragOver={(e) => {
          e.preventDefault()
          setDragging(true)
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault()
          setDragging(false)
          readFiles(e.dataTransfer.files)
        }}
      >
        <p style={{ margin: '0 0 10px', fontSize: 14 }}>
          Arraste os arquivos <span className="pk-num">.txt</span> aqui
        </p>
        <input
          ref={inputRef}
          type="file"
          accept=".txt,text/plain"
          multiple
          style={{ display: 'none' }}
          onChange={(e) => readFiles(e.target.files)}
        />
        <button type="button" className="pk-btn is-primary" onClick={() => inputRef.current?.click()}>
          Escolher arquivos
        </button>
      </div>

      <div className="pk-card">
        <p className="pk-eyebrow">Ou cole o texto da mão</p>
        <textarea
          className="pk-input"
          rows={4}
          placeholder="PokerStars Hand #241234567890: Tournament…"
          value={pasted}
          onChange={(e) => setPasted(e.target.value)}
        />
        <button
          type="button"
          className="pk-btn"
          style={{ width: '100%', marginTop: 8 }}
          disabled={pasted.trim().length === 0}
          onClick={() => {
            onText(pasted, 'texto colado')
            setPasted('')
          }}
        >
          Analisar texto
        </button>
      </div>

      {notice && (
        <div className="pk-card">
          <p className="pk-note">{notice}</p>
        </div>
      )}
    </>
  )
}

interface SummaryProps {
  reports: HandReport[]
  display: ChipDisplay
  onDisplayChange: (display: ChipDisplay) => void
}

/**
 * Saldo somado em big blinds, e não em fichas.
 *
 * Somar fichas de sessões com blinds diferentes não significa nada: 500 fichas
 * ganhas no nível 10/20 e 500 perdidas no 100/200 não se cancelam. Em BB, cada
 * mão é convertida pela blind da própria mão antes de entrar na conta — é assim
 * que resultado de pôquer se mede.
 */
function Summary({ reports, display, onDisplayChange }: SummaryProps) {
  const stats = useMemo(() => summarise(reports), [reports])
  const netBb = useMemo(
    () =>
      reports.reduce(
        (sum, r) => sum + (r.hand.bigBlind > 0 ? r.hand.heroNet / r.hand.bigBlind : 0),
        0,
      ),
    [reports],
  )
  if (reports.length === 0) return null

  const inBb = display === 'bb'
  const net = inBb ? netBb : stats.net

  return (
    <div className="pk-card">
      <div className="pk-stat-grid">
        <div>
          <span className={`pk-stat-value ${net >= 0 ? 'pk-net is-up' : 'pk-net is-down'}`}>
            {net >= 0 ? '+' : ''}
            {inBb ? net.toFixed(1).replace('.', ',') : Math.round(net)}
          </span>
          <span className="pk-stat-label">{inBb ? 'SALDO (BB)' : 'SALDO'}</span>
        </div>
        <div>
          <span className="pk-stat-value">{stats.vpip.toFixed(0)}%</span>
          <span className="pk-stat-label">MÃOS JOGADAS</span>
        </div>
        <div>
          <span className="pk-stat-value" style={{ color: 'var(--pk-red)' }}>
            {stats.errors}
          </span>
          <span className="pk-stat-label">ERROS</span>
        </div>
      </div>
      <div className="pk-chips" style={{ marginTop: 10 }}>
        {(['fichas', 'bb'] as ChipDisplay[]).map((mode) => (
          <button
            key={mode}
            type="button"
            className="pk-pill"
            aria-pressed={display === mode}
            onClick={() => onDisplayChange(mode)}
          >
            {mode === 'fichas' ? 'Fichas' : 'Big blinds'}
          </button>
        ))}
      </div>

      <p className="pk-note" style={{ marginTop: 10 }}>
        {stats.won} {stats.won === 1 ? 'ganha' : 'ganhas'} · {stats.lost}{' '}
        {stats.lost === 1 ? 'perdida' : 'perdidas'}.{' '}
        {stats.vpip > 32
          ? 'Entrar em mais de um terço das mãos costuma ser largo demais fora do botão.'
          : stats.vpip < 14
            ? 'Range apertado: você paga muitas blinds esperando mão premium.'
            : 'A frequência de entrada está numa faixa saudável.'}
      </p>
    </div>
  )
}

function LeaksPanel({ reports, onTrain }: { reports: HandReport[]; onTrain: Props['onTrain'] }) {
  const leaks = useMemo(() => aggregateLeaks(reports), [reports])
  if (leaks.length === 0) return null

  const worst = leaks[0].count

  return (
    <div className="pk-card">
      <h2>Seus leaks</h2>
      <p className="pk-note" style={{ marginBottom: 12 }}>
        Erros agrupados por tipo. Um erro isolado é azar; o mesmo erro trinta vezes é um hábito — e
        hábito se treina.
      </p>

      {leaks.map((leak) => (
        <LeakRow key={leak.code} leak={leak} worst={worst} onTrain={onTrain} />
      ))}
    </div>
  )
}

function LeakRow({ leak, worst, onTrain }: { leak: Leak; worst: number; onTrain: Props['onTrain'] }) {
  return (
    <div style={{ padding: '11px 0', borderBottom: '1px solid var(--pk-border)' }}>
      <div className="pk-row-between">
        <span style={{ fontSize: 14, fontWeight: 600 }}>{leak.label}</span>
        <span className={`pk-flag is-${leak.severity}`}>{leak.count}×</span>
      </div>
      <div className="pk-bar" style={{ margin: '8px 0' }}>
        <span
          style={{
            width: `${Math.max(6, Math.round((leak.count / worst) * 100))}%`,
            background: leak.severity === 'erro' ? 'var(--pk-red)' : 'var(--pk-gold)',
          }}
        />
      </div>
      <p className="pk-note">{leak.advice}</p>
      {leak.positions.length > 0 && (
        <p className="pk-note" style={{ marginTop: 4 }}>
          Mais frequente em:{' '}
          {leak.positions
            .slice(0, 3)
            .map((p) => `${p.position} (${p.count})`)
            .join(', ')}
        </p>
      )}
      <button
        type="button"
        className="pk-btn"
        style={{ marginTop: 8 }}
        onClick={() => onTrain(leak.trainingTab, leak.positions[0]?.position)}
      >
        {leak.trainingTab === 'preflop'
          ? `Treinar ${leak.positions[0]?.position ?? 'pré-flop'}`
          : 'Treinar outs e pot odds'}
      </button>
    </div>
  )
}

type ResultFilter = 'todas' | 'ganhou' | 'perdeu' | 'erros'

function HandList({
  reports,
  onSelect,
  display,
}: {
  reports: HandReport[]
  onSelect: (id: string) => void
  display: ChipDisplay
}) {
  const [filter, setFilter] = useState<ResultFilter>('todas')
  const [position, setPosition] = useState<Position | 'todas'>('todas')

  const positions = useMemo(
    () => [...new Set(reports.map((r) => r.hand.heroPosition))],
    [reports],
  )

  const visible = reports
    // A análise termina fora de ordem (ela roda em fatias); a leitura tem que
    // vir da mais recente para a mais antiga.
    .slice()
    .sort((a, b) => b.hand.playedOn.localeCompare(a.hand.playedOn))
    .filter(({ hand, notes }) => {
      if (position !== 'todas' && hand.heroPosition !== position) return false
      if (filter === 'ganhou') return hand.heroNet > 0
      if (filter === 'perdeu') return hand.heroNet < 0
      if (filter === 'erros') return notes.some((n) => n.severity === 'erro')
      return true
    })

  return (
    <div className="pk-card">
      <h2>Mãos</h2>
      <div className="pk-chips" style={{ margin: '8px 0' }}>
        {(['todas', 'ganhou', 'perdeu', 'erros'] as ResultFilter[]).map((key) => (
          <button
            key={key}
            type="button"
            className="pk-pill"
            aria-pressed={filter === key}
            onClick={() => setFilter(key)}
          >
            {key === 'erros' ? 'com erro' : key}
          </button>
        ))}
      </div>
      <div className="pk-chips" style={{ marginBottom: 4 }}>
        <button
          type="button"
          className="pk-pill"
          aria-pressed={position === 'todas'}
          onClick={() => setPosition('todas')}
        >
          Todas posições
        </button>
        {positions.map((p) => (
          <button
            key={p}
            type="button"
            className="pk-pill"
            aria-pressed={position === p}
            onClick={() => setPosition(p)}
          >
            {p}
          </button>
        ))}
      </div>

      {visible.length === 0 ? (
        <p className="pk-note" style={{ marginTop: 10 }}>
          Nenhuma mão com esse filtro.
        </p>
      ) : (
        visible.map(({ hand, notes }) => {
          // Sem erro, mostra o acerto: quem revê a sessão precisa ver o que
          // fez certo, não só a lista do que errou.
          const worst =
            notes.find((n) => n.severity === 'erro') ??
            notes.find((n) => n.severity === 'atencao') ??
            notes.find((n) => n.severity === 'acerto')
          return (
            <button key={hand.id} type="button" className="pk-hand-row" onClick={() => onSelect(hand.id)}>
              <div className="pk-row-between">
                <span className="pk-row" style={{ gap: 8 }}>
                  <CardRow cards={hand.heroCards} size="sm" />
                  <span className="pk-badge">{hand.heroPosition}</span>
                </span>
                <span className={`pk-net ${hand.heroNet >= 0 ? 'is-up' : 'is-down'}`}>
                  {formatResult(hand.heroNet, hand.bigBlind, display)}
                </span>
              </div>
              {worst && (
                <p className="pk-note" style={{ marginTop: 6 }}>
                  <span className={`pk-flag is-${worst.severity}`}>{worst.title}</span>
                </p>
              )}
            </button>
          )
        })
      )}
    </div>
  )
}

const STREET_ORDER: ParsedStreet[] = ['preflop', 'flop', 'turn', 'river']
const STREET_LABEL: Record<ParsedStreet, string> = {
  preflop: 'Pré-flop',
  flop: 'Flop',
  turn: 'Turn',
  river: 'River',
}

/**
 * Replay rua a rua.
 *
 * A observação aparece grudada na ação que a gerou, e não numa lista no fim: o
 * erro faz sentido no contexto do pote e do board daquele momento, que é
 * exatamente a informação que o jogador tinha quando decidiu.
 */
function HandReplay({
  report,
  onBack,
  display,
}: {
  report: HandReport
  onBack: () => void
  display: ChipDisplay
}) {
  const { hand, notes } = report
  const played = STREET_ORDER.filter(
    (s) => hand.streets[s].length > 0 || hand.boards[s].length > 0,
  )
  const [step, setStep] = useState(0)
  const street = played[Math.min(step, played.length - 1)] ?? 'preflop'
  const board = hand.boards[street]

  const streetNotes = notes.filter((n) => n.street === street)

  return (
    <>
      <div className="pk-card">
        <div className="pk-row-between">
          <div>
            <p className="pk-eyebrow" style={{ margin: 0 }}>
              Mão #{hand.id}
            </p>
            <p className="pk-note">
              {hand.tableName} · blinds {hand.smallBlind}/{hand.bigBlind} · {hand.playedAt}
            </p>
          </div>
          <button type="button" className="pk-back" onClick={onBack}>
            Voltar
          </button>
        </div>
      </div>

      <div className="pk-table">
        <div className="pk-row-between" style={{ marginBottom: 10 }}>
          <span className="pk-badge is-gold">{hand.heroPosition}</span>
          <CardRow cards={hand.heroCards} size="sm" />
          <span className={`pk-net ${hand.heroNet >= 0 ? 'is-up' : 'is-down'}`}>
            {formatResult(hand.heroNet, hand.bigBlind, display)}
          </span>
        </div>

        <div className="pk-board">
          {board.length === 0 ? (
            <p className="pk-note" style={{ margin: 0 }}>
              Sem cartas na mesa.
            </p>
          ) : (
            <CardRow cards={board} />
          )}
        </div>

        <div className="pk-chips" style={{ justifyContent: 'center', marginTop: 12 }}>
          {played.map((s, i) => (
            <button
              key={s}
              type="button"
              className="pk-pill"
              aria-pressed={street === s}
              onClick={() => setStep(i)}
            >
              {STREET_LABEL[s]}
            </button>
          ))}
        </div>
      </div>

      <div className="pk-card">
        <p className="pk-eyebrow">{STREET_LABEL[street]}</p>
        <ul className="pk-list">
          {hand.streets[street].map((action, index) => {
            const note = streetNotes.find((n) => n.actionIndex === index)
            const isHero = action.player === hand.heroName
            return (
              <li key={`${action.player}-${index}`}>
                <div className="pk-row-between">
                  <span style={{ fontWeight: isHero ? 600 : 400, fontSize: 13 }}>
                    {isHero ? 'Você' : action.player}
                  </span>
                  <span className="pk-num pk-muted" style={{ fontSize: 12 }}>
                    {describeAction(action.type)}
                    {/* Aumento se anuncia pelo total da rua; os outros, pelo que foi pago. */}
                    {action.type === 'raise'
                      ? ` ${formatAmount(action.to, hand.bigBlind, display)}`
                      : action.amount > 0
                        ? ` ${formatAmount(action.amount, hand.bigBlind, display)}`
                        : ''}
                    {action.allIn ? ' (all-in)' : ''}
                  </span>
                </div>
                {isHero && action.toCall > 0 && (
                  <p className="pk-note" style={{ fontSize: 11, marginTop: 3 }}>
                    pote {formatAmount(action.potBefore, hand.bigBlind, display)} · para pagar{' '}
                    {formatAmount(action.toCall, hand.bigBlind, display)}
                  </p>
                )}
                {note && <NoteCard note={note} />}
              </li>
            )
          })}
        </ul>
        {hand.streets[street].length === 0 && (
          <p className="pk-note">Ninguém agiu nesta rua — a mão foi direto para a próxima carta.</p>
        )}
      </div>

      {hand.shown.length > 0 && (
        <div className="pk-card">
          <p className="pk-eyebrow">Showdown</p>
          {hand.shown.map((entry) => (
            <div className="pk-row-between" key={entry.name} style={{ padding: '6px 0' }}>
              <span style={{ fontSize: 13 }}>{entry.name === hand.heroName ? 'Você' : entry.name}</span>
              <CardRow cards={entry.cards} size="sm" />
            </div>
          ))}
        </div>
      )}

      <div className="pk-card">
        <p className="pk-eyebrow">Resultado</p>
        <p className="pk-note">
          Pote de {formatAmount(hand.totalPot, hand.bigBlind, display)}
          {hand.winners.length > 0 &&
            ` — ${hand.winners
              .map(
                (w) =>
                  `${w.name === hand.heroName ? 'você' : w.name} levou ${formatAmount(w.amount, hand.bigBlind, display)}`,
              )
              .join(', ')}`}
          .
        </p>
      </div>
    </>
  )
}

function NoteCard({ note }: { note: HandNote }) {
  return (
    <div
      className={`pk-verdict ${note.severity === 'acerto' ? 'is-right' : 'is-wrong'}`}
      style={{ marginTop: 8 }}
    >
      <h3>
        <span className={`pk-flag is-${note.severity}`} style={{ marginRight: 6 }}>
          {note.severity === 'erro' ? 'erro' : note.severity === 'atencao' ? 'atenção' : 'acerto'}
        </span>
        {note.title}
      </h3>
      <p className="pk-note" style={{ color: 'inherit' }}>
        {note.detail}
      </p>
    </div>
  )
}

function describeAction(type: string): string {
  return (
    { fold: 'desistiu', check: 'passou', call: 'pagou', bet: 'apostou', raise: 'aumentou para' }[
      type
    ] ?? type
  )
}
