from app.shared.domain.errors import Problem, ProblemCode


def unavailable() -> Problem:
    return Problem(ProblemCode.INVITATION_UNAVAILABLE)


def not_found() -> Problem:
    return Problem(ProblemCode.RESOURCE_NOT_FOUND)
