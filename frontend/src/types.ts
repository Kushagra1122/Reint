export type MetricSet = {
  mae_mw: number | null
  rmse_mw: number | null
  bias_mw: number | null
  p90_absolute_error_mw: number | null
  overforecast_count: number
  underforecast_count: number
  overforecast_frequency: number | null
  underforecast_frequency: number | null
  matched: number
  eligible_targets: number
  coverage: number
}

export type SeriesPoint = {
  decision_date: string
  delivery_date: string
  start_time: string
  hour: number
  forecast_mw: number | null
  publish_time: string | null
  forecast_age_hours: number | null
  actual_mw: number | null
  actual_publish_time: string | null
  error_mw: number | null
  band_low_mw?: number | null
  band_high_mw?: number | null
}

export type DecisionPayload = {
  decision_date: string
  delivery_date: string
  cutoff: string
  cutoff_local: string
  cutoff_assumption: string
  native_frequency: string
  latest_eligible_publish_time: string | null
  forecast_freshness_hours_at_cutoff: number | null
  summary: {
    mean_forecast_mw: number | null
    min_forecast_mw: number | null
    max_forecast_mw: number | null
    forecast_slots: number
    expected_slots: number
    missing_slots: number
    matched_actual_slots: number
    matched_coverage: number
  }
  prior_performance: MetricSet
  risk_band: {
    available: boolean
    sample_size: number
    signed_error_q05_mw: number | null
    signed_error_q95_mw: number | null
    label: string
  }
  missing_start_times: string[]
  points: SeriesPoint[]
}

export type AccuracyPayload = {
  period: { start: string; end: string }
  cutoff: string
  retrospective: boolean
  metrics: MetricSet
  daily: Array<MetricSet & { delivery_date: string }>
  hourly: Array<MetricSet & { hour: number }>
  histogram: Array<{ label: string; count: number; from: number; to: number }>
  points: SeriesPoint[]
}

export type Revision = {
  publish_time: string
  start_time: string
  generation: number
  eligible_at_cutoff: boolean
  selected_at_cutoff: boolean
  hours_before_target: number
}

export type RevisionsPayload = {
  target_time: string
  cutoff: string
  actual_mw: number | null
  selected_publish_time: string | null
  selected_forecast_mw: number | null
  revision_count: number
  revisions: Revision[]
}

