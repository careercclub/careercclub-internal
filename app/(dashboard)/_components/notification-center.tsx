"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import styles from "../dashboard.module.css";

type NotificationItem = {
  id: string;
  actor_name: string;
  event_type: "created" | "updated" | "deleted";
  title: string;
  message: string;
  created_at: string;
  is_read: boolean;
};

type NotificationResponse = {
  notifications: NotificationItem[];
  unreadCount: number;
};

type PushState = "checking" | "unsupported" | "unconfigured" | "default" | "enabled" | "denied" | "busy";

function timeAgo(value: string) {
  const timestamp = new Date(value).getTime();
  if (!Number.isFinite(timestamp)) return "";

  const seconds = Math.round((timestamp - Date.now()) / 1000);
  const formatter = new Intl.RelativeTimeFormat("en", { numeric: "auto" });
  if (Math.abs(seconds) < 60) return formatter.format(seconds, "second");
  const minutes = Math.round(seconds / 60);
  if (Math.abs(minutes) < 60) return formatter.format(minutes, "minute");
  const hours = Math.round(minutes / 60);
  if (Math.abs(hours) < 24) return formatter.format(hours, "hour");
  const days = Math.round(hours / 24);
  if (Math.abs(days) < 7) return formatter.format(days, "day");
  return new Intl.DateTimeFormat("en", { dateStyle: "medium", timeStyle: "short" }).format(timestamp);
}

function applicationServerKey(value: string) {
  const padding = "=".repeat((4 - (value.length % 4)) % 4);
  const base64 = (value + padding).replaceAll("-", "+").replaceAll("_", "/");
  const raw = window.atob(base64);
  return Uint8Array.from([...raw].map((character) => character.charCodeAt(0)));
}

