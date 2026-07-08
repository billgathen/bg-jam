from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import Response
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models import Song
from app.schemas import ExportRequest
from app.services.mini_comic import build_zine_pdf

router = APIRouter(prefix="/api/export", tags=["export"])


@router.post("/mini-comic")
async def export_mini_comic(
    payload: ExportRequest, db: AsyncSession = Depends(get_db)
) -> Response:
    if not payload.song_ids:
        raise HTTPException(status_code=400, detail="No songs selected")

    result = await db.execute(select(Song).where(Song.id.in_(payload.song_ids)))
    songs_by_id = {s.id: s for s in result.scalars().all()}
    missing = [sid for sid in payload.song_ids if sid not in songs_by_id]
    if missing:
        raise HTTPException(status_code=404, detail=f"Songs not found: {missing}")

    ordered_songs = [
        {"title": songs_by_id[sid].title, "chart": songs_by_id[sid].chart}
        for sid in payload.song_ids
    ]
    pdf_bytes = build_zine_pdf(ordered_songs, booklet_title=payload.booklet_title)

    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": 'attachment; filename="mini-comic.pdf"'},
    )
