import { useEffect, useMemo, useRef, useState } from 'react'

import { CardRow, ChipIcon, PlayingCard } from '../components/PlayingCard'
import { decideBotAction } from '../lib/bots'
import type { ChipDisplay } from '../lib/format'
import { formatAmount, formatChips } from '../lib/format'
import { isUpperSeat, ringPoint, tableHeight } from '../lib/tableLayout'
import type {
  ActionType,
  PlayerAction,
  TournamentPlayer,
  TournamentState,
} from '../lib/tournament'
import {
  HERO_ID,
  actionOptions,
  applyAction,
  blindsOf,
  createTournament,
  currentActor,
  potSize,
  seatNameOf,
  startHand,
} from '../lib/tournament'

/** Pausa entre as ações dos bots — sem isso a mão inteira acontece num piscar. */
const BOT_DELAY_MS = 750

/**
 * Quão para dentro do anel ficam as fichas apostadas.
 *
 * A meio caminho do centro elas batiam no balão da última ação dos assentos de
 * cima, que desce por baixo da placa: "AUMENTOU 50" cobria justamente as fichas
 * de 50. Mais para dentro, cada um tem seu lugar.
 */
const BET_RING_SCALE = 0.42

interface ScreenProps {
  display: ChipDisplay
  onDisplayChange: (display: ChipDisplay) => void
}

export function TournamentScreen({ display, onDisplayChange }: ScreenProps) {
  const [state, setState] = useState<TournamentState | null>(null)
  const [botCount, setBotCount] = useState(5)

  if (!state) {
    return (
      <Lobby
        botCount={botCount}
        setBotCount={setBotCount}
        onStart={() => setState(createTournament({ botCount }))}
      />
    )
  }

  return (
    <Table
      state={state}
      setState={setState}
      onQuit={() => setState(null)}
      display={display}
      onDisplayChange={onDisplayChange}
    />
  )
}

interface LobbyProps {
  botCount: number
  setBotCount: (n: number) => void
  onStart: () => void
}

function Lobby({ botCount, setBotCount, onStart }: LobbyProps) {
  return (
    <>
      <div className="pk-card">
        <div className="pk-row" style={{ marginBottom: 10 }}>
          <ChipIcon />
          <div>
            <h2 style={{ margin: 0 }}>Mesa final</h2>
            <p className="pk-note">Torneio até sobrar um.</p>
          </div>
        </div>
        <p className="pk-note">
          Todos começam com 1.500 fichas. As blinds sobem a cada 6 mãos — quanto mais o torneio
          anda, menos o stack aguenta esperar mão boa. Os bots jogam pela mesma fórmula que o app
          ensina no pré-flop e por cálculo de equity no pós-flop.
        </p>
      </div>

      <div className="pk-card">
        <p className="pk-eyebrow">Quantos adversários</p>
        <div className="pk-chips">
          {[2, 5, 8].map((n) => (
            <button
              key={n}
              type="button"
              className="pk-pill"
              aria-pressed={botCount === n}
              onClick={() => setBotCount(n)}
            >
              {n} bots · mesa de {n + 1}
            </button>
          ))}
        </div>
        <button
          type="button"
          className="pk-btn is-primary"
          style={{ width: '100%', marginTop: 14 }}
          onClick={onStart}
        >
          Começar torneio
        </button>
      </div>
    </>
  )
}

interface TableProps {
  state: TournamentState
  setState: (updater: (prev: TournamentState | null) => TournamentState | null) => void
  onQuit: () => void
  display: ChipDisplay
  onDisplayChange: (display: ChipDisplay) => void
}

