import os
import httpx
from agents.tools.decorators import tool

OPENROUTER_API_KEY = os.getenv("OPENROUTER_API_KEY")


@tool
async def generate_image(
    prompt: str,
    size: str = "1024x1024",
    style: str = "realistic",
    db=None,
    current_user=None,
) -> dict:
    """
    Генерирует изображение по текстовому описанию через OpenRouter (gpt-5-image).

    Args:
        prompt: описание изображения на любом языке
        size: размер (1024x1024, 1024x1792, 1792x1024)
        style: стиль (realistic, cinematic, blueprint, UI dashboard)

    Returns:
        dict с полем images (список base64 data URL) или error
    """

    url = "https://openrouter.ai/api/v1/chat/completions"

    payload = {
        "model": "openai/gpt-5-image",
        "messages": [
            {
                "role": "user",
                "content": f"{prompt}, style: {style}"
            }
        ],
        "modalities": ["image", "text"],
    }

    headers = {
        "Authorization": f"Bearer {OPENROUTER_API_KEY}",
        "Content-Type": "application/json",
        "HTTP-Referer": "https://clickhouse-irkutsk.onrender.com",
        "X-Title": "ClickHouse Irkutsk",
    }

    try:
        async with httpx.AsyncClient(timeout=120.0) as client:
            response = await client.post(url, json=payload, headers=headers)
            response.raise_for_status()
            data = response.json()

        message = data["choices"][0]["message"]

        # Основной формат — message.images (массив объектов с image_url.url)
        if "images" in message and message["images"]:
            return {
                "images": [img["image_url"]["url"] for img in message["images"]]
            }

        # Запасной вариант — content как список блоков
        if "content" in message and isinstance(message["content"], list):
            images = []
            text_parts = []
            for block in message["content"]:
                if isinstance(block, dict):
                    if block.get("type") == "image_url":
                        images.append(block["image_url"]["url"])
                    elif block.get("type") == "text":
                        text_parts.append(block["text"])
            if images:
                return {"images": images}
            if text_parts:
                return {"text": " ".join(text_parts)}

        # Если content строка
        if "content" in message and isinstance(message["content"], str):
            return {"text": message["content"]}

        return {"error": "Изображение не получено", "raw": str(message)}

    except httpx.HTTPStatusError as e:
        return {"error": f"HTTP ошибка {e.response.status_code}: {e.response.text}"}
    except httpx.TimeoutException:
        return {"error": "Превышено время ожидания генерации изображения (120 сек)"}
    except Exception as e:
        return {"error": f"Ошибка: {str(e)}"}
