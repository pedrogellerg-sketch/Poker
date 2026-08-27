import { useState } from 'react'

import { ChipIcon } from './components/PlayingCard'
import type { Position } from './lib/chen'
import { Evolution } from './screens/Evolution'
import { HandRankings } from './screens/HandRankings'
import { MyHands } from './screens/MyHands'
import { PostflopTrainer } from './screens/PostflopTrainer'
import { PreflopTrainer } from './screens/PreflopTrainer'
import { TournamentScreen } from './screens/TournamentScreen'
import { Vocabulary } from './screens/Vocabulary'
import { usePokerData } from './usePokerData'
import './app.css'

type Tab = 'vocab' | 'rankings' | 'preflop' | 'postflop' | 'tournament' | 'hands' | 'evolucao'

interface TabDef {
  id: Tab
  /** O marcador é o naipe: aqui ele não é enfeite, é o vocabulário do conteúdo. */
  mark: string
  tone: 'red' | 'black' | 'chip'
  label: string
  title: string
  subtitle: string
}

const TABS: TabDef[] = [
  {
    id: 'vocab',
    mark: '♠',
    tone: 'black',
    label: 'Termos',
    title: 'Vocabulário',
    subtitle: 'O que cada palavra da mesa quer dizer',
  },
  {
    id: 'rankings',
    mark: '♦',
    tone: 'red',
    label: 'Ranking',
    title: 'Ranking de mãos',
    subtitle: 'Da mais forte à mais fraca',
  },
  {
    id: 'preflop',
    mark: '♥',
    tone: 'red',
    label: 'Pré-flop',
    title: 'Pré-flop',
    subtitle: 'Abrir ou descartar, por posição',
  },
  {
    id: 'postflop',
    mark: '♣',
    tone: 'black',
    label: 'Pós-flop',
    title: 'Pós-flop e equity',
    subtitle: 'Outs, pot odds e leitura de jogo',
  },
  {
    id: 'tournament',
    mark: '',
    tone: 'chip',
    label: 'Torneio',
    title: 'Torneio',
    subtitle: 'Mesa final contra bots',
  },
  {
    id: 'hands',
    mark: '▤',
    tone: 'black',
    label: 'Minhas',
    title: 'Minhas mãos',
    subtitle: 'Importe o histórico e veja seus erros',
  },
  {
    id: 'evolucao',
    mark: '↗',
    tone: 'black',
    label: 'Evolução',
    title: 'Evolução',
    subtitle: 'Acerto por semana e por mês',
  },
]

/**
 * App de treino de pôquer — sete abas, um estado só.
 *
 * O ciclo que o módulo tenta fechar: o usuário joga (aqui ou no PokerStars),
 * importa as mãos, o app aponta o erro recorrente, e o botão do leak leva
 * direto para o treino daquele erro específico. Por isso a navegação é estado
 * local e não rota: o painel de leaks precisa abrir o treino já configurado, e
 * uma URL com parâmetros para isso seria cerimônia sem ganho.
 */
export default function App() {
  const [tab, setTab] = useState<Tab>('vocab')
  const [focusPosition, setFocusPosition] = useState<Position | null>(null)
  const [focusDrill, setFocusDrill] = useState<'outs' | null>(null)
  const data = usePokerData()

  const active = TABS.find((t) => t.id === tab) ?? TABS[0]

  const goTrain = (target: 'preflop' | 'postflop', position?: Position) => {
    if (target === 'preflop') {
      setFocusPosition(position ?? null)
      setTab('preflop')
    } else {
      setFocusDrill('outs')
      setTab('postflop')
    }
    window.scrollTo({ top: 0 })
  }

  return (
    <div className="pk">
      <div className="pk-shell">
        <header className="pk-topbar">
          <ChipIcon />
          <div>
            <h1>{active.title}</h1>
            <p>{active.subtitle}</p>
          </div>
        </header>

        <main>
          {tab === 'vocab' && <Vocabulary />}
          {tab === 'rankings' && <HandRankings />}
          {tab === 'preflop' && (
            <PreflopTrainer
              focusPosition={focusPosition}
              onClearFocus={() => setFocusPosition(null)}
              onRecord={data.recordDrill}
            />
          )}
          {tab === 'postflop' && (
            <PostflopTrainer focusMode={focusDrill} onRecord={data.recordDrill} />
          )}
          {tab === 'tournament' && (
            <TournamentScreen
              display={data.settings.chipDisplay}
              onDisplayChange={(chipDisplay) => data.updateSettings({ chipDisplay })}
            />
          )}
          {tab === 'hands' && (
            <MyHands
              onTrain={goTrain}
              library={data.library}
              display={data.settings.chipDisplay}
              onDisplayChange={(chipDisplay) => data.updateSettings({ chipDisplay })}
            />
          )}
          {tab === 'evolucao' && (
            <Evolution
              drills={data.drills}
              handStats={data.handStats}
              storageOn={data.storageOn}
              saveStatus={data.saveStatus}
              onClearAll={data.clearAll}
              onTrain={goTrain}
            />
          )}
        </main>
      </div>

      <nav className="pk-nav" aria-label="Seções do treino de pôquer">
        <div className="pk-nav-inner">
          {TABS.map((item) => (
            <button
              key={item.id}
              type="button"
              className={`pk-tab is-${item.tone === 'chip' ? 'black' : item.tone}`}
              aria-current={tab === item.id}
              onClick={() => {
                setTab(item.id)
                window.scrollTo({ top: 0 })
              }}
            >
              {item.tone === 'chip' ? (
                <span>
                  <ChipIcon small />
                </span>
              ) : (
                <span aria-hidden="true">{item.mark}</span>
              )}
              <span className="pk-tab-label">{item.label}</span>
            </button>
          ))}
        </div>
      </nav>
    </div>
  )
}
