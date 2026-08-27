/**
 * Autoteste do núcleo de pôquer.
 *
 *   npm run test:poker
 *
 * O repositório não tem runner de teste, e trazer um só por causa deste módulo
 * seria peso desproporcional. O que o avaliador de mãos e o motor de apostas
 * precisam é de verificação *executável* — não do ritual de um framework.
 *
 * Roda por `vite-node` porque os módulos são TypeScript com alias `@/`.
 */

const { parseCards, seededRng } = await import('../src/lib/cards.ts')
const { evaluate5, evaluate7, HandCategory, describeHand } = await import(
  '../src/lib/evaluator.ts'
)
const { chenScore, preflopVerdict } = await import('../src/lib/chen.ts')
const { ruleOf42, requiredEquity, monteCarloEquity, countOuts } = await import(
  '../src/lib/equity.ts'
)
const { buildPots, createTournament, currentActor, applyAction, startHand, potSize, seatLabel } =
  await import('../src/lib/tournament.ts')
const { decideBotAction } = await import('../src/lib/bots.ts')
const { parseHandHistory } = await import('../src/lib/pokerstars.ts')
const { analyseHand, aggregateLeaks } = await import('../src/lib/analysis.ts')
const { buildSeries, accuracy, compareLast, lifetime, streakOf, weakestPositions, periodStart } =
  await import('../src/lib/progress.ts')
const { seatSlack, isUpperSeat, ringPoint, tableHeight } = await import(
  '../src/lib/tableLayout.ts'
)
const { seatName } = await import('../src/lib/tournament.ts')
const { formatAmount, formatResult } = await import('../src/lib/format.ts')

let passed = 0
const failures = []

function check(name, condition, detail = '') {
  if (condition) {
    passed += 1
  } else {
    failures.push(`${name}${detail ? ` — ${detail}` : ''}`)
  }
}

function equal(name, actual, expected) {
  check(name, actual === expected, `esperado ${expected}, veio ${actual}`)
}

function near(name, actual, expected, tolerance) {
  check(
    name,
    Math.abs(actual - expected) <= tolerance,
    `esperado ~${expected} (±${tolerance}), veio ${actual}`,
  )
}

const hand = (text) => evaluate5(parseCards(text))
const hand7 = (text) => evaluate7(parseCards(text))

// ---------------------------------------------------------------- avaliador

equal('royal flush é straight flush', hand('As Ks Qs Js Ts').category, HandCategory.STRAIGHT_FLUSH)
equal('roda é sequência', hand('Ah 2d 3c 4s 5h').category, HandCategory.STRAIGHT)
equal('roda é encabeçada pelo 5', hand('Ah 2d 3c 4s 5h').ranks[0], 5)
equal('straight flush da roda', hand('Ah 2h 3h 4h 5h').category, HandCategory.STRAIGHT_FLUSH)
equal('quadra', hand('9s 9h 9d 9c 2s').category, HandCategory.QUADS)
equal('full house', hand('9s 9h 9d 2c 2s').category, HandCategory.FULL_HOUSE)
equal('flush', hand('As Js 8s 5s 2s').category, HandCategory.FLUSH)
equal('sequência', hand('9s 8h 7d 6c 5s').category, HandCategory.STRAIGHT)
equal('trinca', hand('9s 9h 9d Kc 2s').category, HandCategory.TRIPS)
equal('dois pares', hand('9s 9h 2d 2c Ks').category, HandCategory.TWO_PAIR)
equal('um par', hand('9s 9h 2d 7c Ks').category, HandCategory.PAIR)
equal('carta alta', hand('9s 4h 2d 7c Ks').category, HandCategory.HIGH_CARD)

check('quadra bate full house', hand('9s 9h 9d 9c 2s').score > hand('As Ah Ad Kc Ks').score)
check('flush bate sequência', hand('As Js 8s 5s 2s').score > hand('9s 8h 7d 6c 5s').score)
check(
  'sequência maior vence',
  hand('9s 8h 7d 6c 5s').score > hand('Ah 2d 3c 4s 5h').score,
  'a roda é a menor sequência',
)
check(
  'kicker decide o par',
  hand('9s 9h Ad 7c 5s').score > hand('9s 9h Kd 7c 5s').score,
  'A bate K como kicker',
)
check(
  'flush maior vence pelo topo',
  hand('As Js 8s 5s 2s').score > hand('Ks Qs 8s 5s 2s').score,
)
check('mesma mão empata', hand('As Js 8s 5s 2s').score === hand('Ah Jh 8h 5h 2h').score)

