import io

import pdfplumber
from reportlab.lib.pagesizes import landscape, letter

from app.services.mini_comic import (
    BACK_COVER_PAGE,
    BOTTOM_ROW_PAGES,
    CONTENT_PAGES,
    COVER_PAGE,
    DEFAULT_BARS,
    GRID_COLS,
    MARGIN_Y,
    SONGS_PER_PANEL,
    TOP_ROW_PAGES,
    build_zine_pdf,
)

PAGE_W, PAGE_H = landscape(letter)
PANEL_W = PAGE_W / GRID_COLS
PANEL_H = (PAGE_H - 2 * MARGIN_Y) / 2

SAMPLE_CHART = {
    "A": {"bars": 8, "rows": [["1"] * 8, ["1"] * 8]},
    "B": {"bars": 8, "rows": [["1"] * 8, ["1"] * 8]},
}


def make_song(title: str) -> dict:
    return {"title": title, "chart": SAMPLE_CHART}


def panel_bbox(row: int, col: int) -> tuple[float, float, float, float]:
    """(x0, x1, top, bottom) of a grid panel in pdfplumber's top-down coordinates."""
    x0 = col * PANEL_W
    x1 = x0 + PANEL_W
    if row == 0:
        top, bottom = MARGIN_Y, MARGIN_Y + PANEL_H
    else:
        top, bottom = MARGIN_Y + PANEL_H, MARGIN_Y + 2 * PANEL_H
    return x0, x1, top, bottom


def word_in_panel(word: dict, row: int, col: int) -> bool:
    x0, x1, top, bottom = panel_bbox(row, col)
    cx = (word["x0"] + word["x1"]) / 2
    cy = (word["top"] + word["bottom"]) / 2
    return x0 <= cx <= x1 and top <= cy <= bottom


def word_matches(word: dict, expected: str) -> bool:
    # pdfplumber reads our 180-degree-rotated panels (the top row) back
    # character-and-word-reversed, since it lays text out left-to-right in
    # page space without un-rotating it first.
    text = word["text"]
    return text == expected or text == expected[::-1]


def cell_for_page(page_num: int) -> tuple[int, int]:
    if page_num in TOP_ROW_PAGES:
        return 0, TOP_ROW_PAGES.index(page_num)
    return 1, BOTTOM_ROW_PAGES.index(page_num)


def test_page_mapping_covers_all_pages_exactly_once():
    all_pages = list(TOP_ROW_PAGES) + list(BOTTOM_ROW_PAGES)
    assert sorted(all_pages) == list(range(1, 9))


def test_calibrated_mapping_pinned():
    # Regression pin: this exact mapping was solved from a physical
    # print-cut-fold calibration test (see the comment above these
    # constants in mini_comic.py). Don't "fix" a folding complaint by
    # guessing here again — regenerate calibration.pdf, get a fresh
    # fold-and-read report, and re-derive the mapping from that.
    assert TOP_ROW_PAGES == (1, 8, 7, 6)
    assert BOTTOM_ROW_PAGES == (2, 3, 4, 5)


def test_cover_and_back_cover_are_in_rotated_top_row():
    assert COVER_PAGE in TOP_ROW_PAGES
    assert BACK_COVER_PAGE in TOP_ROW_PAGES


def test_single_sheet_for_small_song_count():
    pdf_bytes = build_zine_pdf([make_song("Solo")])
    with pdfplumber.open(io.BytesIO(pdf_bytes)) as pdf:
        assert len(pdf.pages) == 1


def test_multi_sheet_when_songs_exceed_one_sheet_capacity():
    per_sheet = len(CONTENT_PAGES) * SONGS_PER_PANEL
    songs = [make_song(f"Song {i}") for i in range(per_sheet + 1)]
    pdf_bytes = build_zine_pdf(songs)
    with pdfplumber.open(io.BytesIO(pdf_bytes)) as pdf:
        assert len(pdf.pages) == 2


def test_cover_text_lands_in_mapped_panel():
    pdf_bytes = build_zine_pdf([make_song("Solo")])
    with pdfplumber.open(io.BytesIO(pdf_bytes)) as pdf:
        words = pdf.pages[0].extract_words()
        row, col = cell_for_page(COVER_PAGE)
        assert any(word_matches(w, "Bluegrass") and word_in_panel(w, row, col) for w in words)


