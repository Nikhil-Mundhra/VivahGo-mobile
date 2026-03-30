const { GoogleAuth } = require('google-auth-library');

const FIREBASE_MESSAGING_SCOPE = 'https://www.googleapis.com/auth/firebase.messaging';

function parseServiceAccountJson(rawValue) {
  const raw = String(rawValue || '').trim();
  if (!raw) {
    return null;
  }

  try {
    return JSON.parse(raw);
  } catch {
    throw new Error('FIREBASE_SERVICE_ACCOUNT_JSON could not be parsed.');
  }
}

function normalizePrivateKey(value) {
  return String(value || '').replace(/\\n/g, '\n').trim();
}

function isPemPrivateKey(value) {
  const normalized = normalizePrivateKey(value);
  return normalized.includes('BEGIN PRIVATE KEY') && normalized.includes('END PRIVATE KEY');
}

function readFirebaseServerConfig() {
  const serviceAccount = parseServiceAccountJson(process.env.FIREBASE_SERVICE_ACCOUNT_JSON);
  const projectId = String(
    process.env.FIREBASE_PROJECT_ID ||
    serviceAccount?.project_id ||
    process.env.VITE_FIREBASE_PROJECT_ID ||
    ''
  ).trim();
  const clientEmail = String(process.env.FIREBASE_CLIENT_EMAIL || serviceAccount?.client_email || '').trim();
  const privateKey = normalizePrivateKey(process.env.FIREBASE_PRIVATE_KEY || serviceAccount?.private_key || '');

  return {
    projectId,
    clientEmail,
    privateKey,
  };
}

function ensureFirebaseServerConfig() {
  const config = readFirebaseServerConfig();
  if (!config.projectId || !config.clientEmail || !config.privateKey) {
    throw new Error('Firebase server credentials are not configured.');
  }
  if (!isPemPrivateKey(config.privateKey)) {
    throw new Error('Firebase server private key is invalid. Use the private_key value from a Firebase service account JSON.');
  }
  return config;
}

let accessTokenCache = {
  value: '',
  expiresAt: 0,
};

async function getFirebaseAccessToken() {
  const now = Date.now();
  if (accessTokenCache.value && accessTokenCache.expiresAt > now + (60 * 1000)) {
    return accessTokenCache.value;
  }

  const config = ensureFirebaseServerConfig();
  const auth = new GoogleAuth({
    credentials: {
      project_id: config.projectId,
      client_email: config.clientEmail,
      private_key: config.privateKey,
    },
    scopes: [FIREBASE_MESSAGING_SCOPE],
  });

  const client = await auth.getClient();
  const tokenResponse = await client.getAccessToken();
  const token = typeof tokenResponse === 'string'
    ? tokenResponse
    : tokenResponse?.token || '';

  if (!token) {
    throw new Error('Could not obtain a Firebase access token.');
  }

  accessTokenCache = {
    value: token,
    expiresAt: now + (50 * 60 * 1000),
  };

  return token;
}

async function sendFcmNotification({ token, title, body, clickPath = '/', data = {} }) {
  const { projectId } = ensureFirebaseServerConfig();
  const accessToken = await getFirebaseAccessToken();
  const response = await fetch(`https://fcm.googleapis.com/v1/projects/${encodeURIComponent(projectId)}/messages:send`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      message: {
        token,
        notification: {
          title,
          body,
        },
        data: Object.entries(data || {}).reduce((acc, [key, value]) => {
          acc[String(key)] = String(value ?? '');
          return acc;
        }, {}),
        webpush: {
          notification: {
            icon: '/Thumbnail.png',
            badge: '/Thumbnail.png',
          },
          fcmOptions: {
            link: clickPath.startsWith('/') ? clickPath : `/${clickPath}`,
          },
        },
      },
    }),
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(payload?.error?.message || `FCM send failed (${response.status}).`);
    error.code = payload?.error?.status || '';
    throw error;
  }

  return payload;
}

module.exports = {
  ensureFirebaseServerConfig,
  isPemPrivateKey,
  normalizePrivateKey,
  parseServiceAccountJson,
  readFirebaseServerConfig,
  sendFcmNotification,
};
