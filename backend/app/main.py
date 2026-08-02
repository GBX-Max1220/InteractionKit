"""FastAPI application factory for the InteractionKit study backend.

Run with::

    uvicorn app.main:app --reload --port 8000

or (from the backend/ directory)::

    python -m uvicorn app.main:app --port 8000
"""

from __future__ import annotations

from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from . import api
from .config import APP_NAME
from .db import init_db
from .store import Store

__version__ = "0.1.0"

# CORS: the study frontend (Next.js dev server on :3000) is the only consumer.
ALLOWED_ORIGINS = [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
]


@asynccontextmanager
async def lifespan(app: FastAPI):
    conn = init_db()
    api.set_store(Store(conn))
    yield
    conn.close()


def create_app() -> FastAPI:
    app = FastAPI(title=APP_NAME, version=__version__, lifespan=lifespan)
    app.add_middleware(
        CORSMiddleware,
        allow_origins=ALLOWED_ORIGINS,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    app.include_router(api.router)
    return app


app = create_app()
