# WindSight demo — recording script

Target length: **8–9 minutes**. Part 1 is the customer pitch; Part 2 is the technical handover. Text in brackets is an action and should not be spoken.

## Before recording

- Open the application on **Overview** with decision date **15 January 2026** and cutoff **11:00**.
- Open a second tab with `/docs` for the FastAPI documentation.
- Have `docs/architecture.md`, `backend/app/forecast_selection.py`, and `backend/tests/test_forecast_selection.py` ready in the editor.
- Have a terminal ready in the repository root.
- Record at 1080p and hide notifications, bookmarks, personal account details, and unrelated windows.

## Part 1 — Customer presentation (approximately 4:30)

### 0:00–0:35 — Introduce the product

[Show **Overview**.]

> Hello, and thank you for the opportunity to present WindSight, our pilot decision-support product for your day-ahead procurement team.
>
> The business question is simple but important: when the team must buy electricity for tomorrow, how much wind generation can it reasonably expect, and how much confidence should it place in that forecast?
>
> WindSight answers this using only national Elexon wind forecasts and wind-generation actuals.

### 0:35–1:15 — Explain the decision-time problem

> Wind forecasts are revised many times. Looking back with the newest revision would make an old purchasing decision appear better informed than it really was. WindSight prevents that hindsight bias.
>
> For every delivery hour, it reconstructs the latest forecast that had actually been published when the purchasing cutoff was reached. Later revisions are never allowed into the decision view.

### 1:15–2:10 — Show the controls and headline information

[Point to the decision date, delivery day, cutoff, and latest publication.]

> Here I have selected 15 January as the decision date, so the delivery day is 16 January. The cutoff is 11:00 UK time, and the latest eligible Elexon publication is shown alongside it.
>
> The 11:00 cutoff is configurable and illustrative; we are not presenting it as an official market gate closure. In a production engagement, it would be aligned with the client’s operating process.

[Point to the three KPI cards.]

> The first number is the mean forecast across the 24 delivery hours. The prior MAE tells us the typical size of forecast misses observed before this decision. The overforecast rate shows how frequently forecast wind exceeded actual wind. That direction matters because overforecasting wind may leave more residual demand to procure elsewhere.

### 2:10–2:55 — Explain the delivery chart

[Hover over two points on the chart.]

> The blue line is the as-of wind forecast, and the dashed grey line is actual generation. Hovering any hour shows the forecast value, its publication time, lead time, actual generation, and signed error. The shaded region is an empirical range based only on preceding forecast errors that were available by this cutoff.

[Click **Hide actuals**, pause, then reveal them again.]

> Hiding actuals recreates the information available to the buyer at decision time. Revealing them supports retrospective evaluation after delivery. The data can also be exported as CSV for further analysis.

[Briefly open **Decision notes and audit trail**.]

> Detailed notes and provenance remain available without crowding the main decision screen. This includes the precise cutoff, selected publication, forecast age, sample size, and missing-target count.

### 2:55–3:35 — Show forecast accuracy

[Open **Accuracy**.]

> The Accuracy view evaluates all January decisions using the same historical cutoff rule. MAE measures the average absolute miss. Bias shows whether forecasts tend to be above or below actual generation. We also report overforecast frequency and coverage, so every result is accompanied by its sample size rather than presented without context.

[Point to the main time-series chart, then briefly expand **Detailed accuracy diagnostics**.]

> The main chart compares decision-time forecasts with actual generation. Additional diagnostics provide calibration, error distribution, and hourly bias when an analyst needs deeper investigation.

### 3:35–4:10 — Show forecast revisions

[Open **Revisions**.]

> The Revisions view keeps one delivery hour fixed and shows how its forecast changed as Elexon publications arrived. The selected point is the final revision available at the cutoff. Earlier points were superseded, while later grey points were unavailable to the buyer.
>
> This makes the decision auditable and demonstrates that no future information has leaked into the analysis.

### 4:10–4:30 — Customer close

[Open **Method** briefly, then return to **Overview**.]

> WindSight gives the procurement team a clear, defensible view of forecast availability and quantified wind uncertainty. It does not claim to prescribe a purchase quantity, because that would additionally require demand, contracted supply, prices, and portfolio constraints. The pilot establishes a reliable foundation on which those future decision layers can be built.

