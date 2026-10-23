"use client";

import { notify, notifyError } from "./app-dialog";

/**
 * Run a server action and tell the person when it fails. Without this, a failed save
 * either did nothing visible (the person believed it was saved) or, inside a React
 * transition, took the whole page down. One rule for every module.
 *
 *   start(() => guard(async () => { await saveThing(); onClose(); }, "Could not save the thing."));
 */
export async function guard<T>(job: () => Promise<T>, failure: string): Promise<T | undefined> {
  try {
    return await job();
  } catch (error) {
    notifyError(error, failure);
    return undefined;
  }
}

/** For optimistic updates: put the old state back and say so. */
export function revertWith(restore: () => void, failure: string) {
  return (error: unknown) => { restore(); notify(`${error instanceof Error && error.message ? error.message : failure} The change was undone.`, "error"); };
}

/**
 * onSubmit for a form that posts to a server action: keeps what was typed when it fails
 * (a form `action` clears the fields), says when it worked, and says when it did not.
 */
export function submitTo(action: (formData: FormData) => Promise<unknown>, messages: { success?: string; failure: string }) {
  return (event: { preventDefault: () => void; currentTarget: HTMLFormElement }) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    void guard(async () => { await action(formData); if (messages.success) notify(messages.success); }, messages.failure);
  };
}
