/**
 * As dez categorias de mão, da mais forte para a mais fraca.
 *
 * O exemplo de cada uma é texto no formato do baralho (`As Ks Qs Js Ts`) e vira
 * carta de verdade na tela — a mesma função de leitura usada pelo parser. Nada
 * de imagem: a carta é desenhada, então nunca sai de sincronia com o resto.
 */

export interface RankingEntry {
  name: string
  example: string
  description: string
  /** Chance aproximada de fechar essa mão com as sete cartas. */
  odds: string
}

export const RANKINGS: RankingEntry[] = [
  {
    name: 'Royal flush',
    example: 'As Ks Qs Js Ts',
    description: 'Do dez ao ás, todos do mesmo naipe. A melhor mão do jogo — e a que quase nunca vem.',
    odds: '1 em 31 mil',
  },
  {
    name: 'Straight flush',
    example: '9h 8h 7h 6h 5h',
    description: 'Cinco cartas em sequência, todas do mesmo naipe.',
    odds: '1 em 3.600',
  },
  {
    name: 'Quadra',
    example: 'Qs Qh Qd Qc 4s',
    description: 'As quatro cartas de um mesmo valor, mais um kicker.',
    odds: '1 em 594',
  },
  {
    name: 'Full house',
    example: 'Ks Kh Kd 7c 7s',
    description: 'Uma trinca e um par juntos. No desempate vale primeiro a trinca.',
    odds: '1 em 37',
  },
  {
    name: 'Flush',
    example: 'Ad Jd 8d 5d 2d',
    description: 'Cinco cartas do mesmo naipe, sem sequência. Desempata pela carta mais alta.',
    odds: '1 em 32',
  },
  {
    name: 'Sequência',
    example: 'Ts 9h 8d 7c 6s',
    description:
      'Cinco valores seguidos, de naipes quaisquer. O ás vale nas duas pontas: A-2-3-4-5 é a menor sequência.',
    odds: '1 em 21',
  },
  {
    name: 'Trinca',
    example: '8s 8h 8d Ac 5s',
    description: 'Três cartas do mesmo valor, mais os dois maiores kickers.',
    odds: '1 em 20',
  },
  {
    name: 'Dois pares',
    example: 'Js Jh 4d 4c Ks',
    description: 'Dois pares diferentes. Desempata o par mais alto, depois o segundo, depois o kicker.',
    odds: '1 em 3,3',
  },
  {
    name: 'Um par',
    example: 'Ts Th Kd 7c 3s',
    description: 'Duas cartas do mesmo valor. A mão que mais ganha potes pequenos.',
    odds: '1 em 2,4',
  },
  {
    name: 'Carta alta',
    example: 'Ad Jh 8s 5c 3d',
    description: 'Nenhuma combinação: vale a carta mais alta e, se empatar, a seguinte.',
    odds: '1 em 5,9',
  },
]
