import type { ReactNode } from 'react'

type Props = {
  label: string
  value: string
  note: string
  tone?: 'mint' | 'amber' | 'neutral'
  icon?: ReactNode
}

export function KpiCard({ label, value, note, tone = 'neutral', icon }: Props) {
  return (
    <article className={`kpi-card kpi-${tone}`}>
      <div className="kpi-label"><span>{label}</span>{icon}</div>
      <strong>{value}</strong>
      <p>{note}</p>
    </article>
  )
}