export function NotificationCenter() {
  const router = useRouter();
  const rootRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [pushState, setPushState] = useState<PushState>("checking");

  const loadNotifications = useCallback(async () => {
    try {
      const response = await fetch("/api/notifications", { cache: "no-store" });
      if (!response.ok) throw new Error("Notifications could not be loaded.");
      const payload = (await response.json()) as NotificationResponse;
      setNotifications(payload.notifications);
      setUnreadCount(payload.unreadCount);
      setError(null);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Notifications could not be loaded.");
    } finally {
      setLoading(false);
    }
  }, []);

  const refreshPushState = useCallback(async () => {
    if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) {
      setPushState("unsupported");
      return;
    }

    if (Notification.permission === "denied") {
      setPushState("denied");
      return;
    }

    try {
      const response = await fetch("/api/push-subscriptions", { cache: "no-store" });
      if (!response.ok) throw new Error();
      const config = (await response.json()) as { configured: boolean };
      if (!config.configured) {
        setPushState("unconfigured");
        return;
      }

      const registration = await navigator.serviceWorker.getRegistration();
      const subscription = await registration?.pushManager.getSubscription();
      setPushState(subscription ? "enabled" : "default");
    } catch {
      setPushState("unconfigured");
    }
  }, []);

  useEffect(() => {
    const initialTimer = window.setTimeout(() => {
      void loadNotifications();
      void refreshPushState();
    }, 0);

    const interval = setInterval(() => {
      if (document.visibilityState === "visible") void loadNotifications();
    }, 60_000);

    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") void loadNotifications();
    };
    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      window.clearTimeout(initialTimer);
      clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [loadNotifications, refreshPushState]);

  useEffect(() => {
    const onPointerDown = (event: PointerEvent) => {
      if (open && rootRef.current && !rootRef.current.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [open]);

  async function markAllRead() {
    const response = await fetch("/api/notifications", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ operation: "mark-all-read" }),
    });

    if (response.ok) {
      setUnreadCount(0);
      setNotifications((items) => items.map((item) => ({ ...item, is_read: true })));
    }
  }

  async function openNotification(notification: NotificationItem) {
    setOpen(false);
    if (!notification.is_read) {
      setUnreadCount((count) => Math.max(0, count - 1));
      setNotifications((items) => items.map((item) => item.id === notification.id ? { ...item, is_read: true } : item));
      void fetch("/api/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ operation: "mark-read", notificationId: notification.id }),
      });
    }
    router.push("/tickets");
  }

  async function enablePush() {
    setPushState("busy");
    try {
      const configResponse = await fetch("/api/push-subscriptions", { cache: "no-store" });
      const config = (await configResponse.json()) as { configured: boolean; publicKey: string | null };
      if (!configResponse.ok || !config.configured || !config.publicKey) throw new Error("Push is not configured.");

      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setPushState(permission === "denied" ? "denied" : "default");
        return;
      }

      const registration = await navigator.serviceWorker.register("/sw.js", { scope: "/" });
      const existing = await registration.pushManager.getSubscription();
      const subscription = existing || await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: applicationServerKey(config.publicKey),
      });

      const response = await fetch("/api/push-subscriptions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(subscription.toJSON()),
      });
      if (!response.ok) throw new Error("Subscription could not be saved.");
      setPushState("enabled");
    } catch (pushError) {
      setError(pushError instanceof Error ? pushError.message : "Push notifications could not be enabled.");
      await refreshPushState();
    }
  }

  async function disablePush() {
    setPushState("busy");
    try {
      const registration = await navigator.serviceWorker.getRegistration();
      const subscription = await registration?.pushManager.getSubscription();
      if (subscription) {
        await fetch("/api/push-subscriptions", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ endpoint: subscription.endpoint }),
        });
        await subscription.unsubscribe();
      }
      setPushState("default");
    } catch {
      setError("Push notifications could not be disabled.");
      await refreshPushState();
    }
  }

  const pushLabel = pushState === "enabled" ? "Disable push" : pushState === "busy" || pushState === "checking" ? "Checking..." : "Enable push";
  const pushDisabled = ["busy", "checking", "unsupported", "unconfigured", "denied"].includes(pushState);

  return (
    <div className={styles.notificationRoot} ref={rootRef}>
      <button
        className={styles.notifButton}
        type="button"
        aria-label={`Notifications${unreadCount ? `, ${unreadCount} unread` : ""}`}
        aria-expanded={open}
        onClick={() => {
          setOpen((value) => !value);
          if (!open) void loadNotifications();
        }}
      >
        <i className="ti ti-bell" aria-hidden="true" />
        {unreadCount ? <span className={styles.notificationCount}>{unreadCount > 99 ? "99+" : unreadCount}</span> : null}
      </button>

      {open ? (
        <section className={styles.notificationPanel} aria-label="Ticket notifications">
          <header className={styles.notificationHeader}>
            <div><strong>Ticket notifications</strong><span>{unreadCount} unread</span></div>
            <button type="button" onClick={() => void markAllRead()} disabled={!unreadCount}>Mark all read</button>
          </header>

          <div className={styles.notificationList} aria-live="polite">
            {loading ? <div className={styles.notificationEmpty}>Loading notifications...</div> : null}
            {!loading && error ? <div className={styles.notificationError}>{error}</div> : null}
            {!loading && !error && !notifications.length ? <div className={styles.notificationEmpty}>No ticket notifications yet.</div> : null}
            {!loading && notifications.map((notification) => (
              <button
                className={notification.is_read ? styles.notificationItem : styles.notificationItemUnread}
                type="button"
                key={notification.id}
                onClick={() => void openNotification(notification)}
              >
                <i className={`ti ${notification.event_type === "deleted" ? "ti-trash" : notification.event_type === "created" ? "ti-ticket" : "ti-edit"}`} aria-hidden="true" />
                <span>
                  <strong>{notification.title}</strong>
                  <small>{notification.message}</small>
                  <em>{notification.actor_name} · {timeAgo(notification.created_at)}</em>
                </span>
              </button>
            ))}
          </div>

          <footer className={styles.notificationFooter}>
            <span>{pushState === "denied" ? "Push blocked in browser settings" : pushState === "unconfigured" ? "Push keys not configured" : pushState === "unsupported" ? "Push unavailable on this device" : "Receive ticket alerts when the app is closed"}</span>
            <button type="button" disabled={pushDisabled} onClick={() => void (pushState === "enabled" ? disablePush() : enablePush())}>{pushLabel}</button>
          </footer>
        </section>
      ) : null}
    </div>
  );
}
