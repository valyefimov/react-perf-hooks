/**
 * Cross-Origin Isolation service worker.
 *
 * GitHub Pages cannot serve custom HTTP headers, so it never sends
 * `Cross-Origin-Opener-Policy: same-origin` / `Cross-Origin-Embedder-Policy: require-corp`.
 * Without those, `window.crossOriginIsolated` is false and StackBlitz's embedded
 * WebContainer demos (which need `SharedArrayBuffer`) refuse to boot.
 *
 * This worker intercepts every same-origin fetch made by the page and injects
 * those two headers onto the response, which is enough for the browser to grant
 * cross-origin isolation to pages it controls. Registration lives in
 * src/theme/Root.tsx; this file only runs in the service worker (`self`) scope.
 *
 * Adapted from the public-domain approach popularized by
 * https://github.com/gzuidhof/coi-serviceworker.
 */

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('message', (event) => {
  if (event.data === 'coi-serviceworker-deregister') {
    self.registration.unregister();
  }
});

self.addEventListener('fetch', (event) => {
  const { request } = event;

  // Requests made with `cache: 'only-if-cached'` outside of `same-origin` mode
  // are illegal and would otherwise throw inside this handler.
  if (request.cache === 'only-if-cached' && request.mode !== 'same-origin') {
    return;
  }

  event.respondWith(
    fetch(request)
      .then((response) => {
        if (response.status === 0) {
          return response;
        }

        const headers = new Headers(response.headers);
        headers.set('Cross-Origin-Embedder-Policy', 'require-corp');
        headers.set('Cross-Origin-Opener-Policy', 'same-origin');

        return new Response(response.body, {
          status: response.status,
          statusText: response.statusText,
          headers,
        });
      })
      .catch((error) => console.error('[coi-serviceworker] fetch failed', error)),
  );
});
