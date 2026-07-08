import Cell from "./Cell.jsx";
import { BAR_OPTIONS, cellsForBars } from "../api.js";

// "" cells are only ever trailing padding added by updateBars below, never
// real user content, so it's always safe to strip them back off before
// recomputing a row for a new bar count.
function stripTrailingBlanks(row) {
  let end = row.length;
  while (end > 0 && row[end - 1] === "") end--;
  return row.slice(0, end);
}

function resizeRow(row, newLength) {
  if (newLength <= row.length) return row.slice(0, newLength);
  return [...row, ...Array(newLength - row.length).fill("/")];
}

function Row({ partName, ending, cells, onCellChange }) {
  return (
    <div className="chart-row" role="group" aria-label={`${partName} Part, ending ${ending}`}>
      {cells.map((token, i) => {
        const measure = Math.floor(i / 2) + 1;
        const beat = (i % 2) + 1;
        const measureEnd = beat === 2 && i !== cells.length - 1;

        if (token === "") {
          // A padding bar with no corresponding real content - render as
          // fully inert space, not a focusable/clickable cell.
          return (
            <div
              key={i}
              className={measureEnd ? "cell cell-blank measure-end" : "cell cell-blank"}
              aria-hidden="true"
            />
          );
        }

        return (
          <Cell
            key={i}
            token={token}
            label={`${partName} Part, ending ${ending}, measure ${measure}, beat ${beat}`}
            onChange={(value) => onCellChange(i, value)}
            measureEnd={measureEnd}
          />
        );
      })}
    </div>
  );
}

export default function PartGrid({ partName, part, onChange }) {
  const updateCell = (rowIndex, cellIndex, value) => {
    const rows = part.rows.map((row, r) =>
      r === rowIndex ? row.map((c, i) => (i === cellIndex ? value : c)) : row
    );
    onChange({ bars: part.bars, rows });
  };

  const updateBars = (newBars) => {
    // Recompute both rows fresh from `newBars` every time, rather than
    // patching the previous state - otherwise a blank padding bar added for
    // one odd count lingers (unstripped) when switching to a different
    // count, and can double up (e.g. 9 -> 11 -> 12 previously left 2 stale
    // blank bars instead of the correct 0 or 1).
    const totalCells = cellsForBars(newBars);
    const isOdd = newBars % 2 === 1;
    const rows = part.rows.map((row, rowIndex) => {
      const isShortRow = isOdd && rowIndex === 1;
      const realLength = isShortRow ? totalCells - 2 : totalCells;
      const real = resizeRow(stripTrailingBlanks(row), realLength);
      return isShortRow ? [...real, "", ""] : real;
    });
    onChange({ bars: newBars, rows });
  };

  return (
    <section className="part-section">
      <div className="part-header">
        <span className="part-letter">{partName}</span>
        <select
          className="bars-select"
          aria-label={`Number of bars for ${partName} Part`}
          value={part.bars}
          onChange={(e) => updateBars(Number(e.target.value))}
        >
          {BAR_OPTIONS.map((n) => (
            <option key={n} value={n}>
              {n} bars
            </option>
          ))}
        </select>
        <span className="divider" />
      </div>
      {part.rows.map((row, rowIndex) => (
        <Row
          key={rowIndex}
          partName={partName}
          ending={rowIndex + 1}
          cells={row}
          onCellChange={(cellIndex, value) => updateCell(rowIndex, cellIndex, value)}
        />
      ))}
    </section>
  );
}
