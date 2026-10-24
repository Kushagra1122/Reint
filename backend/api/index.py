from __future__ import annotations

import os
import shutil
from pathlib import Path

source_db = Path(__file__).resolve().parents[1] / "data" / "windsight.db"
runtime_db = Path("/tmp/windsight.db")
if not runtime_db.exists():
    shutil.copyfile(source_db, runtime_db)
os.environ.setdefault("WINDSIGHT_DB_PATH", str(runtime_db))
os.environ.setdefault("WINDSIGHT_CORS_ORIGINS", "*")

from app.main import app

__all__ = ["app"]
