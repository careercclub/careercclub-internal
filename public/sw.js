const STATIC_CACHE = "ccc-static-v1";
const OFFLINE_URL = "/offline";
const PRECACHE_URLS = [OFFLINE_URL, "/favicon.ico", "/pwa-icon/192"];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(STATIC_CACHE).then((cache) => cache.addAll(PRECACHE_URLS)));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== STATIC_CACHE).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith("/api/") || url.pathname === "/sw.js") return;

  if (request.mode === "navigate") {
    event.respondWith(fetch(request).catch(() => caches.match(OFFLINE_URL)));
    return;
  }

  const isStaticAsset =
    url.pathname.startsWith("/_next/static/") ||
    url.pathname.startsWith("/pwa-icon/") ||
    url.pathname === "/favicon.ico";

  if (!isStaticAsset) return;

  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;

      return fetch(request).then((response) => {
        if (response.ok) {
          const copy = response.clone();
          void caches.open(STATIC_CACHE).then((cache) => cache.put(request, copy));
        }
        return response;
      });
    }),
  );
});

self.addEventListener("push", (event) => {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch {
    payload = { title: "CCC Internal", body: event.data?.text() || "Ticket activity" };
  }

  event.waitUntil(
    self.registration.showNotification(payload.title || "CCC Internal", {
      body: payload.body || "Ticket activity",
      icon: "/pwa-icon/192",
      badge: "/pwa-icon/192",
      tag: payload.tag || "ticket-notification",
      renotify: true,
      data: {
        url: payload.url || "/tickets",
        notificationId: payload.notificationId || null,
      },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const targetUrl = new URL(event.notification.data?.url || "/tickets", self.location.origin).href;
  const notificationId = event.notification.data?.notificationId;

  event.waitUntil(
    Promise.all([
      notificationId
        ? fetch("/api/notifications", {
            method: "PATCH",
            credentials: "include",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ operation: "mark-read", notificationId }),
          }).catch(() => undefined)
        : Promise.resolve(),
      self.clients.matchAll({ type: "window", includeUncontrolled: true }).then(async (clients) => {
        const existing = clients.find((client) => new URL(client.url).origin === self.location.origin);
        if (existing) {
          await existing.navigate(targetUrl);
          return existing.focus();
        }
        return self.clients.openWindow(targetUrl);
      }),
    ]),
  );
});
