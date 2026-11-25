"""Обрабатывает отложенные отправки и публикует результат обслуживания."""

import asyncio
import fcntl
import sys
from asyncio import to_thread
from datetime import UTC, datetime
from time import perf_counter, time
from uuid import uuid4

import structlog

from app.composition import Services, services_from_environment
from app.config import MonitoringSettings
from app.modules.identity.infrastructure.persistence.retention import IdentityRetention
from app.modules.scheduling.infrastructure.repository import PostgresCalendarRepository
from app.shared.infrastructure.logging import configure_logging
from app.shared.infrastructure.metrics import MaintenanceMetrics


class Maintenance:
    def __init__(self, services: Services, metrics: MaintenanceMetrics) -> None:
        self.services = services
        self.metrics = metrics

    async def run(self) -> None:
        start = perf_counter()

        self.metrics.success.set(0)

        baseline = {
            (channel, outcome): self.services.metrics.registry.get_sample_value(
                "tutorflow_delivery_attempts_total", {"channel": channel, "outcome": outcome}
            )
            or 0
            for channel in ("email", "phone")
            for outcome in ("accepted", "failed")
        }

        self.metrics.started.set(time())
        await to_thread(self.metrics.write_attempt)

        now = datetime.now(UTC)
        result = await IdentityRetention(self.services.engine).purge_expired(now)
        calendar_keys = await PostgresCalendarRepository(
            self.services.engine
        ).purge_expired_requests(now)
        attempted = 0

        for _ in range(10):
            if not await self.services.identity.registration.deliver_pending():
                break

            attempted += 1

        for kind, count in (
            ("registrations", result.registrations),
            ("sessions", result.sessions),
            ("rate_windows", result.rate_windows),
            ("calendar_keys", calendar_keys),
        ):
            self.metrics.removed.labels(kind).set(count)

        for channel in ("email", "phone"):
            for outcome in ("accepted", "failed"):
                value = self.services.metrics.registry.get_sample_value(
                    "tutorflow_delivery_attempts_total", {"channel": channel, "outcome": outcome}
                )

                self.metrics.delivery.labels(channel, outcome).set(
                    (value or 0) - baseline[channel, outcome]
                )

        self.metrics.duration.set(perf_counter() - start)
        self.metrics.success.set(1)
        await to_thread(self.metrics.write_attempt)
        await to_thread(self.metrics.write_success, time())
        await structlog.get_logger(__name__).ainfo(
            "maintenance_completed",
            attempted=attempted,
            registrations=result.registrations,
            sessions=result.sessions,
            rate_windows=result.rate_windows,
            calendar_keys=calendar_keys,
        )


async def main() -> int:
    configure_logging()
    structlog.contextvars.bind_contextvars(job_id=str(uuid4()))

    services = None

    try:
        directory = MonitoringSettings().directory

        await to_thread(directory.mkdir, parents=True, exist_ok=True)

        lock = await to_thread((directory / "maintenance.lock").open, "w")

        try:
            try:
                fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
            except BlockingIOError:
                return 0

            metrics = MaintenanceMetrics(directory)

            metrics.started.set(time())
            await to_thread(metrics.write_attempt)

            services = await services_from_environment()

            await Maintenance(services, metrics).run()
        finally:
            await to_thread(lock.close)

        return 0
    except Exception:
        await structlog.get_logger(__name__).aerror("maintenance_failed", exc_info=sys.exc_info())

        return 1
    finally:
        if services is not None:
            await services.engine.dispose()

        structlog.contextvars.clear_contextvars()


if __name__ == "__main__":
    raise SystemExit(asyncio.run(main()))
