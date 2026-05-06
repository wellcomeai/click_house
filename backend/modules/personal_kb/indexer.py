import io
import logging

from openai import AsyncOpenAI
from sqlalchemy import delete
from sqlalchemy.ext.asyncio import AsyncSession

from config import settings
from modules.personal_kb.models import KBChunk, KBFile, PersonalNote

logger = logging.getLogger(__name__)

_embed_client = AsyncOpenAI(
    api_key=settings.openrouter_api_key,
    base_url="https://openrouter.ai/api/v1",
)

EMBED_MODEL = "qwen/qwen3-embedding-8b"
CHUNK_WINDOW = 400
CHUNK_OVERLAP = 50
CHUNK_MIN = 20
CHUNK_MAX = 600


def parse_text(file_bytes: bytes, file_type: str) -> str:
    if file_type == "pdf":
        import PyPDF2
        reader = PyPDF2.PdfReader(io.BytesIO(file_bytes))
        pages = []
        for page in reader.pages:
            text = page.extract_text()
            if text:
                pages.append(text)
        return "\n".join(pages)
    elif file_type == "docx":
        from docx import Document
        doc = Document(io.BytesIO(file_bytes))
        return "\n".join(para.text for para in doc.paragraphs if para.text.strip())
    else:
        return file_bytes.decode("utf-8", errors="replace")


def split_into_chunks(text: str) -> list[str]:
    if not text.strip():
        return []
    words = text.split()
    chunks = []
    start = 0
    step = CHUNK_WINDOW - CHUNK_OVERLAP
    while start < len(words):
        end = min(start + CHUNK_WINDOW, len(words))
        chunk_words = words[start:end]
        if len(chunk_words) >= CHUNK_MIN:
            chunk = " ".join(chunk_words[:CHUNK_MAX])
            chunks.append(chunk)
        if end >= len(words):
            break
        start += step
    return chunks


async def get_embedding(text: str) -> list[float] | None:
    try:
        response = await _embed_client.embeddings.create(
            model=EMBED_MODEL,
            input=text[:8000],
        )
        return response.data[0].embedding
    except Exception as e:
        logger.error("Embedding error: %s", e)
        return None


async def index_note(db: AsyncSession, note: PersonalNote) -> None:
    await db.execute(
        delete(KBChunk).where(
            KBChunk.source_type == "note",
            KBChunk.source_id == note.id,
        )
    )

    full_text = f"{note.title}\n\n{note.content}"
    chunks = split_into_chunks(full_text)

    for idx, chunk_text in enumerate(chunks):
        embedding = await get_embedding(chunk_text)
        if embedding is None:
            continue
        db.add(KBChunk(
            user_id=note.user_id,
            source_type="note",
            source_id=note.id,
            source_name=note.title,
            chunk_index=idx,
            chunk_text=chunk_text,
            embedding=embedding,
        ))

    await db.flush()


async def index_file(db: AsyncSession, kb_file: KBFile, file_bytes: bytes) -> None:
    try:
        text = parse_text(file_bytes, kb_file.file_type)
        chunks = split_into_chunks(text)

        await db.execute(
            delete(KBChunk).where(
                KBChunk.source_type == "file",
                KBChunk.source_id == kb_file.id,
            )
        )

        for idx, chunk_text in enumerate(chunks):
            embedding = await get_embedding(chunk_text)
            if embedding is None:
                continue
            db.add(KBChunk(
                user_id=kb_file.user_id,
                source_type="file",
                source_id=kb_file.id,
                source_name=kb_file.original_name,
                chunk_index=idx,
                chunk_text=chunk_text,
                embedding=embedding,
            ))

        kb_file.status = "indexed"
        await db.flush()

    except Exception as e:
        logger.exception("Indexing failed for file %s: %s", kb_file.id, e)
        kb_file.status = "error"
        kb_file.error_message = str(e)[:500]
        await db.flush()
