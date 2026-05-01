import asyncio
import httpx
from agents.tools.decorators import tool
from config import settings

_KIE_BASE = "https://api.kie.ai/api/v1"
_POLL_INTERVAL = 3
_TIMEOUT = 120


@tool
async def generate_image(
    prompt: str,
    aspect_ratio: str = "1:1",
    resolution: str = "1K",
    db=None,
    current_user=None,
) -> dict:
    """
    Генерирует изображение по текстовому описанию через kie.ai.

    Args:
        prompt: описание изображения на любом языке
        aspect_ratio: соотношение сторон (auto, 1:1, 9:16, 16:9, 4:3, 3:4)
        resolution: разрешение (1K, 2K, 4K)

    Returns:
        dict с полем image_url или error
    """
    headers = {
        "Authorization": f"Bearer {settings.kie_api_key}",
        "Content-Type": "application/json",
    }

    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            create_resp = await client.post(
                f"{_KIE_BASE}/jobs/createTask",
                headers=headers,
                json={
                    "prompt": prompt,
                    "aspect_ratio": aspect_ratio,
                    "resolution": resolution,
                },
            )
            create_resp.raise_for_status()
            create_data = create_resp.json()

        task_id = create_data.get("data", {}).get("taskId") or create_data.get("taskId")
        if not task_id:
            return {"error": f"Не удалось получить taskId: {create_data}"}

        elapsed = 0
        async with httpx.AsyncClient(timeout=30.0) as client:
            while elapsed < _TIMEOUT:
                await asyncio.sleep(_POLL_INTERVAL)
                elapsed += _POLL_INTERVAL

                poll_resp = await client.get(
                    f"{_KIE_BASE}/jobs/getTaskDetail",
                    headers=headers,
                    params={"taskId": task_id},
                )
                poll_resp.raise_for_status()
                poll_data = poll_resp.json()

                task = poll_data.get("data", poll_data)
                status = task.get("status", "")

                if status == "completed":
                    image_url = task.get("image_url") or task.get("imageUrl")
                    if image_url:
                        return {"image_url": image_url}
                    return {"error": f"Статус completed, но image_url не найден: {task}"}

                if status in ("failed", "error"):
                    return {"error": f"Задача завершилась с ошибкой: {task}"}

        return {"error": "Превышено время ожидания генерации изображения (120 сек)"}

    except httpx.HTTPStatusError as e:
        return {"error": f"HTTP ошибка {e.response.status_code}: {e.response.text}"}
    except httpx.TimeoutException:
        return {"error": "Превышено время ожидания запроса к kie.ai"}
    except Exception as e:
        return {"error": f"Ошибка: {str(e)}"}
