import { useCallback, useEffect, useMemo, useState } from 'react'
import { Bar, BarChart, CartesianGrid, Cell, ComposedChart, Line, ReferenceLine, ResponsiveContainer, Scatter, ScatterChart, Tooltip, XAxis, YAxis } from 'recharts'
import { getJson, query } from '../api/client'
import { KpiCard } from '../components/KpiCard'
import { ErrorState, LoadingState } from '../components/States'
import type { AccuracyPayload } from '../types'
import { chartTime, fmtMw, fmtNumber, fmtPercent } from '../utils'

export function Accuracy({ cutoff }: { cutoff: string }) {
  const [data, setData] = useState<AccuracyPayload | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setLoading(true); setError('')
    try {
      setData(await getJson(`/api/accuracy?${query({ start: '2026-01-01', end: '2026-01-31', cutoff })}`))
    } catch (err) { setError(err instanceof Error ? err.message : 'Unknown error') }
    finally { setLoading(false) }
  }, [cutoff])
  useEffect(() => { void load() }, [load])

  const extent = useMemo(() => {
    if (!data?.points.length) return [0, 1]
    const values = data.points.flatMap(point => [point.actual_mw ?? 0, point.forecast_mw ?? 0])
    return [Math.min(...values), Math.max(...values)]
  }, [data])

  return <div className="page-stack">
    <header className="page-header"><div><h1>Forecast accuracy</h1><p>January results using only the forecast available at each decision cutoff.</p></div></header>
    {loading && <LoadingState label="Calculating January as-of vintages…" />}
    {error && <ErrorState message={error} retry={() => void load()} />}
    {!loading && !error && data && <>
      <section className="kpi-grid">
        <KpiCard label="MAE" value={fmtMw(data.metrics.mae_mw)} note={`N=${data.metrics.matched} matched`} tone="mint" />
        <KpiCard label="Bias" value={fmtMw(data.metrics.bias_mw)} note="Forecast minus actual" tone={data.metrics.bias_mw && data.metrics.bias_mw > 0 ? 'amber' : 'neutral'} />
        <KpiCard label="Overforecast" value={fmtPercent(data.metrics.overforecast_frequency)} note={`${data.metrics.overforecast_count} intervals`} />
        <KpiCard label="Coverage" value={fmtPercent(data.metrics.coverage)} note={`${data.metrics.matched}/${data.metrics.eligible_targets} targets`} />
      </section>

      <section className="panel chart-panel">
        <div className="panel-heading"><div><p className="eyebrow">Exact-time matches</p><h2>Forecast vs actual across delivery</h2></div><span className="metric-note">P90 abs. error {fmtMw(data.metrics.p90_absolute_error_mw)}</span></div>
        <div className="chart-wrap medium"><ResponsiveContainer width="100%" height="100%"><ComposedChart data={data.points} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
          <CartesianGrid stroke="var(--chart-grid)" vertical={false}/><XAxis dataKey="start_time" tickFormatter={chartTime} minTickGap={60} stroke="var(--chart-axis)" tickLine={false} axisLine={false}/><YAxis tickFormatter={value => `${Math.round(value/1000)}k`} stroke="var(--chart-axis)" tickLine={false} axisLine={false}/><Tooltip labelFormatter={label => new Date(String(label)).toLocaleString('en-GB', {timeZone:'Europe/London'})} formatter={(value, name) => [fmtMw(Number(value)), String(name) === 'forecast_mw' ? 'As-of forecast' : 'Actual']}/><Line dataKey="forecast_mw" stroke="var(--accent)" dot={false} strokeWidth={1.8}/><Line dataKey="actual_mw" stroke="var(--muted)" dot={false} strokeWidth={1.5}/>
        </ComposedChart></ResponsiveContainer></div>
      </section>

      <details className="detail-drawer">
        <summary>Detailed accuracy diagnostics</summary>
        <div className="detail-content">
          <section className="two-column equal">
            <div className="panel chart-panel compact">
              <div className="panel-heading"><div><p className="eyebrow">Calibration</p><h2>Actual vs forecast</h2></div><span className="metric-note">Ideal = diagonal</span></div>
              <div className="chart-wrap small"><ResponsiveContainer width="100%" height="100%"><ScatterChart margin={{top:12,right:16,left:0,bottom:4}}><CartesianGrid stroke="var(--chart-grid)"/><XAxis type="number" dataKey="actual_mw" name="Actual" domain={extent} tickFormatter={value => `${Math.round(value/1000)}k`} stroke="var(--chart-axis)"/><YAxis type="number" dataKey="forecast_mw" name="Forecast" domain={extent} tickFormatter={value => `${Math.round(value/1000)}k`} stroke="var(--chart-axis)"/><Tooltip formatter={value => fmtMw(Number(value))} cursor={{strokeDasharray:'3 3'}}/><ReferenceLine segment={[{x:extent[0],y:extent[0]},{x:extent[1],y:extent[1]}]} stroke="var(--muted)" strokeDasharray="4 4"/><Scatter data={data.points} fill="var(--accent)" fillOpacity={.55}/></ScatterChart></ResponsiveContainer></div>
            </div>
            <div className="panel chart-panel compact">
              <div className="panel-heading"><div><p className="eyebrow">Signed error · MW</p><h2>Error distribution</h2></div><span className="metric-note">Positive = overforecast</span></div>
              <div className="chart-wrap small"><ResponsiveContainer width="100%" height="100%"><BarChart data={data.histogram} margin={{top:12,right:8,left:-10,bottom:4}}><CartesianGrid stroke="var(--chart-grid)" vertical={false}/><XAxis dataKey="label" tick={false} stroke="var(--chart-axis)"/><YAxis stroke="var(--chart-axis)"/><Tooltip formatter={value => [Number(value),'Intervals']} labelFormatter={label => `${String(label)} MW`}/><Bar dataKey="count" radius={[3,3,0,0]}>{data.histogram.map(bin => <Cell key={bin.label} fill="var(--accent)" fillOpacity={bin.to <= 0 ? .45 : .85}/>)}</Bar><ReferenceLine x={data.histogram.find(bin => bin.from <= 0 && bin.to >= 0)?.label} stroke="var(--muted)"/></BarChart></ResponsiveContainer></div>
            </div>
          </section>
          <section className="panel chart-panel compact">
            <div className="panel-heading"><div><p className="eyebrow">Intraday pattern</p><h2>Mean error by hour</h2></div><span className="metric-note">Coverage shown in tooltip</span></div>
            <div className="chart-wrap small"><ResponsiveContainer width="100%" height="100%"><BarChart data={data.hourly} margin={{top:10,right:10,left:0,bottom:0}}><CartesianGrid stroke="var(--chart-grid)" vertical={false}/><XAxis dataKey="hour" tickFormatter={hour => `${String(hour).padStart(2,'0')}:00`} stroke="var(--chart-axis)"/><YAxis tickFormatter={value => fmtNumber(value)} stroke="var(--chart-axis)"/><Tooltip formatter={(value, name) => [String(name) === 'bias_mw' ? fmtMw(Number(value)) : Number(value), String(name) === 'bias_mw' ? 'Bias' : String(name)]} labelFormatter={hour => `${String(hour).padStart(2,'0')}:00 · N=${data.hourly.find(row => row.hour === Number(hour))?.matched}`}/><ReferenceLine y={0} stroke="var(--muted)"/><Bar dataKey="bias_mw" radius={[3,3,0,0]}>{data.hourly.map(row => <Cell key={row.hour} fill="var(--accent)" fillOpacity={(row.bias_mw ?? 0) >= 0 ? .85 : .45}/>)}</Bar></BarChart></ResponsiveContainer></div>
          </section>
        </div>
      </details>
    </>}
  </div>
}

