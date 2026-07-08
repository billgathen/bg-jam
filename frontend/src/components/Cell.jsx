import { useLayoutEffect, useRef, useState } from "react";

// Trailing "?" allows "" too: a completely blank padding bar, distinct
// from "/" (hold/continue previous chord).
const TOKEN_RE = /^([1-7](b|#)?(m|dim|aug|sus2|sus4|7)?|\/)?$/;

function parseToken(token) {
  if (token === "/") return { base: "/", suffix: "" };
  const match = token.match(/^([1-7])(.*)$/);
  return match ? { base: match[1], suffix: match[2] } : { base: token, suffix: "" };
}

function describeToken(token) {
  if (token === "/") return "hold";
  if (token === "") return "empty";
  const { base, suffix } = parseToken(token);
  const names = { m: "minor", dim: "diminished", aug: "augmented", sus2: "sus 2", sus4: "sus 4", 7: "seventh" };
  return suffix ? `${base} ${names[suffix] || suffix}` : base;
}

export default function Cell({ token, label, onChange, measureEnd }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(token);
  const inputRef = useRef(null);

  useLayoutEffect(() => {
    if (editing) {
      setDraft(token);
      inputRef.current?.focus();
    }
  }, [editing]); // eslint-disable-line react-hooks/exhaustive-deps

  const trimmed = draft.trim();
  const isValid = trimmed === "" || TOKEN_RE.test(trimmed);

  const commit = () => {
    if (trimmed === "") {
      // Clearing a cell that had real content means "hold/continue" - but
      // passing through an already-blank padding cell without typing
      // anything shouldn't turn it into a slash.
      onChange(token === "" ? "" : "/");
      setEditing(false);
    } else if (TOKEN_RE.test(trimmed)) {
      onChange(trimmed);
      setEditing(false);
    }
    // Invalid, non-empty input: stay in edit mode so the typed value
    // isn't silently discarded — the user can fix it or clear it.
  };

  if (editing) {
    return (
      <input
        ref={inputRef}
        className={isValid ? "cell-input" : "cell-input invalid"}
        value={draft}
        aria-label={label}
        aria-invalid={!isValid}
        onChange={(e) => setDraft(e.target.value)}
        onFocus={(e) => e.target.select()}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") commit();
          if (e.key === "Tab" && !isValid) e.preventDefault();
          if (e.key === "Escape") setEditing(false);
        }}
      />
    );
  }

  const { base, suffix } = parseToken(token);

  return (
    <button
      type="button"
      className={measureEnd ? "cell measure-end" : "cell"}
      aria-label={`${label}: ${describeToken(token)}.`}
      onFocus={() => setEditing(true)}
    >
      {token === "/" ? (
        <span className="slash" aria-hidden="true">
          /
        </span>
      ) : (
        <span aria-hidden="true">
          {base}
          {suffix && (
            <span className={suffix.includes("7") ? "suffix-raised" : "suffix-flat"}>{suffix}</span>
          )}
        </span>
      )}
    </button>
  );
}
