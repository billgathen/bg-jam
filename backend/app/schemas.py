import re
from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field, model_validator

# The trailing "?" on the whole group makes "" a valid cell too: a
# completely blank bar, distinct from "/" (hold/continue previous chord).
# Used for the padding bar added when an odd bar count is split unevenly
# across the two ending rows - see cells_for_bars() below.
CELL_RE = re.compile(r"^([1-7](b|#)?(m|dim|aug|sus2|sus4|7)?|/)?$")
PART_NAMES = ("A", "B")
ROWS_PER_PART = 2
MIN_BARS = 8
MAX_BARS = 12
DEFAULT_BARS = 8


def cells_for_bars(bars: int) -> int:
    """Cell count per row for a given bar count.

    `bars` is the combined total across both ending rows, split as evenly as
    possible (e.g. 9 -> 5 on the 1st ending, 4 + a blank padding bar on the
    2nd, so both rows render at the same width). An odd count therefore
    rounds up to the next even cell count, applied uniformly to both rows.
    """
    return bars + (bars % 2)


class PartChart(BaseModel):
    # Bar-line dividers are drawn every 2 cells (see CELLS_PER_BAR in
    # mini_comic.py) independent of this value - see cells_for_bars() above
    # for how `bars` maps to each row's actual cell count.
    bars: int = Field(default=DEFAULT_BARS, ge=MIN_BARS, le=MAX_BARS)
    rows: list[list[str]]

    @model_validator(mode="after")
    def validate_rows(self) -> "PartChart":
        if len(self.rows) != ROWS_PER_PART:
            raise ValueError(f"expected {ROWS_PER_PART} rows, got {len(self.rows)}")
        expected_cells = cells_for_bars(self.bars)
        for row in self.rows:
            if len(row) != expected_cells:
                raise ValueError(
                    f"expected {expected_cells} cells per row for {self.bars} bars, got {len(row)}"
                )
            for cell in row:
                if not CELL_RE.match(cell):
                    raise ValueError(f"invalid cell token: {cell!r}")
        return self


class ChartSchema(BaseModel):
    A: PartChart
    B: PartChart

    @model_validator(mode="before")
    @classmethod
    def validate_parts(cls, data):
        if isinstance(data, dict):
            missing = [p for p in PART_NAMES if p not in data]
            if missing:
                raise ValueError(f"missing parts: {missing}")
        return data


class SongCreate(BaseModel):
    title: str
    chart: ChartSchema


class SongUpdate(BaseModel):
    title: str
    chart: ChartSchema


class SongOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    title: str
    chart: ChartSchema
    created_at: datetime
    updated_at: datetime


class SongSummary(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    title: str
    updated_at: datetime


class ExportRequest(BaseModel):
    song_ids: list[int]
    booklet_title: str | None = None
