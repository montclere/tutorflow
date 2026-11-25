"""JSON-логи structlog со списком разрешённых полей и безопасным стеком."""

import logging
import sys
import traceback
from typing import Any, TextIO

import structlog
from structlog.typing import EventDict


EVENTS = {
    "http_request_completed",
    "http_request_failed",
    "delivery_accepted",
    "delivery_failed",
    "maintenance_completed",
    "maintenance_failed",
    "metrics_collection_failed",
}
FIELDS = {
    "event",
    "level",
    "timestamp",
    "logger",
    "request_id",
    "method",
    "route",
    "status",
    "duration_seconds",
    "channel",
    "outcome",
    "attempted",
    "registrations",
    "sessions",
    "rate_windows",
    "calendar_keys",
    "job_id",
    "exception_type",
    "frames",
}

EXTERNAL_FIELDS = {"event", "level", "timestamp", "logger", "exception_type", "frames"}


def safe_event(logger: Any, method: str, event: EventDict) -> EventDict:
    record = event.get("_record")
    exception = event.get("exc_info") or getattr(record, "exc_info", None)

    if exception:
        if exception is True:
            exception = sys.exc_info()

        if isinstance(exception, BaseException):
            exception = (type(exception), exception, exception.__traceback__)

        if isinstance(exception, tuple) and exception[0] is not None:
            event["exception_type"] = exception[0].__name__
            event["frames"] = [
                {"file": frame.filename, "line": frame.lineno, "function": frame.name}
                for frame in traceback.extract_tb(exception[2])
            ]

    known_event = event.get("_from_structlog") and event.get("event") in EVENTS
    allowed_fields = FIELDS if known_event else EXTERNAL_FIELDS

    if not known_event:
        event["event"] = "external_log"

    return {key: value for key, value in event.items() if key in allowed_fields}


def configure_logging(*, level: str = "INFO", stream: TextIO | None = None) -> None:
    processors = [
        structlog.contextvars.merge_contextvars,
        structlog.stdlib.add_log_level,
        structlog.stdlib.add_logger_name,
        structlog.processors.TimeStamper(fmt="iso", utc=True),
    ]

    structlog.configure(
        processors=[*processors, structlog.stdlib.ProcessorFormatter.wrap_for_formatter],
        logger_factory=structlog.stdlib.LoggerFactory(),
        wrapper_class=structlog.stdlib.BoundLogger,
        cache_logger_on_first_use=False,
    )

    formatter = structlog.stdlib.ProcessorFormatter(
        foreign_pre_chain=processors,
        processors=[safe_event, structlog.processors.JSONRenderer(ensure_ascii=False)],
    )
    handler = logging.StreamHandler(stream or sys.stdout)

    handler.setFormatter(formatter)

    root = logging.getLogger()
    root.handlers = [handler]

    root.setLevel(level)

    for name in ("uvicorn", "uvicorn.error", "uvicorn.access", "sqlalchemy", "httpx"):
        logger = logging.getLogger(name)
        logger.handlers = []
        logger.propagate = True

    logging.getLogger("uvicorn.access").disabled = True
