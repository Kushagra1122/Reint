from __future__ import annotations

from datetime import date, datetime

from pydantic import BaseModel, Field


class Coverage(BaseModel):
    matched: int
    eligible_targets: int
    coverage: float = Field(ge=0, le=1)


class HealthResponse(BaseModel):
    service: str
    status: str
    source: str
    snapshot: dict


class ErrorResponse(BaseModel):
    detail: str


class DecisionQuery(BaseModel):
    decision_date: date
    cutoff: str


class RevisionQuery(BaseModel):
    target_time: datetime
    cutoff: datetime

