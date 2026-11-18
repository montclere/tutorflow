from datetime import datetime, timedelta
from hashlib import sha256
from uuid import UUID, uuid4
from zoneinfo import ZoneInfo

from app.shared.application.contracts.accounts import AccountSummary
from app.shared.application.contracts.student_cards import LessonCard, LessonCards, LessonRole
from app.shared.application.ports.clock import now_utc
from app.shared.domain.errors import Problem, ProblemCode

from ..domain.calendar import (
    CONTENT,
    Calendar,
    LocalTimeIssue,
    bounds,
    instant,
    interval,
    overlaps,
    timestamp,
    weekly_intervals,
)
from .ports import CalendarRepository


def missing() -> Problem:
    return Problem(ProblemCode.RESOURCE_NOT_FOUND)


def conflict() -> Problem:
    return Problem(ProblemCode.LESSON_STATE_CONFLICT)


def check_version(record: dict, expected: int, code: ProblemCode = ProblemCode.VERSION_CONFLICT):
    if record["version"] != expected:
        raise Problem(code)


class Schedule:
    def __init__(
        self,
        cards: LessonCards,
        store: CalendarRepository,
        min_minutes: int = 15,
        max_minutes: int = 240,
        horizon_days: int = 365,
        max_series: int = 26,
    ):
        self.cards = cards
        self.store = store
        self.min_minutes = min_minutes
        self.max_minutes = max_minutes
        self.horizon = timedelta(days=horizon_days)
        self.max_series = max_series

    async def _card(
        self,
        actor: AccountSummary,
        role: LessonRole,
        card_id: UUID,
        *,
        write: bool = False,
        archived: bool = False,
    ) -> tuple[LessonCard, Calendar]:
        card = await self.cards.lesson_card(actor, card_id, role, lock=write)
        if write:
            if not card.active and not archived:
                raise missing()
            await self.store.lock_teacher(card.teacher_id)
        return card, await self.store.load(card.card_id)

    async def _locate(
        self,
        actor: AccountSummary,
        role: LessonRole,
        record_id: str,
        kind: str,
        *,
        write: bool = False,
        archived: bool = False,
    ) -> tuple[LessonCard, Calendar]:
        card_id = await self.store.locate(record_id, kind)
        if card_id is None:
            raise missing()
        return await self._card(actor, role, card_id, write=write, archived=archived)

    async def _lesson(
        self, actor, role: LessonRole, lesson_id: str, *, write=False, archived=False
    ):
        card, calendar = await self._locate(
            actor, role, lesson_id, "lesson", write=write, archived=archived
        )
        lesson = calendar.find(lesson_id)
        if lesson is None:
            raise missing()
        return card, calendar, lesson

    def _validate_time(self, item: dict, now: datetime, *, past: bool = False):
        start, end = bounds(item)
        if not self.min_minutes <= item["duration_minutes"] <= self.max_minutes:
            raise Problem(ProblemCode.VALIDATION_FAILED)
        if end > now if past else not now < start <= now + self.horizon:
            raise Problem(ProblemCode.VALIDATION_FAILED)

    async def _conflicts(self, card: LessonCard, proposed: list[dict], ignored: set[str]):
        busy = [
            bounds(item)
            for calendar in await self.store.for_teacher(card.teacher_id)
            for item in calendar.all_lessons()
            if item["status"] == "scheduled" and item["lesson_id"] not in ignored
        ]
        result = []
        times = [bounds(item) for item in proposed]
        for index, span in enumerate(times):
            result.append(
                any(overlaps(span, other) for other in busy)
                or any(
                    index != other_index and overlaps(span, other)
                    for other_index, other in enumerate(times)
                )
            )
        return result

    @staticmethod
    def _content(payload: dict) -> dict:
        return {name: payload.get(name) for name in CONTENT}

    @staticmethod
    def _creation_key(scope: str, payload: dict) -> str:
        return sha256((scope + ":" + payload["client_request_id"]).encode()).hexdigest()

    async def _repeat(
        self, card: LessonCard, calendar: Calendar, key: str, payload: dict, now: datetime
    ):
        for other in await self.store.for_teacher(card.teacher_id):
            if not (stored := other.keys.get(key)):
                continue
            if stored.get("until") and instant(stored["until"]) <= now:
                continue
            if other.card_id != calendar.card_id or stored.get("payload") != payload:
                raise Problem(ProblemCode.LESSON_CREATE_CONFLICT)
            return stored.get("record_id")
        return None

    @staticmethod
    def _notice(
        card: LessonCard,
        calendar: Calendar,
        actor: UUID,
        event: str,
        now: datetime,
        lesson_id: str | None = None,
        *,
        recipients: tuple[UUID, ...] | None = None,
        related_id: str | None = None,
    ):
        viewers = tuple(value for value in (recipients or card.participants()) if value != actor)
        if viewers:
            calendar.notifications.append(
                {
                    "notification_id": str(uuid4()),
                    "event": event,
                    "occurred_at": timestamp(now),
                    "lesson_id": lesson_id,
                    "related_id": related_id,
                    "recipients": [str(value) for value in set(viewers)],
                    "read_by": [],
                }
            )

    async def listing(self, actor, role: LessonRole, start, end, view, card_id):
        if start.utcoffset() != timedelta(0) or end.utcoffset() != timedelta(0):
            raise Problem(ProblemCode.VALIDATION_FAILED)
        if not timedelta(0) < end - start <= timedelta(days=62):
            raise Problem(ProblemCode.VALIDATION_FAILED)
        cards = (
            [await self.cards.lesson_card(actor, card_id, role)]
            if card_id
            else await self.cards.lesson_cards(actor, role)
        )
        result = []
        for card in cards:
            calendar = await self.store.load(card.card_id)
            result.extend(
                lesson
                for lesson in calendar.all_lessons()
                if (lesson["status"] == "scheduled") == (view == "calendar")
                and overlaps(bounds(lesson), (start, end))
            )
        return sorted(
            result, key=lambda lesson: (instant(lesson["starts_at"]), lesson["lesson_id"])
        )

    async def detail(self, actor, role: LessonRole, lesson_id: str) -> dict:
        _, _, lesson = await self._lesson(actor, role, lesson_id)
        return lesson

    async def create(self, actor, payload: dict, *, past: bool = False):
        card, calendar = await self._card(
            actor, "teacher", UUID(payload["student_card_id"]), write=True
        )
        if card.student_id is None:
            raise Problem(ProblemCode.LESSON_STUDENT_NOT_LINKED)
        now = now_utc()
        key = self._creation_key("record" if past else "lesson", payload)
        previous = await self._repeat(card, calendar, key, payload, now)
        if previous and (lesson := calendar.find(previous)):
            return lesson, False
        lesson = {
            **self._content(payload),
            **interval(instant(payload["starts_at"]), payload["duration_minutes"]),
            "lesson_id": str(uuid4()),
            "student_card_id": calendar.card_id,
            "status": "completed" if past else "scheduled",
            "outcome_reason": None,
            "version": 1,
            "series_id": None,
            "series_position": None,
            "is_series_exception": False,
            "uses_series_content": False,
            "updated_at": timestamp(now),
            "created_at": timestamp(now),
        }
        self._validate_time(lesson, now, past=past)
        if not past and any(await self._conflicts(card, [lesson], set())):
            raise Problem(ProblemCode.LESSON_TIME_CONFLICT)
        calendar.lessons[lesson["lesson_id"]] = lesson
        calendar.keys[key] = {"record_id": lesson["lesson_id"], "payload": payload}
        event = "lesson_recorded" if past else "lesson_scheduled"
        calendar.event(lesson, event, str(actor.account_id), "teacher", now)
        self._notice(card, calendar, actor.account_id, event, now, lesson["lesson_id"])
        await self.store.save(card, calendar)
        return lesson, True

    @staticmethod
    def _bump(calendar: Calendar, lesson: dict, now: datetime, *, bump_series: bool = True):
        lesson["version"] += 1
        lesson["updated_at"] = timestamp(now)
        if bump_series and lesson["series_id"]:
            calendar.series[lesson["series_id"]]["version"] += 1

    async def change(self, actor, lesson_id: str, command: str, data: dict) -> dict:
        card, calendar, current = await self._lesson(actor, "teacher", lesson_id, write=True)
        check_version(current, data.pop("expected_version"))
        now = now_utc()
        status, (_, end) = current["status"], bounds(current)
        reason = data.get("reason")
        changed: list[str] = []
        if command == "edit":
            changed = [name for name in data if current.get(name) != data[name]]
            if not changed:
                return current
            updates = {**data, "uses_series_content": False}
            event = "lesson_edited"
        elif command == "cancel":
            if status == "cancelled":
                return current
            if status != "scheduled":
                raise conflict()
            updates = {"status": "cancelled", "outcome_reason": reason}
            event = "lesson_cancelled"
        elif command == "restore":
            if status != "cancelled" or bounds(current)[0] <= now or card.student_id is None:
                raise conflict()
            if any(await self._conflicts(card, [current], {lesson_id})):
                raise Problem(ProblemCode.LESSON_TIME_CONFLICT)
            updates = {"status": "scheduled", "outcome_reason": None}
            event = "lesson_restored"
        else:
            target = data.get("status", "scheduled")
            if status == target and (status in {"completed", "no_show"} or command == "reset"):
                return current
            if end > now or status == "cancelled" or (command == "reset" and status == "scheduled"):
                raise conflict()
            updates = {"status": target, "outcome_reason": reason}
            event = "lesson_attendance_reset" if command == "reset" else "lesson_attendance"
        lesson = calendar.materialize(current)
        before = {name: lesson[name] for name in ("starts_at", "ends_at", "status")}
        lesson.update(updates)
        self._bump(calendar, lesson, now)
        if command != "edit":
            self._close_notices(calendar, {lesson_id})
            if command == "cancel":
                self._supersede(calendar, {lesson_id}, now)
            self._notice(card, calendar, actor.account_id, event, now, lesson_id)
        calendar.event(
            lesson,
            event,
            str(actor.account_id),
            "teacher",
            now,
            changed_fields=changed,
            before=before,
            after={name: lesson[name] for name in before},
            reason=reason,
        )
        await self.store.save(card, calendar)
        return lesson

    async def delete(self, actor, lesson_id: str, header: str | None):
        card, calendar, lesson = await self._lesson(
            actor, "teacher", lesson_id, write=True, archived=True
        )
        if header is None:
            raise Problem(ProblemCode.PRECONDITION_REQUIRED)
        if header != f'"{lesson["version"]}"':
            raise Problem(ProblemCode.PRECONDITION_FAILED)
        calendar.lessons.pop(lesson_id, None)
        calendar.events.pop(lesson_id, None)
        requests = []
        for request_id, request in list(calendar.requests.items()):
            if lesson_id not in self._request_ids(request):
                continue
            remaining = [item for item in request["occurrences"] if item["lesson_id"] != lesson_id]
            if not remaining:
                requests.append(request_id)
                del calendar.requests[request_id]
            else:
                request["occurrences"] = remaining
                if request["status"] == "pending":
                    request.update(status="superseded", version=request["version"] + 1)
        notices = [
            key for key, notice in calendar.notices.items() if notice["lesson_id"] == lesson_id
        ]
        for key in notices:
            del calendar.notices[key]
        calendar.notifications[:] = [
            item
            for item in calendar.notifications
            if item["lesson_id"] != lesson_id
            and item.get("related_id") not in (*requests, *notices)
        ]
        now = now_utc()
        erased = {lesson_id}
        if series_id := lesson["series_id"]:
            series = calendar.series[series_id]
            series["slots"][lesson["series_position"] - 1] = {
                "series_position": lesson["series_position"]
            }
            series["version"] += 1
            if not any(slot.get("lesson_id") for slot in series["slots"]):
                del calendar.series[series_id]
                erased.add(series_id)
        for key, value in calendar.keys.items():
            if value.get("record_id") in erased:
                calendar.keys[key] = {"until": timestamp(now + timedelta(days=1))}
        self._notice(card, calendar, actor.account_id, "lesson_deleted", now)
        await self.store.save(card, calendar)

    async def series_detail(self, actor, series_id: str):
        _, calendar = await self._locate(actor, "teacher", series_id, "series")
        series = calendar.series.get(series_id)
        if series is None:
            raise missing()
        return self._series_view(calendar, series)

    @staticmethod
    def _series_view(calendar: Calendar, series: dict):
        return {
            **{key: value for key, value in series.items() if key != "slots"},
            "lessons": [calendar.find(s["lesson_id"]) for s in series["slots"] if "lesson_id" in s],
        }

    def _series_intervals(self, data, timezone, count):
        if not 1 <= count <= self.max_series:
            raise Problem(ProblemCode.VALIDATION_FAILED)
        return weekly_intervals(
            instant(data["first_local_start"]),
            timezone,
            count,
            data["duration_minutes"],
            data.get("ambiguous_time"),
        )

    async def _initial_plan(self, card, data, now):
        if not 2 <= data["count"] <= self.max_series or card.student_id is None:
            raise Problem(
                ProblemCode.LESSON_STUDENT_NOT_LINKED
                if card.student_id is None
                else ProblemCode.VALIDATION_FAILED
            )
        intervals = self._series_intervals(data, data["timezone"], data["count"])
        items = [
            {"series_position": index, **interval(start, data["duration_minutes"])}
            for index, (start, _) in enumerate(intervals, 1)
        ]
        for item in items:
            self._validate_time(item, now)
        return items, await self._conflicts(card, items, set())

    @staticmethod
    def _plan_view(items, flags, timezone, preserved=()):
        zone = ZoneInfo(timezone)
        occurrences = []
        for item, blocked in zip(items, flags, strict=True):
            local = instant(item["starts_at"]).astimezone(zone)
            offset = local.utcoffset() or timedelta(0)
            occurrences.append(
                {
                    **item,
                    "local_start": local.replace(tzinfo=None).isoformat(timespec="minutes"),
                    "utc_offset_minutes": int(offset.total_seconds() // 60),
                    "conflicts": blocked,
                }
            )
        return {"occurrences": occurrences, "preserved_lesson_ids": list(preserved)}

    async def new_series(self, actor, data: dict, *, preview=False):
        card, calendar = await self._card(
            actor, "teacher", UUID(data["student_card_id"]), write=not preview
        )
        if not card.active:
            raise missing()
        if card.student_id is None:
            raise Problem(ProblemCode.LESSON_STUDENT_NOT_LINKED)
        now = now_utc()
        if not preview:
            key = self._creation_key("series", data)
            previous = await self._repeat(card, calendar, key, data, now)
            if previous and previous in calendar.series:
                return self._series_view(calendar, calendar.series[previous]), False
        items, flags = await self._initial_plan(card, data, now)
        if preview:
            return self._plan_view(items, flags, data["timezone"]), False
        if any(flags):
            raise Problem(ProblemCode.LESSON_TIME_CONFLICT)
        series_id = str(uuid4())
        series = {
            "series_id": series_id,
            "student_card_id": calendar.card_id,
            "timezone": data["timezone"],
            "version": 1,
            "content_template": self._content(data),
            "slots": [
                {
                    **item,
                    "lesson_id": str(uuid4()),
                    "version": 1,
                    "updated_at": timestamp(now),
                    "created_at": timestamp(now),
                }
                for item in items
            ],
        }
        calendar.series[series_id] = series
        calendar.keys[self._creation_key("series", data)] = {
            "record_id": series_id,
            "payload": data,
        }
        calendar.prepare(now)
        self._notice(
            card,
            calendar,
            actor.account_id,
            "series_scheduled",
            now,
            series["slots"][0]["lesson_id"],
        )
        await self.store.save(card, calendar)
        return self._series_view(calendar, series), True

    async def edit_series(self, actor, series_id: str, data: dict):
        card, calendar = await self._locate(actor, "teacher", series_id, "series", write=True)
        series = calendar.series.get(series_id)
        if series is None:
            raise missing()
        check_version(series, data.pop("expected_version"))
        changes = {
            key: value for key, value in data.items() if series["content_template"][key] != value
        }
        if not changes:
            return self._series_view(calendar, series)
        now = now_utc()
        for slot in series["slots"]:
            if not (lesson_id := slot.get("lesson_id")) or not (lesson := calendar.find(lesson_id)):
                continue
            if not lesson["uses_series_content"] or lesson["status"] != "scheduled":
                continue
            if bounds(lesson)[0] <= now:
                calendar.materialize(lesson)["uses_series_content"] = False
                continue
            slot["version"] += 1
            slot["updated_at"] = timestamp(now)
            if lesson_id in calendar.lessons:
                lesson.update(changes)
                self._bump(calendar, lesson, now, bump_series=False)
            calendar.event(
                calendar.find(lesson_id) or lesson,
                "lesson_edited",
                str(actor.account_id),
                "teacher",
                now,
                changed_fields=list(changes),
            )
        series["content_template"].update(changes)
        series["version"] += 1
        await self.store.save(card, calendar)
        return self._series_view(calendar, series)

    @staticmethod
    def _scheduled_slots(calendar, series, now, minimum=0, *, include_exceptions=True):
        return [
            lesson
            for slot in series["slots"]
            if slot["series_position"] >= minimum
            and "lesson_id" in slot
            and (lesson := calendar.find(slot["lesson_id"])) is not None
            and lesson["status"] == "scheduled"
            and bounds(lesson)[0] > now
            and (include_exceptions or not lesson["is_series_exception"])
        ]

    async def cancel_series(self, actor, series_id, data):
        card, calendar = await self._locate(actor, "teacher", series_id, "series", write=True)
        series = calendar.series.get(series_id)
        if series is None:
            raise missing()
        check_version(series, data["expected_version"])
        now = now_utc()
        minimum = 0
        if data["scope"] == "following":
            anchor = calendar.find(data.get("from_lesson_id") or "")
            if (
                not anchor
                or anchor["series_id"] != series_id
                or anchor["status"] != "scheduled"
                or bounds(anchor)[0] <= now
            ):
                raise conflict()
            minimum = anchor["series_position"]
        lessons = self._scheduled_slots(calendar, series, now, minimum)
        for candidate in lessons:
            lesson = calendar.materialize(candidate)
            lesson.update(status="cancelled", outcome_reason=data.get("reason"))
            self._bump(calendar, lesson, now, bump_series=False)
            calendar.event(
                lesson,
                "lesson_cancelled",
                str(actor.account_id),
                "teacher",
                now,
                reason=data.get("reason"),
            )
        if lessons:
            series["version"] += 1
            ids = {item["lesson_id"] for item in lessons}
            self._supersede(calendar, ids, now)
            self._close_notices(calendar, ids)
            self._notice(
                card, calendar, actor.account_id, "series_cancelled", now, lessons[0]["lesson_id"]
            )
            await self.store.save(card, calendar)
        return self._series_view(calendar, series)

    @staticmethod
    def _request_ids(request: dict) -> set[str]:
        return {item["lesson_id"] for item in request["occurrences"]}

    @staticmethod
    def _request_deadline(request: dict) -> datetime:
        return min(
            instant(item[key])
            for item in request["occurrences"]
            for key in ("starts_at", "proposed_starts_at")
        )

    @staticmethod
    def _request_status(card: LessonCard, calendar: Calendar, request: dict, now: datetime) -> str:
        if request["status"] != "pending":
            return request["status"]
        if Schedule._request_deadline(request) <= now:
            return "expired"
        if any(
            not (lesson := calendar.find(item["lesson_id"]))
            or lesson["status"] != "scheduled"
            or any(lesson[key] != item[key] for key in ("starts_at", "ends_at"))
            for item in request["occurrences"]
        ):
            return "superseded"
        if request["requester_role"] == "parent" and (
            not card.grant_for(UUID(request["requester_id"]))
            or request.get("parent_grant") != card.grant_for(UUID(request["requester_id"]))
        ):
            return "superseded"
        participants = {str(value) for value in card.participants()}
        if not {request["requester_id"], request["decider_id"]} <= participants:
            return "superseded"
        return "pending"

    @staticmethod
    def _supersede(calendar: Calendar, ids: set[str], now: datetime, exclude: str | None = None):
        for request in calendar.requests.values():
            if (
                request["request_id"] != exclude
                and request["status"] == "pending"
                and ids & Schedule._request_ids(request)
            ):
                status = "expired" if Schedule._request_deadline(request) <= now else "superseded"
                request.update(status=status, version=request["version"] + 1)

    @staticmethod
    def _close_notices(calendar: Calendar, ids: set[str]):
        for notice in calendar.notices.values():
            if notice["lesson_id"] in ids and notice["status"] == "open":
                notice.update(status="closed", version=notice["version"] + 1)

    @staticmethod
    def _occurrence(lesson, proposed):
        return {
            "lesson_id": lesson["lesson_id"],
            "starts_at": lesson["starts_at"],
            "ends_at": lesson["ends_at"],
            "proposed_starts_at": proposed["starts_at"],
            "proposed_ends_at": proposed["ends_at"],
            "duration_minutes": proposed["duration_minutes"],
        }

    async def propose(self, actor, role: LessonRole, lesson_id, data):
        card, calendar, lesson = await self._lesson(actor, role, lesson_id, write=True)
        now = now_utc()
        if lesson["status"] != "scheduled" or bounds(lesson)[0] <= now:
            raise conflict()
        minutes = data.get("duration_minutes") or lesson["duration_minutes"]
        proposed = interval(instant(data["proposed_starts_at"]), minutes)
        self._validate_time(proposed, now)
        if bounds(lesson) == bounds(proposed):
            raise conflict()
        occurrence = [self._occurrence(lesson, proposed)]
        return await self._submit_proposal(
            actor,
            role,
            card,
            calendar,
            [lesson],
            occurrence,
            "one",
            data.get("reason"),
            data["expected_version"],
            lesson,
            now,
        )

    async def propose_series(self, actor, series_id, data, *, preview=False):
        card, calendar = await self._locate(
            actor, "teacher", series_id, "series", write=not preview
        )
        series = calendar.series.get(series_id)
        if not series or not card.active:
            raise missing()
        now = now_utc()
        anchor = calendar.find(data["from_lesson_id"])
        if (
            not anchor
            or anchor["series_id"] != series_id
            or anchor["status"] != "scheduled"
            or bounds(anchor)[0] <= now
            or anchor["is_series_exception"]
        ):
            raise conflict()
        start = anchor["series_position"]
        lessons = self._scheduled_slots(calendar, series, now, start, include_exceptions=False)
        items = []
        for lesson in lessons:
            local = instant(data["first_local_start"]) + timedelta(
                weeks=lesson["series_position"] - start
            )
            try:
                span = self._series_intervals(
                    {**data, "first_local_start": local.isoformat()}, series["timezone"], 1
                )[0]
            except LocalTimeIssue as problem:
                raise LocalTimeIssue(
                    lesson["series_position"], problem.local_date, problem.code
                ) from None
            item = {
                "lesson_id": lesson["lesson_id"],
                "series_position": lesson["series_position"],
                **interval(span[0], data["duration_minutes"]),
            }
            self._validate_time(item, now)
            items.append(item)
        ids = {item["lesson_id"] for item in items}
        if preview:
            check_version(series, data["expected_version"])
            flags = await self._conflicts(card, items, ids)
            preserved = [
                slot["lesson_id"]
                for slot in series["slots"]
                if "lesson_id" in slot and slot["lesson_id"] not in ids
            ]
            return self._plan_view(items, flags, series["timezone"], preserved), False
        if all(bounds(lesson) == bounds(item) for lesson, item in zip(lessons, items, strict=True)):
            raise conflict()
        occurrences = [
            self._occurrence(lesson, item) for lesson, item in zip(lessons, items, strict=True)
        ]
        return await self._submit_proposal(
            actor,
            "teacher",
            card,
            calendar,
            lessons,
            occurrences,
            "following",
            data.get("reason"),
            data["expected_version"],
            series,
            now,
        )

    async def _submit_proposal(
        self,
        actor,
        role,
        card,
        calendar,
        lessons,
        occurrences,
        scope,
        reason,
        expected,
        versioned,
        now,
    ):
        ids = {item["lesson_id"] for item in occurrences}
        for request in calendar.requests.values():
            if (
                ids & self._request_ids(request)
                and self._request_status(card, calendar, request, now) == "pending"
            ):
                if (
                    request["requester_id"] == str(actor.account_id)
                    and request["occurrences"] == occurrences
                    and request["scope"] == scope
                    and request["reason"] == reason
                ):
                    return request, False
                raise Problem(ProblemCode.LESSON_RESCHEDULE_PENDING)
        check_version(versioned, expected)
        decider = card.student_id if role == "teacher" else card.teacher_id
        if decider is None:
            raise Problem(ProblemCode.LESSON_STUDENT_NOT_LINKED)
        request = {
            "request_id": str(uuid4()),
            "requester_id": str(actor.account_id),
            "decider_id": str(decider),
            "requester_role": role,
            "reason": reason,
            "parent_grant": card.grant_for(actor.account_id) if role == "parent" else None,
            "scope": scope,
            "occurrences": occurrences,
            "version": 1,
            "status": "pending",
            "created_at": timestamp(now),
        }
        calendar.requests[request["request_id"]] = request
        for lesson in lessons:
            if scope == "one":
                lesson = calendar.materialize(lesson)
                self._bump(calendar, lesson, now)
            calendar.event(
                lesson,
                "reschedule_proposed",
                str(actor.account_id),
                role,
                now,
                related_id=request["request_id"],
            )
        self._notice(
            card,
            calendar,
            actor.account_id,
            "reschedule_proposed",
            now,
            lessons[0]["lesson_id"],
            related_id=request["request_id"],
        )
        await self.store.save(card, calendar)
        return request, True

    def _proposal_view(self, card, calendar, request, actor, role):
        status = self._request_status(card, calendar, request, now_utc())
        actor_id = str(actor.account_id)
        decider_role = "student" if request["requester_role"] == "teacher" else "teacher"
        return {
            **request,
            "status": status,
            "can_resolve": status == "pending"
            and actor_id == request["decider_id"]
            and role == decider_role,
            "can_withdraw": status == "pending"
            and actor_id == request["requester_id"]
            and role == request["requester_role"],
        }

    async def request_list(self, actor, role: LessonRole, lesson_id: str):
        card, calendar, _ = await self._lesson(actor, role, lesson_id)
        return [
            self._proposal_view(card, calendar, request, actor, role)
            for request in calendar.requests.values()
            if lesson_id in self._request_ids(request)
        ]

    async def request_action(self, actor, role: LessonRole, request_id, action="detail", data=None):
        card, calendar = await self._locate(
            actor, role, request_id, "request", write=action != "detail"
        )
        request = calendar.requests.get(request_id)
        if request is None:
            raise missing()
        now = now_utc()
        status = self._request_status(card, calendar, request, now)
        if action == "detail":
            return self._proposal_view(card, calendar, request, actor, role)
        assert data is not None
        actor_id = str(actor.account_id)
        if action == "withdraw":
            if actor_id != request["requester_id"] or role != request["requester_role"]:
                raise missing()
            end_status = "withdrawn"
        else:
            expected_role = "student" if request["requester_role"] == "teacher" else "teacher"
            if actor_id != request["decider_id"] or role != expected_role:
                raise missing()
            end_status = "accepted" if data["decision"] == "accept" else "declined"
        check_version(request, data["expected_version"])
        if status == end_status:
            return request
        if status != "pending":
            raise conflict()
        affected = self._request_ids(request)
        if end_status == "accepted":
            proposed = [
                interval(instant(item["proposed_starts_at"]), item["duration_minutes"])
                for item in request["occurrences"]
            ]
            if any(await self._conflicts(card, proposed, affected)):
                raise Problem(ProblemCode.LESSON_TIME_CONFLICT)
            series_to_bump = set()
            for item, update in zip(request["occurrences"], proposed, strict=True):
                source = calendar.find(item["lesson_id"])
                if source is None:
                    raise conflict()
                lesson = calendar.materialize(source)
                lesson.update(update)
                if lesson["series_id"]:
                    series_to_bump.add(lesson["series_id"])
                    if request["scope"] == "one":
                        lesson["is_series_exception"] = True
                self._bump(calendar, lesson, now, bump_series=False)
                calendar.event(
                    lesson,
                    "lesson_rescheduled",
                    actor_id,
                    role,
                    now,
                    before={key: item[key] for key in ("starts_at", "ends_at")},
                    after=update,
                    related_id=request_id,
                )
            for series_id in series_to_bump:
                calendar.series[series_id]["version"] += 1
            self._close_notices(calendar, affected)
            self._supersede(calendar, affected, now, request_id)
        else:
            for item in request["occurrences"]:
                if lesson := calendar.find(item["lesson_id"]):
                    calendar.event(
                        lesson,
                        "reschedule_" + end_status,
                        actor_id,
                        role,
                        now,
                        related_id=request_id,
                    )
        request.update(status=end_status, version=request["version"] + 1)
        self._notice(
            card,
            calendar,
            actor.account_id,
            "reschedule_" + end_status,
            now,
            request["occurrences"][0]["lesson_id"],
            related_id=request_id,
        )
        await self.store.save(card, calendar)
        return request

    @staticmethod
    def _absence_status(card, calendar, notice, now):
        if notice["status"] != "open":
            return notice["status"]
        lesson = calendar.find(notice["lesson_id"])
        return (
            "open"
            if (
                lesson
                and lesson["status"] == "scheduled"
                and bounds(lesson)[0] > now
                and notice["requester_id"] in {str(member) for member in card.participants()}
                and (
                    notice["requester_role"] != "parent"
                    or notice["parent_grant"] == card.grant_for(UUID(notice["requester_id"]))
                )
            )
            else "closed"
        )

    @staticmethod
    def _can_withdraw_notice(notice, actor, role, status):
        return (
            status == "open"
            and notice["requester_id"] == str(actor.account_id)
            and notice["requester_role"] == role
        )

    async def absence(self, actor, role: LessonRole, lesson_id, data=None):
        card, calendar, lesson = await self._lesson(actor, role, lesson_id, write=data is not None)
        now = now_utc()
        existing = []
        for notice in calendar.notices.values():
            if notice["lesson_id"] != lesson_id:
                continue
            status = self._absence_status(card, calendar, notice, now)
            existing.append(
                {
                    **notice,
                    "status": status,
                    "can_withdraw": self._can_withdraw_notice(notice, actor, role, status),
                }
            )
        if data is None:
            return existing
        if role == "teacher" or lesson["status"] != "scheduled" or bounds(lesson)[0] <= now:
            raise conflict()
        for notice in existing:
            if notice["status"] == "open":
                if notice["requester_id"] == str(actor.account_id) and notice["reason"] == data.get(
                    "reason"
                ):
                    return notice, False
                raise Problem(ProblemCode.LESSON_ABSENCE_NOTICE_PENDING)
        check_version(lesson, data["expected_version"])
        notice = {
            "notice_id": str(uuid4()),
            "lesson_id": lesson_id,
            "requester_id": str(actor.account_id),
            "requester_role": role,
            "reason": data.get("reason"),
            "status": "open",
            "parent_grant": card.grant_for(actor.account_id) if role == "parent" else None,
            "version": 1,
            "created_at": timestamp(now),
        }
        lesson = calendar.materialize(lesson)
        self._bump(calendar, lesson, now)
        calendar.notices[notice["notice_id"]] = notice
        calendar.event(
            lesson,
            "absence_reported",
            str(actor.account_id),
            role,
            now,
            related_id=notice["notice_id"],
        )
        self._notice(
            card,
            calendar,
            actor.account_id,
            "absence_reported",
            now,
            lesson_id,
            recipients=(card.teacher_id,),
            related_id=notice["notice_id"],
        )
        await self.store.save(card, calendar)
        return notice, True

    async def absence_action(self, actor, role: LessonRole, notice_id, version=None):
        card, calendar = await self._locate(
            actor, role, notice_id, "notice", write=version is not None
        )
        notice = calendar.notices.get(notice_id)
        if notice is None:
            raise missing()
        now = now_utc()
        status = self._absence_status(card, calendar, notice, now)
        if version is None:
            return {
                **notice,
                "status": status,
                "can_withdraw": self._can_withdraw_notice(notice, actor, role, status),
            }
        if notice["requester_id"] != str(actor.account_id) or notice["requester_role"] != role:
            raise missing()
        check_version(notice, version)
        if status == "withdrawn":
            return notice
        if status != "open":
            raise conflict()
        notice.update(status="withdrawn", version=notice["version"] + 1)
        lesson = calendar.find(notice["lesson_id"])
        if lesson is not None:
            calendar.event(
                lesson, "absence_withdrawn", str(actor.account_id), role, now, related_id=notice_id
            )
        self._notice(
            card,
            calendar,
            actor.account_id,
            "absence_withdrawn",
            now,
            notice["lesson_id"],
            recipients=(card.teacher_id,),
            related_id=notice_id,
        )
        await self.store.save(card, calendar)
        return notice

    async def history(self, actor, role: LessonRole, lesson_id, *, full=False):
        card, calendar, _ = await self._lesson(actor, role, lesson_id)
        rows = list(calendar.events.get(lesson_id, ()))
        for request in calendar.requests.values():
            if (
                lesson_id in self._request_ids(request)
                and self._request_status(card, calendar, request, now_utc()) == "expired"
            ):
                rows.append(
                    {
                        "event_id": request["request_id"],
                        "event": "reschedule_expired",
                        "actor_role": None,
                        "occurred_at": min(
                            min(item["starts_at"], item["proposed_starts_at"])
                            for item in request["occurrences"]
                        ),
                        "related_id": request["request_id"],
                    }
                )
        if full or role == "teacher":
            return rows
        output = []
        for item in rows:
            public = {
                key: item[key]
                for key in (
                    "event_id",
                    "event",
                    "occurred_at",
                    "actor_role",
                    "before",
                    "after",
                    "reason",
                    "related_id",
                )
                if key in item
            }
            if item["event"] == "lesson_edited":
                fields = [
                    field for field in item.get("changed_fields", []) if field != "private_note"
                ]
                if not fields:
                    continue
                public["changed_fields"] = fields
            output.append(public)
        return output

    async def inbox(self, actor, role: LessonRole):
        result = []
        for card in await self.cards.lesson_cards(actor, role):
            calendar = await self.store.load(card.card_id)
            for item in calendar.notifications:
                if str(actor.account_id) in item["recipients"]:
                    result.append(self._notification_view(card, calendar, item, actor, role))
        return result

    @staticmethod
    def _notification_view(card, calendar, item, actor, role):
        request = calendar.requests.get(item["related_id"])
        actionable = bool(
            request
            and request["decider_id"] == str(actor.account_id)
            and role == ("student" if request["requester_role"] == "teacher" else "teacher")
            and Schedule._request_status(card, calendar, request, now_utc()) == "pending"
        )
        return {
            key: item[key]
            for key in ("notification_id", "event", "occurred_at", "lesson_id", "related_id")
        } | {
            "read": str(actor.account_id) in item["read_by"],
            "actionable": actionable,
            "student_card_id": calendar.card_id,
        }

    async def mark_read(self, actor, role: LessonRole, card_id: UUID, notification_id: str):
        card, calendar = await self._card(actor, role, card_id, write=True, archived=True)
        for item in calendar.notifications:
            if (
                item["notification_id"] == notification_id
                and str(actor.account_id) in item["recipients"]
            ):
                if str(actor.account_id) not in item["read_by"]:
                    item["read_by"].append(str(actor.account_id))
                    await self.store.save(card, calendar)
                return
        raise missing()
