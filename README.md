# WindSight

WindSight is a decision-time-aware dashboard for a UK electricity utility's day-ahead procurement team. It answers a narrow, auditable question: **what wind forecast was available at the moment a purchasing decision was made, and how accurate have comparable decision-time forecasts been?**

The product uses only Elexon's `WINDFOR` forecast vintages and `FUELHH` WIND outturn. It is not a trading engine, demand forecast, price model, or purchase optimiser.

## Date and cutoff rule

The primary date picker represents **purchase decisions from 1–31 January 2026**. Each decision targets the following delivery day, so the covered delivery range is **2 January–1 February 2026**. This intentionally does not mix in the alternate “January delivery dates” interpretation.

The default cutoff is **11:00 Europe/London** on the decision date. It is configurable and explicitly illustrative; the app does not claim this is an official UK day-ahead market close. Timestamps are stored in UTC and displayed in UK local time. January 2026 is GMT.

## What is included

- Decision dashboard with as-of forecast, publication provenance, forecast freshness, missing slots, prior performance and empirical risk band.
- Retrospective accuracy view with MAE, RMSE, bias, P90 absolute error, over/underforecast counts, coverage, time series, scatter, histogram and hourly bias.
- Revision explorer separating eligible revisions from updates unavailable at decision time.
- Methodology and limitations view.
- CSV export of the selected matched series.
- Chunked retrying Elexon importer, raw vintage preservation, SQLite cache and idempotent reruns.
- FastAPI contracts, Docker Compose and CI.

## Repository structure

```text
backend/
  app/                 FastAPI, importer, storage, selection and analytics
  scripts/             historical snapshot import command
  tests/               leakage, metric, coverage, date and API tests
  data/windsight.db    reproducible Elexon January snapshot
frontend/
  src/pages/           four product views
  src/components/      shared UI and chart states
docs/                  architecture and demo script
.github/workflows/     backend and frontend CI
docker-compose.yml     local integrated stack
```

## Run with Docker

Prerequisites: Docker with Compose.

```bash
docker compose up --build
```

Open the frontend at `http://localhost:5173`, API at `http://localhost:8000/api/health`, and interactive API documentation at `http://localhost:8000/docs`.

## Run locally

Prerequisites: Python 3.12 and Node.js 22.

```bash
python3.12 -m venv .venv
.venv/bin/pip install -r backend/requirements.txt
cd frontend && npm install && cd ..

# terminal 1
cd backend && ../.venv/bin/uvicorn app.main:app --reload

# terminal 2
cd frontend && npm run dev
```

Vite proxies `/api` to port 8000 in development. Set `VITE_API_URL` when the production API is on another origin; set `WINDSIGHT_CORS_ORIGINS` on the backend to the comma-separated frontend origins.

## Refresh the data snapshot

The app does not call Elexon on every page load. To deterministically refresh the local SQLite cache:

```bash
cd backend
../.venv/bin/python -m scripts.import_january
```

The importer requests the official stream endpoints by publication time in 12-hour chunks, includes a lead-in before the first decision, and extends actuals through 1 February. It retries rate limits/server errors and logs every run in `import_runs`. Re-running does not duplicate identical records.

Data sources:

- [Elexon WINDFOR stream](https://bmrs.elexon.co.uk/api-documentation/endpoint/datasets/WINDFOR/stream)
- [Elexon FUELHH stream](https://bmrs.elexon.co.uk/api-documentation/endpoint/datasets/FUELHH/stream)

## As-of selection

For every target `startTime` on delivery day:

```python
eligible = [
    row for row in forecasts_for_target
    if row.publish_time <= decision_cutoff
    and row.publish_time < row.start_time
]
selected = max(eligible, key=lambda row: row.publish_time, default=None)
```

No eligible record means missing, never zero. The January WINDFOR feed is hourly, while FUELHH is half-hourly; comparisons use exact common timestamps only and do not interpolate.

Signed error is `forecast − actual`: positive means overforecast and potential wind-shortfall exposure. Metrics are calculated only on matched records and are always accompanied by N and coverage. The risk band uses preceding signed-error quantiles when at least 24 observations are available; it is an empirical historical range, not a calibrated prediction interval.

## Tests

```bash
cd backend && ../.venv/bin/pytest -q
cd frontend && npm run build
```

Tests cover post-cutoff exclusion, latest eligible selection, missing-not-zero behavior, exact timestamp alignment, non-WIND filtering, hand-calculated metrics, missing-data coverage, idempotent imports, 31 January → 1 February delivery, timezone-aware handling, and API validation.
