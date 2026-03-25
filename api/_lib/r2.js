const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');

function createR2Client() {
  const endpoint = process.env.R2_ENDPOINT;
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;

  if (!endpoint || !accessKeyId || !secretAccessKey) {
    throw new Error('R2 environment variables (R2_ENDPOINT, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY) are not configured.');
  }

  return new S3Client({
    region: 'auto',
    endpoint,
    credentials: { accessKeyId, secretAccessKey },
  });
}

/**
 * Generate a presigned PUT URL for uploading a file directly to Cloudflare R2.
 * @param {string} key - The object key (path) in the bucket.
 * @param {string} contentType - The MIME type of the file.
 * @param {number} [expiresIn=3600] - URL expiry in seconds.
 * @returns {Promise<string>} The presigned PUT URL.
 */
async function createPresignedPutUrl(key, contentType, expiresIn = 3600) {
  const bucket = process.env.R2_BUCKET_NAME;
  if (!bucket) {
    throw new Error('R2_BUCKET_NAME is not configured.');
  }

  const client = createR2Client();
  const command = new PutObjectCommand({
    Bucket: bucket,
    Key: key,
    ContentType: contentType,
  });

  return getSignedUrl(client, command, { expiresIn });
}

function getPublicBaseUrl() {
  const publicBase = (process.env.R2_PUBLIC_URL || '').trim();
  if (!publicBase) {
    throw new Error('R2_PUBLIC_URL is not configured.');
  }

  try {
    return new URL(publicBase.endsWith('/') ? publicBase : `${publicBase}/`);
  } catch {
    throw new Error('R2_PUBLIC_URL must be a valid absolute URL.');
  }
}

function normalizeObjectKey(key) {
  if (!key || typeof key !== 'string') {
    throw new Error('Object key must be a non-empty string.');
  }

  return key.replace(/^\/+/, '');
}

function createPublicObjectUrl(key) {
  const baseUrl = getPublicBaseUrl();
  return new URL(normalizeObjectKey(key), baseUrl).toString();
}

function extractObjectKeyFromUrl(url) {
  if (!url || typeof url !== 'string') {
    return '';
  }

  let objectUrl;
  try {
    objectUrl = new URL(url);
  } catch {
    return '';
  }

  let baseUrl;
  try {
    baseUrl = getPublicBaseUrl();
  } catch {
    return '';
  }
  if (objectUrl.origin !== baseUrl.origin) {
    return '';
  }

  const basePath = baseUrl.pathname.endsWith('/') ? baseUrl.pathname : `${baseUrl.pathname}/`;
  if (!objectUrl.pathname.startsWith(basePath)) {
    return '';
  }

  return decodeURIComponent(objectUrl.pathname.slice(basePath.length));
}

function normalizeMediaItem(item) {
  if (!item || typeof item !== 'object') {
    return item;
  }

  const key = typeof item.key === 'string' && item.key
    ? item.key
    : extractObjectKeyFromUrl(item.url);

  let publicUrl = item.url;
  if (key) {
    try {
      publicUrl = createPublicObjectUrl(key);
    } catch {
      publicUrl = item.url;
    }
  }

  return {
    ...item,
    key,
    url: publicUrl,
  };
}

function normalizeMediaList(media) {
  if (!Array.isArray(media)) {
    return [];
  }

  return media.map(normalizeMediaItem);
}

module.exports = {
  createPresignedPutUrl,
  createPublicObjectUrl,
  extractObjectKeyFromUrl,
  normalizeMediaItem,
  normalizeMediaList,
};
