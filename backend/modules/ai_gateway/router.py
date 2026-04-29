import logging
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from database import get_db
from dependencies import get_current_user
from modules.users.models import UserRole

logger = logging.getLogger(__name__)

router = APIRouter()


class AgentRunRequest(BaseModel):
    message: str
    history: list[dict] | None = None


@router.get("/")
async def list_agents(_=Depends(get_current_user)):
    from agents.agent_registry import get_agent_list
    return {"agents": get_agent_list()}


@router.post("/{agent_name}/run")
async def run_agent(
    agent_name: str,
    request: AgentRunRequest,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user=Depends(get_current_user),
):
    if current_user.role == UserRole.worker:
        raise HTTPException(status_code=403, detail="Нет доступа к агентам")

    from agents.agent_registry import get_agent

    agent = get_agent(agent_name)
    if agent is None:
        raise HTTPException(status_code=404, detail=f"Агент '{agent_name}' не найден")

    context = {"db": db, "current_user": current_user}

    return StreamingResponse(
        agent.run(request.message, context, request.history),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
            "Connection": "keep-alive",
        },
    )
