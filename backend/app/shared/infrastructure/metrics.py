"""Официальный клиент Prometheus с отдельным реестром на экземпляр приложения."""

from functools import cache
from pathlib import Path

from prometheus_client import CollectorRegistry, Counter, Gauge, Histogram, write_to_textfile


class Metrics:
    def __init__(self) -> None:
        self.registry = CollectorRegistry()
        self.requests = Counter(
            "tutorflow_http_requests_total",
            "Завершённые HTTP-запросы.",
            ["method", "route", "status"],
            registry=self.registry,
        )
        self.duration = Histogram(
            "tutorflow_http_request_duration_seconds",
            "Время обработки HTTP-запроса.",
            ["method", "route"],
            registry=self.registry,
            buckets=(0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10),
        )
        self.failures = Counter(
            "tutorflow_http_failures_total",
            "Необработанные исключения HTTP.",
            ["phase"],
            registry=self.registry,
        )
        self.delivery = Counter(
            "tutorflow_delivery_attempts_total",
            "Результаты отправки кода провайдеру.",
            ["channel", "outcome"],
            registry=self.registry,
        )


@cache
def process_metrics() -> Metrics:
    return Metrics()


class MaintenanceMetrics:
    def __init__(self, directory: Path) -> None:
        self.directory = Path(directory)

        self.directory.mkdir(parents=True, exist_ok=True)

        self.registry = CollectorRegistry()
        self.success = Gauge(
            "tutorflow_maintenance_success",
            "Последний запуск завершился успешно.",
            registry=self.registry,
        )
        self.started = Gauge(
            "tutorflow_maintenance_last_attempt_unixtime",
            "Начало последнего запуска.",
            registry=self.registry,
        )
        self.duration = Gauge(
            "tutorflow_maintenance_duration_seconds",
            "Длительность последнего запуска.",
            registry=self.registry,
        )
        self.removed = Gauge(
            "tutorflow_maintenance_removed_records",
            "Удалено записей за последний запуск.",
            ["kind"],
            registry=self.registry,
        )
        self.delivery = Gauge(
            "tutorflow_maintenance_delivery_attempts",
            "Отправки за последний запуск.",
            ["channel", "outcome"],
            registry=self.registry,
        )

    def write_attempt(self) -> None:
        write_to_textfile(str(self.directory / "maintenance-attempt.prom"), self.registry)

    def write_success(self, timestamp: float) -> None:
        registry = CollectorRegistry()
        last_success = Gauge(
            "tutorflow_maintenance_last_success_unixtime",
            "Последнее успешное завершение.",
            registry=registry,
        )

        last_success.set(timestamp)
        write_to_textfile(str(self.directory / "maintenance-success.prom"), registry)
