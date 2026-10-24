from __future__ import annotations

import json
import sqlite3
from collections.abc import Iterable
from contextlib import contextmanager
from pathlib import Path
from typing import Any

from .config import DB_PATH

SCHEMA = """
CREATE TABLE IF NOT EXISTS forecasts (
  dataset TEXT NOT NULL,
  publish_time TEXT NOT NULL,
  start_time TEXT NOT NULL,
  generation REAL NOT NULL,
  ingested_at TEXT NOT NULL,
  PRIMARY KEY (dataset, publish_time, start_time, generation)
);
CREATE INDEX IF NOT EXISTS idx_forecast_target
  ON forecasts(start_time, publish_time);

CREATE TABLE IF NOT EXISTS actuals (
  dataset TEXT NOT NULL,
  publish_time TEXT NOT NULL,
  start_time TEXT NOT NULL,
  settlement_date TEXT,
  settlement_period INTEGER,
  fuel_type TEXT NOT NULL,
  generation REAL NOT NULL,
  ingested_at TEXT NOT NULL,
  PRIMARY KEY (dataset, publish_time, start_time, fuel_type, generation)
);
CREATE INDEX IF NOT EXISTS idx_actual_target
  ON actuals(start_time, fuel_type, publish_time);

CREATE TABLE IF NOT EXISTS import_runs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  started_at TEXT NOT NULL,
  completed_at TEXT,
  status TEXT NOT NULL,
  forecast_rows INTEGER NOT NULL DEFAULT 0,
  actual_rows INTEGER NOT NULL DEFAULT 0,
  detail TEXT
);
"""


class Repository:
    def __init__(self, path: Path | str = DB_PATH):
        self.path = Path(path)
        self.path.parent.mkdir(parents=True, exist_ok=True)
        with self.connection() as connection:
            connection.executescript(SCHEMA)

    @contextmanager
    def connection(self):
        connection = sqlite3.connect(self.path)
        connection.row_factory = sqlite3.Row
        try:
            yield connection
            connection.commit()
        finally:
            connection.close()

    def add_import_run(self, started_at: str) -> int:
        with self.connection() as connection:
            cursor = connection.execute(
                "INSERT INTO import_runs(started_at, status) VALUES (?, 'running')",
                (started_at,),
            )
            return int(cursor.lastrowid)

    def finish_import_run(
        self, run_id: int, completed_at: str, status: str,
        forecast_rows: int, actual_rows: int, detail: dict[str, Any] | str,
    ) -> None:
        serialized = detail if isinstance(detail, str) else json.dumps(detail)
        with self.connection() as connection:
            connection.execute(
                """UPDATE import_runs SET completed_at=?, status=?, forecast_rows=?,
                actual_rows=?, detail=? WHERE id=?""",
                (completed_at, status, forecast_rows, actual_rows, serialized, run_id),
            )

    def insert_forecasts(self, rows: Iterable[dict[str, Any]], ingested_at: str) -> int:
        values = [
            (row["dataset"], row["publish_time"], row["start_time"], row["generation"], ingested_at)
            for row in rows
        ]
        if not values:
            return 0
        with self.connection() as connection:
            before = connection.total_changes
            connection.executemany(
                "INSERT OR IGNORE INTO forecasts VALUES (?, ?, ?, ?, ?)", values
            )
            return connection.total_changes - before

    def insert_actuals(self, rows: Iterable[dict[str, Any]], ingested_at: str) -> int:
        values = [
            (
                row["dataset"], row["publish_time"], row["start_time"],
                row.get("settlement_date"), row.get("settlement_period"),
                row["fuel_type"], row["generation"], ingested_at,
            )
            for row in rows if row.get("fuel_type") == "WIND"
        ]
        if not values:
            return 0
        with self.connection() as connection:
            before = connection.total_changes
            connection.executemany(
                "INSERT OR IGNORE INTO actuals VALUES (?, ?, ?, ?, ?, ?, ?, ?)", values
            )
            return connection.total_changes - before

    def rows(self, query: str, params: tuple[Any, ...] = ()) -> list[dict[str, Any]]:
        with self.connection() as connection:
            return [dict(row) for row in connection.execute(query, params).fetchall()]

    def health(self) -> dict[str, Any]:
        with self.connection() as connection:
            forecasts = connection.execute("SELECT COUNT(*) FROM forecasts").fetchone()[0]
            actuals = connection.execute("SELECT COUNT(*) FROM actuals").fetchone()[0]
            latest = connection.execute(
                "SELECT * FROM import_runs ORDER BY id DESC LIMIT 1"
            ).fetchone()
        return {
            "forecast_rows": forecasts,
            "actual_rows": actuals,
            "latest_import": dict(latest) if latest else None,
        }

