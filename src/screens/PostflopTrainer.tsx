import { useCallback, useEffect, useState } from 'react'

import { DRAWS } from '../data/draws'
import type { DrawType } from '../data/draws'
import { SCENARIOS } from '../data/scenarios'
import type { Scenario } from '../data/scenarios'
import { CardRow } from '../components/PlayingCard'
import { parseCards } from '../lib/cards'
import { potOddsRatio, requiredEquity, ruleOf42 } from '../lib/equity'

type Mode = 'outs' | 'cenarios'

/** Registro de uma resposta, para o histórico persistido da aba Evolução. */
export type RecordDrill = (event: {
  kind: 'outs' | 'cenario'
  correct: boolean
  outs?: number
  scenarioId?: string
}) => void

interface Props {
  /** Modo inicial — o painel de leaks abre direto no drill de odds. */
  focusMode?: Mode | null
  onRecord?: RecordDrill
}

export function PostflopTrainer({ focusMode, onRecord }: Props) {
  const [mode, setMode] = useState<Mode>(focusMode ?? 'outs')

  useEffect(() => {
    if (focusMode) setMode(focusMode)
  }, [focusMode])

  return (
    <>
      <div className="pk-card">
        <div className="pk-chips">
          <button
            type="button"
            className="pk-pill"
            aria-pressed={mode === 'outs'}
            onClick={() => setMode('outs')}
          >
            Outs e pot odds
          </button>
          <button
            type="button"
            className="pk-pill"
            aria-pressed={mode === 'cenarios'}
            onClick={() => setMode('cenarios')}
          >
            Leitura de jogo
          </button>
        </div>
      </div>

      {mode === 'outs' ? <OutsDrill onRecord={onRecord} /> : <ScenarioDrill onRecord={onRecord} />}
    </>
  )
}

interface DrillQuestion {
  draw: DrawType
  street: 'flop' | 'turn'
  pot: number
  bet: number
}

/**
 * Drill infinito de outs contra pot odds.
 *
 * O usuário decide antes de ver a conta; a conta aparece inteira depois. É a
 * ordem que importa: ver o número primeiro transformaria o exercício numa
 * comparação de dois valores, que não é a habilidade sendo treinada.
 */
