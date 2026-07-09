import re
from datetime import date
from io import BytesIO
from pathlib import Path

from reportlab.lib.pagesizes import landscape, letter
from reportlab.lib.units import inch
from reportlab.pdfgen import canvas

LOGO_PATH = Path(__file__).resolve().parent.parent / "assets" / "switchback-logo.png"

CELL_RE = re.compile(r"^([1-7])(.*)$")
# Bar-line dividers are drawn every 2 cells; a part's "bars" value is its
# row's cell count directly (not bars * CELLS_PER_BAR) - see schemas.py.
CELLS_PER_BAR = 2
DEFAULT_BARS = 8
DEFAULT_ROW_LENGTH = DEFAULT_BARS
GRAY = (0.55, 0.55, 0.55)
DARK = (0.1, 0.1, 0.1)

MARGIN_Y = 0.3 * inch
# Column boundaries sit at true quarters of the sheet width (no outer-edge-only
# margin), so every folded panel - outer and inner alike - is physically the
# same width. PANEL_INSET_X is then applied as content padding on *both* sides
# of every panel, including interior fold lines, not just the two physical
# sheet edges: that keeps content clear of the printer's unprintable area on
# the outer edges while giving inner panels an equal gutter at their fold
# lines, rather than shrinking only the outer two panels.
PANEL_INSET_X = 0.5 * inch
PANEL_PADDING = 0.09 * inch
LEGEND_MARGIN = 0.15 * inch
# 1 CSS rem (16px) at the standard 96px/inch, converted to PDF points.
REM = (16 / 96) * inch
TITLE_WIDTH_OVERHANG = 0.5 * REM
GRID_COLS = 4
GRID_ROWS = 2
SONGS_PER_PANEL = 2

# Single-sheet, 8-page, one-cut zine imposition. Solved directly from a
# calibration print (each grid cell labeled with its row/col identity,
# folded, and read back page-by-page), which gave the exact fold
# permutation: T1->pg1, B1->pg2, B2->pg3, B3->pg4, B4->pg5, T4->pg6,
# T3->pg7, T2->pg8. Top row is rotated 180 degrees; bottom row is upright.
TOP_ROW_PAGES = (1, 8, 7, 6)
BOTTOM_ROW_PAGES = (2, 3, 4, 5)
COVER_PAGE = 1
BACK_COVER_PAGE = 8
CONTENT_PAGES = (2, 3, 4, 5, 6, 7)

CAPO_CHEAT_SHEET = (
    ("A", "2", "G"),
    ("B", "4", "G"),
    ("C", "none", "C"),
    ("D", "2", "C"),
    ("E", "4", "C"),
    ("F", "5", "C"),
    ("G", "none", "G"),
)

NASHVILLE_NUMBER_TABLE = (
    ("1", "G", "C"),
    ("2m", "Am", "Dm"),
    ("3m", "Bm", "Em"),
    ("4", "C", "F"),
    ("5", "D", "G"),
    ("6m", "Em", "Am"),
    ("7b", "F", "B"),
)


def _title_h(block_h: float) -> float:
    return block_h * 0.15


def _part_h(block_h: float) -> float:
    return (block_h - _title_h(block_h)) / 2


def _row_h(part_h: float) -> float:
    return (part_h * 0.85) / 2


def _fit_font_size(c: canvas.Canvas, text: str, font_name: str, max_size: float, max_width: float, min_size: float = 5.0) -> float:
    size = max_size
    while size > min_size and c.stringWidth(text, font_name, size) > max_width:
        size -= 0.5
    return size


