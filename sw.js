
// Troque o número da versão a cada mudança do front-end: o service worker novo
// apaga o cache antigo e o navegador deixa de servir arquivos velhos.
const CACHE_NAME = "avalie-atendimento-v3";

const APP_SHELL = [
  "./",
  "./index.html",
  "./dashboard.html",
  "./offline.html",
  "./css/tokens.css",
  "./css/base.css",
  "./css/index.css",
  "./css/dashboard.css",
  "./js/config.js",
  "./js/api.js",
  "./js/script.js",
  "./js/dashboard.js",
  "./js/pwa.js",
  "./vendor/chart.umd.js",
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

// Rotas que o service worker nunca toca: dados da API, saúde do servidor e a
// área do gestor. Assim nada disso é servido do cache nem confirma envio falso.
function isNeverCached(url) {
  return (
    url.pathname.includes("/api/") ||
    url.pathname.endsWith("/health") ||
    url.pathname.endsWith("/admin.html") ||
    url.pathname.endsWith("/admin-login.html")
  );
}

self.addEventListener("fetch", event => {
  const request = event.request;

  // POST (envio da avaliação) vai direto à rede: sem rede, falha de verdade.
  if (request.method !== "GET") return;

  const url = new URL(request.url);

  if (url.origin !== self.location.origin) return;
  if (isNeverCached(url)) return;

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

  // Rede primeiro: depois de um deploy o usuário recebe o arquivo novo.
  // O cache só atende quando está sem conexão.
  event.respondWith(
    fetch(request).catch(() => caches.match(request))
  );
});
