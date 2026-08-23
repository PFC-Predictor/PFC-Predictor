const CACHE_NAME = "pompey-predictor-v2";
const SHELL_FILES = ["./", "./index.html", "./manifest.json"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(SHELL_FILES))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);

  // Never cache Supabase calls — predictions, results and the leaderboard
  // must always be live. Caching them would mean stale scores on match day,
  // which is worse than no offline support at all.
  if (url.hostname.includes("supabase.co")) return;
  if (event.request.method !== "GET") return;

  event.respondWith(
    fetch(event.request, { cache: "no-store" })
      .then((response) => {
        const clone = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
        return response;
      })
      .catch(() => caches.match(event.request))
  );
});

// A push arriving here is just a data packet — it doesn't show anything on
// its own. This is the part that actually turns it into a real notification
// the phone displays, even while the app itself isn't open.
self.addEventListener("push", (event) => {
  let data = { title: "Pompey Predictor", body: "You've got an update." };
  try {
    if (event.data) data = { ...data, ...event.data.json() };
  } catch (e) {
    // Non-critical — if the payload isn't valid JSON for any reason, still
    // show something rather than silently dropping the notification.
    if (event.data) data.body = event.data.text();
  }

  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      data: { url: data.url || "./" }
    }).catch(() => {})
  );
});

// Tapping the notification itself should bring an already-open tab to the
// front rather than piling up duplicate windows, and only open a fresh one
// if the app genuinely isn't open anywhere.
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const targetUrl = event.notification.data?.url || "./";
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if ("focus" in client) return client.focus();
      }
      if (self.clients.openWindow) return self.clients.openWindow(targetUrl);
    })
  );
});
