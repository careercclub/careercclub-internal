// Who may see which ticket. Shared by the Tickets page and global search so the two
// can never disagree (a staff member must not find someone else's ticket via Ctrl+K).
// Pure: no runtime imports, tested directly under `node --test`.

type Row = Record<string, unknown>;

export type TicketViewer = { role?: string | null; userId?: string | null; email?: string | null };

/** Columns a ticket row needs for the visibility check. */
export const TICKET_VISIBILITY_COLUMNS = ["requester_id", "assigned_to_id", "assigned_to_ids"] as const;

export function findTicketPerson(viewer: TicketViewer, people: Row[]) {
  // Prefer the explicit account link (018_ticket_assignee_auth_user.sql); fall back to
  // the email match for person rows created before it, and for databases where the
  // migration has not been applied yet.
  const userId = String(viewer.userId || "");
  const email = String(viewer.email || "").toLowerCase();
  return (userId ? people.find((person) => String(person.auth_user_id || "") === userId) : undefined)
    ?? (email ? people.find((person) => String(person.email || "").toLowerCase() === email) : undefined);
}

function assignees(ticket: Row) {
  if (Array.isArray(ticket.assigned_to_ids)) return ticket.assigned_to_ids.map(String);
  return ticket.assigned_to_id ? [String(ticket.assigned_to_id)] : [];
}

/** Returns a predicate: admin sees all; lead sees own requests + division's assignments; staff sees own requests + own assignments. */
export function ticketVisibility(viewer: TicketViewer, people: Row[]) {
  const role = String(viewer.role || "staff").toLowerCase();
  if (role === "admin") return () => true;
  const person = findTicketPerson(viewer, people);
  if (!person) return () => false;
  const personId = String(person.id);
  const divisionPeople = people.filter((item) => String(item.divisi_id || "") === String(person.divisi_id || "")).map((item) => String(item.id));
  return (ticket: Row) => {
    if (String(ticket.requester_id || "") === personId) return true;
    const assigned = assignees(ticket);
    return role === "lead" ? assigned.some((id) => divisionPeople.includes(id)) : assigned.includes(personId);
  };
}
