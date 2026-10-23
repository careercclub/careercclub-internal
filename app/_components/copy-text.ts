"use client";

/** Copy text; falls back to a hidden textarea where the Clipboard API is missing (plain http). */
export async function copyText(value: string): Promise<boolean> {
  if (navigator.clipboard?.writeText) {
    try { await navigator.clipboard.writeText(value); return true; } catch { /* fall back */ }
  }
  const area = document.createElement("textarea");
  area.value = value; area.setAttribute("readonly", ""); area.style.position = "fixed"; area.style.opacity = "0";
  document.body.appendChild(area); area.select();
  try { return document.execCommand("copy"); } catch { return false; } finally { area.remove(); }
}
