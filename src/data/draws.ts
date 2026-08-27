/**
 * Tipos de projeto do drill de outs.
 *
 * Os números de outs são fixos e conhecidos — é isso que o jogador precisa
 * reconhecer na mesa em dois segundos. O drill sorteia o projeto e os valores
 * do pote; a conta que o usuário treina é sempre a mesma, o que muda é o preço.
 */

export interface DrawType {
  name: string
  outs: number
  /** Como reconhecer o projeto olhando para o board. */
  hint: string
}

export const DRAWS: DrawType[] = [
  {
    name: 'Projeto de flush',
    outs: 9,
    hint: 'Quatro cartas do mesmo naipe: sobram 9 daquele naipe no baralho.',
  },
  {
    name: 'Sequência aberta',
    outs: 8,
    hint: 'Quatro cartas seguidas abertas dos dois lados: 4 cartas de cada ponta.',
  },
  {
    name: 'Gutshot (sequência interna)',
    outs: 4,
    hint: 'Falta a carta do meio: só os 4 exemplares daquele valor servem.',
  },
  {
    name: 'Duplo projeto (flush + sequência)',
    outs: 15,
    hint: '9 do flush + 8 da sequência, menos as 2 que contam duas vezes.',
  },
  {
    name: 'Par querendo trinca',
    outs: 2,
    hint: 'Só as duas cartas que sobraram daquele valor.',
  },
  {
    name: 'Duas overcards',
    outs: 6,
    hint: 'Duas cartas maiores que o board: 3 de cada uma para fazer o par melhor.',
  },
  {
    name: 'Par + gutshot',
    outs: 6,
    hint: '2 da trinca + 4 da sequência interna.',
  },
  {
    name: 'Projeto de flush + gutshot',
    outs: 12,
    hint: '9 do flush + 4 do gutshot, menos 1 que serve às duas.',
  },
  {
    name: 'Trinca querendo full house',
    outs: 7,
    hint: '6 cartas que pareiam o board + 1 que fecha a quadra.',
  },
]
