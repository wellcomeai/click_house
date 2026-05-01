import logging
from fastapi import APIRouter, Request

logger = logging.getLogger(__name__)
router = APIRouter()

# В памяти: {taskId: {"image_url": "..."} или {"error": "..."}}
_results: dict[str, dict] = {}


def get_result(task_id: str) -> dict | None:
    return _results.get(task_id)


def clear_result(task_id: str) -> None:
    _results.pop(task_id, None)


@router.post("/api/image-callback")
async def image_callback(request: Request):
    try:
        body = await request.json()
        logger.info("kie.ai callback received: %s", body)

        task_id = (
            body.get("taskId")
            or body.get("recordId")
            or body.get("data", {}).get("taskId")
            or body.get("data", {}).get("recordId")
        )

        if not task_id:
            logger.warning("kie.ai callback: taskId not found in body")
            return {"ok": False}

        logger.info("kie.ai callback full body: %s", body)

        image_url = (
            body.get("output", {}).get("image_url")
            or body.get("output", {}).get("url")
            or body.get("output", {}).get("imageUrl")
            or body.get("data", {}).get("output", {}).get("image_url")
            or body.get("data", {}).get("output", {}).get("url")
            or body.get("data", {}).get("output", {}).get("imageUrl")
            or body.get("imageUrl")
            or body.get("image_url")
        )

        status = body.get("status") or body.get("data", {}).get("status")

        if image_url:
            _results[task_id] = {"image_url": image_url}
        elif status in ("failed", "error", "cancelled"):
            _results[task_id] = {"error": f"Задача завершилась со статусом: {status}"}
        else:
            _results[task_id] = {"error": "URL не найден", "raw": body}

        return {"ok": True}

    except Exception as e:
        logger.exception("image_callback error: %s", e)
        return {"ok": False}
