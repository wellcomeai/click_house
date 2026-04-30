import logging
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse

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
    allow_origins=settings.get_cors_origins(),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

from modules.auth.router import router as auth_router
from modules.users.router import router as users_router
from modules.objects.router import router as objects_router
from modules.tasks.router import router as tasks_router
from modules.ai_gateway.router import router as ai_router
from modules.files.router import router as files_router
from modules.comments.router import router as comments_router

app.include_router(auth_router, prefix="/auth", tags=["auth"])
app.include_router(users_router, prefix="/users", tags=["users"])
app.include_router(objects_router, prefix="/objects", tags=["objects"])
app.include_router(tasks_router, prefix="/tasks", tags=["tasks"])
app.include_router(ai_router, prefix="/agents", tags=["agents"])
app.include_router(files_router, tags=["files"])
app.include_router(comments_router, tags=["comments"])


@app.get("/health", tags=["system"])
async def health():
    return {"status": "ok"}


# Serve React frontend — must be AFTER all API routes
FRONTEND_DIST = Path(__file__).parent / "static"

if FRONTEND_DIST.exists():
    app.mount("/assets", StaticFiles(directory=FRONTEND_DIST / "assets"), name="assets")

    @app.get("/{full_path:path}", include_in_schema=False)
    async def serve_spa(full_path: str):
        file_path = FRONTEND_DIST / full_path
        if file_path.exists() and file_path.is_file():
            return FileResponse(file_path)
        return FileResponse(FRONTEND_DIST / "index.html")