def _draw_cell_token(c: canvas.Canvas, cx: float, cy: float, token: str, row_h: float) -> None:
    if token == "":
        return  # completely blank padding bar - nothing to draw
    if token == "/":
        c.setStrokeColorRGB(*GRAY)
        c.setLineWidth(max(row_h * 0.05, 0.6))
        c.setLineCap(1)
        dx, dy = row_h * 0.14, row_h * 0.32
        c.line(cx - dx, cy - dy, cx + dx, cy + dy)
        return

    match = CELL_RE.match(token)
    base, suffix = (match.group(1), match.group(2)) if match else (token, "")
    base_font = row_h * 0.55
    c.setFillColorRGB(*DARK)
    c.setFont("Helvetica-Bold", base_font)
    base_w = c.stringWidth(base, "Helvetica-Bold", base_font)

    if not suffix:
        c.drawCentredString(cx, cy - base_font * 0.35, base)
        return

    suffix_font = base_font * 0.45
    suffix_w = c.stringWidth(suffix, "Helvetica-Bold", suffix_font)
    start_x = cx - (base_w + suffix_w) / 2
    baseline_y = cy - base_font * 0.35
    c.drawString(start_x, baseline_y, base)
    c.setFont("Helvetica-Bold", suffix_font)
    if "7" in suffix:
        c.drawString(start_x + base_w, baseline_y + base_font * 0.35, suffix)
    else:
        c.drawString(start_x + base_w, baseline_y - suffix_font * 0.05, suffix)


def _draw_row(
    c: canvas.Canvas, x: float, y: float, w: float, h: float, cells: list[str] | None, num_cells: int
) -> None:
    cell_w = w / num_cells
    c.setStrokeColorRGB(*GRAY)
    c.setLineWidth(0.75)
    for boundary in range(0, num_cells + 1, CELLS_PER_BAR):
        lx = x + boundary * cell_w
        c.line(lx, y, lx, y + h)
    if cells is None:
        return
    for i, token in enumerate(cells):
        _draw_cell_token(c, x + (i + 0.5) * cell_w, y + h / 2, token, h)


def _draw_part(c: canvas.Canvas, x: float, y: float, w: float, h: float, label: str, part: dict | None) -> None:
    label_h = h * 0.15
    row_h = _row_h(h)
    label_font = label_h * 0.6

    c.setFillColorRGB(*DARK)
    c.setFont("Helvetica-Bold", label_font * 1.3)
    c.drawString(x, y + h - label_h * 0.7, label)

    if part:
        rows = part["rows"]
        num_cells = len(rows[0])
    else:
        rows = (None, None)
        num_cells = DEFAULT_ROW_LENGTH

    _draw_row(c, x, y + h - label_h - row_h, w, row_h, rows[0], num_cells)
    _draw_row(c, x, y + h - label_h - 2 * row_h, w, row_h, rows[1], num_cells)


def _draw_song_block(c: canvas.Canvas, x: float, y: float, w: float, h: float, song: dict | None) -> None:
    title_h = _title_h(h)
    part_h = _part_h(h)

    if song is None:
        _draw_part(c, x, y + part_h, w, part_h, "A part (x 2)", None)
        _draw_part(c, x, y, w, part_h, "B part (x 2)", None)
        return

    max_title_font = title_h * 0.65
    # Let a long title use the same full width as the chord grid below it -
    # plus a little overhang on each side - before shrinking the font,
    # rather than shrinking early to stay inside a narrower band.
    title_font = _fit_font_size(
        c, song["title"], "Helvetica-Bold", max_title_font, w + 2 * TITLE_WIDTH_OVERHANG
    )

    c.setFillColorRGB(*DARK)
    c.setFont("Helvetica-Bold", title_font)
    c.drawCentredString(x + w / 2, y + h - title_h * 0.75, song["title"])

    _draw_part(c, x, y + part_h, w, part_h, "A part (x 2)", song["chart"]["A"])
    _draw_part(c, x, y, w, part_h, "B part (x 2)", song["chart"]["B"])


