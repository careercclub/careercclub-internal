"use client";

import { RECORD_FOCUS_EVENT, type RecordFocusDetail } from "@/app/_components/use-record-focus";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

const GIVE_UP_AFTER_MS = 5000;
// A module that opened the record's detail itself gets a moment to render it.
const HANDLED_GRACE_MS = 600;
const HIGHLIGHT_MS = 3000;

function candidates(id: string) {
  const value = CSS.escape(id);
  return [...document.querySelectorAll<HTMLElement>(`[data-record-id="${value}"], [data-record-ids~="${value}"]`)]
    .filter((element) => element.tagName !== "OPTION");
}

/** Prefer what the user can already see (a card) over a row tucked inside a closed panel. */
function pickTarget(id: string) {
  const all = candidates(id);
  return all.find((element) => element.getClientRects().length > 0 && !element.closest("details:not([open])")) || all[0];
}

function reveal(element: HTMLElement) {
  for (let parent = element.parentElement?.closest<HTMLDetailsElement>("details:not([open])"); parent; parent = parent.parentElement?.closest<HTMLDetailsElement>("details:not([open])")) {
    parent.open = true;
  }
  const opener = element.matches("[data-record-open]") ? element : element.querySelector<HTMLElement>("[data-record-open]");
  if (opener instanceof HTMLDetailsElement) opener.open = true;
  else opener?.click();
  element.scrollIntoView({ block: "center", behavior: "smooth" });
  element.setAttribute("data-record-focused", "");
  window.setTimeout(() => element.removeAttribute("data-record-focused"), HIGHLIGHT_MS);
}

export function RecordFocus() {
  const params = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();
  const focus = params.get("focus");
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!focus) return;
    const id = focus;
    const started = Date.now();
    let handledAt = 0;
    let timer = 0;
    // Drop ?focus from the URL so a refresh or back-navigation does not jump again.
    const clearParam = () => {
      const next = new URLSearchParams(window.location.search);
      next.delete("focus");
      router.replace(`${pathname}${next.size ? `?${next}` : ""}`, { scroll: false });
    };
    const tick = () => {
      const detail: RecordFocusDetail = { id };
      window.dispatchEvent(new CustomEvent(RECORD_FOCUS_EVENT, { detail }));
      if (detail.handled && !handledAt) handledAt = Date.now();
      const target = pickTarget(id);
      if (target) {
        // Give the module one frame to finish switching tab or page before revealing.
        window.requestAnimationFrame(() => reveal(pickTarget(id) || target));
        clearParam();
        return;
      }
      if (handledAt && Date.now() - handledAt > HANDLED_GRACE_MS) {
        clearParam();
        return;
      }
      if (Date.now() - started > GIVE_UP_AFTER_MS) {
        setMessage("That record is not on this page. It may have been deleted.");
        clearParam();
        return;
      }
      timer = window.setTimeout(tick, 150);
    };
    // Start on the next task, not synchronously: this component sits in the shell above
    // the page, so its effect runs before the page's useRecordFocus listeners exist.
    // Dispatching now would reach nobody and a visible row would be "found" without its
    // module ever opening the detail.
    timer = window.setTimeout(tick, 0);
    return () => window.clearTimeout(timer);
  }, [focus, pathname, router]);

  useEffect(() => {
    if (!message) return;
    const timer = window.setTimeout(() => setMessage(""), 5000);
    return () => window.clearTimeout(timer);
  }, [message]);

  return message ? (
    <div role="status" className="fixed bottom-4 left-1/2 z-50 -translate-x-1/2 rounded-md bg-[var(--text)] px-3 py-2 text-xs text-[var(--white)] shadow-lg">
      {message}
    </div>
  ) : null;
}
