"""Проверка и нормализация контактов для сценариев Identity."""

import re

from email_validator import EmailNotValidError, validate_email

from app.modules.identity.application.contracts import ContactInput
from app.modules.identity.domain.exceptions import IdentityError
from app.modules.identity.domain.values import CONTACT_MAX_LENGTH, Contact, ContactKind


PHONE_PATTERN = re.compile(r"\+[1-9][0-9]{7,14}")


class ValidatedContacts:
    def normalize(self, contact: ContactInput) -> Contact:
        if len(contact.value) > CONTACT_MAX_LENGTH:
            raise IdentityError("invalid_contact")

        value = contact.value.strip()

        if not value:
            raise IdentityError("invalid_contact")

        if contact.kind is ContactKind.PHONE:
            if not PHONE_PATTERN.fullmatch(value):
                raise IdentityError("invalid_contact")

            return Contact(contact.kind, value)

        if contact.kind is not ContactKind.EMAIL:
            raise IdentityError("invalid_contact")

        try:
            result = validate_email(value, check_deliverability=False, allow_smtputf8=False)
        except EmailNotValidError:
            raise IdentityError("invalid_contact") from None

        if result.ascii_email is None or len(result.ascii_email) > CONTACT_MAX_LENGTH:
            raise IdentityError("invalid_contact")

        return Contact(contact.kind, result.ascii_email.lower())
