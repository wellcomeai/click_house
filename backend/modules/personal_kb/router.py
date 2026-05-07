import asyncio
import json
import logging
import uuid
from datetime import datetime, timezone
from typing import Annotated

from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile
from fastapi.responses import StreamingResponse
from sqlalchemy import delete, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from database import AsyncSessionLocal, get_db
from dependencies import get_current_user
from modules.files.r2_service import delete_file as r2_delete
from modules.files.r2_service import upload_file as r2_upload
from modules.personal_kb.indexer import get_embedding, index_file, index_note
from modules.personal_kb.llm import stream_answer
from modules.personal_kb.models import (
    AssistantChatHistory,
    ChatSession,
    KBChunk,
    KBFile,
    PersonalNote,
)
from modules.personal_kb.schemas import (
    ChatHistoryItem,
    ChatRequest,
    ChatSessionCreate,
    ChatSessionResponse,
    ChatSessionUpdate,
    ChunkPreview,
    KBFileResponse,
    KBStats,
    NoteCreate,
    NoteDetail,
    NoteListItem,
    NoteUpdate,
)
from modules.personal_kb.search import search_kb

logger = logging.getLogger(__name__)
router = APIRouter()

ALLOWED_TYPES = {"pdf", "docx", "txt", "md"}
MAX_FILE_SIZE = 100 * 1024 * 1024  # 100 MB


# ── Notes ──────────────────────────────────────────────────────────────────


@router.post("/notes", response_model=NoteDetail, status_code=201)
async def create_note(
    data: NoteCreate,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user=Depends(get_current_user),
):
    note = PersonalNote(
        user_id=current_user.id,
        title=data.title,
        content=data.content,
    )
    db.add(note)
    await db.flush()
    await index_note(db, note)
    await db.commit()
    await db.refresh(note)
    return note


@router.get("/notes", response_model=list[NoteListItem])
async def list_notes(
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user=Depends(get_current_user),
):
    result = await db.execute(
        select(PersonalNote)
        .where(PersonalNote.user_id == current_user.id)
        .order_by(PersonalNote.updated_at.desc())
    )
    return result.scalars().all()


@router.get("/notes/{note_id}", response_model=NoteDetail)
async def get_note(
    note_id: uuid.UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user=Depends(get_current_user),
):
    result = await db.execute(
        select(PersonalNote).where(
            PersonalNote.id == note_id,
            PersonalNote.user_id == current_user.id,
        )
    )
    note = result.scalar_one_or_none()
    if not note:
        raise HTTPException(status_code=404, detail="Заметка не найдена")
    return note


@router.put("/notes/{note_id}", response_model=NoteDetail)
async def update_note(
    note_id: uuid.UUID,
    data: NoteUpdate,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user=Depends(get_current_user),
):
    result = await db.execute(
        select(PersonalNote).where(
            PersonalNote.id == note_id,
            PersonalNote.user_id == current_user.id,
        )
    )
    note = result.scalar_one_or_none()
    if not note:
        raise HTTPException(status_code=404, detail="Заметка не найдена")
    if data.title is not None:
        note.title = data.title
    if data.content is not None:
        note.content = data.content
    note.updated_at = datetime.now(timezone.utc)
    await index_note(db, note)
    await db.commit()
    await db.refresh(note)
    return note


@router.delete("/notes/{note_id}", status_code=204)
async def delete_note(
    note_id: uuid.UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user=Depends(get_current_user),
):
    result = await db.execute(
        select(PersonalNote).where(
            PersonalNote.id == note_id,
            PersonalNote.user_id == current_user.id,
        )
    )
    note = result.scalar_one_or_none()
    if not note:
        raise HTTPException(status_code=404, detail="Заметка не найдена")
    await db.execute(
        delete(KBChunk).where(
            KBChunk.source_type == "note",
            KBChunk.source_id == note_id,
        )
    )
    await db.delete(note)
    await db.commit()


# ── Files ──────────────────────────────────────────────────────────────────


