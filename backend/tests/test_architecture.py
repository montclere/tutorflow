"""Регрессии для архитектурной проверки импортов."""

import runpy
import unittest
from pathlib import Path


architecture = runpy.run_path(
    str(Path(__file__).resolve().parents[1] / "scripts/check-architecture.py")
)


class ArchitectureTest(unittest.TestCase):
    def test_rejects_absolute_and_relative_internal_imports(self):
        source = (
            "import app.modules.identity.domain\n"
            "from ..identity import repository\n"
            "from app.modules.identity.public import AccountId\n"
            "from .domain import Card\n"
        )
        violations = list(architecture["violations"](source, Path("students/service.py")))

        self.assertEqual(
            violations,
            [
                (1, "app.modules.identity.domain"),
                (2, "app.modules.identity.repository"),
            ],
        )

    def test_layers_depend_inwards(self):
        application = (
            "from ..domain.accounts import Account\n"
            "from ..infrastructure.persistence.repository import PostgresIdentityRepository\n"
            "from app.modules.scheduling.public import CalendarPort\n"
            "from sqlalchemy import Engine\n"
            "from app.composition import build_services\n"
        )

        self.assertEqual(
            list(architecture["violations"](application, Path("identity/application/service.py"))),
            [
                (
                    2,
                    "app.modules.identity.infrastructure.persistence.repository.PostgresIdentityRepository",
                ),
                (4, "sqlalchemy.Engine"),
                (5, "app.composition.build_services"),
            ],
        )

        public = (
            "from .presentation.http.router import route\n"
            "from .application.services.sessions import SessionService\n"
            "from dataclasses import dataclass\n"
        )

        self.assertEqual(
            list(architecture["violations"](public, Path("identity/public.py"))),
            [
                (1, "app.modules.identity.presentation.http.router.route"),
                (2, "app.modules.identity.application.services.sessions.SessionService"),
            ],
        )

    def test_presentation_cannot_reach_the_composition_root(self):
        source = (
            "from app.composition import Services\n"
            "from app.api_v1 import resolve_services\n"
            "from app.shared.presentation.http import require_json\n"
            "from app.shared.infrastructure.database import postgres_engine\n"
        )

        self.assertEqual(
            list(architecture["violations"](source, Path("scheduling/presentation/router.py"))),
            [
                (1, "app.composition.Services"),
                (2, "app.api_v1.resolve_services"),
                (4, "app.shared.infrastructure.database.postgres_engine"),
            ],
        )

    def test_shared_cannot_reexport_modules_or_application_services(self):
        source = (
            "from app.api_v1 import resolve_services\n"
            "from app.modules.identity.public import Actor\n"
            "from ..infrastructure.database import postgres_engine\n"
            "from fastapi import Request\n"
        )

        self.assertEqual(
            list(architecture["violations"](source, Path("presentation/http.py"), area="shared")),
            [
                (1, "app.api_v1.resolve_services"),
                (2, "app.modules.identity.public.Actor"),
                (3, "app.shared.infrastructure.database.postgres_engine"),
            ],
        )

    def test_adapters_reject_blocking_io_imports(self):
        source = (
            "from sqlalchemy import create_engine\n"
            "from sqlalchemy.orm import Session\n"
            "import smtplib\n"
            "from http.client import HTTPSConnection\n"
            "from sqlalchemy.ext.asyncio import AsyncSession\n"
        )

        self.assertEqual(
            list(architecture["violations"](source, Path("identity/infrastructure/delivery.py"))),
            [
                (1, "sqlalchemy.create_engine"),
                (2, "sqlalchemy.orm.Session"),
                (3, "smtplib"),
                (4, "http.client.HTTPSConnection"),
            ],
        )

    def test_http_handlers_must_be_async(self):
        source = (
            "@router.get('/items')\ndef items():\n    return []\n"
            "@router.post('/items')\nasync def create():\n    return {}\n"
        )

        self.assertEqual(list(architecture["blocking_handlers"](source)), [(2, "items")])
