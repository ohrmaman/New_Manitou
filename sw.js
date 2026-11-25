// Dynamic Service Worker powered by central /config.json
let cachedNamePromise = null;

async function resolveCacheName() {
  if (!cachedNamePromise) {
    cachedNamePromise = fetch('./config.json', { cache: 'no-store' })
      .then((res) => (res.ok ? res.json() : null))
      .then((cfg) => {
        const prefix = (cfg && cfg.cachePrefix) || 'manitou-library';
        const version = (cfg && cfg.version) || 'v34';
        return `${prefix}-${version}`;
      })
      .catch(() => 'manitou-library-v34');
  }
  return cachedNamePromise;
}

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      cachedNamePromise = null;
      const activeCacheName = await resolveCacheName();
      const keys = await caches.keys();
      const oldKeys = keys.filter((k) => k !== activeCacheName);
      await Promise.all(oldKeys.map((k) => caches.delete(k)));
      await self.clients.claim();
      if (oldKeys.length > 0) {
        const windowClients = await self.clients.matchAll({ type: 'window' });
        for (const client of windowClients) {
          try {
            client.navigate(client.url);
          } catch (e) {}
        }
      }
    })()
  );
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);
  if (
    url.pathname.startsWith('/api/') ||
    url.pathname.endsWith('/config.js') ||
    url.pathname.endsWith('/config.json')
  ) {
    return;
  }
  event.respondWith(
    fetch(event.request, { cache: 'no-cache' })
      .then(async (response) => {
        if (response && response.status === 200 && response.type === 'basic') {
          const clone = response.clone();
          const activeCacheName = await resolveCacheName();
          caches.open(activeCacheName).then((cache) => cache.put(event.request, clone));
        }
        return response;
      })
      .catch(async () => {
        const exactMatch = await caches.match(event.request);
        if (exactMatch) return exactMatch;
        return caches.match(event.request, { ignoreSearch: true });
      })
  );
});
