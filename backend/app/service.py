from __future__ import annotations

from datetime import date, datetime, timedelta
from statistics import mean
from typing import Any

from .analytics import group_metrics, histogram, metrics, percentile
from .forecast_selection import select_day
from .repository import Repository
from .time_utils import decision_cutoff, delivery_bounds, iso_utc, parse_cutoff, parse_utc


def validate_decision_date(value: date) -> None:
    if value < date(2026, 1, 1) or value > date(2026, 1, 31):
        raise ValueError("decision date must be between 2026-01-01 and 2026-01-31")


def _actuals(
    repository: Repository, start: datetime, end: datetime, known_by: datetime | None = None
) -> dict[str, dict[str, Any]]:
    query = """SELECT start_time, publish_time, generation, settlement_date, settlement_period
      FROM actuals WHERE fuel_type='WIND' AND start_time >= ? AND start_time < ?"""
    params: tuple[Any, ...] = (iso_utc(start), iso_utc(end))
    if known_by is not None:
        query += " AND publish_time <= ?"
        params += (iso_utc(known_by),)
    query += " ORDER BY start_time, publish_time, generation"
    latest: dict[str, dict[str, Any]] = {}
    for row in repository.rows(query, params):
        latest[row["start_time"]] = row
    return latest


def day_points(
    repository: Repository, decision_date: date, cutoff_value: str,
    actual_known_by: datetime | None = None,
) -> tuple[list[dict[str, Any]], datetime]:
    validate_decision_date(decision_date)
    cutoff = decision_cutoff(decision_date, parse_cutoff(cutoff_value))
    start, end = delivery_bounds(decision_date)
    forecasts = select_day(repository, start, end, cutoff)
    actuals = _actuals(repository, start, end, actual_known_by)
    points: list[dict[str, Any]] = []
    for row in forecasts:
        actual = actuals.get(row["start_time"])
        forecast = row.get("generation")
        actual_mw = actual["generation"] if actual else None
        published = row.get("publish_time")
        target = parse_utc(row["start_time"])
        points.append({
            "decision_date": decision_date.isoformat(),
            "delivery_date": (decision_date + timedelta(days=1)).isoformat(),
            "start_time": row["start_time"],
            "hour": target.hour,
            "forecast_mw": forecast,
            "publish_time": published,
            "forecast_age_hours": (
                (target - parse_utc(published)).total_seconds() / 3600 if published else None
            ),
            "actual_mw": actual_mw,
            "actual_publish_time": actual["publish_time"] if actual else None,
            "error_mw": forecast - actual_mw if forecast is not None and actual_mw is not None else None,
        })
    return points, cutoff


def historical_points(
    repository: Repository, start_date: date, end_date: date, cutoff_value: str,
    actual_known_by: datetime | None = None,
) -> list[dict[str, Any]]:
    points: list[dict[str, Any]] = []
    cursor = start_date
    while cursor <= end_date:
        day, _ = day_points(repository, cursor, cutoff_value, actual_known_by)
        points.extend(day)
        cursor += timedelta(days=1)
    return points