@router.post("/files", response_model=KBFileResponse, status_code=201)
async def upload_kb_file(
    file: Annotated[UploadFile, File()],
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user=Depends(get_current_user),
):
    filename = file.filename or "file"
    ext = filename.rsplit(".", 1)[-1].lower() if "." in filename else ""
    if ext not in ALLOWED_TYPES:
        raise HTTPException(
            status_code=400,
            detail=f"Тип файла не поддерживается: .{ext}. Разрешены: PDF, DOCX, TXT, MD",
        )

    file_bytes = await file.read()
    if len(file_bytes) > MAX_FILE_SIZE:
        raise HTTPException(status_code=413, detail="Файл превышает лимит 100 МБ")

    r2_result = await r2_upload(
        file_bytes=file_bytes,
        original_name=filename,
        content_type=file.content_type or "application/octet-stream",
        folder=f"kb/{current_user.id}",
    )

    kb_file = KBFile(
        user_id=current_user.id,
        original_name=filename,
        storage_key=r2_result["storage_key"],
        public_url=r2_result["public_url"],
        file_type=ext,
        size_bytes=len(file_bytes),
        status="processing",
    )
    db.add(kb_file)
    await db.commit()
    await db.refresh(kb_file)

    file_id = kb_file.id
    captured_bytes = file_bytes

    async def _index_in_background():
        async with AsyncSessionLocal() as bg_db:
            try:
                res = await bg_db.execute(select(KBFile).where(KBFile.id == file_id))
                kb_f = res.scalar_one_or_none()
                if kb_f:
                    await index_file(bg_db, kb_f, captured_bytes)
                    await bg_db.commit()
            except Exception as e:
                logger.exception("Background indexing error for file %s: %s", file_id, e)

    asyncio.create_task(_index_in_background())
    return kb_file


@router.get("/files", response_model=list[KBFileResponse])
async def list_kb_files(
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user=Depends(get_current_user),
):
    result = await db.execute(
        select(KBFile)
        .where(KBFile.user_id == current_user.id)
        .order_by(KBFile.created_at.desc())
    )
    return result.scalars().all()


@router.delete("/files/{file_id}", status_code=204)
async def delete_kb_file(
    file_id: uuid.UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user=Depends(get_current_user),
):
    result = await db.execute(
        select(KBFile).where(
            KBFile.id == file_id,
            KBFile.user_id == current_user.id,
        )
    )
    kb_file = result.scalar_one_or_none()
    if not kb_file:
        raise HTTPException(status_code=404, detail="Файл не найден")

    try:
        await r2_delete(kb_file.storage_key)
    except Exception as e:
        logger.warning("R2 delete failed for %s: %s", kb_file.storage_key, e)

    await db.execute(
        delete(KBChunk).where(
            KBChunk.source_type == "file",
            KBChunk.source_id == file_id,
        )
    )
    await db.delete(kb_file)
    await db.commit()


# ── Chunks ─────────────────────────────────────────────────────────────────


@router.get("/chunks", response_model=list[ChunkPreview])
async def list_chunks(
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user=Depends(get_current_user),
    source_type: str = Query(default="all"),
):
    q = select(KBChunk).where(KBChunk.user_id == current_user.id)
    if source_type in ("note", "file"):
        q = q.where(KBChunk.source_type == source_type)
    q = q.order_by(KBChunk.created_at.desc())
    result = await db.execute(q)
    chunks = result.scalars().all()
    return [
        ChunkPreview(
            id=c.id,
            source_type=c.source_type,
            source_name=c.source_name,
            chunk_index=c.chunk_index,
            chunk_text_preview=c.chunk_text[:300],
            created_at=c.created_at,
        )
        for c in chunks
    ]


# ── Stats ──────────────────────────────────────────────────────────────────


