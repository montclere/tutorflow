"""Регистрация таблиц модулей для Alembic."""

from app.modules.identity.infrastructure.persistence.models import IdentityBase
from app.modules.scheduling.infrastructure.models import SchedulingBase
from app.modules.students.infrastructure.persistence.models import StudentsBase
from app.shared.infrastructure.database import metadata


model_bases = (IdentityBase, SchedulingBase, StudentsBase)
target_metadata = metadata
