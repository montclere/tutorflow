"""Сборка защищённой точки Prometheus из HTTP, Identity и фоновой команды."""

import hmac
import sys
from asyncio import to_thread
from collections.abc import Awaitable, Callable
from pathlib import Path

import structlog
from fastapi import APIRouter, HTTPException, Request
from prometheus_client import CONTENT_TYPE_LATEST, CollectorRegistry, Gauge, generate_latest
from starlette.responses import Response

from app.composition import Services
from app.config import MonitoringSettings
from app.modules.identity.infrastructure.monitoring import RegistrationMetrics
from app.shared.infrastructure.metrics import Metrics


def maintenance_snapshots(directory: Path) -> bytes:
    content = []

    for name in ("maintenance-attempt.prom", "maintenance-success.prom"):
        try:
            content.append((directory / name).read_bytes())
        except FileNotFoundError:
            pass

    return b"".join(content)


def monitoring_router(
    metrics: Metrics, resolve_services: Callable[[Request], Awaitable[Services]]
) -> APIRouter:
    router = APIRouter()
    settings = MonitoringSettings()


    @router.get("/metrics", include_in_schema=False)
    async def scrape(request: Request) -> Response:
        expected = settings.token.get_secret_value()
        supplied = request.headers.get("authorization", "")

        if not expected or not hmac.compare_digest(
            supplied.encode(), f"Bearer {expected}".encode()
        ):
            raise HTTPException(403, "metrics_forbidden")

        registry = CollectorRegistry()
        available = Gauge(
            "tutorflow_metrics_database_available",
            "Доступность БД для мониторинга.",
            registry=registry,
        )
        backlog = b""

        try:
            services = await resolve_services(request)
            backlog = await RegistrationMetrics(
                services.engine, services.identity.registration.policy.delivery_attempts
            ).render()

            available.set(1)
        except Exception:
            available.set(0)
            await structlog.get_logger(__name__).aerror(
                "metrics_collection_failed", exc_info=sys.exc_info()
            )

        body = generate_latest(metrics.registry) + generate_latest(registry) + backlog
        body += await to_thread(maintenance_snapshots, settings.directory)

        return Response(
            body, headers={"Content-Type": CONTENT_TYPE_LATEST, "Cache-Control": "no-store"}
        )


    return router
