import { auth } from "@/auth";
import {
  deletePushSubscription,
  getVapidPublicKey,
  isUuid,
  savePushSubscription,
  type PushSubscriptionInput,
} from "@/lib/api/notifications";

async function getUserId() {
  const session = await auth();
  return isUuid(session?.user?.id) ? session.user.id : null;
}

function isValidSubscription(value: unknown): value is PushSubscriptionInput {
  if (!value || typeof value !== "object") return false;
  const subscription = value as Partial<PushSubscriptionInput>;

  if (
    typeof subscription.endpoint !== "string" ||
    subscription.endpoint.length > 2048 ||
    !subscription.endpoint.startsWith("https://") ||
    !subscription.keys
  ) {
    return false;
  }

  return (
    typeof subscription.keys.p256dh === "string" &&
    subscription.keys.p256dh.length <= 512 &&
    typeof subscription.keys.auth === "string" &&
    subscription.keys.auth.length <= 512
  );
}

export async function GET() {
  const userId = await getUserId();
  if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const publicKey = getVapidPublicKey();
  return Response.json(
    { configured: Boolean(publicKey), publicKey },
    { headers: { "Cache-Control": "no-store" } },
  );
}

export async function POST(request: Request) {
  const userId = await getUserId();
  if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const subscription = (await request.json()) as unknown;
  if (!isValidSubscription(subscription)) {
    return Response.json({ error: "Invalid push subscription." }, { status: 400 });
  }

  await savePushSubscription(userId, subscription, request.headers.get("user-agent"));
  return Response.json({ success: true });
}

export async function DELETE(request: Request) {
  const userId = await getUserId();
  if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const body = (await request.json()) as { endpoint?: unknown };
  if (typeof body.endpoint !== "string" || !body.endpoint.startsWith("https://")) {
    return Response.json({ error: "A valid endpoint is required." }, { status: 400 });
  }

  await deletePushSubscription(userId, body.endpoint);
  return Response.json({ success: true });
}
