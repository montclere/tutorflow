"""Регистрация таблиц модулей для Alembic."""

from app.modules.identity.infrastructure.persistence.models import IdentityBase
from app.modules.scheduling.infrastructure.models import SchedulingBase
from app.shared.infrastructure.database import metadata


model_bases = (IdentityBase, SchedulingBase)
target_metadata = metadata
