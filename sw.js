// Permite instalar el sistema como app en teléfono y tablet.
// Siempre pide primero la versión nueva a internet; la copia guardada solo se usa sin conexión.
// Nunca guarda datos de Firebase ni de otros sitios: solo los archivos propios del sistema.
const CACHE = 'clinica-app-v6';

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.add('./')).then(() => self.skipWaiting()));
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(key => key !== CACHE).map(key => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  event.respondWith(
    fetch(request)
      .then(response => {
        if (response.ok) {
          const copy = response.clone();
          caches.open(CACHE).then(cache => cache.put(request, copy));
        }
        return response;
      })
      .catch(() => caches.match(request, { ignoreSearch: request.mode === 'navigate' }))
  );
});

// Avisos de la mañana (los manda notificaciones/enviar.js por Firebase Cloud Messaging).
self.addEventListener('push', event => {
  let p = {};
  try { p = event.data ? event.data.json() : {}; } catch (e) { p = { data:{ cuerpo:event.data && event.data.text() } }; }
  const d = p.data || p.notification || {};
  event.waitUntil(self.registration.showNotification(d.titulo || d.title || 'Clínica Dr. Allan Leal', {
    body:d.cuerpo || d.body || 'Tiene recordatorios pendientes.',
    icon:'icons/icono-192.png',
    badge:'icons/icono-192.png',
    tag:'clinica-diario',
    data:{ url:d.url || './' }
  }));
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  const destino = new URL(event.notification.data?.url || './', self.registration.scope).href;
  event.waitUntil(clients.matchAll({ type:'window', includeUncontrolled:true }).then(lista => {
    const abierta = lista.find(c => c.url.startsWith(self.registration.scope));
    return abierta ? abierta.focus() : clients.openWindow(destino);
  }));
});
