import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from config import settings

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(name)s %(message)s",
)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Starting ClickHouse Irkutsk API")
    yield
    logger.info("Shutting down ClickHouse Irkutsk API")


app = FastAPI(
    title="ClickHouse Irkutsk API",
    version="1.0.0",
    description="B2B платформа для управления строительными объектами",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.get_cors_origins(),  # ← изменено
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

from modules.auth.router import router as auth_router
from modules.users.router import router as users_router
from modules.objects.router import router as objects_router
from modules.tasks.router import router as tasks_router
from modules.ai_gateway.router import router as ai_router

app.include_router(auth_router, prefix="/auth", tags=["auth"])
app.include_router(users_router, prefix="/users", tags=["users"])
app.include_router(objects_router, prefix="/objects", tags=["objects"])
app.include_router(tasks_router, prefix="/tasks", tags=["tasks"])
app.include_router(ai_router, prefix="/agents", tags=["agents"])


@app.get("/health", tags=["system"])
async def health():
    return {"status": "ok"}
