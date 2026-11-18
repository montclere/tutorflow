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
