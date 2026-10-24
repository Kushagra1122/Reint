from __future__ import annotations

import asyncio
from datetime import datetime, timedelta, timezone
from typing import Any

from .elexon_client import ElexonClient
from .repository import Repository
from .time_utils import iso_utc


def normalize_forecast(row: dict[str, Any]) -> dict[str, Any]:
    return {
        "dataset": "WINDFOR",
        "publish_time": iso_utc(row["publishTime"]),
        "start_time": iso_utc(row["startTime"]),
        "generation": float(row["generation"]),
    }


def normalize_actual(row: dict[str, Any]) -> dict[str, Any]:
    return {
        "dataset": "FUELHH",
        "publish_time": iso_utc(row["publishTime"]),
        "start_time": iso_utc(row["startTime"]),
        "settlement_date": row.get("settlementDate"),
        "settlement_period": row.get("settlementPeriod"),
        "fuel_type": row.get("fuelType"),
        "generation": float(row["generation"]),
    }


async def import_january(repository: Repository | None = None) -> dict[str, Any]:
    repo = repository or Repository()
    now = datetime.now(timezone.utc)
    started = iso_utc(now)
    run_id = repo.add_import_run(started)
    client = ElexonClient()
    try:
        # Lead-in captures vintages available to the first January decision.
        forecast_raw, actual_raw = await asyncio.gather(
            client.fetch_range(
                "WINDFOR",
                datetime(2025, 12, 29, tzinfo=timezone.utc),
                datetime(2026, 2, 1, 12, tzinfo=timezone.utc),
                timedelta(hours=12),
            ),
            client.fetch_range(
                "FUELHH",
                datetime(2026, 1, 2, tzinfo=timezone.utc),
                datetime(2026, 2, 2, 3, tzinfo=timezone.utc),
                timedelta(hours=12),
            ),
        )
        forecasts = [normalize_forecast(row) for row in forecast_raw]
        actuals = [normalize_actual(row) for row in actual_raw]
        inserted_forecasts = repo.insert_forecasts(forecasts, started)
        inserted_actuals = repo.insert_actuals(actuals, started)
        detail = {
            "forecast_received": len(forecasts),
            "actual_received": len(actuals),
            "forecast_inserted": inserted_forecasts,
            "wind_actual_inserted": inserted_actuals,
            "source": "Elexon Insights API",
        }
        repo.finish_import_run(
            run_id, iso_utc(datetime.now(timezone.utc)), "complete",
            inserted_forecasts, inserted_actuals, detail,
        )
        return detail
    except Exception as exc:
        repo.finish_import_run(
            run_id, iso_utc(datetime.now(timezone.utc)), "failed", 0, 0, str(exc)
        )
        raise

