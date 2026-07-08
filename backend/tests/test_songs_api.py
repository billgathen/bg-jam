SAMPLE_CHART = {
    "A": {"bars": 8, "rows": [["1"] * 8, ["1"] * 8]},
    "B": {"bars": 8, "rows": [["1"] * 8, ["1"] * 8]},
}


async def test_create_song(client):
    resp = await client.post("/api/songs", json={"title": "Arkansas Traveler", "chart": SAMPLE_CHART})
    assert resp.status_code == 201
    body = resp.json()
    assert body["title"] == "Arkansas Traveler"
    assert body["chart"]["A"]["rows"][0][0] == "1"
    assert "id" in body and "created_at" in body and "updated_at" in body


async def test_list_songs(client):
    await client.post("/api/songs", json={"title": "Song One", "chart": SAMPLE_CHART})
    await client.post("/api/songs", json={"title": "Song Two", "chart": SAMPLE_CHART})

    resp = await client.get("/api/songs")
    assert resp.status_code == 200
    titles = {s["title"] for s in resp.json()}
    assert {"Song One", "Song Two"} <= titles


async def test_get_song(client):
    created = (await client.post("/api/songs", json={"title": "Get Me", "chart": SAMPLE_CHART})).json()

    resp = await client.get(f"/api/songs/{created['id']}")
    assert resp.status_code == 200
    assert resp.json()["title"] == "Get Me"


async def test_get_missing_song_404(client):
    resp = await client.get("/api/songs/999999")
    assert resp.status_code == 404


async def test_update_song(client):
    created = (await client.post("/api/songs", json={"title": "Old Title", "chart": SAMPLE_CHART})).json()

    updated_chart = SAMPLE_CHART.copy()
    updated_chart["A"] = {"bars": 8, "rows": [["5"] * 8, ["5"] * 8]}
    resp = await client.put(
        f"/api/songs/{created['id']}", json={"title": "New Title", "chart": updated_chart}
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["title"] == "New Title"
    assert body["chart"]["A"]["rows"][0][0] == "5"


async def test_update_missing_song_404(client):
    resp = await client.put("/api/songs/999999", json={"title": "X", "chart": SAMPLE_CHART})
    assert resp.status_code == 404


async def test_delete_song(client):
    created = (await client.post("/api/songs", json={"title": "Delete Me", "chart": SAMPLE_CHART})).json()

    resp = await client.delete(f"/api/songs/{created['id']}")
    assert resp.status_code == 204

    resp = await client.get(f"/api/songs/{created['id']}")
    assert resp.status_code == 404


async def test_delete_missing_song_404(client):
    resp = await client.delete("/api/songs/999999")
    assert resp.status_code == 404


async def test_create_rejects_invalid_chart(client):
    bad_chart = {"A": {"bars": 8, "rows": [["Am"] * 8, ["1"] * 8]}, "B": SAMPLE_CHART["B"]}
    resp = await client.post("/api/songs", json={"title": "Bad", "chart": bad_chart})
    assert resp.status_code == 422
