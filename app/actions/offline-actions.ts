"use server";

import { expected } from "@/lib/actions/expected";
import { requireTicketAccess } from "@/lib/tickets/access";

import { auth } from "@/auth";
import { isActionFailure } from "@/lib/actions/result";
import { getProgramTask } from "@/lib/api/program";
import { OFFLINE_FIELDS, planReplay, type Conflict, type OfflineKind } from "@/lib/offline/fields";
import { rescheduleTicketAction } from "./dashboard-actions";
import { updateProgramTaskWorkflowAction, updateTaskDetailsAction } from "./program-actions";
import { changeTicketStatusAction, updateTicketDetailsAction } from "./ticket-actions";

// A change made offline reaches the server (rules in lib/offline/fields.ts). It is saved through the
// same action as an online save, so every check, notification and ticket↔task sync is the same.

export type OfflineReplay = { result: "applied" | "already" | "missing" } | { result: "conflict"; conflicts: Conflict[] };

const list = (value: string) => (value ? value.split(",") : []);
const only = (changed: string[], allowed: string[]) => changed.every((field) => allowed.includes(field));

async function run(result: Promise<unknown>) {
  const value = await result;
  if (isActionFailure(value)) throw new Error(value.__actionError);
}

export async function applyOfflineChangeAction(change: { kind: OfflineKind; id: string; before: Record<string, string>; after: Record<string, string> }, keepMine = false) {
  return expected(async () => {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");
  const { kind, id } = change;
  if (kind !== "ticket" && kind !== "task") throw new Error("This change cannot be saved offline.");
  if (!/^[0-9a-f-]{36}$/i.test(String(id))) throw new Error(`Invalid ${kind}.`);
  const fields = Object.keys(change.after || {});
  if (!fields.length || fields.some((field) => !OFFLINE_FIELDS[kind].includes(field))) throw new Error("This change cannot be saved offline.");
  const text = (values: Record<string, string>) => Object.fromEntries(Object.entries(values || {}).map(([k, v]) => [k, String(v ?? "")]));
  // A ticket the person may not see is "not found" here too (same rule as an online save).
  const current = kind === "ticket" ? await requireTicketAccess(session.user, id).catch(() => null) : await getProgramTask(id);
  if (!current) return { result: "missing" } as OfflineReplay;
  const plan = planReplay(kind, current, text(change.before), text(change.after));
  if (plan.state === "already") return { result: "already" } as OfflineReplay;
  if (plan.state === "conflict" && !keepMine) return { result: "conflict", conflicts: plan.conflicts } as OfflineReplay;
  const { merged: m, changed } = plan;
  if (kind === "ticket") {
    if (only(changed, ["status"])) await run(changeTicketStatusAction(id, m.status));
    else if (only(changed, ["due_date"]) && m.due_date) await run(rescheduleTicketAction(id, m.due_date));
    else {
      const cc = Array.isArray(current.cc) ? current.cc.join(",") : String(current.cc ?? "");
      await run(updateTicketDetailsAction(id, { title: m.title, description: m.description, status: m.status, priority: m.priority, dueDate: m.due_date || null, assignedToIds: list(m.assigned_to_ids), divisionId: m.divisi_id || null, typeId: current.type_id ?? null, cc }));
    }
  } else if (only(changed, ["status", "due_date"]) && (!changed.includes("due_date") || m.due_date)) {
    await run(updateProgramTaskWorkflowAction(id, { status: changed.includes("status") ? m.status : undefined, dueDate: changed.includes("due_date") ? m.due_date : undefined }));
  } else {
    await run(updateTaskDetailsAction(id, { title: m.title, description: m.description, status: m.status, priority: m.priority, phase: m.phase || undefined, dueDate: m.due_date || null, assigneeIds: list(m.assignee_ids) }));
  }
  return { result: "applied" } as OfflineReplay;
  });
}
