from datetime import date

from app.repository import Repository
from app.service import day_points


def test_import_is_idempotent_and_filters_non_wind(tmp_path):
    repo = Repository(tmp_path / "test.db")
    forecast = {
        "dataset": "WINDFOR", "publish_time": "2026-01-01T09:30:00Z",
        "start_time": "2026-01-02T00:00:00Z", "generation": 100,
    }
    assert repo.insert_forecasts([forecast], "2026-02-03T00:00:00Z") == 1
    assert repo.insert_forecasts([forecast], "2026-02-03T00:00:00Z") == 0
    actuals = [
        {"dataset": "FUELHH", "publish_time": "2026-01-02T00:30:00Z", "start_time": "2026-01-02T00:00:00Z", "settlement_date": "2026-01-02", "settlement_period": 1, "fuel_type": "WIND", "generation": 90},
        {"dataset": "FUELHH", "publish_time": "2026-01-02T00:30:00Z", "start_time": "2026-01-02T00:00:00Z", "settlement_date": "2026-01-02", "settlement_period": 1, "fuel_type": "CCGT", "generation": 999},
    ]
    assert repo.insert_actuals(actuals, "2026-02-03T00:00:00Z") == 1
    points, _ = day_points(repo, date(2026, 1, 1), "11:00")
    assert points[0]["forecast_mw"] == 100
    assert points[0]["actual_mw"] == 90
    assert len(points) == 24


def test_january_31_delivers_february_1(tmp_path):
    repo = Repository(tmp_path / "test.db")
    points, _ = day_points(repo, date(2026, 1, 31), "11:00")
    assert points[0]["delivery_date"] == "2026-02-01"
    assert points[-1]["start_time"] == "2026-02-01T23:00:00Z"

