import asyncio
import json
import logging

import httpx

from agents.tools.decorators import tool

logger = logging.getLogger(__name__)

KIE_BASE_URL = "https://api.kie.ai/api/v1"
POLL_INTERVAL = 5.0       # секунды между запросами статуса
POLL_TIMEOUT  = 600.0     # максимум 10 минут (120 итераций × 5 сек)


async def _poll(task_id: str, headers: dict) -> dict:
    """Опрашивает recordInfo до получения результата или ошибки."""
    detail_url = f"{KIE_BASE_URL}/jobs/recordInfo"
    elapsed = 0.0

    async with httpx.AsyncClient(timeout=30.0) as client:
        while elapsed < POLL_TIMEOUT:
            await asyncio.sleep(POLL_INTERVAL)
            elapsed += POLL_INTERVAL

            try:
                r = await client.get(detail_url, headers=headers, params={"taskId": task_id})

                # 404 — задача ещё не появилась, продолжаем ждать
                if r.status_code == 404:
                    continue

                r.raise_for_status()
                data = r.json()

            except httpx.HTTPStatusError as e:
                return {"error": f"HTTP {e.response.status_code} при опросе статуса", "task_id": task_id}
            except Exception as e:
                return {"error": f"Ошибка при опросе: {e}", "task_id": task_id}

            code       = data.get("code")
            task_data  = data.get("data", {})
            state      = task_data.get("state")

            logger.debug("kie.ai poll %s → state=%s", task_id, state)

            if code == 200 and state == "success":
                # resultJson — строка с вложенным JSON
                result_json_str = task_data.get("resultJson", "{}")
                try:
                    result_json = (
                        json.loads(result_json_str)
                        if isinstance(result_json_str, str)
                        else result_json_str
                    )
                except json.JSONDecodeError as e:
                    return {"error": f"Не удалось разобрать resultJson: {e}", "task_id": task_id}

                result_urls: list[str] = result_json.get("resultUrls", [])
                if not result_urls:
                    return {"error": "resultUrls пуст в ответе kie.ai", "task_id": task_id}

                # Возвращаем первый URL в поле image_url (совместимо с base_agent.py)
                return {
                    "image_url": result_urls[0],
                    "all_urls":  result_urls,
                    "task_id":   task_id,
                    "model":     task_data.get("model"),
                    "cost_time": task_data.get("costTime"),
                }

            if state == "fail":
                return {
                    "error":      task_data.get("failMsg", "Задача завершилась с ошибкой"),
                    "fail_code":  task_data.get("failCode", ""),
                    "task_id":    task_id,
                }

            # state in ("working", "pending", None) — продолжаем ждать

    return {"error": f"Таймаут: задача {task_id} не завершилась за {POLL_TIMEOUT}с"}


@tool
async def generate_image(
    prompt: str,
    aspect_ratio: str = "1:1",
    files_url: str = "",
    db=None,
    current_user=None,
) -> dict:
    """
    Генерирует изображение по текстовому описанию через kie.ai (gpt-image-2).

    Args:
        prompt: описание изображения (до 20 000 символов)
        aspect_ratio: соотношение сторон — auto | 1:1 | 9:16 | 16:9 | 4:3 | 3:4
        files_url: URL исходных изображений через запятую (для image-to-image режима)

    Returns:
        dict с полем image_url или error
    """
    from config import settings

    api_key = settings.kie_api_key
    if not api_key:
        return {"error": "KIE_API_KEY не настроен"}

    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
    }

    # --- Разбираем входные URL (image-to-image) ---
    input_urls: list[str] = []
    if files_url and files_url.strip():
        input_urls = [u.strip() for u in files_url.split(",") if u.strip()]
        input_urls = input_urls[:16]  # kie.ai допускает не более 16

    # --- Выбор модели и параметров ---
    if input_urls:
        model = "gpt-image-2-image-to-image"
        input_params: dict = {"prompt": prompt, "input_urls": input_urls}
    else:
        model = "gpt-image-2-text-to-image"
        input_params = {"prompt": prompt}

    if aspect_ratio and aspect_ratio != "auto":
        input_params["aspect_ratio"] = aspect_ratio

    payload = {"model": model, "input": input_params}

    # --- Создание задачи ---
    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            r = await client.post(
                f"{KIE_BASE_URL}/jobs/createTask",
                json=payload,
                headers=headers,
            )
            r.raise_for_status()
            response = r.json()

    except httpx.HTTPStatusError as e:
        return {"error": f"HTTP {e.response.status_code}: {e.response.text[:200]}"}
    except Exception as e:
        logger.exception("generate_image createTask error: %s", e)
        return {"error": str(e)}

    if response.get("code") != 200:
        return {"error": f"kie.ai: {response.get('msg', 'неизвестная ошибка')} (code={response.get('code')})"}

    task_id = response.get("data", {}).get("taskId")
    if not task_id:
        return {"error": "kie.ai не вернул taskId"}

    logger.info("kie.ai task created: %s, polling...", task_id)

    # --- Ожидание результата через polling ---
    return await _poll(task_id, headers)