def decision_payload(repository: Repository, selected_date: date, cutoff_value: str) -> dict[str, Any]:
    points, cutoff = day_points(repository, selected_date, cutoff_value)
    forecasts = [point["forecast_mw"] for point in points if point["forecast_mw"] is not None]
    published = [point["publish_time"] for point in points if point["publish_time"]]

    prior_points: list[dict[str, Any]] = []
    if selected_date > date(2026, 1, 1):
        prior_points = historical_points(
            repository, date(2026, 1, 1), selected_date - timedelta(days=1),
            cutoff_value, actual_known_by=cutoff,
        )
    prior_metric = metrics(prior_points, len(prior_points))
    prior_errors = [point["error_mw"] for point in prior_points if point["error_mw"] is not None]
    q05 = percentile(prior_errors, 0.05) if len(prior_errors) >= 24 else None
    q95 = percentile(prior_errors, 0.95) if len(prior_errors) >= 24 else None
    for point in points:
        if point["forecast_mw"] is not None and q05 is not None and q95 is not None:
            point["band_low_mw"] = point["forecast_mw"] - q95
            point["band_high_mw"] = point["forecast_mw"] - q05
        else:
            point["band_low_mw"] = None
            point["band_high_mw"] = None

    current_metric = metrics(points, len(points))
    missing = [point["start_time"] for point in points if point["forecast_mw"] is None]
    freshness = None
    if published:
        latest_publish = max(published)
        freshness = (cutoff - parse_utc(latest_publish)).total_seconds() / 3600
    return {
        "decision_date": selected_date.isoformat(),
        "delivery_date": (selected_date + timedelta(days=1)).isoformat(),
        "cutoff": iso_utc(cutoff),
        "cutoff_local": f"{selected_date.isoformat()} {cutoff_value} Europe/London",
        "cutoff_assumption": "Illustrative operating cutoff; not an official market gate closure.",
        "native_frequency": "hourly WINDFOR targets; exact-time FUELHH matches only",
        "latest_eligible_publish_time": max(published) if published else None,
        "forecast_freshness_hours_at_cutoff": freshness,
        "summary": {
            "mean_forecast_mw": mean(forecasts) if forecasts else None,
            "min_forecast_mw": min(forecasts) if forecasts else None,
            "max_forecast_mw": max(forecasts) if forecasts else None,
            "forecast_slots": len(forecasts),
            "expected_slots": len(points),
            "missing_slots": len(missing),
            "matched_actual_slots": current_metric["matched"],
            "matched_coverage": current_metric["coverage"],
        },
        "prior_performance": prior_metric,
        "risk_band": {
            "available": q05 is not None,
            "sample_size": len(prior_errors),
            "signed_error_q05_mw": q05,
            "signed_error_q95_mw": q95,
            "label": "Empirical 90% historical error band from preceding, available observations",
        },
        "missing_start_times": missing,
        "points": points,
    }


def accuracy_payload(
    repository: Repository, start_date: date, end_date: date, cutoff_value: str
) -> dict[str, Any]:
    if start_date < date(2026, 1, 1) or end_date > date(2026, 1, 31) or start_date > end_date:
        raise ValueError("accuracy range must fall within January 2026")
    points = historical_points(repository, start_date, end_date, cutoff_value)
    matched = [point for point in points if point["error_mw"] is not None]
    return {
        "period": {"start": start_date.isoformat(), "end": end_date.isoformat()},
        "cutoff": cutoff_value,
        "retrospective": True,
        "metrics": metrics(points, len(points)),
        "daily": group_metrics(points, "delivery_date"),
        "hourly": group_metrics(points, "hour"),
        "histogram": histogram(points),
        "points": matched,
    }


def revisions_payload(repository: Repository, target_time: datetime, cutoff: datetime) -> dict[str, Any]:
    target = target_time.astimezone(cutoff.tzinfo)
    target_iso = iso_utc(target_time)
    cutoff_iso = iso_utc(cutoff)
    rows = repository.rows(
        """SELECT publish_time, start_time, generation FROM forecasts
        WHERE start_time=? ORDER BY publish_time, generation""",
        (target_iso,),
    )
    revisions = []
    eligible_indexes: list[int] = []
    for index, row in enumerate(rows):
        eligible = row["publish_time"] <= cutoff_iso and row["publish_time"] < target_iso
        if eligible:
            eligible_indexes.append(index)
        revisions.append({
            **row,
            "eligible_at_cutoff": eligible,
            "hours_before_target": (target - parse_utc(row["publish_time"])).total_seconds() / 3600,
        })
    selected_index = eligible_indexes[-1] if eligible_indexes else None
    for index, revision in enumerate(revisions):
        revision["selected_at_cutoff"] = index == selected_index
    actual_map = _actuals(
        repository, target_time, target_time + timedelta(seconds=1)
    )
    actual = actual_map.get(target_iso)
    return {
        "target_time": target_iso,
        "cutoff": cutoff_iso,
        "actual_mw": actual["generation"] if actual else None,
        "selected_publish_time": revisions[selected_index]["publish_time"] if selected_index is not None else None,
        "selected_forecast_mw": revisions[selected_index]["generation"] if selected_index is not None else None,
        "revision_count": len(revisions),
        "revisions": revisions,
    }

