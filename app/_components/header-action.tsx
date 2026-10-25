"use client";

/** Round icon button for rare actions in a dialog header (Duplicate, Calendar). */
export function HeaderAction({ icon, label, onClick, active = false, disabled = false }: { icon: string; label: string; onClick: () => void; active?: boolean; disabled?: boolean }) {
  return (
    <button aria-label={label} className={`grid size-8 place-items-center rounded-full border text-[15px] disabled:opacity-50 ${active ? "border-[var(--purple-mid)] bg-[var(--purple-light)] text-[var(--purple-dark)]" : "border-[var(--border-md)] bg-[var(--white)] text-[var(--text-muted)] hover:border-[var(--purple-mid)] hover:text-[var(--purple-dark)]"}`} disabled={disabled} onClick={onClick} title={label} type="button">
      <i aria-hidden="true" className={`ti ${icon}`} />
    </button>
  );
}
