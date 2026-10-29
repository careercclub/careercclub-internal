import "server-only";
import type postgres from "postgres";
import webPush, { type PushSubscription } from "web-push";
import { withPostgres } from "@/lib/db/postgres";
import { ticketAudience } from "@/lib/tickets/visibility";

export type TicketNotificationEvent = "created" | "updated" | "deleted";

export type TicketNotificationRecord = {
  id: string;
  ticket_id: string | null;
  actor_user_id: string | null;
  actor_name: string;
  event_type: TicketNotificationEvent;
  title: string;
  message: string;
  target_roles: string[];
  target_user_ids?: string[] | null;
  created_at: Date | string;
  is_read: boolean;
};

export type PushSubscriptionInput = {
  endpoint: string;
  keys: {
    p256dh: string;
    auth: string;
  };
};

type PublishTicketNotificationInput = {
  ticketId?: string | null;
  actorUserId?: string | null;
  actorName: string;
  eventType: TicketNotificationEvent;
  title: string;
  message: string;
  targetRoles: unknown;
  /** The ticket (for a delete: as it was). Its audience is everyone who may see it (Putaran 57). */
  ticket?: Record<string, unknown> | null;
};

type StoredPushSubscription = {
  id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
};

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isUuid(value: unknown): value is string {
  return typeof value === "string" && uuidPattern.test(value);
}

export function normalizeNotificationRoles(value: unknown) {
  const source = Array.isArray(value) ? value : typeof value === "string" ? value.split(",") : [];
  const roles = source
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);

  return [...new Set(roles)].slice(0, 20);
}

function normalizeUserRole(role: unknown) {
  return typeof role === "string" && role.trim() ? role.trim().toLowerCase() : "member";
}

function getVapidDetails() {
  const publicKey = process.env.VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT;

  return publicKey && privateKey && subject ? { publicKey, privateKey, subject } : null;
}

export function getVapidPublicKey() {
  return process.env.VAPID_PUBLIC_KEY || null;
}

// target_user_ids arrives with migration 031; until it has run, notifications keep going by role.
let peopleColumn = false;
async function hasPeopleColumn() {
  // Remembered once found; asked again while missing, so the migration is picked up without a restart.
  if (peopleColumn) return true;
  peopleColumn = await withPostgres(async (sql) => {
    const [row] = await sql`select 1 from information_schema.columns where table_schema = 'public' and table_name = 'ticket_notifications' and column_name = 'target_user_ids'`;
    return Boolean(row);
  }).catch(() => false);
  return peopleColumn;
}

/** "This notification is for me": the stored people, or the role for notifications made before 031. */
function forMe(sql: postgres.Sql, withPeople: boolean, userId: string, role: string) {
  return withPeople
    ? sql`(case when notification.target_user_ids is not null then ${userId}::uuid = any(notification.target_user_ids) else ${role} = any(notification.target_roles) end)`
    : sql`${role} = any(notification.target_roles)`;
}

export function listNotificationsForUser(userId: string, role: string | null | undefined, limit = 30) {
  if (!isUuid(userId)) return Promise.resolve([] as TicketNotificationRecord[]);
  const normalizedRole = normalizeUserRole(role);
  const boundedLimit = Math.min(Math.max(limit, 1), 50);

  return withPostgres(async (sql) => {
    const withPeople = await hasPeopleColumn();
    const rows = await sql<TicketNotificationRecord[]>`
      select
        notification.*,
        (receipt.user_id is not null) as is_read
      from ticket_notifications notification
      left join ticket_notification_reads receipt
        on receipt.notification_id = notification.id
       and receipt.user_id = ${userId}::uuid
      where ${forMe(sql, withPeople, userId, normalizedRole)}
      order by notification.created_at desc
      limit ${boundedLimit}
    `;

    return [...rows];
  });
}

export async function markNotificationRead(
  notificationId: string,
  userId: string,
  role: string | null | undefined,
) {
  if (!isUuid(notificationId) || !isUuid(userId)) return false;
  const normalizedRole = normalizeUserRole(role);

  return withPostgres(async (sql) => {
    const withPeople = await hasPeopleColumn();
    const result = await sql`
      insert into ticket_notification_reads (notification_id, user_id)
      select notification.id, ${userId}::uuid
      from ticket_notifications notification
      where notification.id = ${notificationId}::uuid
        and ${forMe(sql, withPeople, userId, normalizedRole)}
      on conflict (notification_id, user_id) do update
      set read_at = now()
    `;

    return (result.count ?? 0) > 0;
  });
}

export async function markAllNotificationsRead(
  userId: string,
  role: string | null | undefined,
) {
  if (!isUuid(userId)) return 0;
  const normalizedRole = normalizeUserRole(role);

  return withPostgres(async (sql) => {
    const withPeople = await hasPeopleColumn();
    const result = await sql`
      insert into ticket_notification_reads (notification_id, user_id)
      select notification.id, ${userId}::uuid
      from ticket_notifications notification
      where ${forMe(sql, withPeople, userId, normalizedRole)}
      on conflict (notification_id, user_id) do update
      set read_at = now()
    `;

    return result.count ?? 0;
  });
}

