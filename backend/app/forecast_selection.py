from __future__ import annotations

from datetime import datetime, timedelta
from typing import Any

from .repository import Repository
from .time_utils import iso_utc


def as_of_forecast(
    forecasts_for_target: list[dict[str, Any]], decision_cutoff: datetime
) -> dict[str, Any] | None:
    eligible = [
        row for row in forecasts_for_target
        if datetime.fromisoformat(row["publish_time"].replace("Z", "+00:00")) <= decision_cutoff
        and datetime.fromisoformat(row["publish_time"].replace("Z", "+00:00"))
        < datetime.fromisoformat(row["start_time"].replace("Z", "+00:00"))
    ]
    return max(
        eligible,
        key=lambda row: (row["publish_time"], float(row["generation"])),
        default=None,
    )


def select_day(
    repository: Repository, delivery_start: datetime, delivery_end: datetime,
    cutoff: datetime,
) -> list[dict[str, Any]]:
    rows = repository.rows(
        """SELECT publish_time, start_time, generation FROM forecasts
        WHERE start_time >= ? AND start_time < ? AND publish_time <= ?
        ORDER BY start_time, publish_time""",
        (iso_utc(delivery_start), iso_utc(delivery_end), iso_utc(cutoff)),
    )
    by_target: dict[str, list[dict[str, Any]]] = {}
    for row in rows:
        by_target.setdefault(row["start_time"], []).append(row)

    selected: list[dict[str, Any]] = []
    cursor = delivery_start
    while cursor < delivery_end:
        target = iso_utc(cursor)
        chosen = as_of_forecast(by_target.get(target, []), cutoff)
        selected.append({"start_time": target, **(chosen or {})} if chosen else {
            "start_time": target, "publish_time": None, "generation": None,
        })
        cursor += timedelta(hours=1)
    return selected