def _draw_cover(c: canvas.Canvas, x: float, y: float, w: float, h: float) -> None:
    max_width = w * 0.9
    logo_h = h * 0.5
    if LOGO_PATH.exists():
        c.drawImage(
            str(LOGO_PATH),
            x + w / 2,
            y + h - logo_h / 2,
            width=w * 0.85,
            height=logo_h * 0.9,
            preserveAspectRatio=True,
            anchor="c",
            anchorAtXY=True,
            mask="auto",
        )

    c.setFillColorRGB(*DARK)
    line1_font = _fit_font_size(c, "Bluegrass Jam", "Helvetica-Bold", h * 0.09, max_width)
    c.setFont("Helvetica-Bold", line1_font)
    c.drawCentredString(x + w / 2, y + h * 0.32, "Bluegrass Jam")

    line2_font = _fit_font_size(c, "Chord Charts", "Helvetica", h * 0.065, max_width)
    c.setFont("Helvetica", line2_font)
    c.drawCentredString(x + w / 2, y + h * 0.32 - line1_font * 1.3, "Chord Charts")


def _draw_table(
    c: canvas.Canvas, x: float, y: float, w: float, h: float, title: str, header: tuple, data_rows: tuple
) -> None:
    title_h = h * 0.2
    c.setFillColorRGB(*DARK)
    title_font = _fit_font_size(c, title, "Helvetica-Bold", title_h * 0.55, w * 0.94)
    c.setFont("Helvetica-Bold", title_font)
    c.drawCentredString(x + w / 2, y + h - title_h * 0.7, title)

    rows = (header, *data_rows)
    table_h = h - title_h
    table_top = y + table_h
    row_h = table_h / len(rows)
    col_w = w / 3

    c.setStrokeColorRGB(*GRAY)
    c.setLineWidth(0.5)
    for i in range(len(rows) + 1):
        ly = table_top - i * row_h
        c.line(x, ly, x + w, ly)
    for i in range(4):
        lx = x + i * col_w
        c.line(lx, y, lx, table_top)

    cell_font = row_h * 0.45
    for r, row in enumerate(rows):
        font_name = "Helvetica-Bold" if r == 0 else "Helvetica"
        c.setFillColorRGB(*DARK)
        c.setFont(font_name, cell_font)
        cy = table_top - (r + 0.5) * row_h - cell_font * 0.35
        for ci, text in enumerate(row):
            c.drawCentredString(x + ci * col_w + col_w / 2, cy, text)


def _draw_back_cover(c: canvas.Canvas, x: float, y: float, w: float, h: float) -> None:
    _draw_table(c, x, y + h / 2, w, h / 2, "Capo Cheat Sheet", ("Key", "Capo", "Play"), CAPO_CHEAT_SHEET)
    _draw_table(c, x, y, w, h / 2, "Nashville Numbers", ("Number", "G", "C"), NASHVILLE_NUMBER_TABLE)


def _draw_panel(c: canvas.Canvas, x: float, y: float, w: float, h: float, rotated: bool, draw_fn) -> None:
    # Inset the content from the panel's true edges (which double as fold/cut
    # lines) so nothing sits right on a crease once folded, and so outer
    # panels aren't printer-clipped. pad_x is applied on both sides of every
    # panel - interior fold lines included - so all panels end up the same
    # physical width once folded; see PANEL_INSET_X.
    pad_x, pad_y = PANEL_INSET_X, PANEL_PADDING
    c.saveState()
    if rotated:
        c.translate(x + w / 2, y + h / 2)
        c.rotate(180)
        draw_fn(c, -w / 2 + pad_x, -h / 2 + pad_y, w - 2 * pad_x, h - 2 * pad_y)
    else:
        draw_fn(c, x + pad_x, y + pad_y, w - 2 * pad_x, h - 2 * pad_y)
    c.restoreState()


