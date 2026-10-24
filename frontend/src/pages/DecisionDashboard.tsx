import { useCallback, useEffect, useMemo, useState } from 'react'
import { Area, CartesianGrid, ComposedChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { ArrowDownToLine, Eye, EyeOff } from 'lucide-react'
import { getJson, query } from '../api/client'
import { ForecastTooltip } from '../components/ChartTooltip'
import { KpiCard } from '../components/KpiCard'
import { ErrorState, LoadingState } from '../components/States'
import type { DecisionPayload } from '../types'
import { chartTime, fmtDate, fmtMw, fmtPercent, fmtTime, toCsv } from '../utils'

type Props = {
  decisionDate: string
  cutoff: string
  onDecisionDate: (value: string) => void
  onCutoff: (value: string) => void
}

export function DecisionDashboard({ decisionDate, cutoff, onDecisionDate, onCutoff }: Props) {
  const [data, setData] = useState<DecisionPayload | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [showActual, setShowActual] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      setData(await getJson<DecisionPayload>(`/api/series?${query({ decision_date: decisionDate, cutoff })}`))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }, [decisionDate, cutoff])

  useEffect(() => { void load() }, [load])

  const chartData = useMemo(() => data?.points.map(point => ({
    ...point,
    band: point.band_low_mw != null && point.band_high_mw != null
      ? [point.band_low_mw, point.band_high_mw] : null,
  })) ?? [], [data])

  function downloadCsv() {
    if (!data) return
    const csv = toCsv(data.points)
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }))
    const link = document.createElement('a')
    link.href = url
    link.download = `windsight-${decisionDate}-${cutoff.replace(':', '')}.csv`
    link.click()
    URL.revokeObjectURL(url)
  }

  const insights = useMemo(() => {
    if (!data) return []
    const notes: Array<{ title: string; body: string; tone: string }> = []
    if (data.summary.missing_slots) notes.push({
      title: `${data.summary.missing_slots} forecast slot${data.summary.missing_slots === 1 ? '' : 's'} missing`,
      body: 'Missing targets remain blank and are excluded from metrics; no zeros are imputed.', tone: 'warning',
    })
    if (data.prior_performance.matched < 24) notes.push({
      title: 'History is still thin at this decision',
      body: `Only ${data.prior_performance.matched} preceding exact-time matches were available. No risk band is shown until N ≥ 24.`, tone: 'neutral',
    })
    if (data.prior_performance.bias_mw != null && data.prior_performance.matched >= 24) {
      const over = data.prior_performance.bias_mw > 0
      notes.push({
        title: `${over ? 'Overforecast' : 'Underforecast'} tendency in preceding data`,
        body: `Mean signed error was ${fmtMw(data.prior_performance.bias_mw)} across ${data.prior_performance.matched} observations. This indicates exposure, not a trade recommendation.`,
        tone: over ? 'warning' : 'positive',
      })
    }
    if (data.summary.missing_slots === 0) notes.push({
      title: 'Complete decision-time forecast coverage',
      body: `All ${data.summary.expected_slots} native hourly targets had an eligible vintage at the selected cutoff.`, tone: 'positive',
    })
    return notes
  }, [data])

  return (
    <div className="page-stack">
      <header className="page-header">
        <div>
          <h1>Wind outlook</h1>
          <p>The latest forecast available at the selected purchasing cutoff.</p>
        </div>
        <div className="header-actions">
          <button className="button secondary" onClick={() => setShowActual(value => !value)}>
            {showActual ? <EyeOff size={16} /> : <Eye size={16} />}
            {showActual ? 'Hide actuals' : 'Reveal actuals'}
          </button>
          <button className="button secondary" onClick={downloadCsv} disabled={!data}>
            <ArrowDownToLine size={16} /> CSV
          </button>
        </div>
      </header>

      <section className="control-strip">
        <label>
          <span>Decision date</span>
          <input type="date" min="2026-01-01" max="2026-01-31" value={decisionDate} onChange={event => onDecisionDate(event.target.value)} />
        </label>
        <div className="delivery-control">
          <span>Delivery day</span>
          <strong>{data ? fmtDate(data.delivery_date) : '—'}</strong>
        </div>
        <label>
          <span>Illustrative cutoff · UK local</span>
          <input type="time" value={cutoff} onChange={event => onCutoff(event.target.value)} />
        </label>
        <div className="control-meta">
          <div><span>Latest eligible publication</span><strong>{fmtTime(data?.latest_eligible_publish_time)}</strong></div>
        </div>
      </section>

      {loading && <LoadingState />}
      {error && <ErrorState message={error} retry={() => void load()} />}
      {!loading && !error && data && <>
        <section className="kpi-grid three">
          <KpiCard label="Mean forecast" value={fmtMw(data.summary.mean_forecast_mw)} note={`${data.summary.forecast_slots}/${data.summary.expected_slots} hourly targets`} tone="mint" />
          <KpiCard label="Prior MAE" value={fmtMw(data.prior_performance.mae_mw)} note={`N=${data.prior_performance.matched} preceding matches`} />
          <KpiCard label="Overforecast rate" value={fmtPercent(data.prior_performance.overforecast_frequency)} note={`Positive error · N=${data.prior_performance.matched}`} tone={data.prior_performance.overforecast_frequency && data.prior_performance.overforecast_frequency > .5 ? 'amber' : 'neutral'} />
        </section>

        <section className="panel chart-panel">
          <div className="panel-heading">
            <div><p className="eyebrow">Delivery profile · MW</p><h2>{fmtDate(data.delivery_date)}</h2></div>
            <div className="legend">
              <span><i className="legend-line forecast" />As-of forecast</span>
              {showActual && <span><i className="legend-line actual" />Actual · known after delivery</span>}
              {data.risk_band.available && <span><i className="legend-box" />Historical error band</span>}
            </div>
          </div>
          <div className="chart-wrap" role="img" aria-label="Wind generation forecast and actual time series">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={chartData} margin={{ top: 12, right: 12, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="bandFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="var(--accent)" stopOpacity=".14"/><stop offset="1" stopColor="var(--accent)" stopOpacity=".02"/></linearGradient>
                </defs>
                <CartesianGrid stroke="var(--chart-grid)" vertical={false} />
                <XAxis dataKey="start_time" tickFormatter={chartTime} minTickGap={28} stroke="var(--chart-axis)" tickLine={false} axisLine={false} />
                <YAxis tickFormatter={value => `${Math.round(value / 1000)}k`} stroke="var(--chart-axis)" tickLine={false} axisLine={false} width={45} />
                <Tooltip content={<ForecastTooltip />} />
                {data.risk_band.available && <Area type="monotone" dataKey="band" stroke="none" fill="url(#bandFill)" connectNulls={false} />}
                <Line type="monotone" dataKey="forecast_mw" stroke="var(--accent)" strokeWidth={2.5} dot={{ r: 2, fill: 'var(--accent)' }} activeDot={{ r: 5 }} connectNulls={false} />
                {showActual && <Line type="monotone" dataKey="actual_mw" stroke="var(--muted)" strokeWidth={2} strokeDasharray="5 5" dot={false} connectNulls={false} />}
              </ComposedChart>
            </ResponsiveContainer>
          </div>
          <footer className="chart-footer">
            <span>Coverage: {data.summary.matched_actual_slots}/{data.summary.expected_slots} · {fmtPercent(data.summary.matched_coverage)}</span>
          </footer>
        </section>

        <details className="detail-drawer">
          <summary>Decision notes and audit trail</summary>
          <section className="two-column detail-content">
            <div className="panel insight-panel">
              <div className="panel-heading"><div><p className="eyebrow">Analyst notes</p><h2>Decision signals</h2></div></div>
              <div className="insight-list">
                {insights.map(note => <article className={`insight ${note.tone}`} key={note.title}><span className="insight-dot" /><div><strong>{note.title}</strong><p>{note.body}</p></div></article>)}
              </div>
            </div>
            <div className="panel audit-panel">
              <div className="panel-heading"><div><p className="eyebrow">Audit trail</p><h2>Forecast provenance</h2></div><span className="status-pill">Elexon source</span></div>
              <dl className="audit-list">
                <div><dt>Decision cutoff</dt><dd>{data.cutoff_local}</dd></div>
                <div><dt>Latest eligible publish</dt><dd>{fmtTime(data.latest_eligible_publish_time, true)}</dd></div>
                <div><dt>Age at cutoff</dt><dd>{data.forecast_freshness_hours_at_cutoff == null ? '—' : `${data.forecast_freshness_hours_at_cutoff.toFixed(1)}h`}</dd></div>
                <div><dt>Historical band sample</dt><dd>N={data.risk_band.sample_size}</dd></div>
                <div><dt>Missing targets</dt><dd>{data.summary.missing_slots}</dd></div>
              </dl>
            </div>
          </section>
        </details>
      </>}
    </div>
  )
}

