import math

from app.analytics import metrics


def test_metrics_and_coverage_hand_calculated():
    points = [
        {"forecast_mw": 10, "actual_mw": 8},
        {"forecast_mw": 7, "actual_mw": 9},
        {"forecast_mw": 5, "actual_mw": 4},
        {"forecast_mw": None, "actual_mw": 3},
    ]
    result = metrics(points, 4)
    assert result["mae_mw"] == 5 / 3
    assert math.isclose(result["rmse_mw"], math.sqrt(3))
    assert result["bias_mw"] == 1 / 3
    assert result["overforecast_count"] == 2
    assert result["underforecast_count"] == 1
    assert result["matched"] == 3
    assert result["coverage"] == 0.75

