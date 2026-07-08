import Cell from "./Cell.jsx";

function Row({ partName, ending, cells, onCellChange }) {
  return (
    <div className="chart-row" role="group" aria-label={`${partName} Part, ending ${ending}`}>
      {cells.map((token, i) => {
        const measure = Math.floor(i / 2) + 1;
        const beat = (i % 2) + 1;
        return (
          <Cell
            key={i}
            token={token}
            label={`${partName} Part, ending ${ending}, measure ${measure}, beat ${beat}`}
            onChange={(value) => onCellChange(i, value)}
            measureEnd={beat === 2 && i !== cells.length - 1}
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
    onChange({ rows });
  };

  return (
    <section className="part-section">
      <div className="part-header">
        <span>{partName} Part</span>
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