equal(
  'sete cartas: acha o flush escondido',
  hand7('As Ks 2h 7s 9s 3s 4c').category,
  HandCategory.FLUSH,
)
equal(
  'sete cartas: acha a sequência com a roda',
  hand7('Ah 2d 3c 4s 5h Kd Qc').category,
  HandCategory.STRAIGHT,
)
equal(
  'sete cartas: full house com dois pares no board',
  hand7('9s 9h 9d 2c Kd Kc 7h').category,
  HandCategory.FULL_HOUSE,
)
equal('descrição em português', describeHand(hand('9s 9h 2d 2c Ks')), 'Dois pares, Noves e Dois')

// A melhor de 7 nunca pode ser pior que qualquer 5 escolhidas dentro dela.
{
  const rng = seededRng(20260826)
  const { createDeck, shuffle } = await import('../src/lib/cards.ts')
  let ok = true
  for (let trial = 0; trial < 300; trial += 1) {
    const cards = shuffle(createDeck(), rng).slice(0, 7)
    const best = evaluate7(cards).score
    for (let i = 0; i < 7 && ok; i += 1) {
      for (let j = i + 1; j < 7 && ok; j += 1) {
        const five = cards.filter((_, k) => k !== i && k !== j)
        if (evaluate5(five).score > best) ok = false
      }
    }
  }
  check('evaluate7 é o máximo das 21 combinações', ok)
}

// -------------------------------------------------------------------- Chen

equal('AA vale 20', chenScore(...parseCards('As Ah')).score, 20)
equal('AKs vale 12', chenScore(...parseCards('As Ks')).score, 12)
equal('AKo vale 10', chenScore(...parseCards('As Kh')).score, 10)
equal('JTs vale 9', chenScore(...parseCards('Js Ts')).score, 9)
equal('22 vale 5 (mínimo do par)', chenScore(...parseCards('2s 2h')).score, 5)
equal('72o vale 0 (nunca negativo)', chenScore(...parseCards('7s 2h')).score, 0)
equal('KQs vale 10', chenScore(...parseCards('Ks Qs')).score, 10)

equal('AQo abre no UTG', preflopVerdict(...parseCards('As Qh'), 'UTG').advice, 'raise')
equal('KJo não abre no UTG', preflopVerdict(...parseCards('Ks Jh'), 'UTG').advice, 'fold')
equal('KJo abre no botão', preflopVerdict(...parseCards('Ks Jh'), 'BTN').advice, 'raise')

// ------------------------------------------------------------------ equity

equal('9 outs no flop ≈ 36%', ruleOf42(9, 2), 36)
equal('9 outs no turn ≈ 18%', ruleOf42(9, 1), 18)
equal('teto de 95%', ruleOf42(25, 2), 95)
near('pot odds de 50 num pote de 100', requiredEquity(100, 50), 33.3, 0.1)

near(
  'AA contra uma mão aleatória ≈ 85%',
  monteCarloEquity({
    hole: parseCards('As Ah'),
    opponents: 1,
    iterations: 3000,
    rng: seededRng(7),
  }).equity,
  85,
  3,
)
near(
  'AA contra cinco mãos aleatórias ≈ 49%',
  monteCarloEquity({
    hole: parseCards('As Ah'),
    opponents: 5,
    iterations: 3000,
    rng: seededRng(11),
  }).equity,
  49,
  4,
)
equal(
  'projeto de flush + duas overcards contra um par: 15 outs',
  countOuts(parseCards('As Ks'), parseCards('7s 2s 9h'), parseCards('9d 8c')),
  15,
)
equal(
  'sequência aberta contra AA: 8 outs',
  countOuts(parseCards('9h 8d'), parseCards('7s 6c 2h'), parseCards('Ah Ad')),
  8,
)
equal(
  'quem já está na frente não tem outs a contar',
  countOuts(parseCards('Ah Ad'), parseCards('7s 6c 2h'), parseCards('9h 8d')),
  0,
)

// --------------------------------------------------------------- side pots

