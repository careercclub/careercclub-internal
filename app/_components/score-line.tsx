// The "score line" (DESIGN.md, rapor karier): a thin bar under a number that has a scale.
// Blue while in progress; the warm achievement accent once the target is reached.

export function ScoreLine({ value, max, label }: { value: number; max: number; label: string }) {
  const share = max > 0 ? Math.max(0, Math.min(1, value / max)) : 0;
  return (
    <span aria-label={label} className="score-line" data-achieved={max > 0 && value >= max ? "true" : undefined} role="img">
      <i style={{ width: `${Math.round(share * 100)}%` }} />
    </span>
  );
}

/** A–D like a report card, from the content grade (top/good/avg/low). */
export const GRADE_LETTER: Record<string, string> = { top: "A", good: "B", avg: "C", low: "D" };