function OutsDrill({ onRecord }: { onRecord?: RecordDrill }) {
  const [question, setQuestion] = useState<DrillQuestion>(drawQuestion)
  const [answer, setAnswer] = useState<'pagar' | 'desistir' | null>(null)
  const [score, setScore] = useState({ right: 0, wrong: 0 })

  const equity = ruleOf42(question.draw.outs, question.street === 'flop' ? 2 : 1)
  const needed = requiredEquity(question.pot, question.bet)
  const shouldCall = equity >= needed

  const next = useCallback(() => {
    setQuestion(drawQuestion())
    setAnswer(null)
  }, [])

  const choose = (choice: 'pagar' | 'desistir') => {
    if (answer) return
    const right = (choice === 'pagar') === shouldCall

    setAnswer(choice)
    setScore((s) => (right ? { ...s, right: s.right + 1 } : { ...s, wrong: s.wrong + 1 }))
    onRecord?.({ kind: 'outs', correct: right, outs: question.draw.outs })
  }

  const correct = answer ? (answer === 'pagar') === shouldCall : false
  const total = score.right + score.wrong

  return (
    <>
      <div className="pk-card">
        <div className="pk-row-between">
          <p className="pk-eyebrow" style={{ margin: 0 }}>
            {question.street === 'flop' ? 'No flop — faltam 2 cartas' : 'No turn — falta 1 carta'}
          </p>
          <div className="pk-score">
            <span>
              acertos <b>{score.right}</b>
            </span>
            <span>
              erros <b>{score.wrong}</b>
            </span>
            {total > 0 && (
              <span>
                <b>{Math.round((score.right / total) * 100)}%</b>
              </span>
            )}
          </div>
        </div>

        <p style={{ fontSize: 15, margin: '12px 0 4px' }}>
          Você tem <strong>{question.draw.name.toLowerCase()}</strong>.
        </p>
        <p className="pk-note">{question.draw.hint}</p>

        <div className="pk-stat-grid" style={{ margin: '14px 0' }}>
          <div>
            <span className="pk-stat-value">{question.pot}</span>
            <span className="pk-stat-label">POTE</span>
          </div>
          <div>
            <span className="pk-stat-value" style={{ color: 'var(--pk-red)' }}>
              {question.bet}
            </span>
            <span className="pk-stat-label">APOSTA DELE</span>
          </div>
          <div>
            <span className="pk-stat-value">{question.draw.outs}</span>
            <span className="pk-stat-label">OUTS</span>
          </div>
        </div>

        {!answer ? (
          <div className="pk-btn-row">
            <button type="button" className="pk-btn is-danger" onClick={() => choose('desistir')}>
              Desistir
            </button>
            <button type="button" className="pk-btn is-primary" onClick={() => choose('pagar')}>
              Pagar {question.bet}
            </button>
          </div>
        ) : (
          <>
            <div className={`pk-verdict ${correct ? 'is-right' : 'is-wrong'}`}>
              <h3>
                {correct ? 'Certo.' : 'Errado.'} {shouldCall ? 'Era para pagar.' : 'Era para desistir.'}
              </h3>
              <ul className="pk-steps">
                <li>
                  Equity: {question.draw.outs} outs × {question.street === 'flop' ? 4 : 2} ={' '}
                  {equity.toFixed(0)}%
                </li>
                <li>
                  Preço: {question.bet} ÷ ({question.pot} + {question.bet}) = {needed.toFixed(1)}%
                </li>
                <li>Pot odds: {potOddsRatio(question.pot, question.bet)}</li>
                <li>
                  {equity.toFixed(0)}% {shouldCall ? '≥' : '<'} {needed.toFixed(1)}% →{' '}
                  {shouldCall ? 'pagar dá lucro no longo prazo' : 'pagar perde fichas no longo prazo'}
                </li>
              </ul>
            </div>
            <button
              type="button"
              className="pk-btn is-primary"
              style={{ width: '100%', marginTop: 10 }}
              onClick={next}
              autoFocus
            >
              Próxima situação
            </button>
          </>
        )}
      </div>

      <div className="pk-card">
        <h3>Regra de 4 e 2</h3>
        <p className="pk-note">
          No flop, multiplique os outs por 4 — são duas cartas por vir. No turn, por 2. O resultado
          é a chance aproximada de fechar. Compare com o preço que o pote está oferecendo: se a
          chance é maior que o preço, pagar dá lucro. A regra superestima um pouco acima de 12 outs;
          para esses casos, tire alguns pontos do resultado.
        </p>
      </div>
    </>
  )
}

function drawQuestion(): DrillQuestion {
  const draw = DRAWS[Math.floor(Math.random() * DRAWS.length)]
  const street = Math.random() < 0.5 ? 'flop' : 'turn'
  const pot = [80, 120, 150, 200, 240, 300, 400, 500][Math.floor(Math.random() * 8)]
  // Frações de pote plausíveis: ninguém aposta 13% nem 210% do pote.
  const fraction = [0.33, 0.4, 0.5, 0.66, 0.75, 1][Math.floor(Math.random() * 6)]
  const bet = Math.round((pot * fraction) / 5) * 5
  return { draw, street, pot, bet }
}

