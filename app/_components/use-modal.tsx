"use client";

// Shared behaviour for the module pages' own modal/panel markup, so every popup acts like
// the shadcn Dialog: announced as a dialog, Esc closes, focus moves in and stays in, and
// returns to the button that opened it. Spread `dialogProps` on the dialog box element.

import { useCallback, useEffect, useId, useRef } from "react";
import { confirmAction } from "./app-dialog";

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

function useModalBehaviour(onClose: () => void, anchor: { current: HTMLElement | null }, mode: "form" | "panel") {
  const closeRef = useRef(onClose);
  useEffect(() => { closeRef.current = onClose; }, [onClose]);
  // Same rule as the shadcn Dialog: once something is typed, Esc / backdrop / X ask first.
  const dirty = useRef(false);
  const asking = useRef(false);
  const dismiss = useCallback(async () => {
    if (!dirty.current) { closeRef.current(); return; }
    if (asking.current) return;
    asking.current = true;
    const discard = await confirmAction({ title: "Discard your changes?", message: "What you typed in this form will be lost.", confirmLabel: "Discard changes", danger: true });
    asking.current = false;
    if (discard) { dirty.current = false; closeRef.current(); }
  }, []);

  useEffect(() => {
    // Forms: the anchor is the dialog box. Panels: the anchor sits inside an inline role="dialog".
    const box = mode === "form" ? anchor.current : anchor.current?.closest<HTMLElement>('[role="dialog"]') ?? null;
    const opener = document.activeElement as HTMLElement | null;
    // Respect a field that focused itself (autoFocus); forms start on the first field, detail panels on the first control (usually Close).
    if (box && !box.contains(document.activeElement)) {
      const first = (mode === "form" && box.querySelector<HTMLElement>("input, select, textarea")) || box.querySelector<HTMLElement>(FOCUSABLE) || box;
      first.focus();
    }
    const markDirty = (event: Event) => { if ((event.target as HTMLElement).matches?.("input:not([type=search]), textarea, select")) dirty.current = true; };
    const markSaved = () => { dirty.current = false; };
    box?.addEventListener("input", markDirty);
    box?.addEventListener("submit", markSaved, true);
    function onKey(event: KeyboardEvent) {
      // A confirm opened on top of this modal handles its own keys.
      if (!box || document.querySelector('[data-slot="dialog-content"]')) return;
      if (event.key === "Escape") { event.preventDefault(); void dismiss(); return; }
      if (event.key !== "Tab") return;
      const items = Array.from(box.querySelectorAll<HTMLElement>(FOCUSABLE)).filter((item) => item.offsetParent !== null);
      if (!items.length) return;
      const first = items[0], last = items[items.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    }
    document.addEventListener("keydown", onKey);
    return () => {
      box?.removeEventListener("input", markDirty);
      box?.removeEventListener("submit", markSaved, true);
      document.removeEventListener("keydown", onKey);
      if (opener && document.contains(opener)) opener.focus();
    };
  }, [anchor, mode, dismiss]);
  return dismiss;
}

export function useModal(onClose: () => void) {
  const ref = useRef<HTMLDivElement & HTMLElement>(null);
  const titleId = useId();
  const dismiss = useModalBehaviour(onClose, ref, "form");
  return {
    ref,
    titleId,
    /** Close from the backdrop or X: asks first when something was typed. */
    dismiss,
    dialogProps: { ref, role: "dialog" as const, "aria-modal": true, "aria-labelledby": titleId, tabIndex: -1 },
  };
}

/** For an existing role="dialog" element written inline: render inside it to get the same keys and focus handling. */
export function DialogBehaviour({ onClose }: { onClose: () => void }) {
  const marker = useRef<HTMLSpanElement>(null);
  useModalBehaviour(onClose, marker, "panel");
  return <span hidden ref={marker} />;
}
