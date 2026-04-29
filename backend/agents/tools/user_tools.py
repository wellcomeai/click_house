import uuid
import logging

from sqlalchemy import select
from sqlalchemy.orm import selectinload

from agents.tools.decorators import tool

logger = logging.getLogger(__name__)


@tool
async def get_user_info(user_id: str, db=None, current_user=None) -> dict:
    """Получить информацию о пользователе: имя, роль, должность, контакты."""
    from agents.tools.db_tools import get_user_details

    return await get_user_details(user_id=user_id, db=db, current_user=current_user)


@tool
async def get_team_by_object(object_id: str, db=None, current_user=None) -> dict:
    """Получить список всех исполнителей задач на указанном объекте."""
    from modules.tasks.models import Task
    from modules.users.models import User

    tasks_result = await db.execute(
        select(Task).where(
            Task.object_id == uuid.UUID(object_id),
            Task.assignee_id.isnot(None),
        )
    )
    tasks = tasks_result.scalars().all()
    assignee_ids = list({t.assignee_id for t in tasks})

    if not assignee_ids:
        return {"count": 0, "members": []}

    users_result = await db.execute(
        select(User)
        .options(selectinload(User.profile))
        .where(User.id.in_(assignee_ids))
    )
    users = users_result.scalars().all()

    members = []
    for user in users:
        profile = user.profile
        members.append(
            {
                "id": str(user.id),
                "email": user.email,
                "role": user.role.value,
                "full_name": " ".join(
                    filter(
                        None,
                        [
                            profile.last_name if profile else None,
                            profile.first_name if profile else None,
                        ],
                    )
                )
                or user.email,
                "position": profile.position if profile else None,
                "task_count": len([t for t in tasks if t.assignee_id == user.id]),
            }
        )

    return {"count": len(members), "members": members}
