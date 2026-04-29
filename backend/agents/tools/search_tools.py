import logging

from sqlalchemy import or_, select

from agents.tools.decorators import tool

logger = logging.getLogger(__name__)


@tool
async def semantic_search(query: str, entity_type: str, db=None, current_user=None) -> dict:
    """Поиск по названию/описанию. entity_type: tasks, objects, users."""
    results = []

    if entity_type == "tasks":
        from modules.tasks.models import Task

        result = await db.execute(
            select(Task).where(
                or_(
                    Task.title.ilike(f"%{query}%"),
                    Task.description.ilike(f"%{query}%"),
                )
            ).limit(10)
        )
        items = result.scalars().all()
        results = [
            {"id": str(t.id), "title": t.title, "status": t.status.value}
            for t in items
        ]

    elif entity_type == "objects":
        from modules.objects.models import Object

        result = await db.execute(
            select(Object).where(
                or_(
                    Object.name.ilike(f"%{query}%"),
                    Object.description.ilike(f"%{query}%"),
                    Object.address.ilike(f"%{query}%"),
                )
            ).limit(10)
        )
        items = result.scalars().all()
        results = [
            {"id": str(o.id), "name": o.name, "status": o.status.value}
            for o in items
        ]

    elif entity_type == "users":
        from modules.users.models import User
        from sqlalchemy.orm import selectinload

        result = await db.execute(
            select(User)
            .options(selectinload(User.profile))
            .where(User.email.ilike(f"%{query}%"))
            .limit(10)
        )
        items = result.scalars().all()
        results = [
            {"id": str(u.id), "email": u.email, "role": u.role.value}
            for u in items
        ]

    return {"query": query, "entity_type": entity_type, "count": len(results), "results": results}
