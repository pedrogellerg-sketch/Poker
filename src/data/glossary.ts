/**
 * Glossário — o vocabulário mínimo para entender qualquer mesa.
 *
 * As definições são curtas de propósito: quem consulta um glossário está no
 * meio de outra coisa. Onde o termo tem um "porquê" que muda decisão, ele
 * aparece na segunda frase — e não em um parágrafo.
 */

export interface Term {
  term: string
  /** Sinônimos e a forma em inglês, para a busca encontrar. */
  aliases?: string[]
  definition: string
  group: 'mesa' | 'aposta' | 'matemática' | 'mãos' | 'torneio'
}

export const GLOSSARY: Term[] = [
  {
    term: 'Blind',
    aliases: ['small blind', 'big blind', 'sb', 'bb'],
    group: 'mesa',
    definition:
      'Aposta obrigatória posta antes das cartas pelos dois jogadores à esquerda do botão. É o que cria pote para disputar — sem blinds, ninguém precisaria jogar mão nenhuma.',
  },
  {
    term: 'Botão (BTN)',
    aliases: ['dealer', 'button'],
    group: 'mesa',
    definition:
      'A marca que indica quem é o dealer da mão e que gira um assento a cada mão. Quem está no botão age por último em todas as ruas depois do pré-flop — a melhor posição da mesa.',
  },
  {
    term: 'UTG',
    aliases: ['under the gun', 'primeiro a falar'],
    group: 'mesa',
    definition:
      'O primeiro a agir no pré-flop, logo à esquerda da big blind. Fala sem informação nenhuma e com a mesa inteira ainda por decidir: é a posição que exige o range mais apertado.',
  },
  {
    term: 'CO (cutoff)',
    aliases: ['cutoff'],
    group: 'mesa',
    definition:
      'O assento imediatamente à direita do botão. Boa posição: só três jogadores ainda podem agir depois de você.',
  },
  {
    term: 'Posição',
    group: 'mesa',
    definition:
      'Onde você senta em relação ao botão, e portanto quando você fala. Agir por último é ver o que todos fizeram antes de decidir — a vantagem mais barata do pôquer.',
  },
  {
    term: 'Pré-flop',
    group: 'mesa',
    definition: 'A rodada de apostas com as duas cartas na mão e nenhuma carta comunitária na mesa.',
  },
  {
    term: 'Flop',
    group: 'mesa',
    definition:
      'As três primeiras cartas comunitárias, abertas de uma vez, seguidas de uma rodada de apostas. É onde a mão realmente toma forma.',
  },
  {
    term: 'Turn',
    group: 'mesa',
    definition: 'A quarta carta comunitária, e a rodada de apostas que vem depois dela.',
  },
  {
    term: 'River',
    group: 'mesa',
    definition:
      'A quinta e última carta comunitária. Depois do river não há mais projeto: o que a mão é, ela já é.',
  },
  {
    term: 'Board',
    aliases: ['cartas comunitárias', 'mesa'],
    group: 'mesa',
    definition:
      'O conjunto de cartas comunitárias. Todo mundo usa as mesmas — o que muda de jogador para jogador são as duas cartas fechadas.',
  },
  {
    term: 'Showdown',
    group: 'mesa',
    definition:
      'A abertura das cartas no fim da mão, quando dois ou mais jogadores chegaram até o river sem desistir. Melhor mão de cinco cartas leva o pote.',
  },
  {
    term: 'Fold (desistir)',
    aliases: ['desistir', 'correr'],
    group: 'aposta',
    definition:
      'Abrir mão da mão e do que já foi apostado. Fichas no pote não são mais suas: insistir para "não perder o que já pus" é o erro mais caro do iniciante.',
  },
  {
    term: 'Check (passar)',
    aliases: ['passar'],
    group: 'aposta',
    definition:
      'Continuar na mão sem apostar, quando não há aposta a pagar. Passar não é fraqueza automática — também serve para controlar o tamanho do pote.',
  },
  {
    term: 'Call (pagar)',
    aliases: ['pagar'],
    group: 'aposta',
    definition:
      'Igualar a aposta do adversário para continuar na mão. Toda decisão de pagar é uma conta: o que o pote paga contra a chance de você ter a melhor mão.',
  },
  {
    term: 'Raise (aumentar)',
    aliases: ['aumentar', 'subir'],
    group: 'aposta',
    definition:
      'Aumentar a aposta em jogo, obrigando quem já apostou a pagar mais ou desistir. Aumentar ganha o pote de duas formas: com a melhor mão ou fazendo o outro desistir.',
  },
  {
    term: '3-bet',
    group: 'aposta',
    definition:
      'O segundo aumento do pré-flop — reaumentar quem abriu. Serve para isolar o agressor e crescer o pote quando sua mão está à frente do range dele.',
  },
  {
    term: 'C-bet (aposta de continuidade)',
    aliases: ['continuation bet', 'cbet'],
    group: 'aposta',
    definition:
      'A aposta no flop feita por quem aumentou no pré-flop. Funciona porque o board erra a maioria das mãos: o adversário também não acertou nada na maior parte das vezes.',
  },
  {
    term: 'All-in',
    group: 'aposta',
    definition:
      'Apostar todas as fichas. Quem vai de all-in continua na mão até o showdown, mas não pode ganhar mais do que o valor que cada adversário cobriu.',
  },
  {
    term: 'Blefe',
    aliases: ['bluff'],
    group: 'aposta',
    definition:
      'Apostar com uma mão que não ganharia no showdown, para levar o pote na desistência do outro. Blefe sem história coerente é só doação.',
  },
  {
    term: 'Ciclo de apostas',
    aliases: ['rodada de apostas', 'betting round'],
    group: 'aposta',
    definition:
      'A rodada em que cada jogador age até que todos os que continuam tenham igualado a mesma aposta. Cada aumento reabre a ação para quem já havia falado.',
  },
  {
    term: 'Pote',
    aliases: ['pot'],
    group: 'aposta',
    definition: 'Todas as fichas apostadas na mão. É o prêmio pelo qual a decisão está sendo tomada.',
  },
  {
    term: 'Side pot (pote lateral)',
    aliases: ['pote lateral'],
    group: 'aposta',
    definition:
      'Pote separado criado quando alguém vai all-in com menos fichas que os outros. Ele só disputa o que cobriu; o resto vira um pote à parte, entre quem tinha mais.',
  },
  {
    term: 'Pot odds',
    aliases: ['odds do pote'],
    group: 'matemática',
    definition:
      'O preço que o pote oferece: aposta dividida por (pote + aposta). Se pagar 50 num pote de 100, você precisa vencer 25% das vezes para o pagamento se justificar.',
  },
  {
    term: 'Equity',
    group: 'matemática',
    definition:
      'A fatia do pote que é sua na média, dada a chance de a sua mão vencer. Equity acima da exigida pelas pot odds significa que pagar dá lucro no longo prazo.',
  },
  {
    term: 'Outs',
    group: 'matemática',
    definition:
      'As cartas que ainda podem transformar sua mão na melhor. Projeto de flush tem 9 outs; sequência aberta, 8. Contar outs é o primeiro passo de toda decisão pós-flop.',
  },
  {
    term: 'Regra de 4 e 2',
    group: 'matemática',
    definition:
      'Atalho para estimar equity de cabeça: outs × 4 no flop (duas cartas por vir), outs × 2 no turn. Aproximação, não conta exata — mas erra pouco onde importa.',
  },
  {
    term: 'Draw (projeto)',
    aliases: ['projeto'],
    group: 'matemática',
    definition:
      'Mão incompleta que fica forte se vier a carta certa: projeto de flush, de sequência. Vale pelas cartas que faltam, não pelo que já é.',
  },
  {
    term: 'Range',
    group: 'matemática',
    definition:
      'O conjunto de mãos que um jogador poderia ter, dada a ação dele. Jogadores bons não tentam adivinhar a mão exata — jogam contra o leque inteiro.',
  },
  {
    term: 'Kicker',
    group: 'mãos',
    definition:
      'A carta de desempate quando dois jogadores têm a mesma combinação. A-K contra A-Q num board com Ás: quem tem o Rei leva, e a diferença é só o kicker.',
  },
  {
    term: 'Nuts',
    group: 'mãos',
    definition:
      'A melhor mão possível naquele board. Ter os nuts é o único momento em que não existe carta ruim para você.',
  },
  {
    term: 'Suited / offsuit',
    aliases: ['mesmo naipe'],
    group: 'mãos',
    definition:
      'Duas cartas do mesmo naipe (suited) ou de naipes diferentes (offsuit). Suited vale pouco mais de 2% de chance extra de flush — importante, mas menos do que parece.',
  },
  {
    term: 'Conectores',
    aliases: ['connectors', 'suited connectors'],
    group: 'mãos',
    definition:
      'Cartas de valores vizinhos (98, JT). Ganham valor porque fazem sequência, e por isso a fórmula de Chen desconta pontos por cada carta de intervalo.',
  },
  {
    term: 'Overpair',
    group: 'mãos',
    definition:
      'Par na mão maior que qualquer carta do board — como QQ num flop 9-7-2. Forte, mas não é motivo para ignorar um board que fez sequência.',
  },
  {
    term: 'Stack',
    group: 'torneio',
    definition:
      'As fichas que você tem à frente. Num torneio o stack costuma ser medido em big blinds: 40 BB e 8 BB pedem estratégias diferentes com a mesma mão.',
  },
  {
    term: 'MTT',
    aliases: ['multi table tournament', 'torneio'],
    group: 'torneio',
    definition:
      'Torneio de múltiplas mesas: todos começam com o mesmo stack, as blinds sobem com o tempo e quem perde as fichas está eliminado.',
  },
  {
    term: 'Mesa final',
    aliases: ['final table'],
    group: 'torneio',
    definition:
      'A última mesa de um torneio, onde estão os sobreviventes e quase toda a premiação. Stacks curtos e blinds altas mudam o jogo: espere mais all-ins e menos pós-flop.',
  },
  {
    term: 'ICM',
    aliases: ['independent chip model'],
    group: 'torneio',
    definition:
      'Modelo que converte fichas em dinheiro esperado num torneio. Explica por que, perto da premiação, uma ficha ganha vale menos que uma ficha perdida.',
  },
  {
    term: 'Bubble',
    group: 'torneio',
    definition:
      'O momento em que falta um eliminado para todo mundo entrar no dinheiro. Os stacks médios apertam o jogo, e os grandes atacam justamente por isso.',
  },
]

export const GROUP_LABEL: Record<Term['group'], string> = {
  mesa: 'Mesa e posições',
  aposta: 'Apostas',
  matemática: 'Matemática',
  mãos: 'Mãos',
  torneio: 'Torneio',
}
