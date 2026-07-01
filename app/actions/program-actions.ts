"use server";

import { auth } from "@/auth";
import { createEventRundownItem, deleteEventRundownItem, duplicateProgramEvent, repairTaskTicketLinks, updateEventRundownItem } from "@/lib/api/program";
import { synchronizeTaskToTicket } from "@/lib/api/program";
import { withPostgres } from "@/lib/db/postgres";
import { revalidatePath } from "next/cache";

async function requireUser() {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");
  return session.user;
}

export async function duplicateProgramAction(formData: FormData) {
  await requireUser();
  const eventId = String(formData.get("event_id") || "").trim();
  const name = String(formData.get("name") || "").trim();
  const date = String(formData.get("date") || "").trim();
  const taskIds = formData.getAll("task_ids").map(String).filter(Boolean);
  if (!eventId || !name || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    throw new Error("Program, duplicate name, and date are required.");
  }
  await duplicateProgramEvent({ eventId, name, date, taskIds: taskIds.length ? taskIds : undefined });
  revalidatePath("/program");
  revalidatePath("/program/tasks");
}

export async function repairProgramTicketLinksAction() {
  const user = await requireUser();
  await repairTaskTicketLinks(user.id);
  revalidatePath("/program/tasks");
  revalidatePath("/tickets");
  revalidatePath("/dashboard");
}

export async function updateProgramTaskWorkflowAction(id: string, input: { status?: string; dueDate?: string }) {
  const user = await requireUser();
  if (!/^[0-9a-f-]{36}$/i.test(id)) throw new Error("Invalid task.");
  if (input.status && !["Todo", "On Progress", "Done"].includes(input.status)) throw new Error("Invalid task status.");
  if (input.dueDate && !/^\d{4}-\d{2}-\d{2}$/.test(input.dueDate)) throw new Error("Invalid task date.");
  await withPostgres(async (sql) => sql.begin(async (tx) => {
    const [task] = await tx<{ project_id: string | null }[]>`
      update tasks set
        status = coalesce(${input.status || null}, status),
        due_date = coalesce(${input.dueDate || null}, due_date)
      where id = ${id}
      returning project_id
    `;
    if (!task) throw new Error("Task not found.");
    if (task.project_id) {
      await tx`
        update events set status = 'On Progress'
        where id = ${task.project_id} and status = 'Planning'
          and exists (select 1 from tasks where project_id = ${task.project_id} and status <> 'Todo')
      `;
    }
  }));
  await synchronizeTaskToTicket(id, user.id);
  revalidatePath("/program"); revalidatePath("/program/tasks"); revalidatePath("/tickets"); revalidatePath("/dashboard");
}

export async function updateTaskDetailsAction(id: string, input: { title: string; description?: string; status?: string; priority?: string; phase?: string; dueDate?: string | null; assigneeIds?: string[] }) {
  const user = await requireUser();
  if (!/^[0-9a-f-]{36}$/i.test(id)) throw new Error("Invalid task.");
  const title = input.title.trim();
  if (!title) throw new Error("Task title is required.");
  const status = input.status && ["Todo", "On Progress", "Done"].includes(input.status) ? input.status : "Todo";
  const priority = input.priority && ["High", "Med", "Low"].includes(input.priority) ? input.priority : "Med";
  const phase = input.phase && ["Pre Event", "Hari H", "Post Event"].includes(input.phase) ? input.phase : null;
  if (input.dueDate && !/^\d{4}-\d{2}-\d{2}$/.test(input.dueDate)) throw new Error("Invalid task date.");
  const assignees = (input.assigneeIds || []).map(String).filter((value) => /^[0-9a-f-]{36}$/i.test(value));
  await withPostgres(async (sql) => sql.begin(async (tx) => {
    const [task] = await tx<{ project_id: string | null }[]>`
      update tasks set
        title = ${title},
        description = ${input.description ?? ""},
        status = ${status},
        priority = ${priority},
        phase = ${phase},
        due_date = ${input.dueDate || null},
        assignee_ids = ${assignees}::uuid[],
        assignee_id = ${assignees[0] || null}
      where id = ${id}
      returning project_id
    `;
    if (!task) throw new Error("Task not found.");
    if (task.project_id) {
      await tx`
        update events set status = 'On Progress'
        where id = ${task.project_id} and status = 'Planning'
          and exists (select 1 from tasks where project_id = ${task.project_id} and status <> 'Todo')
      `;
    }
  }));
  await synchronizeTaskToTicket(id, user.id);
  revalidatePath("/program"); revalidatePath("/program/tasks"); revalidatePath("/tickets"); revalidatePath("/dashboard");
}

export async function createRundownRowAction(eventId: string, order: number) {
  await requireUser();
  await createEventRundownItem({ event_id: eventId, durasi: 0, activity: "New activity", keterangan: "", link: "", cue_mc: "", urutan: order });
  revalidatePath("/program/rundown");
}

export async function saveRundownRowAction(id: string, formData: FormData) {
  await requireUser();
  const duration = Number(formData.get("durasi") || 0);
  await updateEventRundownItem(id, {
    durasi: Number.isFinite(duration) ? duration : 0,
    activity: String(formData.get("activity") || "").trim(),
    keterangan: String(formData.get("keterangan") || "").trim(),
    link: String(formData.get("link") || "").trim(),
    cue_mc: String(formData.get("cue_mc") || "").trim(),
  });
  revalidatePath("/program/rundown");
}

export async function deleteRundownRowAction(id: string) {
  await requireUser();
  await deleteEventRundownItem(id);
  revalidatePath("/program/rundown");
}

export async function moveRundownRowAction(id: string, targetId: string, idOrder: number, targetOrder: number) {
  await requireUser();
  await Promise.all([updateEventRundownItem(id, { urutan: targetOrder }), updateEventRundownItem(targetId, { urutan: idOrder })]);
  revalidatePath("/program/rundown");
}
