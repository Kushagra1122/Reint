# WindSight architecture

```text
React + TypeScript SPA
        │ JSON over HTTPS
        ▼
FastAPI query layer
        │
        ├── as-of forecast selector
        ├── exact-time join + analytics
        └── SQLite historical snapshot
                  ▲
                  │ idempotent import
        Elexon WINDFOR + FUELHH
```

## Data flow

1. The importer requests Elexon dataset streams in 12-hour publication-time chunks. Network failures, HTTP 429s and server errors are retried with exponential backoff.
2. Timestamps are normalized to UTC. Forecast vintages remain separate records. Actuals are filtered to `fuelType == WIND` before persistence.
3. SQLite composite primary keys make reruns idempotent while preserving distinct conflicting values for audit.
4. For every delivery target, the API selects the latest record where `publishTime <= cutoff` and `publishTime < startTime`.
5. FUELHH is joined only on an identical `startTime`. The January WINDFOR feed is hourly; the half-hour FUELHH observations that have no hourly forecast counterpart are not resampled.
6. Metrics are calculated only on matched observations and always include matched count and coverage.

## Decision-time safeguards

- The main page uses only the selected vintage.
- The revisions page may show later vintages, but marks them unavailable at the cutoff.
- Historical bands on a selected decision use preceding observations whose actual publication was available by that cutoff.
- The all-month accuracy view is explicitly labelled retrospective.

## Deployment shape

The frontend is a static Vite bundle suitable for Vercel. The backend is an ASGI service suitable for Heroku or another Python host. The checked-in SQLite snapshot makes production reads independent of an ephemeral writeable disk; refreshes should build a new snapshot during a release or upload it to durable storage.

