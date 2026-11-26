"""HTTP-контракты частной группы, состава и безопасного собственного участия."""

from decimal import Decimal
from typing import Annotated, Literal
from uuid import UUID

from fastapi import Query
from pydantic import BaseModel, ConfigDict, Field

from app.modules.groups.application.contracts import PAGE_MAX_SIZE, GroupOverview, Participation
from app.modules.groups.domain.entities import Member
from app.modules.groups.domain.values import NAME_MAX_LENGTH, NOTES_MAX_LENGTH, PRICE_QUANTUM, Price


PageSize = Annotated[int, Query(ge=1, le=PAGE_MAX_SIZE)]


class Input(BaseModel):
    model_config = ConfigDict(extra="forbid")


class GroupCreate(Input):
    name: Annotated[str, Field(min_length=1, max_length=NAME_MAX_LENGTH)]
    notes: Annotated[str | None, Field(max_length=NOTES_MAX_LENGTH)] = None


class GroupPatch(Input):
    name: Annotated[str | None, Field(min_length=1, max_length=NAME_MAX_LENGTH)] = None
    notes: Annotated[str | None, Field(max_length=NOTES_MAX_LENGTH)] = None


class Amount(Input):
    amount: Annotated[Decimal, Field(ge=0, max_digits=12, decimal_places=2, allow_inf_nan=False)]
    currency: Literal["RUB"] = "RUB"

    def to_price(self) -> Price:
        return Price(self.amount)


class TotalPrice(BaseModel):
    amount: Decimal
    currency: Literal["RUB"] = "RUB"


class GroupView(BaseModel):
    id: UUID
    teacher_id: UUID
    name: str
    notes: str | None
    archived: bool
    total_price: TotalPrice

    @classmethod
    def from_overview(cls, value: GroupOverview) -> "GroupView":
        group = value.group

        return cls(
            id=group.id,
            teacher_id=group.teacher_id,
            name=group.name,
            notes=group.notes,
            archived=group.archived,
            total_price=TotalPrice(amount=value.total.quantize(PRICE_QUANTUM)),
        )


class MemberCreate(Input):
    card_id: UUID
    price: Amount


class MemberPatch(Input):
    price: Amount


class MemberPrice(BaseModel):
    card_id: UUID
    price: Amount

    @classmethod
    def from_member(cls, member: Member) -> "MemberPrice":
        return cls(card_id=member.card_id, price=Amount(amount=member.price.amount))


class MemberView(MemberPrice):
    name: str


class ParticipationView(BaseModel):
    group_id: UUID
    teacher_id: UUID
    name: str
    archived: bool
    card_id: UUID
    price: Amount

    @classmethod
    def from_participation(cls, value: Participation) -> "ParticipationView":
        return cls(
            group_id=value.group_id,
            teacher_id=value.teacher_id,
            name=value.name,
            archived=value.archived,
            card_id=value.card_id,
            price=Amount(amount=value.amount),
        )


class Page[T](BaseModel):
    items: list[T]
    next_after: UUID | None = None
