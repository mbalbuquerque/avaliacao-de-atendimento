
const CACHE_NAME = "avalie-atendimento-v1";

const APP_SHELL = [
  "./",
  "./index.html",
  "./offline.html",
  "./css/style.css",
  "./css/pwa.css",
  "./js/script.js",
  "./js/pwa.js",
  "./manifest.webmanifest",
  "./icons/icon-192.png",
  "./icons/icon-512.png"
];

self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys().then(async keys => {
      await Promise.all(
        keys
          .filter(key => key !== CACHE_NAME)
          .map(key => caches.delete(key))
      );

      await self.clients.claim();
    })
  );
});

self.addEventListener("fetch", event => {
  const request = event.request;

  if (request.method !== "GET") return;

  const url = new URL(request.url);

  // Não armazenar respostas da API ou de outros domínios.
  if (url.origin !== self.location.origin) return;
  if (url.pathname.includes("/api/")) return;

  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request).catch(async () => {
        return (
          await caches.match(request) ||
          await caches.match("./offline.html")
        );
      })
    );
    return;
  }

  event.respondWith(
    caches.match(request).then(cached => {
      return cached || fetch(request);
    })
  );
});