function Table({ state, setState, onQuit, display, onDisplayChange }: TableProps) {
  const actor = currentActor(state)
  const heroTurn = actor?.id === HERO_ID
  const pot = potSize(state)
  const { sb, bb } = blindsOf(state)
  const logRef = useRef<HTMLUListElement>(null)

  /**
   * Turno dos bots.
   *
   * O timer é montado e desmontado pelo efeito: em `StrictMode` o React monta,
   * limpa e remonta, e sem a limpeza a mesma decisão seria aplicada duas vezes
   * — o bot agiria em dobro e a mão andaria sozinha.
   */
  useEffect(() => {
    if (state.phase !== 'acting') return
    const next = currentActor(state)
    if (!next || next.isHuman) return

    const timer = setTimeout(() => {
      setState((prev) => {
        if (!prev || prev.phase !== 'acting') return prev
        const acting = currentActor(prev)
        if (!acting || acting.isHuman) return prev
        return applyAction(prev, decideBotAction(prev, acting))
      })
    }, BOT_DELAY_MS)

    return () => clearTimeout(timer)
  }, [state, setState])

  useEffect(() => {
    const list = logRef.current
    if (list) list.scrollTop = list.scrollHeight
  }, [state.log.length])

  const act = (action: PlayerAction) => {
    setState((prev) => (prev ? applyAction(prev, action) : prev))
  }

  const showdownIds = useMemo(
    () => new Set(state.outcome?.shown.map((s) => s.playerId) ?? []),
    [state.outcome],
  )

  if (state.phase === 'over') {
    return <Result state={state} onQuit={onQuit} display={display} bigBlind={bb} />
  }

  // A altura acompanha o tamanho da mesa: com nove assentos o oval precisa de
  // mais espaço vertical para as placas não se encavalarem.
  const areaHeight = tableHeight(state.players.length)

  return (
    <>
      <div className="pk-card">
        <div className="pk-row-between">
          <div>
            <p className="pk-eyebrow" style={{ margin: 0 }}>
              Mão {state.handNumber} · nível {state.levelIndex + 1}
            </p>
            <p className="pk-num" style={{ margin: '3px 0 0', fontSize: 13 }}>
              blinds {formatChips(sb)}/{formatChips(bb)}
            </p>
          </div>
          <button type="button" className="pk-back" onClick={onQuit}>
            Sair da mesa
          </button>
        </div>

        <div className="pk-chips" style={{ marginTop: 10 }}>
          <span className="pk-stat-label" style={{ alignSelf: 'center', marginRight: 2 }}>
            MOSTRAR
          </span>
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
      </div>

      <div className="pk-table">
        <div className="pk-table-area" style={{ height: areaHeight }}>
          <div className="pk-felt" />

          <div className="pk-felt-center">
            <span className="pk-pot">
              <span className="pk-pot-label">Pote</span>
              <span className="pk-pot-value">{formatAmount(pot, bb, display)}</span>
            </span>

            <div className="pk-board">
              {state.board.length === 0 ? (
                <span className="pk-board-empty">pré-flop</span>
              ) : (
                state.board.map((card) => (
                  <PlayingCard key={`${card.rank}${card.suit}`} card={card} size="md" dealt />
                ))
              )}
            </div>
          </div>

          {state.players.map((player, index) => (
            <Seat
              key={player.id}
              player={player}
              state={state}
              index={index}
              isTurn={actor?.id === player.id}
              reveal={showdownIds.has(player.id)}
              display={display}
              bigBlind={bb}
            />
          ))}
        </div>

        <ul className="pk-log" ref={logRef}>
          {state.log.map((entry) => (
            <li
              key={entry.id}
              className={
                entry.kind === 'street' ? 'is-street' : entry.kind === 'result' ? 'is-result' : ''
              }
            >
              {entry.text}
            </li>
          ))}
        </ul>
      </div>

      {state.phase === 'handOver' ? (
        <div className="pk-actions">
          <p style={{ margin: '0 0 6px', fontSize: 14, textAlign: 'center' }}>
            {state.outcome?.headline}
          </p>
          <button
            type="button"
            className="pk-btn is-primary"
            onClick={() => setState((prev) => (prev ? startHand(prev) : prev))}
            autoFocus
          >
            Próxima mão
          </button>
        </div>
      ) : heroTurn && actor ? (
        <HeroActions state={state} hero={actor} onAct={act} display={display} bigBlind={bb} />
      ) : (
        <div className="pk-actions">
          <p className="pk-note" style={{ margin: 0, textAlign: 'center' }}>
            {actor ? `${actor.name} está pensando…` : 'Distribuindo…'}
          </p>
        </div>
      )}
    </>
  )
}

/** O ponto do anel como estilo CSS. A conta em si mora em `lib/tableLayout`. */
function seatStyle(index: number, total: number, scale = 1) {
  const { leftPct, topPct } = ringPoint(index, total, scale)
  return { left: `${leftPct}%`, top: `${topPct}%` }
}

/** O assento do herói não segue o anel: fica preso ao centro da borda de baixo. */
function heroStyle() {
  return { left: '50%', top: 'auto', bottom: 0 }
}

interface SeatProps {
  player: TournamentPlayer
  state: TournamentState
  index: number
  isTurn: boolean
  reveal: boolean
  display: ChipDisplay
  bigBlind: number
}

