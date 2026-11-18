"""Единый набор метаданных для Alembic."""

from app.modules.identity.infrastructure.models import accounts
from app.modules.students.infrastructure.persistence.models import student_cards
from app.shared.infrastructure.db.base import metadata
from app.shared.infrastructure.rate_limit import rate_limits

assert all(table.metadata is metadata for table in (accounts, student_cards, rate_limits))
