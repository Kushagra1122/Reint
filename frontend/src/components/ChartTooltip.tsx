import type { SeriesPoint } from '../types'
import { fmtMw, fmtTime } from '../utils'

type PayloadItem = { payload: SeriesPoint }

export function ForecastTooltip({ active, payload }: { active?: boolean; payload?: PayloadItem[] }) {
  if (!active || !payload?.length) return null
  const point = payload[0].payload
  return (
    <div className="chart-tooltip">
      <span className="eyebrow">Delivery interval</span>
      <strong>{fmtTime(point.start_time, true)}</strong>
      <dl>
        <div><dt>Forecast</dt><dd>{fmtMw(point.forecast_mw)}</dd></div>
        <div><dt>Actual</dt><dd>{fmtMw(point.actual_mw)}</dd></div>
        <div><dt>Error</dt><dd>{fmtMw(point.error_mw)}</dd></div>
        <div><dt>Published</dt><dd>{fmtTime(point.publish_time)}</dd></div>
        <div><dt>Lead time</dt><dd>{point.forecast_age_hours?.toFixed(1) ?? '—'}h</dd></div>
      </dl>
    </div>
  )
}

