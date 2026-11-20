/*
 * Pocket Games service worker.
 * It exists so the app can be installed and can show notifications (e.g. "Sam invited
 * you to Connect Four"). It deliberately does NOT cache pages, so players always get
 * the latest version of the game.
 */

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

// A fetch handler is required for the browser to offer "Install app". Pass everything through.
self.addEventListener("fetch", () => {});

self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { title: "Pocket Games", body: event.data ? event.data.text() : "" };
  }
  event.waitUntil(
    self.registration.showNotification(data.title || "Pocket Games", {
      body: data.body || "",
      icon: "/icons/192",
      badge: "/icons/96",
      tag: data.tag, // a newer invite to the same room replaces the older one
      data: { url: data.url || "/" },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = new URL((event.notification.data && event.notification.data.url) || "/", self.location.origin).href;
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((windows) => {
      // Reuse an open Pocket Games window if there is one.
      for (const w of windows) {
        if ("focus" in w) {
          w.navigate(url);
          return w.focus();
        }
      }
      return self.clients.openWindow(url);
    }),
  );
});
