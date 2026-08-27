import { useMemo, useState } from 'react'

import { GLOSSARY, GROUP_LABEL } from '../data/glossary'
import type { Term } from '../data/glossary'

const GROUPS = Object.keys(GROUP_LABEL) as Term['group'][]

/**
 * Glossário com busca.
 *
 * A busca varre também os apelidos (`cbet`, `bluff`, `under the gun`) porque
 * quem procura um termo geralmente ouviu a versão em inglês numa transmissão —
 * e não vai adivinhar como o app resolveu traduzir.
 */
export function Vocabulary() {
  const [query, setQuery] = useState('')
  const [group, setGroup] = useState<Term['group'] | 'todos'>('todos')

  const results = useMemo(() => {
    const needle = normalise(query)
    return GLOSSARY.filter((term) => {
      if (group !== 'todos' && term.group !== group) return false
      if (!needle) return true
      const haystack = normalise(
        [term.term, term.definition, ...(term.aliases ?? [])].join(' '),
      )
      return haystack.includes(needle)
    })
  }, [query, group])

  return (
    <>
      <div className="pk-card">
        <label className="pk-eyebrow" htmlFor="pk-busca">
          Buscar termo
        </label>
        <input
          id="pk-busca"
          className="pk-input"
          type="search"
          placeholder="pot odds, c-bet, UTG…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <div className="pk-chips" style={{ marginTop: 10 }}>
          <button
            type="button"
            className="pk-pill"
            aria-pressed={group === 'todos'}
            onClick={() => setGroup('todos')}
          >
            Todos
          </button>
          {GROUPS.map((key) => (
            <button
              key={key}
              type="button"
              className="pk-pill"
              aria-pressed={group === key}
              onClick={() => setGroup(key)}
            >
              {GROUP_LABEL[key]}
            </button>
          ))}
        </div>
      </div>

      <div className="pk-card">
        <p className="pk-eyebrow">
          {results.length} {results.length === 1 ? 'termo' : 'termos'}
        </p>
        {results.length === 0 ? (
          <p className="pk-note">
            Nada encontrado para “{query}”. Tente o termo em inglês — muita coisa na mesa é dita
            assim mesmo.
          </p>
        ) : (
          <ul className="pk-list">
            {results.map((term) => (
              <li key={term.term}>
                <p className="pk-term">{term.term}</p>
                <p className="pk-def">{term.definition}</p>
              </li>
            ))}
          </ul>
        )}
      </div>
    </>
  )
}

/** Busca sem acento e sem caixa: ninguém digita "matemática" com acento no celular. */
function normalise(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
}
