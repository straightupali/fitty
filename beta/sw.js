// Retires the old beta: clears its offline cache, removes itself, and reloads open beta pages
// (which then forward to the main app). Never touches the main app's caches.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(k => k.startsWith('fitty-beta-')).map(k => caches.delete(k)));
    await self.registration.unregister();
    const clients = await self.clients.matchAll({ type: 'window' });
    clients.forEach(c => c.navigate(new URL('../', self.registration.scope).href));
  })());
});
