const CACHE_VERSION = "quan-ly-thu-chi-v3";
const STATIC_CACHE = `${CACHE_VERSION}-static`;
const APP_SHELL = [
  "./",
  "./index.html",
  "./manifest.json",
  "./icon-192.png",
  "./icon-512.png"
];

self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(STATIC_CACHE)
      .then(cache => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys
          .filter(key => key.startsWith("quan-ly-thu-chi-") && key !== STATIC_CACHE)
          .map(key => caches.delete(key))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", event => {
  const request = event.request;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  event.respondWith(networkFirst(request));
});

async function networkFirst(request) {
  const cache = await caches.open(STATIC_CACHE);
  try {
    const networkRequest = new Request(request, { cache: "no-store" });
    const response = await fetch(networkRequest);
    if (response && response.ok) {
      await cache.put(request, response.clone());
    }
    return response;
  } catch (error) {
    const cached = await cache.match(request);
    if (cached) return cached;
    if (request.mode === "navigate") {
      const fallback = await cache.match("./index.html");
      if (fallback) return fallback;
    }
    throw error;
  }
}

// Khi sinh viên chạm vào thông báo "2k gửi xe" hoặc nhắc nhở 11h/19h:
// Tự động mở trang web và điền sẵn khoản giao dịch vào bảng nhập
self.addEventListener("notificationclick", event => {
  event.notification.close();
  const data = event.notification.data || {};
  const query = data.amount
    ? `?quick=1&cat=${encodeURIComponent(data.category || "chiDiLai")}&amount=${encodeURIComponent(data.amount)}&note=${encodeURIComponent(data.note || "Gửi xe đi học")}`
    : `?quick=1`;

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then(clientList => {
      for (const client of clientList) {
        if ("focus" in client) {
          client.focus();
          client.postMessage({ type: "OPEN_PREFILLED_TX", payload: data });
          return;
        }
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow("./index.html" + query);
      }
    })
  );
});
