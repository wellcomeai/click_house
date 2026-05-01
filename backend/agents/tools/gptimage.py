import asyncio
import logging

import httpx

from agents.tools.decorators import tool

logger = logging.getLogger(__name__)

KIE_BASE_URL = "https://api.kie.ai/api/v1"
WAIT_INTERVAL = 2.0
WAIT_TIMEOUT  = 120.0


@tool
async def generate_image(
    prompt: str,
    aspect_ratio: str = "1:1",
    resolution: str = "1K",
    db=None,
    current_user=None,
) -> dict:
    """
    Генерирует изображение по текстовому описанию через kie.ai (gpt-image-2).

    Args:
        prompt: описание изображения (до 20 000 символов)
        aspect_ratio: соотношение сторон — auto | 1:1 | 9:16 | 16:9 | 4:3 | 3:4
        resolution: разрешение — 1K | 2K | 4K

    Returns:
        dict с полем image_url или error
    """
    from config import settings
    from modules.image_callback.router import get_result, clear_result

    api_key = settings.kie_api_key
    if not api_key:
        return {"error": "KIE_API_KEY не настроен"}

    callback_url = f"{settings.public_url}/api/image-callback"

    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
    }

    payload = {
        "model": "gpt-image-2-text-to-image",
        "callBackUrl": callback_url,
        "input": {
            "prompt": prompt,
            "aspect_ratio": aspect_ratio,
            "resolution": resolution,
        },
    }

    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            resp = await client.post(
                f"{KIE_BASE_URL}/jobs/createTask",
                json=payload,
                headers=headers,
            )
            resp.raise_for_status()
            data = resp.json()
            logger.info("kie.ai createTask response: %s", data)

            if data.get("code") != 200:
                return {"error": f"Ошибка создания задачи: {data.get('msg', 'unknown')}"}

            task_id = data["data"]["taskId"]
            logger.info("kie.ai task created: %s, waiting for callback...", task_id)

        # Ждём пока callback роутер положит результат в dict
        elapsed = 0.0
        while elapsed < WAIT_TIMEOUT:
            await asyncio.sleep(WAIT_INTERVAL)
            elapsed += WAIT_INTERVAL

            result = get_result(task_id)
            if result is not None:
                clear_result(task_id)
                logger.info("kie.ai result received for %s: %s", task_id, result)
                return result

        return {"error": f"Таймаут: callback не пришёл за {WAIT_TIMEOUT}с"}

    except httpx.HTTPStatusError as e:
        return {"error": f"HTTP {e.response.status_code}: {e.response.text[:200]}"}
    except Exception as e:
        logger.exception("generate_image error: %s", e)
        return {"error": str(e)}
