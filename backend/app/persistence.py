"""Регистрация таблиц модулей для Alembic."""

from app.modules.groups.infrastructure.persistence.models import GroupsBase
from app.modules.identity.infrastructure.persistence.models import IdentityBase
from app.modules.scheduling.infrastructure.models import SchedulingBase
from app.modules.scheduling.infrastructure.persistence.lesson_models import LessonsBase
from app.modules.students.infrastructure.persistence.adult_models import AdultAccessBase
from app.modules.students.infrastructure.persistence.models import StudentsBase
from app.shared.infrastructure.database import metadata


model_bases = (IdentityBase, SchedulingBase, StudentsBase, AdultAccessBase, GroupsBase, LessonsBase)
target_metadata = metadata
