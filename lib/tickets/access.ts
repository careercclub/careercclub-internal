import "server-only";
import { getTicket, listTicketPeople } from "@/lib/api/tickets";
import type { SessionUser } from "@/lib/auth/guards";
import { ticketVisibility } from "./visibility";

/**
 * A ticket can only be changed by someone who may see it — the same rule as the board and search
 * (lib/tickets/visibility.ts). A ticket the person may not see is answered as "not found", so an
 * id alone says nothing about it (Putaran 58).
 */
export async function requireTicketAccess(user: SessionUser, ticketId: string) {
  const ticket = await getTicket(String(ticketId));
  if (!ticket) throw new Error("Ticket not found.");
  const visible = ticketVisibility({ role: user.role, userId: user.id, email: user.email }, await listTicketPeople());
  if (!visible(ticket)) throw new Error("Ticket not found.");
  return ticket;
}
