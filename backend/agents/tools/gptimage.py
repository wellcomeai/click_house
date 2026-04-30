import os
import httpx
from agents.tools.decorators import tool

OPENROUTER_API_KEY = os.getenv("OPENROUTER_API_KEY")


@tool
async def generate_image(
    prompt: str,
    size: str = "1024x1024",
    style: str = "realistic"
) -> dict:
    """
    Генерирует изображение по текстовому описанию через OpenRouter.

    Args:
        prompt: описание изображения
        size: размер (например 512x512, 1024x1024)
        style: стиль (realistic, cinematic, anime, etc)

    Returns:
        dict с image_url или base64
    """

    url = "https://openrouter.ai/api/v1/chat/completions"

    payload = {
        "model": "openai/gpt-5.4-image-2",  # можно менять
        "messages": [
            {
                "role": "user",
                "content": f"{prompt}, style: {style}"
            }
        ],
        "modalities": ["image", "text"]
    }

    headers = {
        "Authorization": f"Bearer {OPENROUTER_API_KEY}",
        "Content-Type": "application/json"
    }

    async with httpx.AsyncClient(timeout=60) as client:
        response = await client.post(url, json=payload, headers=headers)
        response.raise_for_status()
        data = response.json()

    try:
        message = data["choices"][0]["message"]

        # вариант 1 — image_url
        if "images" in message:
            images = message["images"]
            return {
                "images": [img["image_url"]["url"] for img in images]
            }

        # вариант 2 — base64 fallback
        if "content" in message:
            return {"raw": message["content"]}

        return {"error": "No image returned"}

    except Exception as e:
        return {"error": f"Parse error: {str(e)}"}
