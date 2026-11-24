from typing import Literal

from fastapi import FastAPI
from pydantic import BaseModel

app = FastAPI(title="TutorFlow API")


class HealthStatus(BaseModel):
    status: Literal["ok"] = "ok"


@app.get("/health")
async def health() -> HealthStatus:
    return HealthStatus()