def test_back_cover_text_lands_in_mapped_panel():
    pdf_bytes = build_zine_pdf([make_song("Solo")])
    with pdfplumber.open(io.BytesIO(pdf_bytes)) as pdf:
        words = pdf.pages[0].extract_words()
        row, col = cell_for_page(BACK_COVER_PAGE)
        assert any(word_matches(w, "Capo") and word_in_panel(w, row, col) for w in words)


def test_first_song_lands_in_first_content_panel():
    pdf_bytes = build_zine_pdf([make_song("UniqueTitleXYZ")])
    with pdfplumber.open(io.BytesIO(pdf_bytes)) as pdf:
        words = pdf.pages[0].extract_words()
        row, col = cell_for_page(CONTENT_PAGES[0])
        assert any(word_matches(w, "UniqueTitleXYZ") and word_in_panel(w, row, col) for w in words)


def test_top_row_rotated_bottom_row_upright():
    # pdfplumber's 'upright' flag only flags sideways (90/270 degree) text,
    # not our 180-degree flip, so detect rotation from the text matrix
    # directly: an upright glyph has a positive x-scale, a 180-rotated one
    # has a negative x-scale.
    pdf_bytes = build_zine_pdf([make_song("Solo")])
    with pdfplumber.open(io.BytesIO(pdf_bytes)) as pdf:
        page = pdf.pages[0]
        x0, x1, top0, bottom0 = panel_bbox(0, 0)
        x0b, x1b, top1, bottom1 = panel_bbox(1, 0)
        # Bound by column as well as row: the fold/cut guide labels can fall
        # within a row's vertical band while sitting in a different column.
        top_row_chars = [
            c for c in page.chars if top0 <= c["top"] <= bottom0 and x0 <= c["x0"] <= x1
        ]
        bottom_row_chars = [
            c for c in page.chars if top1 <= c["top"] <= bottom1 and x0b <= c["x0"] <= x1b
        ]
        assert top_row_chars and all(c["matrix"][0] < 0 for c in top_row_chars)
        assert bottom_row_chars and all(c["matrix"][0] > 0 for c in bottom_row_chars)


def test_blank_template_fills_every_unused_slot():
    pdf_bytes = build_zine_pdf([make_song("Only One")])
    with pdfplumber.open(io.BytesIO(pdf_bytes)) as pdf:
        words = pdf.pages[0].extract_words(extra_attrs=["fontname"])
        total_slots = len(CONTENT_PAGES) * SONGS_PER_PANEL
        # Part labels are standalone bold "A"/"B" words. The Capo Cheat
        # Sheet's Key column also has bare "A"/"B" letters but in a plain
        # (non-bold) font, and the cover's "Bluegrass Jam" is bold but "B"
        # there is part of a larger word, not standalone - so matching whole
        # words in a bold font uniquely picks out the real part labels.
        a_labels = [w for w in words if w["text"] == "A" and "Bold" in w["fontname"]]
        b_labels = [w for w in words if w["text"] == "B" and "Bold" in w["fontname"]]
        assert len(a_labels) == total_slots
        assert len(b_labels) == total_slots


def test_part_labels_indicate_each_part_is_played_twice():
    pdf_bytes = build_zine_pdf([make_song("Only One")])
    with pdfplumber.open(io.BytesIO(pdf_bytes)) as pdf:
        text = pdf.pages[0].extract_text()
        assert "A (x 2)" in text
        assert "B (x 2)" in text


def test_no_table_of_contents_or_badges_on_cover():
    pdf_bytes = build_zine_pdf([make_song("Solo")], booklet_title="My Jam")
    with pdfplumber.open(io.BytesIO(pdf_bytes)) as pdf:
        text = pdf.pages[0].extract_text()
        assert "My Jam" not in text
        assert "Solo" in text


def test_fold_lines_sit_at_true_physical_quarters_so_all_panels_match_width():
    # The 3 interior dashed fold lines must land at exact quarters of the
    # sheet width, not margin-adjusted positions - otherwise the outer two
    # folded panels end up physically wider than the inner two once cut and
    # folded, even though every panel's printed content is margin-safe.
    pdf_bytes = build_zine_pdf([make_song("Solo")])
    full_sheet_height = PAGE_H - 2 * MARGIN_Y
    with pdfplumber.open(io.BytesIO(pdf_bytes)) as pdf:
        lines = pdf.pages[0].lines
        # The 3 interior fold guides are the only vertical lines that run the
        # full sheet height (bar-line dividers inside a panel are much
        # shorter), which uniquely picks them out from the chart content.
        full_height_vertical = [
            l
            for l in lines
            if abs(l["x0"] - l["x1"]) < 0.01 and l["height"] > full_sheet_height - 1
        ]
        xs = sorted({round(l["x0"], 1) for l in full_height_vertical})
        expected = [round(PANEL_W, 1), round(2 * PANEL_W, 1), round(3 * PANEL_W, 1)]
        assert xs == expected


