import uuid
from dataclasses import dataclass

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession


@dataclass
class SearchResult:
    id: int
    source_type: str
    source_name: str
    chunk_index: int
    chunk_text: str
    similarity: float


async def search_kb(
    db: AsyncSession,
    user_id: uuid.UUID,
    query_embedding: list[float],
    k: int = 5,
) -> list[SearchResult]:
    vec_str = "[" + ",".join(str(v) for v in query_embedding) + "]"

    rows = await db.execute(
        text("""
            SELECT id, source_type, source_name, chunk_index, chunk_text,
                   1 - (embedding <=> CAST(:vec AS vector)) AS similarity
            FROM kb_chunks
            WHERE user_id = CAST(:uid AS uuid)
              AND embedding IS NOT NULL
            ORDER BY embedding <=> CAST(:vec AS vector)
            LIMIT :k
        """),
        {"uid": str(user_id), "vec": vec_str, "k": k},
    )
    return [
        SearchResult(
            id=row.id,
            source_type=row.source_type,
            source_name=row.source_name,
            chunk_index=row.chunk_index,
            chunk_text=row.chunk_text,
            similarity=float(row.similarity),
        )
        for row in rows
    ]
