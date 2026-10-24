from __future__ import annotations

from datetime import date, datetime, time, timedelta, timezone
from zoneinfo import ZoneInfo

LONDON = ZoneInfo("Europe/London")
UTC = timezone.utc


def parse_utc(value: str) -> datetime:
    parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
    if parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=UTC)
    return parsed.astimezone(UTC)


def iso_utc(value: datetime | str) -> str:
    parsed = parse_utc(value) if isinstance(value, str) else value.astimezone(UTC)
    return parsed.replace(microsecond=0).isoformat().replace("+00:00", "Z")


def decision_cutoff(decision_date: date, cutoff: time) -> datetime:
    local = datetime.combine(decision_date, cutoff, tzinfo=LONDON)
    return local.astimezone(UTC)


def delivery_bounds(decision_date: date) -> tuple[datetime, datetime]:
    delivery_date = decision_date + timedelta(days=1)
    start = datetime.combine(delivery_date, time.min, tzinfo=LONDON).astimezone(UTC)
    end = datetime.combine(delivery_date + timedelta(days=1), time.min, tzinfo=LONDON).astimezone(UTC)
    return start, end


def parse_cutoff(value: str) -> time:
    try:
        return time.fromisoformat(value)
    except ValueError as exc:
        raise ValueError("cutoff must be HH:MM in UK local time") from exc

