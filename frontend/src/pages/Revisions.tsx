import { useCallback, useEffect, useMemo, useState } from 'react'
import { CartesianGrid, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { getJson, query } from '../api/client'
import { ErrorState, LoadingState } from '../components/States'
import type { RevisionsPayload } from '../types'
import { fmtDate, fmtMw, fmtTime } from '../utils'

export function Revisions({ decisionDate, cutoff }: { decisionDate: string; cutoff: string }) {
  const deliveryDate = useMemo(() => {
    const date = new Date(`${decisionDate}T12:00:00Z`); date.setUTCDate(date.getUTCDate() + 1)
    return date.toISOString().slice(0, 10)
  }, [decisionDate])
  const [hour, setHour] = useState('12')
  const [data, setData] = useState<RevisionsPayload | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const target = `${deliveryDate}T${hour}:00:00Z`
  const cutoffIso = `${decisionDate}T${cutoff}:00Z`
  const cutoffMs = Date.parse(cutoffIso)
  const load = useCallback(async () => {
    setLoading(true); setError('')
    try { setData(await getJson(`/api/revisions?${query({ target_time: target, cutoff: cutoffIso })}`)) }
    catch (err) { setError(err instanceof Error ? err.message : 'Unknown error') }
    finally { setLoading(false) }
  }, [target, cutoffIso])
  useEffect(() => { void load() }, [load])
  const chartData = useMemo(() => data?.revisions.map(revision => ({ ...revision, publish_ms: Date.parse(revision.publish_time) })) ?? [], [data])

  return <div className="page-stack">
    <header className="page-header"><div><h1>Forecast revisions</h1><p>How the forecast changed for one delivery hour.</p></div></header>
    <section className="control-strip revisions-controls">
      <div className="delivery-control"><span>Delivery date</span><strong>{fmtDate(deliveryDate)}</strong></div>
      <label><span>Target hour · GMT</span><select value={hour} onChange={event => setHour(event.target.value)}>{Array.from({length:24},(_,index) => <option key={index} value={String(index).padStart(2,'0')}>{String(index).padStart(2,'0')}:00</option>)}</select></label>
      <div className="control-meta"><div><span>Purchase cutoff</span><strong>{fmtTime(cutoffIso, true)}</strong></div></div>
    </section>
    {loading && <LoadingState label="Loading forecast vintage history…" />}
    {error && <ErrorState message={error} retry={() => void load()} />}
    {!loading && !error && data && <>
      <section className="revision-summary two">
        <article><div><span>Selected at cutoff</span><strong>{fmtMw(data.selected_forecast_mw)}</strong><small>Published {fmtTime(data.selected_publish_time, true)}</small></div></article>
        <article><div><span>Observed actual</span><strong>{fmtMw(data.actual_mw)}</strong><small>Known only after delivery</small></div></article>
      </section>
      <section className="panel chart-panel">
        <div className="panel-heading"><div><p className="eyebrow">{data.revision_count} revisions · target {fmtTime(data.target_time, true)}</p><h2>Forecast by publication time</h2></div><div className="legend"><span><i className="legend-line forecast"/>Revision</span><span><i className="cutoff-mark"/>Cutoff</span></div></div>
        <div className="chart-wrap"><ResponsiveContainer width="100%" height="100%"><LineChart data={chartData} margin={{top:12,right:16,left:0,bottom:6}}><CartesianGrid stroke="var(--chart-grid)" vertical={false}/><XAxis dataKey="publish_ms" type="number" scale="time" domain={['dataMin','dataMax']} tickFormatter={value => fmtTime(new Date(value).toISOString())} minTickGap={36} stroke="var(--chart-axis)" tickLine={false} axisLine={false}/><YAxis tickFormatter={value => `${Math.round(value/1000)}k`} stroke="var(--chart-axis)" tickLine={false} axisLine={false}/><Tooltip labelFormatter={label => `Published ${fmtTime(new Date(Number(label)).toISOString(), true)}`} formatter={value => [fmtMw(Number(value)),'Forecast']}/><ReferenceLine x={cutoffMs} stroke="var(--accent)" strokeWidth={2} strokeDasharray="5 5" label={{value:'CUTOFF',position:'insideTopRight',fill:'var(--accent)',fontSize:11}}/><Line dataKey="generation" stroke="var(--accent)" strokeWidth={2.5} dot={(props) => { const revision = data.revisions[props.index]; return <circle key={props.key} cx={props.cx} cy={props.cy} r={revision?.selected_at_cutoff ? 6 : 3.5} fill={revision?.eligible_at_cutoff ? 'var(--accent)' : 'var(--faint)'} stroke={revision?.selected_at_cutoff ? '#fff' : 'none'} strokeWidth={2}/> }}/>{data.actual_mw != null && <ReferenceLine y={data.actual_mw} stroke="var(--muted)" strokeDasharray="3 5" label={{value:'ACTUAL',position:'right',fill:'var(--muted)',fontSize:11}}/>}</LineChart></ResponsiveContainer></div>
      </section>
      <details className="detail-drawer">
        <summary>Publication ledger</summary>
        <section className="panel table-panel detail-content">
          <div className="panel-heading"><div><p className="eyebrow">Audit detail</p><h2>Every available vintage</h2></div></div>
          <div className="table-scroll"><table><thead><tr><th>Published</th><th>Forecast</th><th>Lead to target</th><th>Decision status</th></tr></thead><tbody>{data.revisions.map(revision => <tr key={`${revision.publish_time}-${revision.generation}`} className={revision.selected_at_cutoff ? 'selected-row' : ''}><td>{fmtTime(revision.publish_time, true)}</td><td>{fmtMw(revision.generation)}</td><td>{revision.hours_before_target.toFixed(1)} hours</td><td>{revision.selected_at_cutoff ? <span className="status-pill">Selected as-of</span> : revision.eligible_at_cutoff ? <span className="status-pill muted">Superseded before cutoff</span> : <span className="status-pill amber">Unavailable at decision</span>}</td></tr>)}</tbody></table></div>
        </section>
      </details>
    </>}
  </div>
}

