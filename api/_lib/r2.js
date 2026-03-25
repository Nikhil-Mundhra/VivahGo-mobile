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

function createPublicObjectUrl(key) {
  const publicBase = (process.env.R2_PUBLIC_URL || '').trim();
  if (!publicBase) {
    throw new Error('R2_PUBLIC_URL is not configured.');
  }

  let baseUrl;
  try {
    baseUrl = new URL(publicBase.endsWith('/') ? publicBase : `${publicBase}/`);
  } catch {
    throw new Error('R2_PUBLIC_URL must be a valid absolute URL.');
  }

  return new URL(key, baseUrl).toString();
}

module.exports = { createPresignedPutUrl, createPublicObjectUrl };
