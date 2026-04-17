const CACHE_NAME = 'nutricore-v1';
const APP_ICON = '/icon-192.png';

self.addEventListener('install', (event) => {
  console.log('[SW] Installing service worker');
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  console.log('[SW] Activating service worker');
  event.waitUntil(clients.claim());
});

self.addEventListener('push', (event) => {
  console.log('[SW] Push received');
  
  if (!event.data) {
    console.log('[SW] No push data');
    return;
  }

  let payload;
  try {
    payload = event.data.json();
  } catch (e) {
    console.error('[SW] Failed to parse push data:', e);
    return;
  }

  const { title, body, actionType, deepLink, data } = payload;

  const options = {
    body: body || 'You have a new notification',
    icon: APP_ICON,
    badge: APP_ICON,
    tag: actionType || 'default',
    renotify: true,
    requireInteraction: false,
    data: {
      deepLink: deepLink || '/',
      actionType,
      ...data,
    },
    actions: [
      {
        action: 'open',
        title: 'Open',
      },
    ],
  };

  event.waitUntil(
    self.registration.showNotification(title || 'NutriCore', options)
  );
});

self.addEventListener('notificationclick', (event) => {
  console.log('[SW] Notification click:', event.action);
  event.notification.close();

  const deepLink = event.notification.data?.deepLink || '/';
  const urlToOpen = new URL(deepLink, self.location.origin).href;

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url.startsWith(self.location.origin) && 'focus' in client) {
          client.focus();
          client.postMessage({
            type: 'NOTIFICATION_CLICK',
            deepLink,
          });
          return;
        }
      }
      return clients.openWindow(urlToOpen);
    })
  );
});

self.addEventListener('notificationclose', (event) => {
  console.log('[SW] Notification dismissed');
});
