/**
 * Cenários de leitura de jogo — escritos à mão, um a um.
 *
 * O drill de outs é procedural porque a conta é sempre a mesma. Leitura de jogo
 * não é: depende da textura do board, de quem apostou, do tamanho da aposta e
 * da história que a mão conta. Gerar isso por sorteio produziria situações sem
 * sentido, então aqui o conteúdo é curado — e o feedback explica o raciocínio,
 * não só o veredito.
 */

export interface ScenarioOption {
  label: string
  correct?: boolean
  feedback: string
}

export interface Scenario {
  id: string
  topic: 'c-bet' | 'sizing' | 'blefe' | 'textura' | 'valor' | 'disciplina'
  position: string
  hero: string
  board: string
  street: 'flop' | 'turn' | 'river'
  pot: number
  setup: string
  question: string
  options: ScenarioOption[]
  lesson: string
}

export const SCENARIOS: Scenario[] = [
  {
    id: 'cbet-board-seco',
    topic: 'c-bet',
    position: 'CO',
    hero: 'Ah Kd',
    board: '8c 5d 2h',
    street: 'flop',
    pot: 130,
    setup:
      'Você abriu no CO com A-K, só a big blind pagou. O flop veio 8-5-2 de naipes diferentes e ele passou.',
    question: 'O que você faz?',
    options: [
      {
        label: 'Aposta pequena, ~35% do pote',
        correct: true,
        feedback:
          'Board seco e baixo erra o range de quem defendeu a big blind quase sempre. Uma aposta pequena já faz o trabalho: não precisa arriscar muito para ganhar um pote que ninguém quer.',
      },
      {
        label: 'Aposta grande, ~80% do pote',
        feedback:
          'Aposta grande aqui só é paga por mão que te bate. Contra um range que erra o flop, você está arriscando muito para ganhar o mesmo pote pequeno.',
      },
      {
        label: 'Passa e desiste do pote',
        feedback:
          'Passar entrega o pote de graça e ainda deixa A-K sem chance de melhorar com pressão. Este é o flop clássico de aposta de continuidade.',
      },
    ],
    lesson: 'Board seco pede aposta pequena e frequente. O tamanho serve à função, não ao tamanho da sua mão.',
  },
  {
    id: 'board-molhado-par-medio',
    topic: 'textura',
    position: 'BTN',
    hero: 'Jc Jd',
    board: 'Qs Th 9h',
    street: 'flop',
    pot: 220,
    setup:
      'Você abriu no botão com um par de valetes e dois jogadores pagaram. O flop Q-T-9 com duas copas passou para os dois.',
    question: 'Qual a melhor linha?',
    options: [
      {
        label: 'Passa e vê o turn de graça',
        correct: true,
        feedback:
          'Seu par de valetes perde para Q, T, 9, sequência feita e vira projeto pobre. Neste board, apostar só constrói pote para as mãos que já estão à sua frente — e você ainda tem o projeto de sequência para acertar barato.',
      },
      {
        label: 'Aposta 75% do pote para "proteger"',
        feedback:
          'Proteção contra o quê? Quase nada que pague é pior que você. Você constrói pote contra sequência e dois pares, com duas ruas ainda por vir.',
      },
      {
        label: 'All-in para tirar os projetos',
        feedback:
          'Você é o projeto neste flop. All-in aqui é pagar caro para descobrir que já estava atrás.',
      },
    ],
    lesson:
      'Um par que era forte no pré-flop pode ser mão marginal no flop. A textura decide, não o que você tinha antes.',
  },
  {
    id: 'semi-blefe-duplo-projeto',
    topic: 'blefe',
    position: 'BB',
    hero: '9s 8s',
    board: '7s 6d 2s',
    street: 'flop',
    pot: 180,
    setup:
      'Você defendeu a big blind com 9-8 do mesmo naipe. O flop trouxe projeto de flush e sequência aberta. O adversário apostou 90.',
    question: 'Qual a melhor jogada?',
    options: [
      {
        label: 'Aumenta — semi-blefe',
        correct: true,
        feedback:
          'Com 15 outs você tem cerca de 55% de equity contra a maioria das mãos feitas: nem é blefe de verdade. Aumentar ganha o pote na hora às vezes e constrói pote quando você acerta.',
      },
      {
        label: 'Paga e vê o turn',
        feedback:
          'Pagar não é erro grave, mas desperdiça a melhor característica da mão: ela ganha de duas formas. Passivo demais para 15 outs.',
      },
      {
        label: 'Desiste',
        feedback:
          'Desistir com quinze outs é o oposto da conta certa — aqui você tem mais equity do que quem apostou.',
      },
    ],
    lesson:
      'Semi-blefe é aposta que ganha de duas formas: pela desistência agora e pela carta depois. É a aposta mais lucrativa do jogo.',
  },
  {
    id: 'valor-fino-river',
    topic: 'valor',
    position: 'BTN',
    hero: 'As Jd',
    board: 'Ac 9h 4d 7s 2c',
    street: 'river',
    pot: 400,
    setup:
      'Você tem par de ases com kicker valete. O adversário passou nas três ruas e passa de novo no river.',
    question: 'O que você faz?',
    options: [
      {
        label: 'Aposta 30-40% do pote',
        correct: true,
        feedback:
          'Aposta fina de valor: existem várias mãos piores que pagam — A com kicker menor, par de noves, par de setes. Aposta pequena é o que mantém essas mãos pagando.',
      },
      {
        label: 'Passa e mostra',
        feedback:
          'Passar aqui é deixar de ganhar as fichas que os pares menores pagariam. Você quase nunca está atrás depois de três passadas dele.',
      },
      {
        label: 'Aposta o tamanho do pote',
        feedback:
          'Aposta grande transforma todas as mãos piores em desistência, e só é paga por A-K, A-Q e dois pares. Você ganha menos apostando mais.',
      },
    ],
    lesson:
      'Valor fino é escolher o tamanho que a mão pior consegue pagar. Aposta grande com mão média ganha só quando você perde.',
  },
  {
    id: 'disciplina-overpair',
    topic: 'disciplina',
    position: 'MP',
    hero: 'Kh Kc',
    board: '9d 7c 3s 5h 6d',
    street: 'river',
    pot: 900,
    setup:
      'Você apostou flop e turn com um par de reis. No river veio o 6, completando 8-x e o board 9-7-5-6. O adversário, que só pagou até aqui, agora aumenta all-in.',
    question: 'Qual a leitura?',
    options: [
      {
        label: 'Desiste',
        correct: true,
        feedback:
          'Um jogador passivo que só pagava e de repente vai all-in no river que completa sequência quase nunca está blefando. Seus reis não batem nenhuma mão que faz essa jogada.',
      },
      {
        label: 'Paga: par de reis é mão forte',
        feedback:
          'Era mão forte no pré-flop. Neste river, o range que aumenta é sequência e dois pares — seus reis viraram um blefe-catcher caro.',
      },
      {
        label: 'Reaumenta para testar',
        feedback:
          'Não existe "testar" com o stack inteiro contra um all-in. Reaumentar aqui só paga mais caro pela mesma informação.',
      },
    ],
    lesson:
      'A força da sua mão é relativa ao range que continua apostando. Par grande não é motivo para ignorar o que a ação está dizendo.',
  },
  {
    id: 'sizing-projeto-no-turn',
    topic: 'sizing',
    position: 'CO',
    hero: 'Qh Qd',
    board: 'Jh 8h 3c 2h',
    street: 'turn',
    pot: 500,
    setup:
      'Você tem um par de damas e o turn completou a terceira copa. O adversário passou. Você não tem copas na mão.',
    question: 'Qual o melhor tamanho de aposta?',
    options: [
      {
        label: 'Passa atrás e controla o pote',
        correct: true,
        feedback:
          'Sem copas na mão, apostar só é pago por flush e por J-x que te bate. Passar mantém o pote pequeno com uma mão que agora é média e ainda pode ganhar no showdown.',
      },
      {
        label: 'Aposta 70% do pote',
        feedback:
          'Uma aposta grande é paga exatamente pelas mãos que ganham de você. É construir pote contra o flush que acabou de fechar.',
      },
      {
        label: 'Aposta pequena, 25%, para "bloquear"',
        feedback:
          'Bloquear com aposta pequena convida o flush a aumentar e ainda dá preço barato ao projeto que sobrou. Aqui a passada é mais firme que a aposta pequena.',
      },
    ],
    lesson: 'Quando a carta que chega favorece o range do adversário, controlar o pote vale mais do que apostar.',
  },
  {
    id: 'defesa-big-blind',
    topic: 'disciplina',
    position: 'BB',
    hero: 'Kd 7c',
    board: '—',
    street: 'flop',
    pot: 75,
    setup:
      'O jogador do botão abriu para 2,5 big blinds. Você está na big blind com K-7 de naipes diferentes e o preço para pagar é bom.',
    question: 'Pagar ou desistir?',
    options: [
      {
        label: 'Desiste',
        correct: true,
        feedback:
          'Preço bom não conserta mão ruim fora de posição. K-7 offsuit faz par com kicker fraco — a mão que mais perde dinheiro é exatamente essa, ganhando potes pequenos e perdendo os grandes.',
      },
      {
        label: 'Paga: o preço está barato',
        feedback:
          'O preço é só metade da conta. A outra metade é jogar as três ruas seguintes falando primeiro, com uma mão que quase nunca sabe se está na frente.',
      },
      {
        label: 'Reaumenta como blefe',
        feedback:
          'É defensável em teoria, mas K-7 offsuit bloqueia pouco e não tem como continuar depois. Blefe precisa de mão que possa melhorar.',
      },
    ],
    lesson:
      'Pot odds justificam pagar, mas não jogar mal as ruas seguintes. Fora de posição, a mão precisa de mais que preço.',
  },
  {
    id: 'multiway-cuidado',
    topic: 'textura',
    position: 'UTG',
    hero: 'Ad Kh',
    board: 'Ks 9s 8s',
    street: 'flop',
    pot: 420,
    setup:
      'Você abriu no UTG com A-K e três jogadores pagaram. O flop veio K-9-8, todas de espadas. Você tem o par mais alto e o ás de... ouros.',
    question: 'Como jogar o flop em quatro?',
    options: [
      {
        label: 'Passa',
        correct: true,
        feedback:
          'Board monótono e três adversários: a chance de alguém já ter flush é grande, e seu par de reis não tem como aguentar pressão. Passar mantém o pote controlável.',
      },
      {
        label: 'Aposta metade do pote',
        feedback:
          'Contra três jogadores, apostar num board de três cartas do mesmo naipe é convidar quem tem flush a aumentar e quem tem projeto a pagar barato.',
      },
      {
        label: 'Aposta o pote para tirar os projetos',
        feedback:
          'Nem uma aposta do tamanho do pote tira quem já fechou flush. Você constrói pote com a segunda melhor mão.',
      },
    ],
    lesson:
      'Cada adversário a mais reduz o valor de uma mão que precisa de proteção. Em pote multiway, aposte com mãos que aguentam ser pagas.',
  },
  {
    id: 'blefe-com-bloqueador',
    topic: 'blefe',
    position: 'BTN',
    hero: 'As 4s',
    board: 'Qs 8s 3d 7h 2c',
    street: 'river',
    pot: 600,
    setup:
      'Seu projeto de flush não fechou. Você tem o ás de espadas na mão e o adversário passou pela terceira vez.',
    question: 'Blefar ou desistir do pote?',
    options: [
      {
        label: 'Blefa grande',
        correct: true,
        feedback:
          'O ás de espadas é bloqueador: ele reduz as combinações de flush que o adversário pode ter, e é justamente o flush que pagaria. Seu blefe conta a história de uma mão forte e a sua mão não vale nada no showdown.',
      },
      {
        label: 'Passa e desiste do pote',
        feedback:
          'Passar é seguro, mas joga fora a única forma de ganhar: ás-quatro nunca vence no showdown. Este é o lugar exato do blefe.',
      },
      {
        label: 'Aposta pequena para "comprar barato"',
        feedback:
          'Aposta pequena dá preço bom demais para qualquer par pagar por curiosidade. Blefe precisa fazer o par médio se sentir mal.',
      },
    ],
    lesson:
      'Blefe bom junta duas coisas: uma mão sem valor no showdown e bloqueadores das mãos que pagariam.',
  },
  {
    id: 'stack-curto-torneio',
    topic: 'disciplina',
    position: 'CO',
    hero: 'Ac Ts',
    board: '—',
    street: 'flop',
    pot: 90,
    setup:
      'Torneio, blinds 100/200. Você tem 12 big blinds no cutoff e a mesa passou até você.',
    question: 'Qual a jogada com A-T?',
    options: [
      {
        label: 'All-in',
        correct: true,
        feedback:
          'Com 12 big blinds não existe pós-flop: um aumento normal compromete quase metade do stack e você jogaria o flop sem espaço para desistir. O all-in aproveita a fold equity que ainda resta.',
      },
      {
        label: 'Aumenta para 2,5 big blinds',
        feedback:
          'Aumento pequeno com stack curto é o pior dos mundos: você investe 20% do stack e ainda enfrenta decisões impossíveis no flop.',
      },
      {
        label: 'Desiste e espera mão melhor',
        feedback:
          'Esperar com 12 big blinds é ver as blinds comerem o stack. A-T no cutoff com a mesa passada é melhor do que a próxima mão que você vai receber.',
      },
    ],
    lesson:
      'Em torneio, o tamanho do stack muda a jogada mais do que a mão. Abaixo de 15 big blinds, o jogo vira empurrar ou desistir.',
  },
]
