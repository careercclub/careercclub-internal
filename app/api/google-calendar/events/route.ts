import { auth } from "@/auth";
import { updateProgramTask } from "@/lib/api/program";

type RequestBody = {
  accessToken?: unknown;
  taskId?: unknown;
  title?: unknown;
  description?: unknown;
  start?: unknown;
  end?: unknown;
  attendees?: unknown;
};

function value(input: unknown, max: number) {
  return typeof input === "string" ? input.trim().slice(0, max) : "";
}

function isDateTime(value: string) {
  return /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(value) && Number.isFinite(new Date(value).getTime());
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json() as RequestBody;
  const accessToken = value(body.accessToken, 4096);
  const taskId = value(body.taskId, 64);
  const title = value(body.title, 300);
  const description = value(body.description, 5000);
  const start = value(body.start, 40);
  const end = value(body.end, 40);
  const attendees = Array.isArray(body.attendees)
    ? body.attendees.map((email) => value(email, 254).toLowerCase()).filter((email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)).slice(0, 50)
    : [];

  if (!accessToken || !taskId || !title || !isDateTime(start) || !isDateTime(end) || new Date(end) <= new Date(start)) {
    return Response.json({ error: "Task, title, and a valid start/end range are required." }, { status: 400 });
  }

  const googleResponse = await fetch("https://www.googleapis.com/calendar/v3/calendars/primary/events?sendUpdates=all", {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      summary: title,
      description,
      start: { dateTime: start, timeZone: "Asia/Jakarta" },
      end: { dateTime: end, timeZone: "Asia/Jakarta" },
      attendees: attendees.map((email) => ({ email })),
    }),
  });

  if (!googleResponse.ok) {
    const detail = await googleResponse.text();
    console.error("Google Calendar API error", googleResponse.status, detail.slice(0, 1000));
    return Response.json({ error: googleResponse.status === 401 ? "Google authorization expired. Please try again." : "Google Calendar rejected the event." }, { status: 502 });
  }

  const event = await googleResponse.json() as { id?: string; htmlLink?: string };
  await updateProgramTask(taskId, { gcal_added: true });
  return Response.json({ id: event.id, url: event.htmlLink });
}
