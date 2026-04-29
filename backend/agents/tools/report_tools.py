import uuid
import logging
from datetime import datetime, timezone

from agents.tools.decorators import tool

logger = logging.getLogger(__name__)


@tool
async def generate_report(object_id: str, report_type: str, db=None, current_user=None) -> dict:
    """Сгенерировать отчёт по строительному объекту. Типы: summary, tasks, budget."""
    from modules.objects.service import get_object_summary
    from agents.tools.object_tools import get_overdue_tasks

    obj_summary = await get_object_summary(db, uuid.UUID(object_id))
    overdue = await get_overdue_tasks(object_id=object_id, db=db, current_user=current_user)

    report = {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "report_type": report_type,
        "object": obj_summary,
    }

    if report_type in ("tasks", "summary"):
        report["overdue_tasks"] = overdue

    if report_type in ("budget", "summary"):
        planned = obj_summary.get("budget_planned")
        actual = obj_summary.get("budget_actual")
        if planned and actual:
            report["budget_variance"] = float(actual) - float(planned)
            report["budget_utilization_pct"] = round(float(actual) / float(planned) * 100, 1)

    return report
