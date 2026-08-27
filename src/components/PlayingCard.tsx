import type { Card } from '../lib/cards'
import { SUIT_NAME, SUIT_SYMBOL, isRed, rankLabel, rankName } from '../lib/cards'

/**
 * Tamanhos da carta.
 *
 * `xs` existe para os assentos dos adversários na mesa: ali a carta não precisa
 * ser lida (está virada), só precisa ocupar o lugar certo e caber na placa. Usar
 * o tamanho grande ali fazia as cartas escaparem do feltro.
 */
export type CardSize = 'xs' | 'sm' | 'md' | 'lg'

interface PlayingCardProps {
  card?: Card | null
  /** Verso virado para cima — as cartas dos bots antes do showdown. */
  hidden?: boolean
  size?: CardSize
  /** Anima a entrada, para quando a carta acaba de ser distribuída. */
  dealt?: boolean
}

/**
 * Uma carta de baralho.
 *
 * O naipe entra como símbolo *e* como texto acessível: `♥` sozinho é lido de
 * formas diferentes por cada leitor de tela, e a cor vermelha não é informação
 * para quem não a enxerga.
 */
export function PlayingCard({ card, hidden, size = 'lg', dealt }: PlayingCardProps) {
  const classes = [
    'pk-playing-card',
    `is-${size}`,
    hidden || !card ? 'is-back' : '',
    card && !hidden && isRed(card.suit) ? 'is-red' : '',
    dealt ? 'pk-deal-in' : '',
  ]
    .filter(Boolean)
    .join(' ')

  if (!card || hidden) {
    return <span className={classes} aria-label="Carta virada para baixo" role="img" />
  }

  return (
    <span
      className={classes}
      role="img"
      aria-label={`${rankName(card.rank)} de ${SUIT_NAME[card.suit]}`}
    >
      <span className="pk-pc-rank" aria-hidden="true">
        {rankLabel(card.rank)}
      </span>
      <span className="pk-pc-suit" aria-hidden="true">
        {SUIT_SYMBOL[card.suit]}
      </span>
    </span>
  )
}

interface HandProps {
  cards: (Card | null)[]
  hidden?: boolean
  size?: CardSize
  dealt?: boolean
}

export function CardRow({ cards, hidden, size, dealt }: HandProps) {
  return (
    <span className="pk-hand">
      {cards.map((card, i) => (
        <PlayingCard
          key={card ? `${card.rank}${card.suit}` : `slot-${i}`}
          card={card}
          hidden={hidden}
          size={size}
          dealt={dealt}
        />
      ))}
    </span>
  )
}

/** A ficha desenhada em CSS — logo do módulo e ícone da aba do torneio. */
export function ChipIcon({ small }: { small?: boolean }) {
  return <span className={`pk-chip${small ? ' is-small' : ''}`} aria-hidden="true" />
}
