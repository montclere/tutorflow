import asyncio
import secrets

from argon2 import PasswordHasher
from argon2.exceptions import InvalidHashError, VerificationError


class ArgonPasswords:
    def __init__(self):
        self.slots = asyncio.Semaphore(4)
        self.hasher = PasswordHasher()
        self.dummy_hash = self.hasher.hash(secrets.token_urlsafe(32))

    async def hash(self, password: str) -> str:
        async with self.slots:
            return await asyncio.to_thread(self.hasher.hash, password)

    async def verify(self, password: str, password_hash: str | None) -> bool:
        try:
            async with self.slots:
                await asyncio.to_thread(
                    self.hasher.verify, password_hash or self.dummy_hash, password
                )
        except (VerificationError, InvalidHashError):
            return False
        return password_hash is not None
