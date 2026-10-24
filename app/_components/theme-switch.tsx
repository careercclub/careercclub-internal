"use client";

import { readTheme, THEME_KEY, type Theme } from "@/lib/theme/theme";
import { useEffect, useSyncExternalStore } from "react";

/** The current look, re-rendering when it changes (charts redraw with the new colours). */
export function useResolvedTheme(): Theme {
  return useSyncExternalStore(
    (notify) => { const observer = new MutationObserver(notify); observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] }); return () => observer.disconnect(); },
    () => (document.documentElement.dataset.theme === "dark" ? "dark" : "light"),
    () => "light",
  );
}

/** Top-bar toggle: light (default) ⇄ dark. */
export function ThemeSwitch() {
  const theme = useResolvedTheme();
  // Applies the stored choice even if the <head> script did not run (e.g. an embedded preview).
  useEffect(() => { document.documentElement.dataset.theme = readTheme(); }, []);

  function toggle() {
    const next: Theme = theme === "dark" ? "light" : "dark";
    document.documentElement.dataset.theme = next;
    try { if (next === "dark") localStorage.setItem(THEME_KEY, "dark"); else localStorage.removeItem(THEME_KEY); } catch { /* storage blocked: applies for this visit */ }
  }

  const label = theme === "dark" ? "Switch to light mode" : "Switch to dark mode";
  return (
    <button aria-label={label} aria-pressed={theme === "dark"} className="grid size-8 place-items-center rounded-full border border-[var(--border)] bg-[var(--white)] text-[var(--text-muted)] hover:border-[var(--purple-mid)] hover:text-[var(--text)]" onClick={toggle} title={label} type="button">
      <i aria-hidden="true" className={`ti ${theme === "dark" ? "ti-sun" : "ti-moon"} text-[16px]`} />
    </button>
  );
}
