from __future__ import annotations

from datetime import date, datetime

from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware

from .config import cors_origins
from .repository import Repository
from .schemas import HealthResponse
from .service import accuracy_payload, decision_payload, revisions_payload

app = FastAPI(
    title="WindSight API",
    version="1.0.0",
    description="Decision-time-aware UK wind forecast intelligence using Elexon data only.",
)
app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins(),
    allow_credentials=False,
    allow_methods=["GET"],
    allow_headers=["*"],
)
repository = Repository()


@app.get("/api/health", response_model=HealthResponse)
def health():
    snapshot = repository.health()
    has_data = snapshot["forecast_rows"] > 0 and snapshot["actual_rows"] > 0
    return {
        "service": "windsight-api",
        "status": "ready" if has_data else "no-data",
        "source": "Elexon FUELHH + WINDFOR",
        "snapshot": snapshot,
    }


@app.get("/api/decisions")
def decisions(
    date_value: date = Query(alias="date"),
    cutoff: str = Query(default="11:00", pattern=r"^([01]\d|2[0-3]):[0-5]\d$"),
):
    try:
        payload = decision_payload(repository, date_value, cutoff)
        return {key: value for key, value in payload.items() if key != "points"}
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc


@app.get("/api/series")
def series(
    decision_date: date,
    cutoff: str = Query(default="11:00", pattern=r"^([01]\d|2[0-3]):[0-5]\d$"),
):
    try:
        return decision_payload(repository, decision_date, cutoff)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc


@app.get("/api/accuracy")
def accuracy(
    start: date = date(2026, 1, 1),
    end: date = date(2026, 1, 31),
    cutoff: str = Query(default="11:00", pattern=r"^([01]\d|2[0-3]):[0-5]\d$"),
):
    try:
        return accuracy_payload(repository, start, end, cutoff)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc


@app.get("/api/revisions")
def revisions(target_time: datetime, cutoff: datetime):
    if target_time.tzinfo is None or cutoff.tzinfo is None:
        raise HTTPException(status_code=422, detail="target_time and cutoff must include a timezone")
    return revisions_payload(repository, target_time, cutoff)


@app.get("/api/methodology")
def methodology():
    return {
        "sources": [
            {
                "dataset": "WINDFOR",
                "purpose": "Historical forecast vintages",
                "url": "https://bmrs.elexon.co.uk/api-documentation/endpoint/datasets/WINDFOR/stream",
            },
            {
                "dataset": "FUELHH",
                "purpose": "WIND generation outturn",
                "url": "https://bmrs.elexon.co.uk/api-documentation/endpoint/datasets/FUELHH/stream",
            },
        ],
        "date_rule": "January 1–31, 2026 are decision dates; delivery is the following day, through February 1.",
        "cutoff": "11:00 Europe/London is configurable and illustrative, not an official gate closure.",
        "selection": "For each target, choose the latest publishTime at or before cutoff, with publishTime before startTime.",
        "matching": "WINDFOR is hourly in this snapshot. FUELHH is matched only on exact common startTime; no interpolation.",
        "error_sign": "forecast minus actual: positive is overforecast; negative is underforecast.",
        "limitations": [
            "WINDFOR and FUELHH may not cover identical asset universes.",
            "The risk band is an empirical historical error range, not a calibrated prediction interval.",
            "This product describes wind uncertainty and does not recommend a trade quantity.",
        ],
    }

