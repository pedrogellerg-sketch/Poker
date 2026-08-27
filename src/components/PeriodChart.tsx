import { useState } from 'react'

export interface ChartPoint {
  key: string
  /** Rótulo do eixo: `16/03` ou `mar`. */
  label: string
  /** `null` = período sem dado nenhum, que é diferente de zero. */
  value: number | null
  /** Quantas observações sustentam o valor — vira legenda ao tocar. */
  sample: number
  caption: string
}

interface PeriodChartProps {
  points: ChartPoint[]
  /** `percent` fixa a escala em 0-100; `count` escala pelo maior valor. */
  scale?: 'percent' | 'count'
  /** Linha de referência recessiva (a média do jogador, por exemplo). */
  reference?: { value: number; label: string } | null
  format?: (value: number) => string
  height?: number
  /** Texto quando nenhum período da janela tem dado. */
  emptyMessage?: string
}

/**
 * Barras por período — uma série só, um eixo só.
 *
 * Três decisões que o gráfico carrega:
 *
 * 1. **Período sem dado não é zero.** Semana em que ninguém treinou aparece como
 *    um traço vazado; semana treinada com 0% de acerto aparece como barra rente
 *    ao chão. Empilhar as duas na mesma altura mentiria sobre a pausa.
 * 2. **Uma cor só.** A série é magnitude, não identidade — pintar cada barra de
 *    uma cor sugeriria categorias que não existem. Acerto e erro nunca viram
 *    verde-e-vermelho lado a lado: essa dupla é indistinguível para boa parte
 *    dos daltônicos, e aqui ela seria a única informação.
 * 3. **Os números continuam em texto.** Tocar a barra escreve a conta embaixo, e
 *    a lista completa fica a um toque — o gráfico é o resumo, não a fonte.
 */
export function PeriodChart({
  points,
  scale = 'percent',
  reference = null,
  format = (v) => `${Math.round(v)}%`,
  height = 132,
  emptyMessage = 'Nenhum treino registrado ainda.',
}: PeriodChartProps) {
  const [selected, setSelected] = useState<string | null>(null)

  const max =
    scale === 'percent' ? 100 : Math.max(1, ...points.map((p) => (p.value === null ? 0 : p.value)))

  const active = points.find((p) => p.key === selected) ?? lastWithData(points)

  return (
    <div className="pk-chart">
      <div className="pk-chart-plot" style={{ height }}>
        {reference && reference.value > 0 && (
          <div
            className="pk-chart-ref"
            style={{ bottom: `${Math.min((reference.value / max) * 100, 100)}%` }}
          >
            <span>{reference.label}</span>
          </div>
        )}

        <div className="pk-chart-cols">
          {points.map((point) => {
            const value = point.value
            const ratio = value === null ? 0 : Math.min(value / max, 1)
            const isActive = active?.key === point.key

            return (
              <button
                type="button"
                key={point.key}
                className={`pk-chart-col${isActive ? ' is-active' : ''}`}
                onClick={() => setSelected(point.key)}
                title={point.caption}
                aria-label={point.caption}
              >
                <span className="pk-chart-track">
                  {value === null ? (
                    <span className="pk-chart-empty" />
                  ) : (
                    <span
                      className="pk-chart-fill"
                      // 3px de piso: 0% precisa continuar sendo uma barra visível.
                      style={{ height: `max(3px, ${ratio * 100}%)` }}
                    />
                  )}
                </span>
              </button>
            )
          })}
        </div>
      </div>

      <div className="pk-chart-axis">
        {points.map((point) => (
          <span key={point.key} className={active?.key === point.key ? 'is-active' : ''}>
            {point.label}
          </span>
        ))}
      </div>

      <p className="pk-chart-caption">
        {active ? (
          <>
            <strong className="pk-num">{active.value === null ? '—' : format(active.value)}</strong>{' '}
            {active.caption}
          </>
        ) : (
          emptyMessage
        )}
      </p>
    </div>
  )
}

function lastWithData(points: ChartPoint[]): ChartPoint | undefined {
  for (let i = points.length - 1; i >= 0; i -= 1) {
    if (points[i].value !== null) return points[i]
  }
  return undefined
}
