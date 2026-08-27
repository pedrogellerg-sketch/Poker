import { CardRow } from '../components/PlayingCard'
import { RANKINGS } from '../data/rankings'
import { parseCards } from '../lib/cards'

/**
 * Referência das dez categorias, da mais forte para a mais fraca.
 *
 * Tela sem interação de propósito: é material de consulta, e consulta boa é a
 * que responde antes de pedir qualquer coisa em troca.
 */
export function HandRankings() {
  return (
    <>
      <div className="pk-card">
        <h2>Ranking de mãos</h2>
        <p className="pk-note">
          A mão vale as melhores cinco cartas entre as duas suas e as cinco da mesa. Se as cinco
          melhores forem as da mesa, o pote é dividido.
        </p>
      </div>

      <div className="pk-card">
        {RANKINGS.map((entry, index) => (
          <div className="pk-rank-row" key={entry.name}>
            <span className="pk-rank-index">{index + 1}</span>
            <div style={{ minWidth: 0, flex: 1 }}>
              <div className="pk-row-between">
                <p className="pk-term" style={{ margin: 0 }}>
                  {entry.name}
                </p>
                <span className="pk-num pk-muted" style={{ fontSize: 10.5 }}>
                  {entry.odds}
                </span>
              </div>
              <div style={{ margin: '7px 0' }}>
                <CardRow cards={parseCards(entry.example)} size="sm" />
              </div>
              <p className="pk-def">{entry.description}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="pk-card">
        <h3>Empate</h3>
        <p className="pk-note">
          Mesma categoria decide-se pelas cartas: par de reis com kicker Ás bate par de reis com
          kicker Dama. Empate absoluto divide o pote — e a sobra de fichas vai para o primeiro
          jogador à esquerda do botão.
        </p>
      </div>
    </>
  )
}
