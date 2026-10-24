from __future__ import annotations

import asyncio
from datetime import datetime, timedelta
from typing import Any

import httpx

from .config import ELEXON_BASE_URL
from .time_utils import iso_utc


class ElexonError(RuntimeError):
    pass


class ElexonClient:
    def __init__(self, base_url: str = ELEXON_BASE_URL, timeout: float = 30.0):
        self.base_url = base_url.rstrip("/")
        self.timeout = timeout

    async def fetch_window(
        self, client: httpx.AsyncClient, dataset: str, start: datetime, end: datetime
    ) -> list[dict[str, Any]]:
        url = f"{self.base_url}/datasets/{dataset}/stream"
        params = {
            "publishDateTimeFrom": iso_utc(start),
            "publishDateTimeTo": iso_utc(end),
        }
        for attempt in range(4):
            try:
                response = await client.get(url, params=params)
                if response.status_code == 429 or response.status_code >= 500:
                    raise httpx.HTTPStatusError(
                        f"Elexon returned {response.status_code}",
                        request=response.request,
                        response=response,
                    )
                response.raise_for_status()
                payload = response.json()
                if not isinstance(payload, list):
                    raise ElexonError(f"Unexpected {dataset} response shape")
                return payload
            except (httpx.HTTPError, ValueError) as exc:
                if attempt == 3:
                    raise ElexonError(f"Failed to fetch {dataset}: {exc}") from exc
                await asyncio.sleep(2 ** attempt)
        return []

    async def fetch_range(
        self, dataset: str, start: datetime, end: datetime, chunk: timedelta
    ) -> list[dict[str, Any]]:
        windows: list[tuple[datetime, datetime]] = []
        cursor = start
        while cursor < end:
            next_cursor = min(cursor + chunk, end)
            windows.append((cursor, next_cursor))
            cursor = next_cursor

        semaphore = asyncio.Semaphore(4)
        async with httpx.AsyncClient(timeout=self.timeout, headers={"Accept": "application/json"}) as client:
            async def fetch(window: tuple[datetime, datetime]):
                async with semaphore:
                    return await self.fetch_window(client, dataset, *window)

            batches = await asyncio.gather(*(fetch(window) for window in windows))
        return [row for batch in batches for row in batch]

