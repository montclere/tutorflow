from app.config import Settings
from app.main import create_app


def test_openapi_distinguishes_parent_and_teacher_card_views():
    app = create_app(Settings("postgresql+psycopg://postgres@localhost/tutorflow", "t" * 48))
    schema = app.openapi()
    components = schema["components"]["schemas"]
    assert "private_note" in components["TeacherCardView"]["properties"]
    assert "private_note" not in components["ParentCardView"]["properties"]
    assert "parent_access_id" in components["ParentCardView"]["properties"]
    accept = schema["paths"]["/api/v1/invitations/accept"]["post"]
    assert {"200", "201"} <= set(accept["responses"])


def test_openapi_matches_public_errors_and_created_headers():
    app = create_app(Settings("postgresql+psycopg://postgres@localhost/tutorflow", "t" * 48))
    schema = app.openapi()
    paths = schema["paths"]
    login = paths["/api/v1/auth/login"]["post"]["responses"]
    assert {"400", "403", "413", "415", "422", "429", "500", "503"} <= set(login)
    assert "401" not in login
    assert {"csrf_failed", "invalid_credentials"} <= set(login["403"]["x-problem-codes"])
    for status, response in login.items():
        if int(status) >= 400:
            assert set(response["content"]) == {"application/problem+json"}
            problem = response["content"]["application/problem+json"]["schema"]
            assert problem["$ref"] == "#/components/schemas/ProblemDetails"
    assert "Retry-After" in login["429"]["headers"]
    assert "HTTPValidationError" not in schema["components"]["schemas"]
    accept = paths["/api/v1/invitations/accept"]["post"]["responses"]
    assert "Location" in accept["201"]["headers"]
    assert "Location" not in accept["200"].get("headers", {})
    assert (
        "content" not in paths["/api/v1/auth/password-resets/complete"]["post"]["responses"]["204"]
    )