{
  const players = [
    { id: 'a', committed: 100, folded: false, inHand: true },
    { id: 'b', committed: 500, folded: false, inHand: true },
    { id: 'c', committed: 500, folded: false, inHand: true },
  ]
  const pots = buildPots(players)
  equal('duas camadas de pote', pots.length, 2)
  equal('pote principal soma 300', pots[0].amount, 300)
  equal('pote principal tem 3 elegíveis', pots[0].eligible.length, 3)
  equal('pote lateral soma 800', pots[1].amount, 800)
  equal('pote lateral exclui o curto', pots[1].eligible.join(','), 'b,c')
}

{
  // Quem desiste deixa as fichas no pote, mas não recebe nenhuma camada.
  const players = [
    { id: 'a', committed: 200, folded: true, inHand: true },
    { id: 'b', committed: 500, folded: false, inHand: true },
    { id: 'c', committed: 500, folded: false, inHand: true },
  ]
  const pots = buildPots(players)
  equal('fichas do desistente contam no pote', pots[0].amount, 600)
  check('desistente não é elegível', !pots[0].eligible.includes('a'))
  equal(
    'total distribuído = total apostado',
    pots.reduce((s, p) => s + p.amount, 0),
    1200,
  )
}

equal('assento 0 é a small blind', seatLabel(0, 6), 'SB')
equal('último assento é o botão', seatLabel(5, 6), 'BTN')
equal('penúltimo é o cutoff', seatLabel(4, 6), 'CO')
equal('heads-up: botão é small blind', seatLabel(0, 2), 'SB')

// ------------------------------------------------- torneio de ponta a ponta

{
  const TABLE = 6
  const STACK = 1500
  const TOTAL = TABLE * STACK
  let tournaments = 0
  let chipLeak = null
  let stuck = false
  let negative = false

  for (let seed = 1; seed <= 12 && !chipLeak && !stuck; seed += 1) {
    const rng = seededRng(seed * 1013)
    let state = createTournament({ botCount: TABLE - 1, startingStack: STACK }, rng)
    let steps = 0

    while (state.phase !== 'over' && steps < 20000) {
      steps += 1

      if (state.phase === 'handOver') {
        const chips = state.players.reduce((s, p) => s + p.stack, 0)
        if (chips !== TOTAL) chipLeak = `mão ${state.handNumber}: ${chips} de ${TOTAL}`
        state = startHand(state, rng)
        continue
      }

      const actor = currentActor(state)
      if (!actor) {
        stuck = true
        break
      }
      if (state.players.some((p) => p.stack < 0)) negative = true

      // O herói também é jogado pela IA: o teste é do motor, não do usuário.
      state = applyAction(state, decideBotAction(state, actor, rng))
    }

    if (steps >= 20000) stuck = true
    if (state.phase === 'over') tournaments += 1
  }

  check('12 torneios completos terminam', tournaments === 12, `terminaram ${tournaments}`)
  check('nenhuma ficha criada ou perdida', chipLeak === null, chipLeak ?? '')
  check('nenhum stack negativo', !negative)
  check('o motor nunca trava sem jogador da vez', !stuck)
}

{
  // O pote na mesa tem que bater com o que saiu dos stacks.
  const rng = seededRng(999)
  let state = createTournament({ botCount: 2, startingStack: 800 }, rng)
  let consistent = true

  for (let i = 0; i < 400 && state.phase !== 'over'; i += 1) {
    if (state.phase === 'handOver') {
      state = startHand(state, rng)
      continue
    }
    const actor = currentActor(state)
    if (!actor) break
    state = applyAction(state, decideBotAction(state, actor, rng))
    // Só vale durante a mão: depois do showdown os prêmios já estão nos stacks
    // e `potSize` ainda descreve o pote que acabou de ser pago.
    if (state.phase !== 'acting') continue
    const chips = state.players.reduce((s, p) => s + p.stack, 0)
    if (chips + potSize(state) !== 3 * 800) consistent = false
  }
  check('stacks + pote = fichas do torneio', consistent)
}

// ------------------------------------------------------- parser PokerStars

