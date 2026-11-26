// Offline shell for the Testlab gallery only. Prototype folders own their own runtime.
const CACHE_NAME = 'testlab-gallery-v3';
const ROOT_FILES = ['','index.html','site.css','site.js','catalog.json','manifest.webmanifest',
                    'icons/icon-192.png','icons/icon-512.png','icons/testlab.svg'];
const scopeUrl = new URL(self.registration.scope);
if (!scopeUrl.pathname.endsWith('/')) throw new Error('Testlab worker must have a directory scope.');
const rootUrl = new URL('index.html', scopeUrl).href;

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE_NAME)
    .then(cache => cache.addAll(ROOT_FILES.map(path => new URL(path, scopeUrl).href)))
    .then(() => self.skipWaiting()));
});

self.addEventListener('activate', event => {
  event.waitUntil(Promise.all([
    caches.keys().then(keys => Promise.all(
      keys.filter(key => key.startsWith('testlab-gallery-') && key !== CACHE_NAME)
        .map(key => caches.delete(key))
    )),
    self.clients.claim()
  ]));
});

self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== scopeUrl.origin || !url.pathname.startsWith(scopeUrl.pathname)) return;
  const relative = url.pathname.slice(scopeUrl.pathname.length);
  // Only handle root shell assets; never intercept a self-contained prototype's resources.
  if (!ROOT_FILES.includes(relative)) return;
  event.respondWith((async () => {
    try {
      const response = await fetch(request);
      if (response.ok) {
        const cached = response.clone();
        event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.put(request, cached)));
      }
      return response;
    } catch {
      const cache = await caches.open(CACHE_NAME);
      return (await cache.match(request, {ignoreSearch:true})) ||
        (request.mode === 'navigate' ? await cache.match(rootUrl) : undefined) ||
        Response.error();
    }
  })());
});
