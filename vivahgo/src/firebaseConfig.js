export function getFirebaseMessagingConfig(env = import.meta.env) {
  return {
    apiKey: String(env?.VITE_FIREBASE_API_KEY || '').trim(),
    authDomain: String(env?.VITE_FIREBASE_AUTH_DOMAIN || '').trim(),
    projectId: String(env?.VITE_FIREBASE_PROJECT_ID || '').trim(),
    messagingSenderId: String(env?.VITE_FIREBASE_MESSAGING_SENDER_ID || '').trim(),
    appId: String(env?.VITE_FIREBASE_APP_ID || '').trim(),
  };
}

export function getFirebaseVapidKey(env = import.meta.env) {
  return String(env?.VITE_FIREBASE_VAPID_KEY || '').trim();
}

export function isFirebaseMessagingConfigured(config = getFirebaseMessagingConfig()) {
  return Boolean(
    config.apiKey &&
    config.projectId &&
    config.messagingSenderId &&
    config.appId &&
    getFirebaseVapidKey()
  );
}
