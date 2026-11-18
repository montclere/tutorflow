"""Стабильные коды отказов приложения."""

from enum import StrEnum


class ProblemCode(StrEnum):
    INVALID_REQUEST = "invalid_request"
    CHALLENGE_INVALID = "challenge_invalid"
    INVITATION_UNAVAILABLE = "invitation_unavailable"
    AUTHENTICATION_REQUIRED = "authentication_required"
    INVALID_CREDENTIALS = "invalid_credentials"
    CSRF_FAILED = "csrf_failed"
    TEACHER_CABINET_REQUIRED = "teacher_cabinet_required"
    FORBIDDEN = "forbidden"
    RESOURCE_NOT_FOUND = "resource_not_found"
    METHOD_NOT_ALLOWED = "method_not_allowed"
    VERSION_CONFLICT = "version_conflict"
    INVITATION_ALREADY_ACCEPTED = "invitation_already_accepted"
    INVITATION_ACCEPTANCE_CONFLICT = "invitation_acceptance_conflict"
    STUDENT_CARD_ALREADY_LINKED = "student_card_already_linked"
    PARENT_APPLICATION_CONFLICT = "parent_application_conflict"
    LESSON_STUDENT_NOT_LINKED = "lesson_student_not_linked"
    LESSON_TIME_CONFLICT = "lesson_time_conflict"
    LESSON_STATE_CONFLICT = "lesson_state_conflict"
    LESSON_CREATE_CONFLICT = "lesson_create_conflict"
    LESSON_RESCHEDULE_PENDING = "lesson_reschedule_pending"
    LESSON_ABSENCE_NOTICE_PENDING = "lesson_absence_notice_pending"
    STUDENT_CARD_HAS_OPEN_LESSONS = "student_card_has_open_lessons"
    PRECONDITION_REQUIRED = "precondition_required"
    PRECONDITION_FAILED = "precondition_failed"
    REQUEST_TOO_LARGE = "request_too_large"
    UNSUPPORTED_MEDIA_TYPE = "unsupported_media_type"
    VALIDATION_FAILED = "validation_failed"
    CURSOR_INVALID = "cursor_invalid"
    RATE_LIMITED = "rate_limited"
    INTERNAL_ERROR = "internal_error"
    DEPENDENCY_UNAVAILABLE = "dependency_unavailable"


class Problem(Exception):
    def __init__(self, code: ProblemCode, *, retry_after: int | None = None):
        super().__init__(code.value)
        self.code = code
        self.retry_after = retry_after
