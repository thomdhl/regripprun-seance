/* Regripp’Run – Ma séance : fonctionnement hors connexion.
   Pour forcer la mise à jour des fichiers en cache, changez VERSION. */
const VERSION = "rrc-seance-2026-10-23";
const SHELL = ["./", "./index.html", "./manifest.webmanifest",
  "./icons/icon-192.png", "./icons/icon-512.png", "./icons/icon-maskable-512.png", "./icons/apple-touch-icon.png"];

self.addEventListener("install", event => {
  event.waitUntil(caches.open(VERSION).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(keys.filter(k => k !== VERSION).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", event => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (req.mode === "navigate") { event.respondWith(networkFirst(req)); return; }
  if (url.origin === self.location.origin) { event.respondWith(cacheFirst(req)); return; }
  if (/^fonts\.(googleapis|gstatic)\.com$/.test(url.hostname)) { event.respondWith(staleWhileRevalidate(req)); return; }
});

/* La page : toujours la dernière version si le réseau répond, sinon la copie en cache */
async function networkFirst(req) {
  const cache = await caches.open(VERSION);
  try {
    const res = await Promise.race([
      fetch(req),
      new Promise((_, reject) => setTimeout(() => reject(new Error("délai dépassé")), 4000))
    ]);
    if (res && res.ok) cache.put("./index.html", res.clone());
    return res;
  } catch (e) {
    return (await cache.match("./index.html")) || (await cache.match("./")) || Response.error();
  }
}

/* Icônes et manifeste : depuis le cache */
async function cacheFirst(req) {
  const cache = await caches.open(VERSION);
  const hit = await cache.match(req);
  if (hit) return hit;
  try {
    const res = await fetch(req);
    if (res && res.ok) cache.put(req, res.clone());
    return res;
  } catch (e) {
    return Response.error();
  }
}

/* Polices : la copie en cache tout de suite, mise à jour en arrière-plan */
async function staleWhileRevalidate(req) {
  const cache = await caches.open(VERSION);
  const hit = await cache.match(req);
  const update = fetch(req).then(res => { if (res && (res.ok || res.type === "opaque")) cache.put(req, res.clone()); return res; }).catch(() => null);
  return hit || (await update) || Response.error();
}