def test_fold_and_cut_guides_are_present_and_visually_distinct():
    pdf_bytes = build_zine_pdf([make_song("Solo")])
    with pdfplumber.open(io.BytesIO(pdf_bytes)) as pdf:
        page = pdf.pages[0]
        text = page.extract_text()
        assert "CUT" in text
        assert "fold" in text
        assert "cut" in text

        lines = page.lines
        fold_widths = [l["linewidth"] for l in lines if l["linewidth"] < 1.0]
        cut_widths = [l["linewidth"] for l in lines if l["linewidth"] >= 1.0]
        # The cut line is drawn solid and thicker than any dashed fold line,
        # so the two are distinguishable even on a black-and-white printer.
        assert fold_widths and cut_widths
        assert min(cut_widths) > max(fold_widths)


def test_blank_template_has_no_placeholder_underline():
    pdf_bytes = build_zine_pdf([])  # no songs -> every content slot is blank
    with pdfplumber.open(io.BytesIO(pdf_bytes)) as pdf:
        page = pdf.pages[0]
        row, col = cell_for_page(CONTENT_PAGES[0])
        x0, x1, top, bottom = panel_bbox(row, col)
        # Shrink the box by a point on each side so the fold-guide line
        # running exactly along the panel's boundary isn't mistaken for
        # content inside it.
        panel_lines = [
            l
            for l in page.lines
            if x0 + 1 <= l["x0"] <= x1 - 1 and top + 1 <= l["top"] <= bottom - 1
        ]
        # Bar lines within a blank part's grid are vertical; a horizontal
        # line here would only be the old placeholder underline, now removed.
        horizontal_lines = [l for l in panel_lines if abs(l["top"] - l["bottom"]) < 0.01]
        assert horizontal_lines == []


def _vertical_line_count_in_panel(pdf_bytes: bytes, row: int, col: int) -> int:
    x0, x1, top, bottom = panel_bbox(row, col)
    with pdfplumber.open(io.BytesIO(pdf_bytes)) as pdf:
        lines = pdf.pages[0].lines
    return len(
        [
            l
            for l in lines
            if x0 - 1 <= l["x0"] <= x1 + 1
            and top - 1 <= l["top"] <= bottom + 1
            and abs(l["x0"] - l["x1"]) < 0.01
        ]
    )


def _boundary_line_count(num_cells: int) -> int:
    # Bar-line dividers are drawn every 2 cells, including both edges.
    return num_cells // 2 + 1


def test_more_bars_draws_more_vertical_bar_lines():
    row, col = cell_for_page(CONTENT_PAGES[0])
    base_song = {
        "title": "Base",
        "chart": {
            "A": {"bars": 8, "rows": [["1"] * 8, ["1"] * 8]},
            "B": {"bars": 8, "rows": [["1"] * 8, ["1"] * 8]},
        },
    }
    wide_song = {
        "title": "Wide",
        "chart": {
            "A": {"bars": 8, "rows": [["1"] * 8, ["1"] * 8]},
            "B": {"bars": 12, "rows": [["1"] * 12, ["1"] * 12]},
        },
    }
    base_count = _vertical_line_count_in_panel(build_zine_pdf([base_song]), row, col)
    wide_count = _vertical_line_count_in_panel(build_zine_pdf([wide_song]), row, col)
    # Going from 8 to 12 bars adds this many boundary lines per row, across B's 2 rows.
    lines_diff = _boundary_line_count(12) - _boundary_line_count(8)
    assert wide_count - base_count == lines_diff * 2


def test_blank_template_defaults_to_eight_bars_worth_of_lines():
    row, col = cell_for_page(CONTENT_PAGES[0])
    count = _vertical_line_count_in_panel(build_zine_pdf([]), row, col)
    # 2 blank song slots per panel * 2 parts * 2 rows * boundary lines for 8 bars.
    assert count == 2 * 2 * 2 * _boundary_line_count(DEFAULT_BARS)
