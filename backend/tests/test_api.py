import asyncio

import httpx

from app.main import app


def get(path: str, params: dict[str, str] | None = None) -> httpx.Response:
    async def request() -> httpx.Response:
        transport = httpx.ASGITransport(app=app)
        async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
            return await client.get(path, params=params)
    return asyncio.run(request())


def test_health_contract():
    response = get("/api/health")
    assert response.status_code == 200
    assert response.json()["source"] == "Elexon FUELHH + WINDFOR"


def test_rejects_out_of_range_decision():
    response = get("/api/series", params={"decision_date": "2025-12-31", "cutoff": "11:00"})
    assert response.status_code == 422
