/* global firebase, importScripts */

const FIREBASE_CDN_VERSION = '12.11.0';

function readFirebaseConfig() {
  const params = new URL(self.location.href).searchParams;
  return {
    apiKey: params.get('apiKey') || '',
    authDomain: params.get('authDomain') || '',
    projectId: params.get('projectId') || '',
    messagingSenderId: params.get('messagingSenderId') || '',
    appId: params.get('appId') || '',
  };
}

function isFirebaseConfigured(config) {
  return Boolean(config.apiKey && config.projectId && config.messagingSenderId && config.appId);
}

function resolveClickPath(payload) {
  const fromOptions = typeof payload?.fcmOptions?.link === 'string' ? payload.fcmOptions.link : '';
  const fromData = typeof payload?.data?.clickPath === 'string' ? payload.data.clickPath : '';
  const candidate = fromOptions || fromData || '/';
  return candidate.startsWith('/') ? candidate : `/${candidate}`;
}

function openNotificationTarget(clickPath) {
  const targetUrl = new URL(clickPath, self.location.origin).href;
  return self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
    const matching = clients.find((client) => {
      try {
        return new URL(client.url).href === targetUrl;
      } catch {
        return false;
      }
    });

    if (matching) {
      return matching.focus();
    }

    return self.clients.openWindow(targetUrl);
  });
}

// Register this before importing Firebase so our click handling wins.
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const clickPath = typeof event.notification?.data?.clickPath === 'string'
    ? event.notification.data.clickPath
    : '/';

  event.waitUntil(openNotificationTarget(clickPath));
});

const firebaseConfig = readFirebaseConfig();

if (isFirebaseConfigured(firebaseConfig)) {
  try {
    importScripts(`https://www.gstatic.com/firebasejs/${FIREBASE_CDN_VERSION}/firebase-app-compat.js`);
    importScripts(`https://www.gstatic.com/firebasejs/${FIREBASE_CDN_VERSION}/firebase-messaging-compat.js`);

    firebase.initializeApp(firebaseConfig);

    const messaging = firebase.messaging();
    messaging.onBackgroundMessage((payload) => {
      const title = payload?.notification?.title || 'VivahGo reminder';
      const body = payload?.notification?.body || 'You have an upcoming planner reminder.';

      self.registration.showNotification(title, {
        body,
        icon: '/Thumbnail.png',
        badge: '/Thumbnail.png',
        data: {
          clickPath: resolveClickPath(payload),
        },
      });
    });
  } catch (error) {
    console.error('VivahGo Firebase messaging service worker failed to initialize.', error);
  }
}
