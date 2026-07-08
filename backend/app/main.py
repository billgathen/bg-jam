from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.routers import export, songs

app = FastAPI(title="bg-jam")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(songs.router)
app.include_router(export.router)


@app.get("/api/health")
async def health() -> dict[str, str]:
    return {"status": "ok"}
