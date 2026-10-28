"use client";

import { describeDeleteAction } from "@/app/_actions/record-actions";
import { confirmAction, notify, notifyError } from "./app-dialog";

/**
 * Every delete asks the server first (lib/records/delete-rules.ts): refused while other records
 * still use it, otherwise the confirm says what goes with it ("Also deletes 3 deals").
 */
export async function confirmDelete(options: { recordKey: string; ids: string[]; title: string; confirmLabel: string; message?: string }) {
  let info: { blocked: string; also: string };
  try {
    const reply = await describeDeleteAction(options.recordKey, options.ids);
    info = { blocked: reply?.blocked || "", also: reply?.also || "" };
  } catch (error) {
    notifyError(error, "Could not check what this deletes.");
    return false;
  }
  if (info.blocked) {
    notify(`Can’t delete. ${info.blocked}`, "error");
    return false;
  }
  return confirmAction({ title: options.title, message: [options.message, info.also, "This cannot be undone."].filter(Boolean).join(" "), confirmLabel: options.confirmLabel, danger: true });
}
