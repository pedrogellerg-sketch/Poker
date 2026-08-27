/**
 * Como os valores aparecem na mesa.
 *
 * Jogador de torneio não pensa em fichas, pensa em big blinds: "1.500" não diz
 * nada sozinho, mas "15 BB" diz que o stack está curto e que a próxima decisão
 * é empurrar ou desistir. O mesmo stack vale muito mais no nível 1 do que no
 * nível 8, e só a contagem em BB mostra isso — por isso o modo é do usuário e
 * vale para a mesa inteira: stacks, pote, apostas e botões de ação.
 */

export type ChipDisplay = 'fichas' | 'bb'

/** Fichas com separador de milhar do português: `1.500`. */
export function formatChips(amount: number): string {
  return Math.round(amount).toLocaleString('pt-BR')
}

/**
 * O valor no modo escolhido.
 *
 * A casa decimal só entra onde muda decisão. Abaixo de 20 BB ela é o próprio
 * jogo — 12,5 e 12 big blinds pedem contas diferentes de push/fold; acima
 * disso é ruído, e ruído que não cabe numa placa de assento de 84px.
 */
export function formatAmount(amount: number, bigBlind: number, mode: ChipDisplay): string {
  if (mode === 'fichas' || bigBlind <= 0) return formatChips(amount)

  const bb = amount / bigBlind
  if (bb >= 20) return `${Math.round(bb)} BB`
  if (Number.isInteger(bb)) return `${bb} BB`
  return `${bb.toFixed(1).replace('.', ',')} BB`
}

/** Só o número em BB, sem a unidade — para tabelas e listas apertadas. */
export function toBigBlinds(amount: number, bigBlind: number): number {
  return bigBlind > 0 ? amount / bigBlind : 0
}

/** Resultado com sinal: `+12,5 BB`, `-340`. */
export function formatResult(amount: number, bigBlind: number, mode: ChipDisplay): string {
  const sign = amount > 0 ? '+' : amount < 0 ? '-' : ''
  return `${sign}${formatAmount(Math.abs(amount), bigBlind, mode)}`
}