const SAMPLE = `PokerStars Hand #241234567890: Tournament #3210987654, $4.60+$0.40 USD Hold'em No Limit - Level III (25/50) - 2024/03/15 20:11:03 ET
Table '3210987654 12' 6-max Seat #4 is the button
Seat 1: Otavio (1500 in chips)
Seat 2: Bruna (2200 in chips)
Seat 3: Fernando (1480 in chips)
Seat 4: Lia (900 in chips)
Seat 5: Ravi (3100 in chips)
Seat 6: Nina (1200 in chips)
Ravi: posts small blind 25
Nina: posts big blind 50
*** HOLE CARDS ***
Dealt to Fernando [Ah Kd]
Otavio: folds
Bruna: folds
Fernando: raises 100 to 150
Lia: folds
Ravi: folds
Nina: calls 100
*** FLOP *** [7c 2d Kh]
Nina: checks
Fernando: bets 175
Nina: calls 175
*** TURN *** [7c 2d Kh] [9s]
Nina: checks
Fernando: checks
*** RIVER *** [7c 2d Kh 9s] [2h]
Nina: bets 300
Fernando: calls 300
*** SHOW DOWN ***
Nina: shows [9h 9d] (a full house, Nines full of Deuces)
Fernando: mucks hand
Nina collected 1300 from pot
*** SUMMARY ***
Total pot 1300 | Rake 0
Board [7c 2d Kh 9s 2h]
Seat 3: Fernando showed [Ah Kd] and lost with two pair, Kings and Deuces
Seat 6: Nina (big blind) showed [9h 9d] and won (1300) with a full house

PokerStars Hand #241234567891: Tournament #3210987654, $4.60+$0.40 USD Hold'em No Limit - Level III (25/50) - 2024/03/15 20:14:41 ET
Table '3210987654 12' 6-max Seat #5 is the button
Seat 1: Otavio (1500 in chips)
Seat 2: Bruna (2200 in chips)
Seat 3: Fernando (655 in chips)
Seat 5: Ravi (3100 in chips)
Seat 6: Nina (2500 in chips)
Nina: posts small blind 25
Otavio: posts big blind 50
*** HOLE CARDS ***
Dealt to Fernando [7s 2h]
Bruna: folds
Fernando: raises 100 to 150
Ravi: folds
Nina: folds
Otavio: folds
Uncalled bet (100) returned to Fernando
Fernando collected 125 from pot
*** SUMMARY ***
Total pot 125 | Rake 0
Seat 3: Fernando collected (125)
`

{
  const hands = parseHandHistory(SAMPLE)
  equal('duas mãos importadas', hands.length, 2)

  const first = hands[0]
  equal('id da mão', first.id, '241234567890')
  equal('herói identificado', first.heroName, 'Fernando')
  equal('cartas do herói', first.heroCards.map((c) => `${c.rank}${c.suit}`).join(' '), '14h 13d')
  equal('seis jogadores na mesa', first.players.length, 6)
  equal('big blind lida', first.bigBlind, 50)
  equal('board completo', first.board.length, 5)
  equal('posição do herói', first.heroPosition, 'CO')
  equal('blinds ficam fora da lista de decisões', first.streets.preflop.length, 6)
  equal('ação de aumento com valor total', first.streets.preflop[2].to, 150)
  equal('flop tem três ações', first.streets.flop.length, 3)
  equal('river tem duas ações', first.streets.river.length, 2)
  equal('pote total', first.totalPot, 1300)
  equal('vencedor', first.winners[0].name, 'Nina')
  check('herói perdeu a mão', first.heroNet < 0, `heroNet=${first.heroNet}`)

  const second = hands[1]
  equal('mesa de cinco na segunda mão', second.players.length, 5)
  equal('aposta não paga devolvida', second.uncalledReturned, 100)
  check('herói lucrou sem showdown', second.heroNet > 0, `heroNet=${second.heroNet}`)
  equal('sem showdown', second.showdown, false)
}

// ------------------------------------------------------------------ análise

{
  const hands = parseHandHistory(SAMPLE)
  const reports = hands.map((h) => analyseHand(h, { iterations: 400, rng: seededRng(3) }))

  const weakOpen = reports[1].notes.find((n) => n.code === 'abertura-fraca')
  check('72o aberto no CO vira erro apontado', Boolean(weakOpen), JSON.stringify(reports[1].notes))
  equal('erro é do pré-flop', weakOpen?.street, 'preflop')

  const leaks = aggregateLeaks(reports)
  check('painel de leaks agrupa por código', leaks.length > 0)
  check(
    'cada leak leva a um treino',
    leaks.every((l) => Boolean(l.trainingTab)),
  )
}

// ----------------------------------------------------------- evolução no tempo

