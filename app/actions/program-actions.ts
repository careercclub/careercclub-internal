"use server";

import { auth } from "@/auth";
import { duplicateProgramEvent, repairTaskTicketLinks } from "@/lib/api/program";
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
