"use client";

// One "Links" field for every popup that keeps links (Tickets now; reused as modules move over).
// A readable list (site, path, open, remove) and a full-size input with a clear "Add link".

import { useId, useState, type KeyboardEvent } from "react";

export type LinkItem = { label?: unknown; url: unknown };

const str = (value: unknown) => (value === null || value === undefined ? "" : String(value));

/** "https://www.figma.com/file/abc" → { host: "figma.com", rest: "/file/abc" }. */
export function linkParts(url: string) {
  try {
    const parsed = new URL(url);
    return { host: parsed.hostname.replace(/^www\./, ""), rest: `${parsed.pathname === "/" ? "" : parsed.pathname}${parsed.search}` };
  } catch {
    return { host: url, rest: "" };
  }
}

export function isLinkUrl(value: string) {
  try { const parsed = new URL(value.trim()); return (parsed.protocol === "http:" || parsed.protocol === "https:") && (parsed.hostname.includes(".") || parsed.hostname === "localhost"); } catch { return false; }
}

export function LinksField({ links, onAdd, onRemove, busy = false, label = "Links", optional = false }: {
  links: LinkItem[];
  onAdd: (url: string) => void | Promise<void>;
  onRemove?: (index: number) => void | Promise<void>;
  busy?: boolean;
  label?: string;
  optional?: boolean;
}) {
  const id = useId();
  const [url, setUrl] = useState("");
  const [error, setError] = useState("");

  async function add() {
    const value = url.trim();
    if (!value) return;
    // "figma.com/x" is accepted as https://figma.com/x.
    const full = /^[a-z][a-z0-9+.-]*:\/\//i.test(value) ? value : `https://${value}`;
    if (!isLinkUrl(full)) { setError("That does not look like a link. Paste the full address."); return; }
    setError("");
    // A failed add keeps what was pasted so it can be tried again (the popup shows why).
    try { await onAdd(full); setUrl(""); } catch { /* shown by the caller */ }
  }
  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Enter") { event.preventDefault(); void add(); }
  }

  return (
    <div className="grid gap-1.5" data-links-field="">
      <label className="flex items-center gap-2 text-[13px] font-semibold text-[var(--text)]" htmlFor={id}>
        {label}{optional ? <span className="font-normal text-[var(--text-muted)]">(optional)</span> : null}
        {links.length ? <span className="rounded-full bg-[var(--surface-2)] px-2 text-[12px] font-semibold text-[var(--text-muted)]">{links.length}</span> : null}
      </label>
      {links.length ? (
        <ul className="m-0 grid list-none gap-0 overflow-hidden rounded-[10px] border border-[var(--border)] p-0">
          {links.map((link, index) => {
            const href = str(link.url); const { host, rest } = linkParts(href);
            const name = str(link.label) && str(link.label) !== "Link" ? str(link.label) : "";
            return (
              <li className="flex items-center gap-2.5 border-t border-[var(--border)] px-3 py-2 first:border-t-0" key={`${href}-${index}`}>
                <span aria-hidden="true" className="grid size-7 shrink-0 place-items-center rounded-lg bg-[var(--purple-light)] text-[var(--purple-dark)]"><i className="ti ti-link text-[14px]" /></span>
                <a className="min-w-0 flex-1 text-[13px] text-[var(--text)] no-underline hover:text-[var(--purple-dark)]" href={href} rel="noopener noreferrer" target="_blank" title={href}>
                  <span className="block truncate font-semibold">{name || host}</span>
                  <span className="block truncate text-[12px] text-[var(--text-muted)]">{name ? `${host}${rest}` : rest || "Open link"}</span>
                </a>
                <a aria-label={`Open ${name || host}`} className="grid size-8 shrink-0 place-items-center rounded-full text-[var(--text-muted)] hover:bg-[var(--surface-2)] hover:text-[var(--text)]" href={href} rel="noopener noreferrer" target="_blank"><i aria-hidden="true" className="ti ti-external-link text-[15px]" /></a>
                {onRemove ? <button aria-label={`Remove link ${name || host}`} className="grid size-8 shrink-0 place-items-center rounded-full text-[var(--text-muted)] hover:bg-[var(--red-bg)] hover:text-[var(--red)]" disabled={busy} onClick={() => void onRemove(index)} type="button"><i aria-hidden="true" className="ti ti-x text-[15px]" /></button> : null}
              </li>
            );
          })}
        </ul>
      ) : null}
      <div className="flex gap-2">
        <input aria-invalid={Boolean(error) || undefined} className="h-[38px] min-w-0 flex-1 rounded-[10px] border border-[var(--border-md)] bg-[var(--white)] px-3 text-[13px] text-[var(--text)] outline-none placeholder:text-[var(--text-hint)] focus:border-[var(--purple-mid)] focus:ring-[3px] focus:ring-[var(--purple-light)] aria-invalid:border-[var(--red)]" id={id} onChange={(event) => { setUrl(event.target.value); if (error) setError(""); }} onKeyDown={onKeyDown} placeholder="Paste a link (Drive, Figma, Canva…)" type="url" value={url} />
        <button className="inline-flex h-[38px] shrink-0 items-center gap-1.5 rounded-full border border-[var(--purple-mid)] bg-[var(--white)] px-4 text-[13px] font-bold text-[var(--purple-dark)] hover:bg-[var(--purple-light)] disabled:cursor-not-allowed disabled:border-[var(--border-md)] disabled:text-[var(--text-hint)] disabled:hover:bg-[var(--white)]" disabled={busy || !url.trim()} onClick={() => void add()} type="button"><i aria-hidden="true" className="ti ti-plus text-[14px]" />Add link</button>
      </div>
      {error ? <p className="m-0 text-[12px] font-semibold text-[var(--red)]" role="alert">{error}</p> : null}
    </div>
  );
}
