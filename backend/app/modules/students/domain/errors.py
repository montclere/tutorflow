from app.shared.domain.errors import Problem


def unavailable() -> Problem:
    return Problem("invitation_unavailable", 400)


def not_found() -> Problem:
    return Problem("resource_not_found", 404)
