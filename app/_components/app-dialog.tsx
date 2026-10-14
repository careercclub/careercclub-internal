"use client";

// One confirm, one text prompt and one notice for the whole app, replacing the browser's
// window.confirm / window.prompt / window.alert (which block the page, cannot be styled,
// and can be silenced by the browser — after which a Delete button just does nothing).
// Call the functions from any client component; <AppDialogHost /> in the shell renders them.

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useEffect, useRef, useSyncExternalStore } from "react";

type ConfirmOptions = { title: string; message?: string; confirmLabel: string; danger?: boolean };
type PromptOptions = { title: string; label: string; submitLabel: string; defaultValue?: string; placeholder?: string };
type Request =
  | ({ kind: "confirm"; resolve: (value: boolean) => void } & ConfirmOptions)
  | ({ kind: "prompt"; resolve: (value: string | null) => void } & PromptOptions);
type Notice = { id: number; message: string; tone: "info" | "error" };
type State = { request: Request | null; notices: Notice[] };

let state: State = { request: null, notices: [] };
const listeners = new Set<() => void>();
const emit = (next: State) => { state = next; listeners.forEach((listener) => listener()); };
let noticeId = 0;

/** Resolves true when the person confirms; false on Cancel, Esc or clicking outside. */
export function confirmAction(options: ConfirmOptions): Promise<boolean> {
  return new Promise((resolve) => {
    state.request?.kind === "confirm" ? state.request.resolve(false) : state.request?.resolve(null);
    emit({ ...state, request: { kind: "confirm", resolve, ...options } });
  });
}

/** Resolves the trimmed text, or null when cancelled or left empty. */
export function askText(options: PromptOptions): Promise<string | null> {
  return new Promise((resolve) => {
    state.request?.kind === "confirm" ? state.request.resolve(false) : state.request?.resolve(null);
    emit({ ...state, request: { kind: "prompt", resolve, ...options } });
  });
}

/** Non-blocking message; errors stay a little longer. */
export function notify(message: string, tone: Notice["tone"] = "info") {
  const id = ++noticeId;
  emit({ ...state, notices: [...state.notices.slice(-2), { id, message, tone }] });
  window.setTimeout(() => emit({ ...state, notices: state.notices.filter((notice) => notice.id !== id) }), tone === "error" ? 7000 : 4000);
}

/** For catch blocks: the server's message when there is one, otherwise the fallback. */
export function notifyError(error: unknown, fallback: string) {
  notify(error instanceof Error && error.message ? error.message : fallback, "error");
}

function subscribe(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener); }; }
const getState = () => state;
const getServerState = (): State => ({ request: null, notices: [] });

export function AppDialogHost() {
  const { request, notices } = useSyncExternalStore(subscribe, getState, getServerState);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const confirmRef = useRef<HTMLButtonElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!request) return;
    // Dangerous actions start on Cancel so Enter never deletes by accident.
    const target = request.kind === "prompt" ? inputRef.current : request.danger ? cancelRef.current : confirmRef.current;
    window.setTimeout(() => target?.focus(), 0);
  }, [request]);

  function close(answer: boolean) {
    if (!request) return;
    if (request.kind === "confirm") request.resolve(answer);
    else { const value = inputRef.current?.value.trim() || ""; request.resolve(answer && value ? value : null); }
    emit({ ...state, request: null });
  }

  return (
    <>
      <Dialog open={Boolean(request)} onOpenChange={(open) => { if (!open) close(false); }}>
        {request ? (
          <DialogContent className="max-w-md" showCloseButton={false}>
            <form className="grid gap-4" onSubmit={(event) => { event.preventDefault(); close(true); }}>
              <DialogHeader>
                <DialogTitle>{request.title}</DialogTitle>
                {request.kind === "confirm" && request.message ? <DialogDescription className="whitespace-pre-line">{request.message}</DialogDescription> : <DialogDescription className="sr-only">{request.title}</DialogDescription>}
              </DialogHeader>
              {request.kind === "prompt" ? (
                <label className="grid gap-1.5 text-sm">
                  <span className="font-medium">{request.label}</span>
                  <input className="h-10 rounded-md border border-input px-3" defaultValue={request.defaultValue} placeholder={request.placeholder} ref={inputRef} required />
                </label>
              ) : null}
              <DialogFooter>
                <Button onClick={() => close(false)} ref={cancelRef} type="button" variant="outline">Cancel</Button>
                <Button ref={confirmRef} type="submit" variant={request.kind === "confirm" && request.danger ? "destructive" : "default"}>
                  {request.kind === "confirm" ? request.confirmLabel : request.submitLabel}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        ) : null}
      </Dialog>
      <div aria-live="polite" className="pointer-events-none fixed inset-x-0 bottom-20 z-[100] flex flex-col items-center gap-2 px-4 md:bottom-6">
        {notices.map((notice) => (
          <div className={`pointer-events-auto flex max-w-md items-start gap-3 rounded-md px-3.5 py-2.5 text-sm shadow-lg ${notice.tone === "error" ? "bg-[var(--red)] text-white" : "bg-[var(--text)] text-white"}`} key={notice.id} role={notice.tone === "error" ? "alert" : "status"}>
            <span className="flex-1">{notice.message}</span>
            <button aria-label="Dismiss message" className="opacity-80 hover:opacity-100" onClick={() => emit({ ...state, notices: state.notices.filter((item) => item.id !== notice.id) })} type="button">×</button>
          </div>
        ))}
      </div>
    </>
  );
}