## Part 2 — Technical lead handover (approximately 4:30)

### 4:30–5:05 — Architecture

[Show `docs/architecture.md`.]

> I’ll now cover the implementation and the controls that make the analysis reproducible.
>
> The architecture has four layers: a React and TypeScript frontend, a FastAPI query service, a SQLite historical snapshot, and an importer for the official Elexon WINDFOR and FUELHH streams. Page loads query the local snapshot rather than calling Elexon directly, which gives repeatable results and predictable performance.

### 5:05–5:50 — Ingestion and storage

[Show `backend/app/ingest.py`, then `repository.py`.]

> The importer requests data by publication time in 12-hour chunks and downloads the two datasets concurrently. Rate limits, server errors, and network failures are retried with exponential backoff.
>
> All timestamps are normalized to UTC. FUELHH records are filtered to the WIND fuel type before persistence. Forecast vintages are deliberately preserved as separate rows because publication history is essential to an as-of analysis.
>
> SQLite composite primary keys and insert-ignore operations make reruns idempotent. Every run is also written to an import ledger. The supplied snapshot contains over twenty thousand forecast vintages and roughly fifteen hundred wind actual records.

### 5:50–6:40 — Decision-time selection

[Show `backend/app/forecast_selection.py`.]

> This is the key business rule. For each target hour, a forecast is eligible only when its publish time is at or before the decision cutoff and before the delivery start time. From those records, the latest publication is selected. If no eligible record exists, the value remains missing; it is never converted to zero.

[Show `backend/tests/test_forecast_selection.py`.]

> The tests prove that a better post-cutoff forecast is excluded, the latest eligible revision is selected, and missing data remains null. These tests directly protect against the most damaging failure mode: future-data leakage.

### 6:40–7:20 — Matching and analytics

[Show `backend/app/service.py`, then `analytics.py`.]

> The January WINDFOR snapshot has hourly targets, while FUELHH is half-hourly. Comparisons use identical start times only; the service does not silently interpolate or manufacture observations.
>
> Signed error is forecast minus actual. The analytics layer calculates MAE, RMSE, bias, P90 absolute error, over- and underforecast frequencies, matched sample size, and coverage. The historical band uses the fifth and ninety-fifth percentiles of preceding signed errors once at least 24 matched observations exist. It is labelled as an empirical range, not a calibrated prediction interval.

### 7:20–8:00 — API and frontend

[Open the FastAPI `/docs` tab.]

> FastAPI exposes health, decision series, accuracy, revisions, and methodology endpoints. Input dates and cutoff formats are validated, and timezone-aware timestamps are required for revision queries.

[Return to the application.]

> The React frontend keeps the decision date and cutoff as shared state across the relevant views. Recharts provides the visualisations, while loading, error, empty-data, responsive navigation, and CSV-export behaviour are handled explicitly. Secondary diagnostics are collapsed by default to keep the decision surface focused.

### 8:00–8:40 — Quality and deployment

[In the terminal, run or show completed output for the following commands.]

```bash
cd backend && ../.venv/bin/pytest -q
cd ../frontend && npm run build
cd .. && docker compose ps
curl http://localhost:8000/api/health
```

> The automated suite covers selection leakage, metrics, coverage, WIND-only filtering, idempotent imports, date boundaries, and API validation. The TypeScript production build also passes.
>
> Docker Compose runs the frontend and backend as an integrated stack. For deployment, the frontend is built on Vercel, the Python API runs on Heroku, and the frontend API URL plus backend CORS origins are supplied through environment variables. GitHub Actions repeats the backend tests and frontend build on every push and pull request.

### 8:40–9:00 — Technical close

[Show the README.]

> The README documents setup, data refresh, selection rules, tests, deployment, limitations, and the required AI-use disclosure. The main known limitation is that WINDFOR and FUELHH may not cover perfectly identical wind-asset universes. Within that constraint, the product provides a reproducible and auditable decision-time analysis. Thank you.

## Recording reminders

- Speak slowly and do not read the bracketed actions aloud.
- Do not describe 11:00 as an official market deadline.
- Do not claim that WindSight calculates the quantity to purchase.
- Keep Part 1 under five minutes and transition clearly before Part 2.
- If a chart takes time to load, pause the recording instead of filling the delay.
- After uploading, watch the complete video once and verify the unlisted link in an incognito window.

