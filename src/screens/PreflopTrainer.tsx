import { useCallback, useEffect, useState } from 'react'

import { CardRow } from '../components/PlayingCard'
import type { Card } from '../lib/cards'
import { createDeck, shuffle } from '../lib/cards'
import type { Position, PreflopAdvice, PreflopVerdict } from '../lib/chen'
import {
  OPEN_THRESHOLDS,
  POSITION_HINT,
  POSITION_NAME,
  TRAINABLE_POSITIONS,
  preflopVerdict,
} from '../lib/chen'

interface Question {
  position: Position
  cards: [Card, Card]
}

interface Props {
  /** Posição vinda de um leak — o treino já abre focado no erro do usuário. */
  focusPosition?: Position | null
  onClearFocus?: () => void
  /** Registra a resposta no histórico persistido, que alimenta a aba Evolução. */
  onRecord?: (event: { kind: 'preflop'; correct: boolean; position: Position }) => void
}

/**
 * Treino de abertura por posição.
 *
 * O feedback mostra a conta inteira, não só "certo/errado": o objetivo é que
 * depois de algumas dezenas de mãos o usuário consiga estimar o score sozinho
 * na mesa. Um app que só diz "errado" ensina a chutar melhor, não a jogar.
 */
export function PreflopTrainer({ focusPosition, onClearFocus, onRecord }: Props) {
  const [restrict, setRestrict] = useState<Position | null>(focusPosition ?? null)
  const [question, setQuestion] = useState<Question>(() => draw(focusPosition ?? null))
  const [verdict, setVerdict] = useState<{ answer: PreflopAdvice; result: PreflopVerdict } | null>(
    null,
  )
  const [score, setScore] = useState({ right: 0, wrong: 0 })

  useEffect(() => {
    if (focusPosition) {
      setRestrict(focusPosition)
      setQuestion(draw(focusPosition))
      setVerdict(null)
    }
  }, [focusPosition])

  const next = useCallback(() => {
    setQuestion(draw(restrict))
    setVerdict(null)
  }, [restrict])

  const answer = (choice: PreflopAdvice) => {
    if (verdict) return
    const result = preflopVerdict(question.cards[0], question.cards[1], question.position)
    const right = choice === result.advice

    setVerdict({ answer: choice, result })
    setScore((s) => (right ? { ...s, right: s.right + 1 } : { ...s, wrong: s.wrong + 1 }))
    onRecord?.({ kind: 'preflop', correct: right, position: question.position })
  }

  const correct = verdict ? verdict.answer === verdict.result.advice : false
  const total = score.right + score.wrong

  return (
    <>
      <div className="pk-card">
        <div className="pk-row-between">
          <p className="pk-eyebrow" style={{ margin: 0 }}>
            Abertura por posição
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

        <div className="pk-chips" style={{ marginTop: 10 }}>
          <button
            type="button"
            className="pk-pill"
            aria-pressed={restrict === null}
            onClick={() => {
              setRestrict(null)
              onClearFocus?.()
              setQuestion(draw(null))
              setVerdict(null)
            }}
          >
            Todas
          </button>
          {TRAINABLE_POSITIONS.map((position) => (
            <button
              key={position}
              type="button"
              className="pk-pill"
              aria-pressed={restrict === position}
              onClick={() => {
                setRestrict(position)
                setQuestion(draw(position))
                setVerdict(null)
              }}
            >
              {position}
            </button>
          ))}
        </div>
      </div>

      <div className="pk-card">
        <p className="pk-eyebrow">Você está no {POSITION_NAME[question.position]}</p>
        <p className="pk-note" style={{ marginBottom: 12 }}>
          {POSITION_HINT[question.position]} Ninguém aumentou até aqui.
        </p>

        <div style={{ display: 'flex', justifyContent: 'center', margin: '4px 0 16px' }}>
          <CardRow cards={question.cards} dealt />
        </div>

        {!verdict ? (
          <div className="pk-btn-row">
            <button type="button" className="pk-btn is-danger" onClick={() => answer('fold')}>
              Desistir
            </button>
            <button type="button" className="pk-btn is-primary" onClick={() => answer('raise')}>
              Aumentar
            </button>
          </div>
        ) : (
          <>
            <div className={`pk-verdict ${correct ? 'is-right' : 'is-wrong'}`}>
              <h3>
                {correct ? 'Certo.' : 'Errado.'}{' '}
                {verdict.result.advice === 'raise' ? 'A mão abre.' : 'A mão descarta.'}
              </h3>
              <p className="pk-note" style={{ color: 'inherit' }}>
                {verdict.result.explanation}
              </p>
              <ul className="pk-steps">
                {verdict.result.steps.map((step) => (
                  <li key={step}>{step}</li>
                ))}
              </ul>
              <p className="pk-note" style={{ marginTop: 8 }}>
                Limiar do {question.position}: {OPEN_THRESHOLDS[question.position]} pontos.
              </p>
            </div>
            <button
              type="button"
              className="pk-btn is-primary"
              style={{ width: '100%', marginTop: 10 }}
              onClick={next}
              autoFocus
            >
              Próxima mão
            </button>
          </>
        )}
      </div>

      <div className="pk-card">
        <h3>A régua</h3>
        <p className="pk-note">
          A fórmula de Chen resume a mão inicial em um número. Cada posição tem um limiar: se o
          score alcança, abre; se não alcança, descarta. Quanto mais cedo você fala, mais gente
          pode ter mão melhor — por isso o UTG exige 9 e o botão se contenta com 5.
        </p>
        <div style={{ marginTop: 10 }}>
          {TRAINABLE_POSITIONS.map((position) => (
            <div className="pk-row-between" key={position} style={{ padding: '5px 0' }}>
              <span style={{ fontSize: 13 }}>{POSITION_NAME[position]}</span>
              <span className="pk-num" style={{ color: 'var(--pk-gold)' }}>
                {OPEN_THRESHOLDS[position]}
              </span>
            </div>
          ))}
        </div>
      </div>
    </>
  )
}

function draw(restrict: Position | null): Question {
  const deck = shuffle(createDeck())
  const position =
    restrict ?? TRAINABLE_POSITIONS[Math.floor(Math.random() * TRAINABLE_POSITIONS.length)]
  return { position, cards: [deck[0], deck[1]] }
}
