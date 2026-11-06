self.addEventListener('notificationclick', (event) => {
  event.stopImmediatePropagation();
  event.notification.close();
  const target = new URL('/notifications?unread=true', self.location.origin).href;
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      const existing = clients.find(
        (client) => new URL(client.url).origin === self.location.origin,
      );
      return existing
        ? existing.navigate(target).then((client) => client?.focus())
        : self.clients.openWindow(target);
    }),
  );
});

importScripts('./ngsw-worker.js');
