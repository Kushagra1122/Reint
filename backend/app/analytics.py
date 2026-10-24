from __future__ import annotations

import math
from collections import defaultdict
from statistics import mean
from typing import Any


def percentile(values: list[float], probability: float) -> float | None:
    if not values:
        return None
    ordered = sorted(values)
    position = (len(ordered) - 1) * probability
    lower = math.floor(position)
    upper = math.ceil(position)
    if lower == upper:
        return ordered[lower]
    weight = position - lower
    return ordered[lower] * (1 - weight) + ordered[upper] * weight


def metrics(points: list[dict[str, Any]], eligible_targets: int | None = None) -> dict[str, Any]:
    matched = [
        point for point in points
        if point.get("forecast_mw") is not None and point.get("actual_mw") is not None
    ]
    errors = [point["forecast_mw"] - point["actual_mw"] for point in matched]
    target_count = eligible_targets if eligible_targets is not None else len(points)
    if not errors:
        return {
            "mae_mw": None, "rmse_mw": None, "bias_mw": None,
            "p90_absolute_error_mw": None, "overforecast_count": 0,
            "underforecast_count": 0, "overforecast_frequency": None,
            "underforecast_frequency": None, "matched": 0,
            "eligible_targets": target_count, "coverage": 0,
        }
    over = sum(error > 0 for error in errors)
    under = sum(error < 0 for error in errors)
    return {
        "mae_mw": mean(abs(error) for error in errors),
        "rmse_mw": math.sqrt(mean(error ** 2 for error in errors)),
        "bias_mw": mean(errors),
        "p90_absolute_error_mw": percentile([abs(error) for error in errors], 0.9),
        "overforecast_count": over,
        "underforecast_count": under,
        "overforecast_frequency": over / len(errors),
        "underforecast_frequency": under / len(errors),
        "matched": len(errors),
        "eligible_targets": target_count,
        "coverage": len(errors) / target_count if target_count else 0,
    }


def group_metrics(points: list[dict[str, Any]], field: str) -> list[dict[str, Any]]:
    groups: dict[Any, list[dict[str, Any]]] = defaultdict(list)
    for point in points:
        groups[point[field]].append(point)
    return [{field: key, **metrics(value, len(value))} for key, value in sorted(groups.items())]


def histogram(points: list[dict[str, Any]], bins: int = 10) -> list[dict[str, Any]]:
    errors = [
        point["forecast_mw"] - point["actual_mw"] for point in points
        if point.get("forecast_mw") is not None and point.get("actual_mw") is not None
    ]
    if not errors:
        return []
    low, high = min(errors), max(errors)
    if low == high:
        return [{"label": f"{low:.0f}", "count": len(errors), "from": low, "to": high}]
    width = (high - low) / bins
    counts = [0] * bins
    for error in errors:
        index = min(int((error - low) / width), bins - 1)
        counts[index] += 1
    return [
        {
            "label": f"{low + index * width:.0f} to {low + (index + 1) * width:.0f}",
            "count": count,
            "from": low + index * width,
            "to": low + (index + 1) * width,
        }
        for index, count in enumerate(counts)
    ]
