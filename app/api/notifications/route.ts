import { auth } from "@/auth";
import {
  isUuid,
  listNotificationsForUser,
  markAllNotificationsRead,
  markNotificationRead,
} from "@/lib/api/notifications";

async function getIdentity() {
  const session = await auth();
  const userId = session?.user?.id;

  return session?.user && isUuid(userId)
    ? { userId, role: session.user.role }
    : null;
}

export async function GET() {
  const identity = await getIdentity();
  if (!identity) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const notifications = await listNotificationsForUser(identity.userId, identity.role);

  return Response.json(
    {
      notifications,
      unreadCount: notifications.filter((notification) => !notification.is_read).length,
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}

export async function PATCH(request: Request) {
  const identity = await getIdentity();
  if (!identity) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const body = (await request.json()) as { operation?: unknown; notificationId?: unknown };

  if (body.operation === "mark-all-read") {
    await markAllNotificationsRead(identity.userId, identity.role);
    return Response.json({ success: true });
  }

  if (body.operation === "mark-read" && isUuid(body.notificationId)) {
    const success = await markNotificationRead(
      body.notificationId,
      identity.userId,
      identity.role,
    );

    return Response.json({ success }, { status: success ? 200 : 404 });
  }

  return Response.json({ error: "Invalid notification operation." }, { status: 400 });
}
