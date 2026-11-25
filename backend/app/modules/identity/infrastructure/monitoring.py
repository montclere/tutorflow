"""Prometheus-метрики состояния доставки, хранимого модулем Identity."""

from datetime import UTC, datetime

from prometheus_client import CollectorRegistry, Gauge, generate_latest
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncEngine

from app.modules.identity.infrastructure.persistence.models import Registration


class RegistrationMetrics:
    def __init__(self, engine: AsyncEngine, max_attempts: int) -> None:
        self.engine = engine
        self.max_attempts = max_attempts

    async def render(self) -> bytes:
        registry = CollectorRegistry()
        pending = Gauge(
            "tutorflow_delivery_pending", "Коды с ожидающей отправкой.", registry=registry
        )
        oldest = Gauge(
            "tutorflow_delivery_oldest_pending_age_seconds",
            "Возраст самого старого ожидающего кода.",
            registry=registry,
        )
        exhausted = Gauge(
            "tutorflow_delivery_exhausted",
            "Активные коды с исчерпанными попытками отправки.",
            registry=registry,
        )
        now = datetime.now(UTC)

        async with self.engine.connect() as connection:
            await connection.exec_driver_sql("SET LOCAL statement_timeout = '2000ms'")

            count, since = (
                await connection.execute(
                    select(func.count(), func.min(Registration.sent_at)).where(
                        Registration.expires_at > now,
                        Registration.remaining_attempts > 0,
                        Registration.delivery_due_at.is_not(None),
                        Registration.delivery_attempts < self.max_attempts,
                    )
                )
            ).one()
            failed = await connection.scalar(
                select(func.count())
                .select_from(Registration)
                .where(
                    Registration.expires_at > now,
                    Registration.delivery_due_at.is_not(None),
                    Registration.delivery_attempts >= self.max_attempts,
                )
            )

        pending.set(count)
        oldest.set(max(0, (now - since).total_seconds()) if since is not None else 0)
        exhausted.set(failed or 0)

        return generate_latest(registry)