/** Banco curado — as situações que a matemática sozinha não resolve. */
function ScenarioDrill({ onRecord }: { onRecord?: RecordDrill }) {
  const [index, setIndex] = useState(() => Math.floor(Math.random() * SCENARIOS.length))
  const [chosen, setChosen] = useState<number | null>(null)
  const [seen, setSeen] = useState<number[]>([])

  const scenario: Scenario = SCENARIOS[index]
  const board = scenario.board === '—' ? [] : parseCards(scenario.board)

  const next = () => {
    const remaining = SCENARIOS.map((_, i) => i).filter((i) => !seen.includes(i) && i !== index)
    const pool = remaining.length > 0 ? remaining : SCENARIOS.map((_, i) => i).filter((i) => i !== index)
    setSeen(remaining.length > 0 ? [...seen, index] : [])
    setIndex(pool[Math.floor(Math.random() * pool.length)])
    setChosen(null)
  }

  return (
    <>
      <div className="pk-card">
        <div className="pk-row-between">
          <p className="pk-eyebrow" style={{ margin: 0 }}>
            {scenario.position} · {scenario.street}
          </p>
          <span className="pk-badge">{scenario.topic}</span>
        </div>

        <div className="pk-row" style={{ margin: '12px 0', flexWrap: 'wrap', gap: 14 }}>
          <div>
            <span className="pk-stat-label">SUA MÃO</span>
            <div style={{ marginTop: 4 }}>
              <CardRow cards={parseCards(scenario.hero)} size="sm" />
            </div>
          </div>
          {board.length > 0 && (
            <div>
              <span className="pk-stat-label">MESA</span>
              <div style={{ marginTop: 4 }}>
                <CardRow cards={board} size="sm" />
              </div>
            </div>
          )}
          <div>
            <span className="pk-stat-label">POTE</span>
            <div className="pk-num" style={{ marginTop: 6, color: 'var(--pk-gold)', fontSize: 17 }}>
              {scenario.pot}
            </div>
          </div>
        </div>

        <p style={{ fontSize: 14, lineHeight: 1.55, margin: '0 0 6px' }}>{scenario.setup}</p>
        <p className="pk-note" style={{ color: 'var(--pk-parchment)' }}>
          {scenario.question}
        </p>

        <div style={{ display: 'grid', gap: 8, marginTop: 12 }}>
          {scenario.options.map((option, i) => {
            const revealed = chosen !== null
            const isChosen = chosen === i
            // Depois da escolha, a resposta certa aparece marcada mesmo que não
            // tenha sido a escolhida — é o que fecha o aprendizado.
            const tone = revealed && option.correct
              ? ' pk-opt-right'
              : revealed && isChosen
                ? ' pk-opt-wrong'
                : ''
            return (
              <button
                key={option.label}
                type="button"
                className={`pk-btn${tone}`}
                style={{
                  textAlign: 'left',
                  opacity: revealed && !option.correct && !isChosen ? 0.45 : 1,
                }}
                onClick={() => {
                  if (chosen !== null) return
                  setChosen(i)
                  onRecord?.({
                    kind: 'cenario',
                    correct: Boolean(option.correct),
                    scenarioId: scenario.id,
                  })
                }}
                disabled={revealed}
              >
                {option.label}
              </button>
            )
          })}
        </div>

        {chosen !== null && (
          <>
            <div
              className={`pk-verdict ${scenario.options[chosen].correct ? 'is-right' : 'is-wrong'}`}
              style={{ marginTop: 12 }}
            >
              <h3>{scenario.options[chosen].correct ? 'Boa leitura.' : 'Não é a melhor linha.'}</h3>
              <p className="pk-note" style={{ color: 'inherit' }}>
                {scenario.options[chosen].feedback}
              </p>
              {!scenario.options[chosen].correct && (
                <p className="pk-note" style={{ marginTop: 8 }}>
                  <strong>
                    {scenario.options.find((o) => o.correct)?.label}
                  </strong>
                  : {scenario.options.find((o) => o.correct)?.feedback}
                </p>
              )}
            </div>
            <p className="pk-note" style={{ marginTop: 10 }}>
              <strong style={{ color: 'var(--pk-gold)' }}>Princípio:</strong> {scenario.lesson}
            </p>
            <button
              type="button"
              className="pk-btn is-primary"
              style={{ width: '100%', marginTop: 10 }}
              onClick={next}
              autoFocus
            >
              Próximo cenário
            </button>
          </>
        )}
      </div>
    </>
  )
}
