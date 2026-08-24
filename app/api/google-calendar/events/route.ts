import { auth } from "@/auth";
import { getProgramTask, updateProgramTask } from "@/lib/api/program";
import { getTicket, updateTicket } from "@/lib/api/tickets";

type RequestBody = {
  accessToken?: unknown;
  taskId?: unknown;
  ticketId?: unknown;
  title?: unknown;
  description?: unknown;
  start?: unknown;
  end?: unknown;
  allDay?: unknown;
  attendees?: unknown;
};

function value(input: unknown, max: number) {
  return typeof input === "string" ? input.trim().slice(0, max) : "";
}

function isDateTime(value: string) {
  return /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(value) && Number.isFinite(new Date(value).getTime());
}

function isDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function nextDate(value: string) {
  const date = new Date(`${value}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + 1);
  return date.toISOString().slice(0, 10);
}

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

export async function GET() {
  const session = await auth();
  if (!session?.user) return Response.json({ error: "Unauthorized" }, { status: 401 });
  return Response.json(
    { clientId: process.env.GOOGLE_OAUTH_CLIENT_ID || process.env["NEXT_PUBLIC_GOOGLE_CLIENT_ID"] || "" },
    { headers: { "Cache-Control": "no-store" } },
  );
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json() as RequestBody;
  const accessToken = value(body.accessToken, 4096);
  const taskId = value(body.taskId, 64);
  const ticketId = value(body.ticketId, 64);
  const title = value(body.title, 300);
  const description = value(body.description, 5000);
  const start = value(body.start, 40);
  const end = value(body.end, 40);
  const allDay = body.allDay === true;
  const attendees = Array.isArray(body.attendees)
    ? body.attendees.map((email) => value(email, 254).toLowerCase()).filter((email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)).slice(0, 50)
    : [];

  const validRecordId = (taskId && isUuid(taskId)) || (ticketId && isUuid(ticketId));
  const validRange = allDay
    ? isDate(start) && isDate(end) && end >= start
    : isDateTime(start) && isDateTime(end) && new Date(end) > new Date(start);

  if (!accessToken || (!taskId && !ticketId) || (taskId && ticketId) || !validRecordId || !title || !validRange) {
    return Response.json({ error: "One task or ticket, title, and a valid start/end range are required." }, { status: 400 });
  }

  const record = taskId ? await getProgramTask(taskId) : await getTicket(ticketId);
  if (!record) return Response.json({ error: taskId ? "Task not found." : "Ticket not found." }, { status: 404 });

  const existingEventId = value(record.gcal_event_id, 1024);
  const endpoint = existingEventId
    ? `https://www.googleapis.com/calendar/v3/calendars/primary/events/${encodeURIComponent(existingEventId)}?sendUpdates=all`
    : "https://www.googleapis.com/calendar/v3/calendars/primary/events?sendUpdates=all";
  const googleResponse = await fetch(endpoint, {
    method: existingEventId ? "PATCH" : "POST",
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      summary: title,
      description,
      start: allDay ? { date: start } : { dateTime: start, timeZone: "Asia/Jakarta" },
      end: allDay ? { date: nextDate(end) } : { dateTime: end, timeZone: "Asia/Jakarta" },
      attendees: attendees.map((email) => ({ email })),
    }),
  });

  if (!googleResponse.ok) {
    const detail = await googleResponse.text();
    console.error("Google Calendar API error", googleResponse.status, detail.slice(0, 1000));
    return Response.json({
      code: googleResponse.status === 401 ? "GOOGLE_TOKEN_EXPIRED" : "GOOGLE_CALENDAR_REJECTED",
      error: googleResponse.status === 401
        ? "Google authorization expired. Please try again."
        : existingEventId && googleResponse.status === 404
          ? "The original Google Calendar event could not be found."
          : "Google Calendar rejected the event.",
    }, { status: 502 });
  }

  const event = await googleResponse.json() as { id?: string; htmlLink?: string };
  const calendarState = {
    gcal_added: true,
    gcal_event_id: event.id || existingEventId,
    gcal_event_url: event.htmlLink || null,
  };
  if (taskId) await updateProgramTask(taskId, calendarState);
  else await updateTicket(ticketId, calendarState);
  return Response.json({ id: calendarState.gcal_event_id, url: calendarState.gcal_event_url, operation: existingEventId ? "updated" : "created" });
}
