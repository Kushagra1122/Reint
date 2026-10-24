from datetime import datetime, timezone

from app.forecast_selection import as_of_forecast


def row(publish: str, generation: float, start: str = "2026-01-16T12:00:00Z"):
    return {"publish_time": publish, "start_time": start, "generation": generation}


def test_excludes_better_post_cutoff_forecast():
    cutoff = datetime(2026, 1, 15, 11, tzinfo=timezone.utc)
    result = as_of_forecast([
        row("2026-01-15T09:30:00Z", 6000),
        row("2026-01-15T11:30:00Z", 5000),
    ], cutoff)
    assert result["generation"] == 6000


def test_chooses_latest_eligible_revision():
    cutoff = datetime(2026, 1, 15, 11, tzinfo=timezone.utc)
    result = as_of_forecast([
        row("2026-01-14T20:00:00Z", 5700),
        row("2026-01-15T09:30:00Z", 6000),
    ], cutoff)
    assert result["publish_time"] == "2026-01-15T09:30:00Z"


def test_missing_is_none_not_zero():
    cutoff = datetime(2026, 1, 15, 11, tzinfo=timezone.utc)
    assert as_of_forecast([row("2026-01-15T11:30:00Z", 0)], cutoff) is None

