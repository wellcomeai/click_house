import logging

from agents.tools.decorators import tool

logger = logging.getLogger(__name__)


@tool
async def send_notification(
    user_id: str,
    message: str,
    db=None,
    current_user=None,
) -> dict:
    """Отправить уведомление пользователю (логируется в систему)."""
    logger.info(
        "NOTIFICATION to user %s from agent (triggered by %s): %s",
        user_id,
        str(current_user.id) if current_user else "unknown",
        message,
    )
    return {
        "success": True,
        "recipient_id": user_id,
        "message": message,
    }