@router.get("/stats", response_model=KBStats)
async def get_stats(
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user=Depends(get_current_user),
):
    uid = current_user.id
    notes_count = (
        await db.execute(
            select(func.count()).select_from(PersonalNote).where(PersonalNote.user_id == uid)
        )
    ).scalar_one()
    files_count = (
        await db.execute(
            select(func.count()).select_from(KBFile).where(KBFile.user_id == uid)
        )
    ).scalar_one()
    chunks_count = (
        await db.execute(
            select(func.count()).select_from(KBChunk).where(KBChunk.user_id == uid)
        )
    ).scalar_one()
    total_size = (
        await db.execute(
            select(func.coalesce(func.sum(KBFile.size_bytes), 0)).where(
                KBFile.user_id == uid
            )
        )
    ).scalar_one()
    return KBStats(
        notes_count=notes_count,
        files_count=files_count,
        chunks_count=chunks_count,
        total_size_bytes=int(total_size),
    )


# ── Sessions ───────────────────────────────────────────────────────────────


@router.post("/sessions", response_model=ChatSessionResponse, status_code=201)
async def create_session(
    data: ChatSessionCreate,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user=Depends(get_current_user),
):
    session = ChatSession(
        user_id=current_user.id,
        title=data.title or "Новый чат",
    )
    db.add(session)
    await db.commit()
    await db.refresh(session)
    return ChatSessionResponse(
        id=session.id,
        title=session.title,
        created_at=session.created_at,
        updated_at=session.updated_at,
        last_message=None,
        message_count=0,
    )


@router.get("/sessions", response_model=list[ChatSessionResponse])
async def list_sessions(
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user=Depends(get_current_user),
):
    sessions_result = await db.execute(
        select(ChatSession)
        .where(ChatSession.user_id == current_user.id)
        .order_by(ChatSession.updated_at.desc())
    )
    sessions = sessions_result.scalars().all()

    response = []
    for s in sessions:
        count_row = await db.execute(
            select(func.count()).select_from(AssistantChatHistory).where(
                AssistantChatHistory.session_id == s.id
            )
        )
        message_count = count_row.scalar_one()

        last_msg_row = await db.execute(
            select(AssistantChatHistory)
            .where(AssistantChatHistory.session_id == s.id)
            .order_by(AssistantChatHistory.created_at.desc())
            .limit(1)
        )
        last_msg = last_msg_row.scalar_one_or_none()

        response.append(
            ChatSessionResponse(
                id=s.id,
                title=s.title,
                created_at=s.created_at,
                updated_at=s.updated_at,
                last_message=last_msg.content[:100] if last_msg else None,
                message_count=message_count,
            )
        )
    return response


@router.put("/sessions/{session_id}", response_model=ChatSessionResponse)
async def rename_session(
    session_id: uuid.UUID,
    data: ChatSessionUpdate,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user=Depends(get_current_user),
):
    result = await db.execute(
        select(ChatSession).where(
            ChatSession.id == session_id,
            ChatSession.user_id == current_user.id,
        )
    )
    session = result.scalar_one_or_none()
    if not session:
        raise HTTPException(status_code=404, detail="Сессия не найдена")
    session.title = data.title
    session.updated_at = datetime.now(timezone.utc)
    await db.commit()
    await db.refresh(session)
    return ChatSessionResponse(
        id=session.id,
        title=session.title,
        created_at=session.created_at,
        updated_at=session.updated_at,
        last_message=None,
        message_count=0,
    )


@router.delete("/sessions/{session_id}", status_code=204)
async def delete_session(
    session_id: uuid.UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user=Depends(get_current_user),
):
    result = await db.execute(
        select(ChatSession).where(
            ChatSession.id == session_id,
            ChatSession.user_id == current_user.id,
        )
    )
    session = result.scalar_one_or_none()
    if not session:
        raise HTTPException(status_code=404, detail="Сессия не найдена")
    await db.delete(session)
    await db.commit()


# ── Chat ───────────────────────────────────────────────────────────────────