function Seat({ player, state, index, isTurn, reveal, display, bigBlind }: SeatProps) {
  const hero = player.isHuman
  const total = state.players.length
  const position = player.inHand ? seatNameOf(state, player.id) : null
  const out = player.stack === 0 && !player.inHand
  const isDealer = state.buttonIndex === index

  const classes = [
    'pk-seat',
    isTurn ? 'is-turn' : '',
    player.folded || out ? 'is-folded' : '',
    hero ? 'is-hero' : '',
    isUpperSeat(index, total) ? 'is-upper' : '',
  ]
    .filter(Boolean)
    .join(' ')

  const showCards = player.inHand && !player.folded

  return (
    <>
      <div className={classes} style={hero ? heroStyle() : seatStyle(index, total)}>
        {player.allIn && <span className="pk-allin">all-in</span>}
        {/* Quem desistiu já está apagado e sem cartas: repetir "desistiu" em
            balão só enche a mesa de rótulo em mão com muita gente. */}
        {!player.allIn && !player.folded && player.lastAct && (
          <span className={`pk-seat-say${sayTone(player.lastAct.kind)}`}>
            {sayText(player.lastAct)}
          </span>
        )}

        <div className="pk-seat-cards">
          {showCards ? (
            <CardRow
              cards={player.hole}
              hidden={!hero && !reveal}
              size={hero ? 'md' : 'xs'}
              dealt
            />
          ) : null}
        </div>

        <div className={`pk-plate${out ? ' is-out' : ''}`}>
          <span className="pk-plate-name">{hero ? 'Você' : player.name}</span>
          <span className="pk-plate-line">
            {/* A posição fica dentro da placa: como etiqueta flutuante ela
                colidia com o balão da última ação. */}
            {position && <span className="pk-plate-pos">{position}</span>}
            <span className="pk-plate-stack">
              {out ? 'eliminado' : formatAmount(player.stack, bigBlind, display)}
            </span>
          </span>
        </div>
      </div>

      {isDealer && player.inHand && (
        <span
          className="pk-dealer"
          style={seatStyle(index, total, 0.62)}
          aria-label="Botão do dealer"
        >
          D
        </span>
      )}

      {player.betThisRound > 0 && (
        <span className="pk-chips-bet" style={seatStyle(index, total, BET_RING_SCALE)}>
          <span className="pk-chip-stack" aria-hidden="true">
            <span />
            <span />
            <span />
          </span>
          <span className="pk-bet-value">
            {formatAmount(player.betThisRound, bigBlind, display)}
          </span>
        </span>
      )}
    </>
  )
}

/** Desistiu fica apagado; agressão fica em vermelho — como se lê numa mesa. */
function sayTone(kind: ActionType): string {
  if (kind === 'fold') return ' is-fold'
  if (kind === 'raise' || kind === 'bet') return ' is-aggro'
  return ''
}

/**
 * O balão do assento — só o verbo, sem o valor.
 *
 * O valor já está nas fichas apostadas, ao lado do assento, que é onde uma mesa
 * de verdade o mostra. Repetir no balão deixava "Aumentou 1.450" largo o
 * bastante para cobrir a placa do vizinho numa mesa de nove.
 */
function sayText(act: { kind: ActionType; amount: number }): string {
  switch (act.kind) {
    case 'fold':
      return 'Desistiu'
    case 'check':
      return 'Passou'
    case 'call':
      return 'Pagou'
    case 'bet':
      return 'Apostou'
    default:
      return 'Aumentou'
  }
}

interface HeroActionsProps {
  state: TournamentState
  hero: TournamentPlayer
  onAct: (action: PlayerAction) => void
  display: ChipDisplay
  bigBlind: number
}

/**
 * Painel de ação, na ordem do cliente: desistir, pagar, aumentar.
 *
 * O aumento ganhou controle deslizante e atalhos de fração do pote porque
 * escolher o tamanho *é* a decisão — dois botões fixos ensinavam que só existem
 * dois tamanhos, que é exatamente o vício que trava o jogador iniciante.
 */