export function savePushSubscription(
  userId: string,
  subscription: PushSubscriptionInput,
  userAgent?: string | null,
) {
  if (!isUuid(userId)) throw new Error("A database-backed user is required for push notifications.");

  return withPostgres(async (sql) => {
    await sql`
      insert into web_push_subscriptions (user_id, endpoint, p256dh, auth, user_agent)
      values (
        ${userId}::uuid,
        ${subscription.endpoint},
        ${subscription.keys.p256dh},
        ${subscription.keys.auth},
        ${userAgent?.slice(0, 500) || null}
      )
      on conflict (endpoint) do update
      set
        user_id = excluded.user_id,
        p256dh = excluded.p256dh,
        auth = excluded.auth,
        user_agent = excluded.user_agent,
        updated_at = now()
    `;
  });
}

export function deletePushSubscription(userId: string, endpoint: string) {
  if (!isUuid(userId)) return Promise.resolve(0);

  return withPostgres(async (sql) => {
    const result = await sql`
      delete from web_push_subscriptions
      where user_id = ${userId}::uuid
        and endpoint = ${endpoint}
    `;

    return result.count ?? 0;
  });
}

async function sendPushToRoles(
  notification: Omit<TicketNotificationRecord, "is_read">,
) {
  const vapid = getVapidDetails();
  if (!vapid) return;

  const subscriptions = await withPostgres(async (sql) => {
    const roles = sql.array(notification.target_roles);
    const people = Array.isArray(notification.target_user_ids) ? notification.target_user_ids : null;
    const rows = await sql<StoredPushSubscription[]>`
      select subscription.id, subscription.endpoint, subscription.p256dh, subscription.auth
      from web_push_subscriptions subscription
      join auth_users app_user on app_user.id = subscription.user_id
      where app_user.is_active is true
        and ${people ? sql`subscription.user_id = any(${people}::uuid[])` : sql`lower(coalesce(app_user.role, 'member')) = any(${roles}::text[])`}
    `;

    return [...rows];
  });

  const payload = JSON.stringify({
    title: notification.title,
    body: notification.message,
    url: "/tickets",
    tag: `ticket-${notification.ticket_id || notification.id}`,
    notificationId: notification.id,
  });

  const staleSubscriptionIds: string[] = [];

  await Promise.allSettled(
    subscriptions.map(async (subscription) => {
      try {
        await webPush.sendNotification(
          {
            endpoint: subscription.endpoint,
            keys: { p256dh: subscription.p256dh, auth: subscription.auth },
          } satisfies PushSubscription,
          payload,
          {
            TTL: 3600,
            urgency: notification.event_type === "created" ? "high" : "normal",
            topic: notification.id.replaceAll("-", "").slice(0, 32),
            vapidDetails: vapid,
          },
        );
      } catch (error) {
        const statusCode =
          typeof error === "object" && error !== null && "statusCode" in error
            ? Number(error.statusCode)
            : 0;

        if (statusCode === 404 || statusCode === 410) {
          staleSubscriptionIds.push(subscription.id);
        } else {
          console.error("Ticket push delivery failed", error);
        }
      }
    }),
  );

  if (staleSubscriptionIds.length) {
    await withPostgres(async (sql) => {
      await sql`
        delete from web_push_subscriptions
        where id = any(${sql.array(staleSubscriptionIds)}::uuid[])
      `;
    });
  }
}

export async function publishTicketNotification(input: PublishTicketNotificationInput) {
  const targetRoles = normalizeNotificationRoles(input.targetRoles);
  const actorUserId = isUuid(input.actorUserId) ? input.actorUserId : null;
  const withPeople = Boolean(input.ticket) && await hasPeopleColumn();
  if (!withPeople && !targetRoles.length) return null;

  const notification = await withPostgres(async (sql) => {
    let people: string[] | null = null;
    if (withPeople && input.ticket) {
      // Everyone who may see this ticket (board rule), except whoever made the change.
      const [accounts, persons] = await Promise.all([
        sql<Array<{ id: string; email: string | null; role: string | null; is_active: boolean | null }>>`select id, email, role, is_active from auth_users where is_active is not false`,
        sql<Array<Record<string, unknown>>>`select * from tkt_people`,
      ]);
      people = ticketAudience(input.ticket, [...accounts], [...persons], actorUserId);
      if (!people.length) return null;
    }
    const [row] = await sql<Omit<TicketNotificationRecord, "is_read">[]>`
      insert into ticket_notifications (
        ticket_id,
        actor_user_id,
        actor_name,
        event_type,
        title,
        message,
        target_roles${people ? sql`, target_user_ids` : sql``}
      )
      values (
        ${isUuid(input.ticketId) ? input.ticketId : null}::uuid,
        ${actorUserId}::uuid,
        ${input.actorName.slice(0, 120)},
        ${input.eventType},
        ${input.title.slice(0, 180)},
        ${input.message.slice(0, 500)},
        ${sql.array(targetRoles)}::text[]${people ? sql`, ${people}::uuid[]` : sql``}
      )
      returning *
    `;

    return row;
  });

  if (notification) {
    await sendPushToRoles(notification);
  }

  return notification ?? null;
}
