export async function networkFirstNavigation(request, cache, fetchRequest) {
  try {
    return await fetchRequest(request);
  } catch {
    return (
      (await cache.match("./index.html")) ||
      (await cache.match("./")) ||
      Response.error()
    );
  }
}

export function createServiceWorker(cacheVersion, precacheUrls) {
  return `const CACHE_NAME = "chromaflow-${cacheVersion}";
const PRECACHE_URLS = ${JSON.stringify(precacheUrls, null, 2)};

${networkFirstNavigation.toString()}

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE_URLS)),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((names) =>
        Promise.all(
          names
            .filter((name) => name.startsWith("chromaflow-") && name !== CACHE_NAME)
            .map((name) => caches.delete(name)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;

  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;

  event.respondWith(
    caches.open(CACHE_NAME).then(async (cache) => {
      if (event.request.mode === "navigate") {
        return networkFirstNavigation(event.request, cache, fetch);
      }

      return (await cache.match(event.request)) || fetch(event.request);
    }),
  );
});
`;
}
