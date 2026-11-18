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
