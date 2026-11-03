/* Service worker: guarda as telas e os ficheiros (CSS/JS) para o sistema abrir mesmo sem internet.
   Os dados (/api) nunca são guardados aqui: as operações feitas sem rede ficam na fila do aparelho. */
const CACHE = 'agua-v13-1';
const SHELL = ['/reader', '/cashier', '/offline', '/css/app.css', '/js/app.js', '/js/offline-store.js', '/js/print-docs.js',
  '/js/pages/reader.js', '/js/pages/cashier.js', '/img/icon.svg', '/manifest.webmanifest'];
const PAGES = ['/dashboard', '/customers', '/readings', '/invoices', '/cashier', '/payments', '/statements', '/debtors', '/reports',
  '/tariffs', '/team', '/settings', '/reader', '/portal', '/admin', '/print', '/messages'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then(c => Promise.all(SHELL.map(u => c.add(u).catch(() => null)))).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', (e) => {
  const req = e.request;
  const url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== location.origin || url.pathname.startsWith('/api/') || url.pathname.startsWith('/actuator')) return;
  if (req.mode === 'navigate') {
    // Páginas: tenta a rede; sem rede usa a cópia guardada (ou a página "sem ligação").
    e.respondWith(fetch(req).then(res => {
      if (res.ok && !res.redirected && PAGES.includes(url.pathname)) { const copy = res.clone(); caches.open(CACHE).then(c => c.put(url.pathname, copy)); }
      return res;
    }).catch(() => caches.match(url.pathname).then(r => r || caches.match('/offline'))));
    return;
  }
  // CSS/JS/imagens: responde com a cópia e atualiza em segundo plano.
  e.respondWith(caches.match(req).then(cached => {
    const net = fetch(req).then(res => {
      if (res.ok) { const copy = res.clone(); caches.open(CACHE).then(c => c.put(req, copy)); }
      return res;
    }).catch(() => cached);
    return cached || net;
  }));
});