@router.post("/chat")
async def chat(
    request: ChatRequest,
    current_user=Depends(get_current_user),
):
    async def generate():
        async with AsyncSessionLocal() as db:
            try:
                # Resolve or create session
                session_id = request.session_id
                if not request.skip_history:
                    if session_id is not None:
                        sess_result = await db.execute(
                            select(ChatSession).where(
                                ChatSession.id == session_id,
                                ChatSession.user_id == current_user.id,
                            )
                        )
                        session = sess_result.scalar_one_or_none()
                        if not session:
                            session_id = None
                    if session_id is None:
                        session = ChatSession(
                            user_id=current_user.id,
                            title="Новый чат",
                        )
                        db.add(session)
                        await db.flush()
                        session_id = session.id

                    # Send session_id as first SSE event
                    yield f"data: {json.dumps({'type': 'session_id', 'session_id': str(session_id)}, ensure_ascii=False)}\n\n"

                query_embedding = await get_embedding(request.message)
                if query_embedding is None:
                    yield f"data: {json.dumps({'type': 'error', 'content': 'Не удалось создать эмбеддинг запроса'}, ensure_ascii=False)}\n\n"
                    yield "data: [DONE]\n\n"
                    return

                chunks = await search_kb(db, current_user.id, query_embedding, k=5)

                history_rows = (
                    await db.execute(
                        select(AssistantChatHistory)
                        .where(
                            AssistantChatHistory.user_id == current_user.id,
                            AssistantChatHistory.session_id == session_id,
                        )
                        .order_by(AssistantChatHistory.created_at.desc())
                        .limit(20)
                    )
                ).scalars().all()
                history = [
                    {"role": r.role, "content": r.content}
                    for r in reversed(history_rows)
                ]

                if not request.skip_history:
                    # Auto-update title if session title is still default and this is the first message
                    if session_id is not None and len(history_rows) == 0:
                        sess_result = await db.execute(
                            select(ChatSession).where(ChatSession.id == session_id)
                        )
                        session_obj = sess_result.scalar_one_or_none()
                        if session_obj and session_obj.title == "Новый чат":
                            session_obj.title = request.message[:60]
                            session_obj.updated_at = datetime.now(timezone.utc)

                    db.add(
                        AssistantChatHistory(
                            user_id=current_user.id,
                            session_id=session_id,
                            role="user",
                            content=request.message,
                        )
                    )
                    await db.flush()

                full_response: list[str] = []
                async for sse_line in stream_answer(request.message, history, chunks):
                    yield sse_line
                    if sse_line.startswith("data: ") and "[DONE]" not in sse_line:
                        try:
                            payload = json.loads(sse_line[6:])
                            if payload.get("type") == "text":
                                full_response.append(payload["content"])
                        except Exception:
                            pass

                if full_response and not request.skip_history:
                    db.add(
                        AssistantChatHistory(
                            user_id=current_user.id,
                            session_id=session_id,
                            role="assistant",
                            content="".join(full_response),
                        )
                    )
                    if session_id is not None:
                        sess_result = await db.execute(
                            select(ChatSession).where(ChatSession.id == session_id)
                        )
                        session_obj = sess_result.scalar_one_or_none()
                        if session_obj:
                            session_obj.updated_at = datetime.now(timezone.utc)
                    await db.commit()

            except Exception as e:
                logger.exception("Chat endpoint error: %s", e)
                yield f"data: {json.dumps({'type': 'error', 'content': str(e)}, ensure_ascii=False)}\n\n"
                yield "data: [DONE]\n\n"

    return StreamingResponse(
        generate(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
            "Connection": "keep-alive",
        },
    )


@router.get("/chat/history", response_model=list[ChatHistoryItem])
async def get_chat_history(
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user=Depends(get_current_user),
    session_id: uuid.UUID | None = Query(default=None),
    limit: int = Query(default=50, le=200),
):
    q = (
        select(AssistantChatHistory)
        .where(AssistantChatHistory.user_id == current_user.id)
        .order_by(AssistantChatHistory.created_at.asc())
        .limit(limit)
    )
    if session_id is not None:
        q = q.where(AssistantChatHistory.session_id == session_id)
    result = await db.execute(q)
    return result.scalars().all()


@router.delete("/chat/history", status_code=204)
async def clear_chat_history(
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user=Depends(get_current_user),
):
    await db.execute(
        delete(AssistantChatHistory).where(
            AssistantChatHistory.user_id == current_user.id
        )
    )
    await db.commit()
