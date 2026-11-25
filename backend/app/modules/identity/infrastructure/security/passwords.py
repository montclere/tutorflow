"""Ограниченные вычисления Argon2id вне event loop."""

from asyncio import Semaphore, Task, create_task, shield, to_thread, wait_for
from collections.abc import Callable
from functools import partial

from argon2 import PasswordHasher
from argon2.exceptions import InvalidHashError, VerificationError

from app.modules.identity.domain.exceptions import IdentityError
from app.modules.identity.infrastructure.security.settings import PasswordHashingSettings


class ArgonPasswords:
    def __init__(self, settings: PasswordHashingSettings | None = None) -> None:
        self.settings = settings or PasswordHashingSettings()
        self.hasher = PasswordHasher(
            time_cost=self.settings.time_cost,
            memory_cost=self.settings.memory_kib,
            parallelism=self.settings.parallelism,
        )
        self._slots = Semaphore(self.settings.max_concurrent)
        self._jobs: set[Task[object]] = set()

    def needs_rehash(self, digest: str) -> bool:
        return self.hasher.check_needs_rehash(digest)

    async def hash(self, password: str) -> str:
        return await self._run(partial(self.hasher.hash, password))

    async def verify(self, digest: str, password: str) -> bool:
        try:
            return await self._run(partial(self.hasher.verify, digest, password))
        except (InvalidHashError, VerificationError):
            return False

    async def _run[T](self, operation: Callable[[], T]) -> T:
        try:
            await wait_for(self._slots.acquire(), timeout=self.settings.wait_timeout_seconds)
        except TimeoutError:
            raise IdentityError("identity_busy") from None

        job = create_task(to_thread(operation))

        self._jobs.add(job)
        job.add_done_callback(self._finished)

        return await shield(job)

    def _finished(self, job: Task[object]) -> None:
        self._jobs.discard(job)
        self._slots.release()

        if not job.cancelled():
            job.exception()
