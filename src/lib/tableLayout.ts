/**
 * Onde cada assento fica no oval da mesa.
 *
 * Isto é matemática, não estilo, e por isso mora aqui e não na tela: layout
 * absoluto quebra em silêncio. Uma placa que escapa do feltro não lança erro
 * nenhum — só fica feia num tamanho de mesa que ninguém testou. Com a conta
 * separada, o autoteste mede a caixa de cada assento e falha quando ela sai.
 *
 * O herói fica sempre no centro de baixo, como em qualquer cliente: é o ponto de
 * vista dele. Os demais se distribuem em passos iguais no anel, na mesma ordem
 * em que agem — assim "quem fala depois de mim" vira uma pergunta que se
 * responde olhando para a direita.
 *
 * O assento do herói é **preso à borda de baixo**, e não posicionado pelo anel.
 * No anel ele ficava a 85% da altura, e como é o assento mais alto (cartas
 * grandes), vazava por 2px na mesa de três: a altura da área teria que crescer
 * junto, o que desperdiçaria espaço nas mesas curtas. Preso embaixo, ele cabe em
 * qualquer altura por construção.
 */

/**
 * Raios do anel, em porcentagem da área.
 *
 * Menores que o oval de propósito: as placas encostam no trilho por dentro, e
 * assim nenhuma escapa da borda na largura de um celular.
 */
export const RING_X = 36
export const RING_Y = 35

export interface RingPoint {
  /** Porcentagem da largura da área, no centro do assento. */
  leftPct: number
  /** Porcentagem da altura da área, no centro do assento. */
  topPct: number
}

export function ringAngle(index: number, total: number): number {
  return ((90 + (index * 360) / total) * Math.PI) / 180
}

/** Um ponto do anel. `scale` menor que 1 aproxima do centro (fichas, botão). */
export function ringPoint(index: number, total: number, scale = 1): RingPoint {
  const angle = ringAngle(index, total)
  return {
    leftPct: 50 + RING_X * scale * Math.cos(angle),
    topPct: 50 + RING_Y * scale * Math.sin(angle),
  }
}

/** Metade de cima da mesa — onde os rótulos precisam cair para baixo. */
export function isUpperSeat(index: number, total: number): boolean {
  return Math.sin(ringAngle(index, total)) < -0.1
}

export interface SeatBoxInput {
  index: number
  total: number
  areaWidth: number
  areaHeight: number
  seatWidth: number
  seatHeight: number
}

/**
 * Folga entre a caixa do assento e cada borda da área, em pixels.
 *
 * Negativo significa que o assento escapou. O assento é centrado no ponto do
 * anel (`translate(-50%, -50%)` no CSS), então a caixa vai de centro − metade a
 * centro + metade.
 */
export function seatSlack({
  index,
  total,
  areaWidth,
  areaHeight,
  seatWidth,
  seatHeight,
}: SeatBoxInput): { left: number; right: number; top: number; bottom: number } {
  const centered = {
    left: (areaWidth - seatWidth) / 2,
    right: (areaWidth - seatWidth) / 2,
  }

  // O herói é preso embaixo: centrado na horizontal, rente à borda inferior.
  if (isHeroSeat(index)) {
    return { ...centered, top: areaHeight - seatHeight, bottom: 0 }
  }

  const { leftPct, topPct } = ringPoint(index, total)
  const cx = (leftPct / 100) * areaWidth
  const cy = (topPct / 100) * areaHeight

  return {
    left: cx - seatWidth / 2,
    right: areaWidth - (cx + seatWidth / 2),
    top: cy - seatHeight / 2,
    bottom: areaHeight - (cy + seatHeight / 2),
  }
}

/** O assento 0 é sempre o do usuário. */
export function isHeroSeat(index: number): boolean {
  return index === 0
}

/**
 * Altura da área da mesa por número de jogadores.
 *
 * Com o herói preso embaixo, a altura só precisa dar conta do anel: mais
 * assentos, mais espaço vertical para as placas não se encavalarem.
 */
export function tableHeight(players: number): number {
  if (players <= 3) return 262
  if (players <= 6) return 296
  return 340
}
