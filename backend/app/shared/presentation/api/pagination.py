import base64
import hmac
import json
from dataclasses import dataclass
from datetime import datetime
from uuid import UUID

from app.shared.application.security import keyed_digest
from app.shared.domain.errors import Problem, ProblemCode

Position = tuple[datetime, UUID]


@dataclass(frozen=True)
class Pagination:
    key: str
    scope: str
    limit: int
    cursor: str | None

    @property
    def position(self) -> Position | None:
        if self.cursor is None:
            return None
        try:
            payload, signature = self.cursor.split(".", 1)
            expected = keyed_digest(self.key, "cursor", self.scope, payload)
            if not hmac.compare_digest(signature, expected):
                raise ValueError
            timestamp, record_id = json.loads(base64.urlsafe_b64decode(payload))
            return datetime.fromisoformat(timestamp), UUID(record_id)
        except (ValueError, TypeError, OverflowError):
            raise Problem(ProblemCode.CURSOR_INVALID) from None

    def result(self, rows: list, position, serialize) -> dict:
        shown = rows[: self.limit]
        cursor = None
        if len(rows) > self.limit:
            timestamp, record_id = position(shown[-1])
            payload = base64.urlsafe_b64encode(
                json.dumps([timestamp.isoformat(), str(record_id)]).encode()
            ).decode()
            cursor = payload + "." + keyed_digest(self.key, "cursor", self.scope, payload)
        return {"items": [serialize(row) for row in shown], "next_cursor": cursor}
