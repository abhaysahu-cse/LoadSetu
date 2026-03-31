from __future__ import annotations

from unittest.mock import AsyncMock

import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient

from main import app
from services.control_plane import parse_whatsapp_message
from services.kafka_client import get_producer


class FakeProducer:
    def __init__(self) -> None:
        self.publish = AsyncMock(return_value=True)


@pytest_asyncio.fixture
async def client():
    async with AsyncClient(
        transport=ASGITransport(app=app),
        base_url="http://test",
    ) as ac:
        yield ac


def test_parse_driver_message() -> None:
    parsed = parse_whatsapp_message("Indore to Bhopal truck empty")
    assert parsed.type == "driver"
    assert parsed.origin == "Indore"
    assert parsed.destination == "Bhopal"
    assert parsed.weight_tons is None


def test_parse_load_message() -> None:
    parsed = parse_whatsapp_message("Need truck Bhopal to Nagpur 10 ton")
    assert parsed.type == "load"
    assert parsed.origin == "Bhopal"
    assert parsed.destination == "Nagpur"
    assert parsed.weight_tons == 10.0


@pytest.mark.asyncio
async def test_whatsapp_webhook_handles_bad_message(client: AsyncClient) -> None:
    fake_producer = FakeProducer()
    app.dependency_overrides[get_producer] = lambda: fake_producer
    try:
        response = await client.post(
            "/api/v1/whatsapp/webhook",
            data={"Body": "hello there", "From": "whatsapp:+919999999999", "MessageSid": "SM123"},
        )
        assert response.status_code == 200
        assert "application/xml" in response.headers["content-type"]
        fake_producer.publish.assert_not_awaited()
    finally:
        app.dependency_overrides.clear()


@pytest.mark.asyncio
async def test_admin_force_match_queues_load_event(client: AsyncClient) -> None:
    fake_producer = FakeProducer()
    app.dependency_overrides[get_producer] = lambda: fake_producer
    try:
        response = await client.post(
            "/api/v1/admin/force-match",
            json={
                "load_id": "1fc036ba-912b-45c0-8f3f-2032d303e02c",
                "origin": "Bhopal",
                "destination": "Nagpur",
                "pickup_lat": 23.2599,
                "pickup_lng": 77.4126,
                "weight_tons": 10,
            },
        )
        assert response.status_code == 200
        body = response.json()
        assert body["status"] == "queued"
        fake_producer.publish.assert_awaited_once()
    finally:
        app.dependency_overrides.clear()