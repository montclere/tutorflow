"""Таблицы самостоятельных групп и персональных условий членства."""

from decimal import Decimal
from uuid import UUID

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    ForeignKey,
    ForeignKeyConstraint,
    Index,
    Numeric,
    String,
    UniqueConstraint,
)
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column

from app.shared.infrastructure.database import metadata


class GroupsBase(DeclarativeBase):
    metadata = metadata


class Group(GroupsBase):
    __tablename__ = "groups_groups"
    __table_args__ = (
        UniqueConstraint("id", "teacher_id", name="uq_group_owner"),
        CheckConstraint("length(trim(name)) > 0", name="ck_group_name"),
        Index("ix_group_listing", "teacher_id", "archived", "id"),
    )
    id: Mapped[UUID] = mapped_column(primary_key=True)
    teacher_id: Mapped[UUID] = mapped_column(ForeignKey("identity_accounts.id", ondelete="CASCADE"))
    name: Mapped[str] = mapped_column(String(120))
    notes: Mapped[str | None] = mapped_column(String(4000))
    archived: Mapped[bool] = mapped_column(Boolean, server_default="false")


class Membership(GroupsBase):
    __tablename__ = "groups_memberships"
    __table_args__ = (
        ForeignKeyConstraint(
            ["group_id", "teacher_id"],
            ["groups_groups.id", "groups_groups.teacher_id"],
            ondelete="CASCADE",
        ),
        ForeignKeyConstraint(
            ["card_id", "teacher_id"],
            ["students_cards.id", "students_cards.teacher_id"],
            ondelete="CASCADE",
        ),
        CheckConstraint("amount >= 0 AND amount <> 'NaN'::numeric", name="ck_group_member_price"),
        Index("ix_group_card_listing", "card_id", "group_id"),
    )
    group_id: Mapped[UUID] = mapped_column(primary_key=True)
    card_id: Mapped[UUID] = mapped_column(primary_key=True)
    teacher_id: Mapped[UUID] = mapped_column()
    amount: Mapped[Decimal] = mapped_column(Numeric(12, 2))