{
  const drill = (at, kind, correct, position) => ({ at, kind, correct, position })

  // Segunda 2026-03-16 a domingo 2026-03-22 são a mesma semana.
  equal('semana começa na segunda', periodStart('2026-03-18', 'semana'), '2026-03-16')
  equal('domingo ainda é da semana anterior', periodStart('2026-03-22', 'semana'), '2026-03-16')
  equal('segunda seguinte abre outra semana', periodStart('2026-03-23', 'semana'), '2026-03-23')
  equal('mês começa no dia 1', periodStart('2026-03-18', 'mes'), '2026-03-01')

  const events = [
    // Semana de 09/03: 1 de 2.
    drill('2026-03-09', 'preflop', true, 'BTN'),
    drill('2026-03-10', 'preflop', false, 'UTG'),
    // Semana de 16/03: 3 de 4.
    drill('2026-03-16', 'preflop', true, 'UTG'),
    drill('2026-03-17', 'preflop', true, 'UTG'),
    drill('2026-03-18', 'outs', true, undefined),
    drill('2026-03-18', 'outs', false, undefined),
  ]

  const series = buildSeries(events, [], 'semana', 3, '2026-03-18')
  equal('a série tem os períodos pedidos', series.length, 3)
  equal('a série termina na semana de hoje', series[2].start, '2026-03-16')
  equal('semana sem treino entra vazia na série', series[0].drills.total, 0)
  equal('semana anterior somou 2 decisões', series[1].drills.total, 2)
  equal('semana atual somou 4 decisões', series[2].drills.total, 4)
  equal('semana atual acertou 3', series[2].drills.correct, 3)
  equal('separa por tipo de treino', series[2].byKind.outs.total, 2)
  equal('acerto da semana atual', Math.round(accuracy(series[2].drills)), 75)
  equal('período vazio não vira zero por cento', accuracy(series[0].drills), null)

  const cmp = compareLast(series)
  equal('delta em pontos percentuais', Math.round(cmp.delta), 25)

  const perKind = compareLast(series, 'preflop')
  equal('delta por tipo olha só aquele treino', Math.round(accuracy(perKind.current)), 100)

  // Uma mão importada conta no dia em que foi jogada.
  const withHands = buildSeries(events, [{ at: '2026-03-17', errors: 2 }], 'semana', 3, '2026-03-18')
  equal('erros das mãos entram na semana certa', withHands[2].handErrors, 2)
  equal('mãos contadas por período', withHands[2].hands, 1)
  equal('semana anterior fica sem mãos', withHands[1].handErrors, 0)

  const monthly = buildSeries(events, [], 'mes', 2, '2026-03-18')
  equal('mês agrega as duas semanas', monthly[1].drills.total, 6)

  const life = lifetime(events, '2026-03-18')
  equal('total de decisões da vida', life.total, 6)
  equal('acertos da vida', life.correct, 4)
  equal('dias distintos treinados', life.days, 5)
  equal('primeiro dia', life.firstDay, '2026-03-09')

  // A sequência conta de hoje para trás e sobrevive ao dia ainda não treinado.
  const days = new Set(['2026-03-16', '2026-03-17', '2026-03-18'])
  equal('sequência de três dias', streakOf(days, '2026-03-18'), 3)
  equal('hoje vazio ainda conta a sequência de ontem', streakOf(days, '2026-03-19'), 3)
  equal('dois dias parados quebram a sequência', streakOf(days, '2026-03-20'), 0)

  // Posição só vira diagnóstico com amostra suficiente.
  const few = weakestPositions(events)
  equal('posição com poucas respostas não vira leak', few.length, 0)

  const many = []
  for (let i = 0; i < 6; i += 1) many.push(drill('2026-03-16', 'preflop', i < 2, 'UTG'))
  for (let i = 0; i < 6; i += 1) many.push(drill('2026-03-16', 'preflop', true, 'BTN'))
  const ranked = weakestPositions(many)
  equal('duas posições com amostra', ranked.length, 2)
  equal('a pior aparece primeiro', ranked[0].position, 'UTG')
  equal('acerto da pior posição', Math.round(ranked[0].accuracy), 33)
}

// ------------------------------------------------------------ layout da mesa

