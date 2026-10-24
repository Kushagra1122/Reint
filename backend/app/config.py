from __future__ import annotations

import os
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parents[1]
DB_PATH = Path(os.getenv("WINDSIGHT_DB_PATH", BASE_DIR / "data" / "windsight.db"))
ELEXON_BASE_URL = "https://data.elexon.co.uk/bmrs/api/v1"
DEFAULT_CUTOFF = "11:00"
DECISION_START = "2026-01-01"
DECISION_END = "2026-01-31"


def cors_origins() -> list[str]:
    raw = os.getenv("WINDSIGHT_CORS_ORIGINS", "http://localhost:5173")
    return [value.strip() for value in raw.split(",") if value.strip()]

