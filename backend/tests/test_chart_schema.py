import pytest
from pydantic import ValidationError

from app.schemas import ChartSchema

VALID_TOKENS = ["1", "7", "/", "6m", "27", "5b7", "1#", "3dim", "4aug", "1sus2", "1sus4"]
INVALID_TOKENS = ["8", "0", "Am", "G7", "1x", "", "1 4", "-1", "6mm", "10"]


def make_chart(a_row0=None):
    row = a_row0 or ["1"] * 8
    return {
        "A": {"rows": [row, ["1"] * 8]},
        "B": {"rows": [["1"] * 8, ["1"] * 8]},
    }


@pytest.mark.parametrize("token", VALID_TOKENS)
def test_valid_cell_tokens(token):
    ChartSchema.model_validate(make_chart([token] * 8))


@pytest.mark.parametrize("token", INVALID_TOKENS)
def test_invalid_cell_tokens_rejected(token):
    with pytest.raises(ValidationError):
        ChartSchema.model_validate(make_chart([token] * 8))


def test_wrong_row_count_rejected():
    chart = make_chart()
    chart["A"]["rows"] = [["1"] * 8]  # only 1 row, need 2
    with pytest.raises(ValidationError):
        ChartSchema.model_validate(chart)


def test_wrong_cell_count_rejected():
    chart = make_chart()
    chart["A"]["rows"][0] = ["1"] * 7  # only 7 cells, need 8
    with pytest.raises(ValidationError):
        ChartSchema.model_validate(chart)


def test_missing_part_rejected():
    with pytest.raises(ValidationError):
        ChartSchema.model_validate({"A": {"rows": [["1"] * 8, ["1"] * 8]}})
