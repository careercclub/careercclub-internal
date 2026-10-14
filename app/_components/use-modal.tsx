"use client";

// Shared behaviour for the module pages' own modal/panel markup, so every popup acts like
// the shadcn Dialog: announced as a dialog, Esc closes, focus moves in and stays in, and
// returns to the button that opened it. Spread `dialogProps` on the dialog box element.

import { useEffect, useId, useRef } from "react";

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

function useModalBehaviour(onClose: () => void, anchor: { current: HTMLElement | null }, mode: "form" | "panel") {
  const closeRef = useRef(onClose);
  useEffect(() => { closeRef.current = onClose; }, [onClose]);

  useEffect(() => {
    // Forms: the anchor is the dialog box. Panels: the anchor sits inside an inline role="dialog".
    const box = mode === "form" ? anchor.current : anchor.current?.closest<HTMLElement>('[role="dialog"]') ?? null;
    const opener = document.activeElement as HTMLElement | null;
    // Respect a field that focused itself (autoFocus); forms start on the first field, detail panels on the first control (usually Close).
    if (box && !box.contains(document.activeElement)) {
      const first = (mode === "form" && box.querySelector<HTMLElement>("input, select, textarea")) || box.querySelector<HTMLElement>(FOCUSABLE) || box;
      first.focus();
    }
    function onKey(event: KeyboardEvent) {
      // A confirm opened on top of this modal handles its own keys.
      if (!box || document.querySelector('[data-slot="dialog-content"]')) return;
      if (event.key === "Escape") { event.preventDefault(); closeRef.current(); return; }
      if (event.key !== "Tab") return;
      const items = Array.from(box.querySelectorAll<HTMLElement>(FOCUSABLE)).filter((item) => item.offsetParent !== null);
      if (!items.length) return;
      const first = items[0], last = items[items.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    }
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      if (opener && document.contains(opener)) opener.focus();
    };
  }, [anchor, mode]);
}

export function useModal(onClose: () => void) {
  const ref = useRef<HTMLDivElement & HTMLElement>(null);
  const titleId = useId();
  useModalBehaviour(onClose, ref, "form");
  return {
    ref,
    titleId,
    dialogProps: { ref, role: "dialog" as const, "aria-modal": true, "aria-labelledby": titleId, tabIndex: -1 },
  };
}

/** For an existing role="dialog" element written inline: render inside it to get the same keys and focus handling. */
export function DialogBehaviour({ onClose }: { onClose: () => void }) {
  const marker = useRef<HTMLSpanElement>(null);
  useModalBehaviour(onClose, marker, "panel");
  return <span hidden ref={marker} />;
}