{
  // Medidas com régua no navegador a 380px de viewport, arredondadas para cima:
  // área 326x…, assento comum 84x62,3, assento do herói 96x89,3.
  const AREA_WIDTH = 326
  const SEAT = { width: 84, height: 63 }
  const HERO = { width: 96, height: 90 }
  /** Exigimos folga de verdade, não empate: 0px passa hoje e vaza no próximo ajuste. */
  const MIN_SLACK = 2

  let worst = Infinity
  let offender = ''

  for (const total of [3, 6, 9]) {
    const areaHeight = tableHeight(total)
    for (let index = 0; index < total; index += 1) {
      const isHero = index === 0
      const box = isHero ? HERO : SEAT
      const slack = seatSlack({
        index,
        total,
        areaWidth: AREA_WIDTH,
        areaHeight,
        seatWidth: box.width,
        seatHeight: box.height,
      })

      // A borda de baixo do herói é rente de propósito — ele é preso ali.
      const edges = isHero
        ? [slack.left, slack.right, slack.top]
        : [slack.left, slack.right, slack.top, slack.bottom]

      const min = Math.min(...edges)
      if (min < worst) {
        worst = min
        offender = `mesa de ${total}, assento ${index}`
      }
      if (isHero) check(`herói rente embaixo na mesa de ${total}`, slack.bottom === 0)
    }
  }

  check(
    'todo assento cabe na mesa com folga',
    worst >= MIN_SLACK,
    `${offender} sobra ${worst.toFixed(1)}px`,
  )

  // O herói fica no centro de baixo — é o ponto de vista dele.
  const hero = ringPoint(0, 6)
  equal('herói centrado na horizontal', Math.round(hero.leftPct), 50)
  check('herói na parte de baixo', hero.topPct > 80, `topPct=${hero.topPct}`)
  check('herói nunca é assento de cima', !isUpperSeat(0, 6))
  check('alguém ocupa o topo numa mesa de 6', isUpperSeat(3, 6))

  // Preso embaixo, o herói cabe mesmo se a mesa encolher.
  const pinned = seatSlack({
    index: 0,
    total: 6,
    areaWidth: AREA_WIDTH,
    areaHeight: 200,
    seatWidth: HERO.width,
    seatHeight: HERO.height,
  })
  equal('herói rente à borda de baixo', pinned.bottom, 0)

  // As fichas apostadas ficam entre o assento e o pote, nunca fora.
  const bet = ringPoint(0, 6, 0.5)
  check(
    'fichas apostadas ficam entre o assento e o centro',
    bet.topPct > 50 && bet.topPct < hero.topPct,
    `bet=${bet.topPct} hero=${hero.topPct}`,
  )
}

// -------------------------------------------------------- nomes dos assentos

equal('9-max: o primeiro a falar é UTG', seatName(2, 9), 'UTG')
equal('9-max: o seguinte é UTG+1', seatName(3, 9), 'UTG+1')
equal('9-max: o hijack existe', seatName(6, 9), 'HJ')
equal('9-max: cutoff no penúltimo', seatName(7, 9), 'CO')
equal('9-max: botão no último', seatName(8, 9), 'BTN')
check(
  'nenhum nome de assento se repete na mesa de 9',
  new Set(Array.from({ length: 9 }, (_, i) => seatName(i, 9))).size === 9,
)
check(
  'nenhum nome de assento se repete na mesa de 6',
  new Set(Array.from({ length: 6 }, (_, i) => seatName(i, 6))).size === 6,
)
equal('5-max: o assento do meio é UTG', seatName(2, 5), 'UTG')
equal('o balde de Chen do hijack é MP', seatLabel(6, 9), 'MP')
equal('o balde de Chen do UTG+1 é UTG', seatLabel(3, 9), 'UTG')

// ------------------------------------------------------------ fichas e big blinds

equal('fichas com separador de milhar', formatAmount(1500, 20, 'fichas'), '1.500')
equal('stack grande em BB, sem decimal', formatAmount(1500, 20, 'bb'), '75 BB')
equal('stack curto mantém a decimal', formatAmount(250, 20, 'bb'), '12,5 BB')
equal('valor redondo não ganha decimal', formatAmount(20, 20, 'bb'), '1 BB')
equal('meia big blind', formatAmount(10, 20, 'bb'), '0,5 BB')
equal('resultado negativo em BB', formatResult(-250, 20, 'bb'), '-12,5 BB')
equal('resultado positivo em fichas', formatResult(340, 20, 'fichas'), '+340')

// ----------------------------------------------------------------- relatório

const total = passed + failures.length
if (failures.length === 0) {
  console.log(`\n✓ ${passed}/${total} verificações passaram.\n`)
} else {
  console.error(`\n✗ ${failures.length} de ${total} falharam:\n`)
  for (const failure of failures) console.error(`  · ${failure}`)
  console.error('')
  process.exitCode = 1
}