function HeroActions({ state, hero, onAct, display, bigBlind }: HeroActionsProps) {
  const options = actionOptions(state, hero)
  const canRaise = options.minRaiseTo > 0 && options.maxRaiseTo > options.minRaiseTo
  const [amount, setAmount] = useState(options.potRaiseTo || options.minRaiseTo)

  // A situação mudou (nova rua, novo aumento): o valor sugerido volta a valer.
  const signature = `${state.handNumber}:${state.street}:${state.currentBet}:${hero.betThisRound}`
  const lastSignature = useRef(signature)
  if (lastSignature.current !== signature) {
    lastSignature.current = signature
    const suggested = options.potRaiseTo || options.minRaiseTo
    if (suggested !== amount) setAmount(suggested)
  }

  const clamped = Math.min(Math.max(amount, options.minRaiseTo), options.maxRaiseTo)
  const pot = potSize(state)
  const verb = state.currentBet > 0 ? 'Aumentar' : 'Apostar'

  /** Fração do pote já contando o que falta pagar — a conta que a mesa usa. */
  const fractionTo = (fraction: number) =>
    Math.min(
      Math.max(state.currentBet + Math.round((pot + options.callAmount) * fraction), options.minRaiseTo),
      options.maxRaiseTo,
    )

  const presets: { label: string; value: number }[] = [
    { label: '½ pote', value: fractionTo(0.5) },
    { label: '¾ pote', value: fractionTo(0.75) },
    { label: 'Pote', value: fractionTo(1) },
    { label: 'Máx', value: options.maxRaiseTo },
  ]

  return (
    <div className="pk-actions">
      {canRaise && (
        <div className="pk-raise">
          <div className="pk-raise-head">
            <span className="pk-stat-label">{verb.toUpperCase()} PARA</span>
            <span className="pk-raise-value">{formatAmount(clamped, bigBlind, display)}</span>
          </div>

          <input
            type="range"
            className="pk-slider"
            min={options.minRaiseTo}
            max={options.maxRaiseTo}
            step={Math.max(1, Math.round(bigBlind / 2))}
            value={clamped}
            onChange={(e) => setAmount(Number(e.target.value))}
            aria-label={`${verb} para`}
          />

          <div className="pk-chips">
            {presets.map((preset) => (
              <button
                key={preset.label}
                type="button"
                className="pk-pill"
                aria-pressed={clamped === preset.value}
                onClick={() => setAmount(preset.value)}
              >
                {preset.label}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="pk-btn-row">
        <button type="button" className="pk-btn is-fold" onClick={() => onAct({ type: 'fold' })}>
          Desistir
        </button>

        {options.canCheck ? (
          <button type="button" className="pk-btn is-call" onClick={() => onAct({ type: 'check' })}>
            Passar
          </button>
        ) : (
          <button type="button" className="pk-btn is-call" onClick={() => onAct({ type: 'call' })}>
            {options.isAllInCall ? 'All-in' : 'Pagar'}{' '}
            {formatAmount(options.callAmount, bigBlind, display)}
          </button>
        )}

        {canRaise ? (
          <button
            type="button"
            className="pk-btn is-raise"
            onClick={() => onAct({ type: 'raise', amount: clamped })}
          >
            {clamped >= options.maxRaiseTo ? 'All-in' : verb}
          </button>
        ) : (
          options.minRaiseTo > 0 && (
            <button
              type="button"
              className="pk-btn is-raise"
              onClick={() => onAct({ type: 'allin' })}
            >
              All-in
            </button>
          )
        )}
      </div>
    </div>
  )
}

interface ResultProps {
  state: TournamentState
  onQuit: () => void
  display: ChipDisplay
  bigBlind: number
}

function Result({ state, onQuit, display, bigBlind }: ResultProps) {
  const hero = state.players.find((p) => p.id === HERO_ID)
  const champion = hero?.place === 1

  const ranking = state.players.slice().sort((a, b) => (a.place ?? 99) - (b.place ?? 99))

  return (
    <>
      <div className="pk-card" style={{ textAlign: 'center' }}>
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 10 }}>
          <ChipIcon />
        </div>
        <h2 style={{ fontSize: 20 }}>
          {champion ? 'Você levou o torneio.' : `${hero?.place ?? 0}º lugar`}
        </h2>
        <p className="pk-note">
          {champion
            ? 'Todas as fichas da mesa terminaram do seu lado. Repita com mais adversários para aumentar a dificuldade.'
            : 'O torneio acabou para você. Reveja o que aconteceu nas mãos grandes — quase sempre a decisão cara foi tomada antes do river.'}
        </p>
      </div>

      <div className="pk-card">
        <p className="pk-eyebrow">Classificação</p>
        <ul className="pk-list">
          {ranking.map((player) => (
            <li key={player.id} className="pk-row-between">
              <span>
                <span className="pk-num" style={{ color: 'var(--pk-gold)', marginRight: 8 }}>
                  {player.place ?? '—'}º
                </span>
                {player.isHuman ? 'Você' : player.name}
              </span>
              <span className="pk-num pk-muted">
                {formatAmount(player.stack, bigBlind, display)}
              </span>
            </li>
          ))}
        </ul>
      </div>

      <button type="button" className="pk-btn is-primary" style={{ width: '100%' }} onClick={onQuit}>
        Novo torneio
      </button>
    </>
  )
}
