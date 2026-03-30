import { getApp, getApps, initializeApp } from 'firebase/app';
import { deleteToken, getMessaging, getToken, isSupported, onMessage } from 'firebase/messaging';
import { getFirebaseMessagingConfig, getFirebaseVapidKey, isFirebaseMessagingConfigured } from './firebaseConfig.js';

function getFirebaseApp() {
  const config = getFirebaseMessagingConfig();
  if (!isFirebaseMessagingConfigured(config)) {
    throw new Error('Firebase web messaging is not configured.');
  }

  return getApps().length ? getApp() : initializeApp(config);
}

export function buildFirebaseMessagingServiceWorkerUrl(config = getFirebaseMessagingConfig(), win = typeof window !== 'undefined' ? window : undefined) {
  if (!win?.location?.origin) {
    throw new Error('Window location is required to register the Firebase messaging service worker.');
  }

  const url = new URL('/firebase-messaging-sw.js', win.location.origin);
  const params = {
    apiKey: config.apiKey,
    authDomain: config.authDomain,
    projectId: config.projectId,
    messagingSenderId: config.messagingSenderId,
    appId: config.appId,
  };

  Object.entries(params).forEach(([key, value]) => {
    if (value) {
      url.searchParams.set(key, value);
    }
  });

  return url.toString();
}

async function getServiceWorkerRegistration() {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
    throw new Error('Service workers are not supported in this browser.');
  }

  return navigator.serviceWorker.register(buildFirebaseMessagingServiceWorkerUrl(), {
    scope: '/',
  });
}

export async function getBrowserNotificationSupport() {
  if (typeof window === 'undefined') {
    return { supported: false, configured: false, permission: 'default' };
  }

  const configured = isFirebaseMessagingConfigured();
  if (!configured) {
    return { supported: false, configured: false, permission: Notification?.permission || 'default' };
  }

  const supported = await isSupported().catch(() => false);
  return {
    supported,
    configured,
    permission: typeof Notification !== 'undefined' ? Notification.permission : 'default',
  };
}

export async function requestBrowserPushToken() {
  const support = await getBrowserNotificationSupport();
  if (!support.configured) {
    throw new Error('Firebase web messaging env vars are missing.');
  }

  if (!support.supported) {
    throw new Error('Push notifications are not supported in this browser.');
  }

  if (typeof Notification === 'undefined') {
    throw new Error('Browser notifications are not supported in this browser.');
  }

  const permission = support.permission === 'granted'
    ? 'granted'
    : await Notification.requestPermission();
  if (permission !== 'granted') {
    throw new Error('Browser notification permission was not granted.');
  }

  const app = getFirebaseApp();
  const registration = await getServiceWorkerRegistration();
  const messaging = getMessaging(app);
  const token = await getToken(messaging, {
    vapidKey: getFirebaseVapidKey(),
    serviceWorkerRegistration: registration,
  });

  if (!token) {
    throw new Error('Firebase did not return a push token for this browser.');
  }

  return token;
}

export async function removeBrowserPushToken() {
  const support = await getBrowserNotificationSupport();
  if (!support.configured || !support.supported) {
    return false;
  }

  const app = getFirebaseApp();
  const messaging = getMessaging(app);
  return deleteToken(messaging);
}

export async function subscribeToForegroundMessages(callback) {
  const support = await getBrowserNotificationSupport();
  if (!support.configured || !support.supported) {
    return () => {};
  }

  const app = getFirebaseApp();
  const messaging = getMessaging(app);
  return onMessage(messaging, callback);
}
