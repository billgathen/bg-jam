from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models import Song
from app.schemas import SongCreate, SongOut, SongSummary, SongUpdate

router = APIRouter(prefix="/api/songs", tags=["songs"])


@router.get("", response_model=list[SongSummary])
async def list_songs(db: AsyncSession = Depends(get_db)) -> list[Song]:
    result = await db.execute(select(Song).order_by(Song.title))
    return list(result.scalars().all())


@router.post("", response_model=SongOut, status_code=201)
async def create_song(payload: SongCreate, db: AsyncSession = Depends(get_db)) -> Song:
    song = Song(title=payload.title, chart=payload.chart.model_dump())
    db.add(song)
    await db.commit()
    await db.refresh(song)
    return song


@router.get("/{song_id}", response_model=SongOut)
async def get_song(song_id: int, db: AsyncSession = Depends(get_db)) -> Song:
    song = await db.get(Song, song_id)
    if song is None:
        raise HTTPException(status_code=404, detail="Song not found")
    return song


@router.put("/{song_id}", response_model=SongOut)
async def update_song(
    song_id: int, payload: SongUpdate, db: AsyncSession = Depends(get_db)
) -> Song:
    song = await db.get(Song, song_id)
    if song is None:
        raise HTTPException(status_code=404, detail="Song not found")
    song.title = payload.title
    song.chart = payload.chart.model_dump()
    await db.commit()
    await db.refresh(song)
    return song


@router.delete("/{song_id}", status_code=204)
async def delete_song(song_id: int, db: AsyncSession = Depends(get_db)) -> None:
    song = await db.get(Song, song_id)
    if song is None:
        raise HTTPException(status_code=404, detail="Song not found")
    await db.delete(song)
    await db.commit()
