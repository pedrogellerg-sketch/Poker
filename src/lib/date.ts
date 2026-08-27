/**
 * Datas em fuso local.
 *
 * O app é de uma pessoa só e roda offline: não há sincronização entre fusos
 * para resolver, e "hoje" é sempre o hoje de quem está olhando a tela.
 *
 * A regra que não pode ser quebrada: **nunca use `toISOString()`** para montar
 * a chave do dia. Ele converte para UTC, e às nove da noite em Brasília isso
 * devolve o dia seguinte — o treino da segunda apareceria na terça, e a
 * sequência de dias quebraria sozinha de madrugada.
 */

/** Chave de dia no formato `YYYY-MM-DD`, sempre em horário local. */
export type ISODate = string

export function toISODate(d: Date = new Date()): ISODate {
  const year = d.getFullYear()
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function fromISODate(iso: ISODate): Date {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, m - 1, d)
}

export function todayISO(): ISODate {
  return toISODate()
}

export function addDays(iso: ISODate, days: number): ISODate {
  const date = fromISODate(iso)
  date.setDate(date.getDate() + days)
  return toISODate(date)
}

/** Segunda-feira da semana da data informada. */
export function startOfWeek(iso: ISODate): ISODate {
  const weekday = fromISODate(iso).getDay()
  const backToMonday = weekday === 0 ? 6 : weekday - 1
  return addDays(iso, -backToMonday)
}
