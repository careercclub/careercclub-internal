"use server";

import { expected } from "@/lib/actions/expected";
import { requireTicketAccess } from "@/lib/tickets/access";

import { auth } from "@/auth";
import { synchronizeTicketToTask } from "@/lib/api/program";
import { updateTicket } from "@/lib/api/tickets";
import { revalidatePath } from "next/cache";

export async function rescheduleTicketAction(id: string, date: string) {
  return expected(async () => {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error("Invalid deadline.");
  const ticket = await requireTicketAccess(session.user, id);
  await updateTicket(id, { due_date: date });
  if (ticket.related_task_id) await synchronizeTicketToTask(id);
  revalidatePath("/dashboard");
  revalidatePath("/tickets");
  revalidatePath("/program/tasks");
  revalidatePath("/", "layout");
  });
}
