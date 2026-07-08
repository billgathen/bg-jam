# bg-jam

A webapp for building bluegrass jam chord charts using the Nashville Number
System, and exporting a set of songs as a pocket-sized "mini-comic" booklet
you can print, cut, and fold for a jam session.

## Features

- **Chord chart editor** — enter each song as two parts (A/B), each with a
  first and second ending, in Nashville numbers (`1`–`7`, with optional
  accidentals and qualities like `6m`, `5b7`, `2sus4`) or `/` for a held
  chord. No key is stored — the numbers work in any key.
- **Song library** — save, edit, and delete songs; select any subset for
  export.
- **Mini-comic export** — generates a single-sheet, 8-page PDF booklet (front
  cover, back cover with a capo cheat sheet, and up to 12 songs per sheet)
  designed to be cut and folded into a pocket booklet. Extra sheets are added
  automatically if you select more songs than fit on one.

## Tech stack

- **Backend**: FastAPI, SQLAlchemy (async), Alembic, PostgreSQL, reportlab
  (PDF generation)
- **Frontend**: React + Vite
- **Infra**: Docker Compose
- **Tests**: pytest (backend), Vitest + Testing Library (frontend)

## Getting started

Requires Docker and Docker Compose.

```bash
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env

docker compose up -d --build
docker compose exec backend alembic upgrade head
```

- Frontend: http://localhost:5173
- Backend API docs: http://localhost:8000/docs

## Running tests

```bash
./test.sh
```

Runs the full backend (pytest) and frontend (Vitest) suites inside the
running containers. Run this after every code change. The backend suite
creates and tears down its own `bgjam_test` database, so it's safe to run
alongside your dev data.

## Exporting and folding the mini-comic booklet

Every exported sheet has the fold/cut guide lines printed right on it, along
with a legend in the bottom-left corner:

- **Dashed gray lines** — fold only, never cut. There are three running the
  full height of the sheet (quarter-marks) and two short segments on the
  horizontal center line (to the left and right of the cut).
- **One solid black line**, thicker than the dashed ones and labeled `CUT` —
  this is the only part of the sheet you actually cut, and only through this
  segment. Everything else is fold-only.

To fold it:

1. In the library, select the songs you want and click **Export Mini-Comic**
   to download a PDF.
2. Print it single-sided, landscape, on US Letter paper.
3. Fold **"hot dog" style** (top edge to bottom edge), crease, then unfold.
4. Fold **"hamburger" style** (left edge to right edge), crease, then unfold.
5. Fold hot-dog style again and, while folded, cut along the printed **`CUT`**
   line — a short slit through the middle only, not the whole sheet. Don't
   cut along any of the dashed lines.
6. Unfold completely flat — there's now a short slit in the center.
7. Fold hamburger style again (short way) with the slit along the top.
8. Push the two ends of the folded strip toward each other. The slit pops
   open into a diamond; keep pushing until the four sections collapse into an
   8-page booklet, following the dashed quarter-mark creases. Crease every
   page flat.

The front cover ends up on top and the back cover (with the capo cheat
sheet) on the bottom. If it comes out inside-out, you folded step 7 or 8 the
other way — unfold back to the flat sheet-with-slit and try again in the
other direction.

## Project structure

```
backend/
  app/
    routers/        songs CRUD + export endpoints
    services/        mini_comic.py — PDF booklet generation
    models.py, schemas.py, database.py, config.py
  alembic/           migrations
  tests/             pytest suite
frontend/
  src/
    pages/           SongLibraryPage, SongEditorPage
    components/      Cell, PartGrid
    api.js           backend API client
```
