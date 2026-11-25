"""Сценарии учебных профилей собственной карточки преподавателя."""

from uuid import UUID, uuid4

from app.modules.identity.public import Actor
from app.modules.students.application.ports import StudentsUnitOfWork
from app.modules.students.application.services.access import owned_card, require_page_size
from app.modules.students.domain.entities import LearningProfile
from app.modules.students.domain.exceptions import StudentError
from app.modules.students.domain.values import Money


class LearningProfileService:
    def __init__(self, persistence: StudentsUnitOfWork) -> None:
        self.persistence = persistence

    async def save(
        self,
        actor: Actor,
        card_id: UUID,
        profile_id: UUID | None,
        price: Money,
        fields: dict[str, str | None],
    ) -> LearningProfile:
        if fields.keys() - {"subject", "level", "goal", "duration", "description"}:
            raise StudentError("invalid_student_data")

        async with self.persistence.transaction() as unit:
            await owned_card(unit.students, actor, card_id)

            if (
                profile_id is not None
                and await unit.students.find_profile(card_id, profile_id) is None
            ):
                raise StudentError("student_profile_not_found")

            profile = LearningProfile(profile_id or uuid4(), card_id, price, **fields)

            await unit.students.save_profile(profile)

        return profile

    async def list(
        self, actor: Actor, card_id: UUID, after_id: UUID | None, limit: int
    ) -> list[LearningProfile]:
        require_page_size(limit)

        async with self.persistence.transaction() as unit:
            await owned_card(unit.students, actor, card_id, lock=False)

            return await unit.students.list_profiles(card_id, after_id, limit + 1)

    async def get(self, actor: Actor, card_id: UUID, profile_id: UUID) -> LearningProfile:
        async with self.persistence.transaction() as unit:
            await owned_card(unit.students, actor, card_id, lock=False)

            profile = await unit.students.find_profile(card_id, profile_id)

            if profile is None:
                raise StudentError("student_profile_not_found")

            return profile

    async def delete(self, actor: Actor, card_id: UUID, profile_id: UUID) -> None:
        async with self.persistence.transaction() as unit:
            await owned_card(unit.students, actor, card_id)

            if not await unit.students.delete_profile(card_id, profile_id):
                raise StudentError("student_profile_not_found")
