import re
from datetime import datetime

from pydantic import BaseModel, ConfigDict, field_validator, model_validator

CELL_RE = re.compile(r"^([1-7](b|#)?(m|dim|aug|sus2|sus4|7)?|/)$")
ROW_LENGTH = 8
PART_NAMES = ("A", "B")
ROWS_PER_PART = 2


class PartChart(BaseModel):
    rows: list[list[str]]

    @field_validator("rows")
    @classmethod
    def validate_rows(cls, rows: list[list[str]]) -> list[list[str]]:
        if len(rows) != ROWS_PER_PART:
            raise ValueError(f"expected {ROWS_PER_PART} rows, got {len(rows)}")
        for row in rows:
            if len(row) != ROW_LENGTH:
                raise ValueError(f"expected {ROW_LENGTH} cells per row, got {len(row)}")
            for cell in row:
                if not CELL_RE.match(cell):
                    raise ValueError(f"invalid cell token: {cell!r}")
        return rows


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
