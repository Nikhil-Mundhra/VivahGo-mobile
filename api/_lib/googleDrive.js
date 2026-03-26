const crypto = require('crypto');

const DRIVE_SCOPE = 'https://www.googleapis.com/auth/drive.file';

function base64UrlEncode(input) {
  return Buffer.from(input)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
}

function normalizePrivateKey(value) {
  return typeof value === 'string' ? value.replace(/\\n/g, '\n') : '';
}

function getDriveConfig() {
  return {
    clientEmail: process.env.GOOGLE_DRIVE_SERVICE_ACCOUNT_EMAIL || '',
    privateKey: normalizePrivateKey(process.env.GOOGLE_DRIVE_PRIVATE_KEY || ''),
    folderId: process.env.GOOGLE_DRIVE_CAREERS_FOLDER_ID || '',
  };
}

function createServiceAccountAssertion(clientEmail, privateKey) {
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: 'RS256', typ: 'JWT' };
  const payload = {
    iss: clientEmail,
    scope: DRIVE_SCOPE,
    aud: 'https://oauth2.googleapis.com/token',
    exp: now + 3600,
    iat: now,
  };

  const encodedHeader = base64UrlEncode(JSON.stringify(header));
  const encodedPayload = base64UrlEncode(JSON.stringify(payload));
  const signingInput = `${encodedHeader}.${encodedPayload}`;
  const signer = crypto.createSign('RSA-SHA256');
  signer.update(signingInput);
  signer.end();
  const signature = signer.sign(privateKey);

  return `${signingInput}.${signature.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '')}`;
}

async function getDriveAccessToken(fetchImpl = fetch) {
  const { clientEmail, privateKey } = getDriveConfig();
  if (!clientEmail || !privateKey) {
    throw new Error('Google Drive upload is not configured.');
  }

  const assertion = createServiceAccountAssertion(clientEmail, privateKey);
  const body = new URLSearchParams({
    grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
    assertion,
  });

  const response = await fetchImpl('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: body.toString(),
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok || !data.access_token) {
    throw new Error(data.error_description || data.error || 'Could not authenticate with Google Drive.');
  }

  return data.access_token;
}

function buildDriveFilename({ fullName, jobId, originalFilename }) {
  const safeName = String(fullName || 'candidate')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60) || 'candidate';
  const safeJob = String(jobId || 'role')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40) || 'role';
  const ext = String(originalFilename || '').toLowerCase().endsWith('.pdf') ? '.pdf' : '.pdf';

  return `${new Date().toISOString().slice(0, 10)}-${safeJob}-${safeName}${ext}`;
}

async function uploadPdfToDrive({ buffer, filename, fullName, jobId, fetchImpl = fetch }) {
  const { folderId } = getDriveConfig();
  if (!folderId) {
    throw new Error('Google Drive careers folder is not configured.');
  }

  const accessToken = await getDriveAccessToken(fetchImpl);
  const boundary = `vivahgo_${Date.now()}_${Math.random().toString(16).slice(2)}`;
  const metadata = {
    name: buildDriveFilename({ fullName, jobId, originalFilename: filename }),
    parents: [folderId],
  };

  const multipartBody = Buffer.concat([
    Buffer.from(`--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(metadata)}\r\n`),
    Buffer.from(`--${boundary}\r\nContent-Type: application/pdf\r\n\r\n`),
    buffer,
    Buffer.from(`\r\n--${boundary}--`),
  ]);

  const response = await fetchImpl('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&supportsAllDrives=true&fields=id,name,webViewLink,webContentLink,mimeType', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': `multipart/related; boundary=${boundary}`,
    },
    body: multipartBody,
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok || !data.id) {
    throw new Error(data.error?.message || 'Could not upload resume to Google Drive.');
  }

  return {
    id: data.id,
    name: data.name || metadata.name,
    webViewLink: data.webViewLink || `https://drive.google.com/file/d/${data.id}/view`,
    webContentLink: data.webContentLink || `https://drive.google.com/uc?id=${data.id}&export=download`,
    mimeType: data.mimeType || 'application/pdf',
  };
}

module.exports = {
  getDriveConfig,
  uploadPdfToDrive,
};