def _draw_fold_and_cut_guides(c: canvas.Canvas, page_w: float, page_h: float, panel_w: float, panel_h: float) -> None:
    # Fold lines sit at the sheet's true physical quarters/edges (panel_w is
    # no longer margin-adjusted), independent of the content-inset margins
    # applied inside each panel by _draw_panel.
    left, right = 0.0, page_w
    bottom, top = MARGIN_Y, page_h - MARGIN_Y
    mid_y = MARGIN_Y + panel_h
    col_xs = [i * panel_w for i in (1, 2, 3)]

    c.saveState()
    c.setStrokeColorRGB(*GRAY)
    c.setLineWidth(0.5)
    c.setDash([3, 3])
    for x in col_xs:
        c.line(x, bottom, x, top)
    c.line(left, mid_y, col_xs[0], mid_y)
    c.line(col_xs[2], mid_y, right, mid_y)
    c.restoreState()

    c.saveState()
    c.setStrokeColorRGB(*DARK)
    c.setLineWidth(1.2)
    c.line(col_xs[0], mid_y, col_xs[2], mid_y)
    c.setFont("Helvetica-Bold", 6)
    c.setFillColorRGB(*DARK)
    c.drawCentredString((col_xs[0] + col_xs[2]) / 2, mid_y + 3, "CUT")
    c.restoreState()

    c.saveState()
    legend_x = LEGEND_MARGIN
    legend_y = bottom * 0.4
    c.setStrokeColorRGB(*GRAY)
    c.setLineWidth(0.5)
    c.setDash([3, 3])
    c.line(legend_x, legend_y, legend_x + 14, legend_y)
    c.setFont("Helvetica", 6)
    c.setFillColorRGB(*GRAY)
    c.drawString(legend_x + 18, legend_y - 2, "fold")

    cut_swatch_x = legend_x + 55
    c.setStrokeColorRGB(*DARK)
    c.setLineWidth(1.2)
    c.setDash([])
    c.line(cut_swatch_x, legend_y, cut_swatch_x + 14, legend_y)
    c.setFillColorRGB(*DARK)
    c.drawString(cut_swatch_x + 18, legend_y - 2, "cut")
    c.restoreState()


def build_zine_pdf(songs: list[dict], booklet_title: str | None = None) -> bytes:
    buf = BytesIO()
    page_w, page_h = landscape(letter)
    c = canvas.Canvas(buf, pagesize=(page_w, page_h))

    panel_w = page_w / GRID_COLS
    panel_h = (page_h - 2 * MARGIN_Y) / GRID_ROWS
    per_sheet = len(CONTENT_PAGES) * SONGS_PER_PANEL

    title = booklet_title or f"Jam Songs — {date.today().isoformat()}"
    c.setTitle(title)
    sheets = [songs[i : i + per_sheet] for i in range(0, max(len(songs), 1), per_sheet)]

    for sheet_songs in sheets:
        page_content: dict[int, tuple] = {
            COVER_PAGE: ("cover", None),
            BACK_COVER_PAGE: ("back", None),
        }
        idx = 0
        for page_num in CONTENT_PAGES:
            chunk = sheet_songs[idx : idx + SONGS_PER_PANEL]
            idx += SONGS_PER_PANEL
            padded = chunk + [None] * (SONGS_PER_PANEL - len(chunk))
            page_content[page_num] = ("songs", padded)

        for row, page_order in ((0, TOP_ROW_PAGES), (1, BOTTOM_ROW_PAGES)):
            y = MARGIN_Y + panel_h if row == 0 else MARGIN_Y
            rotated = row == 0
            for col, page_num in enumerate(page_order):
                x = col * panel_w
                kind, payload = page_content[page_num]

                if kind == "cover":

                    def draw_fn(c, x, y, w, h):
                        _draw_cover(c, x, y, w, h)

                elif kind == "back":

                    def draw_fn(c, x, y, w, h):
                        _draw_back_cover(c, x, y, w, h)

                else:

                    def draw_fn(c, x, y, w, h, payload=payload):
                        block_h = h / SONGS_PER_PANEL
                        for i, song in enumerate(payload):
                            _draw_song_block(c, x, y + h - (i + 1) * block_h, w, block_h, song)

                _draw_panel(c, x, y, panel_w, panel_h, rotated, draw_fn)

        _draw_fold_and_cut_guides(c, page_w, page_h, panel_w, panel_h)
        c.showPage()

    c.save()
    return buf.getvalue()
