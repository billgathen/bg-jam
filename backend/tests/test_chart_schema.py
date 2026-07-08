import pytest
from pydantic import ValidationError

from app.schemas import DEFAULT_BARS, MAX_BARS, MIN_BARS, ChartSchema, cells_for_bars

VALID_TOKENS = ["1", "7", "/", "", "6m", "27", "5b7", "1#", "3dim", "4aug", "1sus2", "1sus4"]
INVALID_TOKENS = ["8", "0", "Am", "G7", "1x", "1 4", "-1", "6mm", "10"]


def make_chart(bars=DEFAULT_BARS, a_row0=None):
    length = cells_for_bars(bars)
    row = a_row0 or ["1"] * length
    return {
        "A": {"bars": bars, "rows": [row, ["1"] * length]},
        "B": {"bars": bars, "rows": [["1"] * length, ["1"] * length]},
    }


@pytest.mark.parametrize("token", VALID_TOKENS)
def test_valid_cell_tokens(token):
    ChartSchema.model_validate(make_chart(a_row0=[token] * DEFAULT_BARS))


@pytest.mark.parametrize("token", INVALID_TOKENS)
def test_invalid_cell_tokens_rejected(token):
    with pytest.raises(ValidationError):
        ChartSchema.model_validate(make_chart(a_row0=[token] * DEFAULT_BARS))


def test_wrong_row_count_rejected():
    chart = make_chart()
    chart["A"]["rows"] = [["1"] * DEFAULT_BARS]  # only 1 row, need 2
    with pytest.raises(ValidationError):
        ChartSchema.model_validate(chart)


def test_wrong_cell_count_rejected():
    chart = make_chart()
    chart["A"]["rows"][0] = ["1"] * (DEFAULT_BARS - 1)  # one short of bars
    with pytest.raises(ValidationError):
        ChartSchema.model_validate(chart)


def test_missing_part_rejected():
    with pytest.raises(ValidationError):
        ChartSchema.model_validate({"A": {"rows": [["1"] * DEFAULT_BARS] * 2}})


def test_bars_defaults_to_eight_when_omitted():
    chart = {
        "A": {"rows": [["1"] * DEFAULT_BARS, ["1"] * DEFAULT_BARS]},
        "B": {"rows": [["1"] * DEFAULT_BARS, ["1"] * DEFAULT_BARS]},
    }
    result = ChartSchema.model_validate(chart)
    assert result.A.bars == DEFAULT_BARS


@pytest.mark.parametrize("bars", [MIN_BARS, MIN_BARS + 1, MAX_BARS - 1, MAX_BARS])
def test_bars_in_range_accepted(bars):
    ChartSchema.model_validate(make_chart(bars=bars))


@pytest.mark.parametrize("bars", [MIN_BARS - 1, MAX_BARS + 1, 0, -1])
def test_bars_out_of_range_rejected(bars):
    length = max(bars, 0)
    chart = {
        "A": {"bars": bars, "rows": [["1"] * length, ["1"] * length]},
        "B": {"bars": DEFAULT_BARS, "rows": [["1"] * DEFAULT_BARS] * 2},
    }
    with pytest.raises(ValidationError):
        ChartSchema.model_validate(chart)


def test_row_length_must_match_this_parts_own_bar_count():
    # A has 8 bars (8 cells) while B has 10 bars (10 cells) - each part's
    # rows are validated against its own bar count, independently.
    chart = {
        "A": {"bars": 8, "rows": [["1"] * 8, ["1"] * 8]},
        "B": {"bars": 10, "rows": [["1"] * 10, ["1"] * 10]},
    }
    result = ChartSchema.model_validate(chart)
    assert result.A.bars == 8
    assert result.B.bars == 10


def test_row_length_mismatched_with_own_bars_rejected():
    chart = {
        "A": {"bars": 10, "rows": [["1"] * 8, ["1"] * 8]},  # 8 cells but declares 10 bars
        "B": {"bars": DEFAULT_BARS, "rows": [["1"] * DEFAULT_BARS] * 2},
    }
    with pytest.raises(ValidationError):
        ChartSchema.model_validate(chart)


@pytest.mark.parametrize("bars,expected_cells", [(8, 8), (9, 10), (10, 10), (11, 12), (12, 12)])
def test_cells_for_bars_rounds_odd_counts_up_to_even(bars, expected_cells):
    assert cells_for_bars(bars) == expected_cells


def test_odd_bars_requires_the_rounded_up_cell_count():
    # 9 bars split across 2 rows is 5 + 4, padded to 5 + 5 = 10 cells each,
    # so both ending rows render at the same width.
    chart = make_chart(bars=9)
    assert len(chart["A"]["rows"][0]) == 10
    result = ChartSchema.model_validate(chart)
    assert result.A.bars == 9
    assert len(result.A.rows[0]) == 10
    assert len(result.A.rows[1]) == 10


def test_odd_bars_with_unrounded_cell_count_rejected():
    chart = {
        "A": {"bars": 9, "rows": [["1"] * 9, ["1"] * 9]},  # not rounded up to 10
        "B": {"bars": DEFAULT_BARS, "rows": [["1"] * DEFAULT_BARS] * 2},
    }
    with pytest.raises(ValidationError):
        ChartSchema.model_validate(chart)


def test_row_with_blank_padding_bar_is_valid():
    # 5 real bars (10 cells) on the 1st ending; 4 real bars + 1 completely
    # blank padding bar on the 2nd, matching a 9-bar section.
    chart = {
        "A": {
            "bars": 9,
            "rows": [
                ["1", "4", "5", "1", "5", "/", "/", "/", "1", "4"],
                ["1", "4", "5", "1", "/", "4", "5", "1", "", ""],
            ],
        },
        "B": {"bars": DEFAULT_BARS, "rows": [["1"] * DEFAULT_BARS] * 2},
    }
    result = ChartSchema.model_validate(chart)
    assert result.A.rows[1][-2:] == ["", ""]
