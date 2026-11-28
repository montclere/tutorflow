"""Проверки ролей, владения карточкой и границ страницы."""

from uuid import UUID

from app.modules.identity.public import Actor, Role
from app.modules.students.application.contracts import PAGE_MAX_SIZE
from app.modules.students.application.ports import StudentsRepository, StudentsTransaction
from app.modules.students.domain.entities import StudentCard
from app.modules.students.domain.exceptions import StudentError


def require_teacher(actor: Actor) -> None:
    if actor.role is not Role.TEACHER:
        raise StudentError("teacher_required")


def require_student(actor: Actor) -> None:
    if actor.role is not Role.STUDENT:
        raise StudentError("student_required")


def require_page_size(limit: int) -> None:
    if not 1 <= limit <= PAGE_MAX_SIZE:
        raise StudentError("invalid_student_data")


async def owned_card(
    repository: StudentsRepository, actor: Actor, card_id: UUID, *, lock: bool = True
) -> StudentCard:
    require_teacher(actor)

    card = await repository.find_card(card_id, actor.account_id, lock=lock)

    if card is None:
        raise StudentError("student_card_not_found")

    return card


def require_adult(actor: Actor) -> None:
    if actor.role is not Role.ADULT:
        raise StudentError("adult_required")


async def connected_adult_card(
    unit: StudentsTransaction, actor: Actor, card_id: UUID
) -> StudentCard:
    require_adult(actor)

    card = await unit.adults.find_card_for_update(card_id, actor.account_id)

    if card is None or await unit.adults.find_connection(card.id, actor.account_id) is None:
        raise StudentError("adult_connection_not_found")

    return card
