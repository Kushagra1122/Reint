export const fmtNumber = (value: number | null | undefined, digits = 0) =>
  value == null ? '—' : new Intl.NumberFormat('en-GB', { maximumFractionDigits: digits }).format(value)

export const fmtMw = (value: number | null | undefined) => value == null ? '—' : `${fmtNumber(value)} MW`

export const fmtPercent = (value: number | null | undefined) =>
  value == null ? '—' : `${(value * 100).toFixed(1)}%`

export const fmtDate = (value: string) => new Intl.DateTimeFormat('en-GB', {
  weekday: 'short', day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Europe/London',
}).format(new Date(`${value}T12:00:00Z`))

export const fmtTime = (value: string | null | undefined, includeDate = false) => {
  if (!value) return '—'
  return new Intl.DateTimeFormat('en-GB', {
    ...(includeDate ? { day: 'numeric', month: 'short' } : {}),
    hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Europe/London',
  }).format(new Date(value)) + ' GMT'
}

export const chartTime = (value: string) => new Intl.DateTimeFormat('en-GB', {
  hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Europe/London',
}).format(new Date(value))

export function toCsv(rows: Record<string, unknown>[]) {
  if (!rows.length) return ''
  const columns = Object.keys(rows[0])
  const escape = (value: unknown) => `"${String(value ?? '').replaceAll('"', '""')}"`
  return [columns.join(','), ...rows.map(row => columns.map(column => escape(row[column])).join(','))].join('\n')
}

