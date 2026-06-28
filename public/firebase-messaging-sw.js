/* Finia FCM background service worker.
 * Config is passed via the registration query string (public Firebase web config —
 * see src/lib/push.ts) so no secrets live in this static file. Registered at its own
 * scope (/firebase-cloud-messaging-push-scope) so it coexists with the PWA sw.js. */
importScripts("https://www.gstatic.com/firebasejs/10.12.2/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/10.12.2/firebase-messaging-compat.js");

const params = new URLSearchParams(self.location.search);
const config = {
  apiKey: params.get("apiKey"),
  authDomain: params.get("authDomain"),
  projectId: params.get("projectId"),
  storageBucket: params.get("storageBucket"),
  messagingSenderId: params.get("messagingSenderId"),
  appId: params.get("appId"),
};

if (config.apiKey) {
  firebase.initializeApp(config);
  const messaging = firebase.messaging();
  messaging.onBackgroundMessage((payload) => {
    const n = payload.notification || {};
    self.registration.showNotification(n.title || "Finia reminder", {
      body: n.body || "",
      icon: "/icon-192.png",
      badge: "/icon-192.png",
      data: payload.data || {},
      tag: (payload.data && payload.data.tag) || "finia-reminder",
    });
  });
}

// Tapping the notification opens Finia at the calendar.
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || "/calendar";
  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((list) => {
      for (const c of list) if ("focus" in c) return c.focus();
      if (clients.openWindow) return clients.openWindow(url);
    })
  );
});
