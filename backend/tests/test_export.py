import io

import pdfplumber

SAMPLE_CHART = {
    "A": {"rows": [["1", "4", "5", "1", "5", "/", "/", "/"], ["1", "4", "5", "1", "/", "4", "5", "1"]]},
    "B": {"rows": [["1", "4", "1", "5", "1", "4", "1", "5"], ["1", "4", "1", "5", "1", "4", "5", "1"]]},
}


async def _create_song(client, title):
    resp = await client.post("/api/songs", json={"title": title, "chart": SAMPLE_CHART})
    assert resp.status_code == 201
    return resp.json()["id"]


async def test_export_requires_song_ids(client):
    resp = await client.post("/api/export/mini-comic", json={"song_ids": []})
    assert resp.status_code == 400


async def test_export_missing_song_404(client):
    resp = await client.post("/api/export/mini-comic", json={"song_ids": [999999]})
    assert resp.status_code == 404


async def test_export_returns_pdf(client):
    song_id = await _create_song(client, "Solo Song")
    resp = await client.post("/api/export/mini-comic", json={"song_ids": [song_id]})
    assert resp.status_code == 200
    assert resp.headers["content-type"] == "application/pdf"
    assert resp.content[:4] == b"%PDF"


async def test_export_contains_song_and_capo_sheet(client):
    song_id = await _create_song(client, "Arkansas Traveler")
    resp = await client.post("/api/export/mini-comic", json={"song_ids": [song_id]})

    with pdfplumber.open(io.BytesIO(resp.content)) as pdf:
        text = pdf.pages[0].extract_text()
        assert "Arkansas Traveler" in text
        # The cover and back cover sit in 180-degree-rotated panels, so
        # pdfplumber reads them back character-and-word-reversed.
        assert "Capo Cheat Sheet"[::-1] in text
        assert "Bluegrass Jam"[::-1] in text


async def test_export_multiple_songs_in_id_order(client):
    id1 = await _create_song(client, "First Song")
    id2 = await _create_song(client, "Second Song")

    resp = await client.post("/api/export/mini-comic", json={"song_ids": [id1, id2]})
    with pdfplumber.open(io.BytesIO(resp.content)) as pdf:
        text = pdf.pages[0].extract_text()
        assert "First Song" in text
        assert "Second Song" in text
