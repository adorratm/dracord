/* Dracord web push — sekme kapalıyken bildirim */
self.addEventListener('push', (event) => {
  let data = { title: 'Dracord', body: '', link: '/notifications', tag: 'dracord' };
  try {
    if (event.data) data = { ...data, ...event.data.json() };
  } catch {
    // ignore
  }
  event.waitUntil(
    self.registration.showNotification(data.title || 'Dracord', {
      body: data.body || '',
      icon: '/logo.png',
      badge: '/favicon.svg',
      tag: data.tag || 'dracord',
      data: { link: data.link || '/notifications' },
    }),
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const link =
    (event.notification.data && event.notification.data.link) || '/notifications';
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
      for (const client of list) {
        if ('focus' in client) {
          client.navigate?.(link);
          return client.focus();
        }
      }
      if (clients.openWindow) return clients.openWindow(link);
    }),
  );
});
