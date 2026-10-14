"use client";

import { useEffect, useRef } from "react";

// Opening a search result: the global <RecordFocus> (dashboard shell) reads ?focus=<id>
// and broadcasts this event until an element with data-record-id=<id> is on screen.
// Modules listen with useRecordFocus() to make that record reachable (switch tab,
// jump to its page, clear filters). Mark the element with data-record-id (or a
// space-separated data-record-ids when one element stands for several records), and
// the control that opens its detail with data-record-open. A module that opens the
// record's detail itself (a modal) returns true so RecordFocus stops looking.
export const RECORD_FOCUS_EVENT = "ccc:record-focus";

export type RecordFocusDetail = { id: string; handled?: boolean };

export function useRecordFocus(handler: (id: string) => boolean | void) {
  const latest = useRef(handler);
  useEffect(() => { latest.current = handler; });
  useEffect(() => {
    function listener(event: Event) {
      const detail = (event as CustomEvent<RecordFocusDetail>).detail;
      if (detail?.id && latest.current(detail.id) === true) detail.handled = true;
    }
    window.addEventListener(RECORD_FOCUS_EVENT, listener);
    return () => window.removeEventListener(RECORD_FOCUS_EVENT, listener);
  }, []);
}
