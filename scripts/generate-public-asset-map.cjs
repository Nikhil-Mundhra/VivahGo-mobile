#!/usr/bin/env node

const fs = require('node:fs');
const path = require('node:path');
const { list } = require('@vercel/blob');
const { buildTrackedFilenameMap } = require('./public-asset-manifest.cjs');

const ROOT_DIR = path.resolve(__dirname, '..');
const GUIDES_PATH = path.join(ROOT_DIR, 'vivahgo', 'src', 'content', 'guides.json');
const OUTPUT_JSON_PATH = path.join(ROOT_DIR, 'vivahgo', 'src', 'generated', 'public-asset-map.json');
const OUTPUT_JS_PATH = path.join(ROOT_DIR, 'vivahgo', 'src', 'generated', 'public-asset-map.js');

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function parseDotEnv(contents) {
  return String(contents || '')
    .split(/\r?\n/)
    .reduce((env, line) => {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) {
        return env;
      }

      const separatorIndex = trimmed.indexOf('=');
      if (separatorIndex <= 0) {
        return env;
      }

      const key = trimmed.slice(0, separatorIndex).trim();
      let value = trimmed.slice(separatorIndex + 1).trim();
      if (
        (value.startsWith('"') && value.endsWith('"'))
        || (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }

      env[key] = value;
      return env;
    }, {});
}

function loadBlobToken() {
  if (process.env.BLOB_READ_WRITE_TOKEN) {
    return process.env.BLOB_READ_WRITE_TOKEN;
  }

  const envCandidates = [
    path.join(ROOT_DIR, '.env'),
    path.join(ROOT_DIR, 'vivahgo', '.env'),
  ];

  for (const candidate of envCandidates) {
    if (!fs.existsSync(candidate)) {
      continue;
    }

    const parsed = parseDotEnv(fs.readFileSync(candidate, 'utf8'));
    if (parsed.BLOB_READ_WRITE_TOKEN) {
      process.env.BLOB_READ_WRITE_TOKEN = parsed.BLOB_READ_WRITE_TOKEN;
      return parsed.BLOB_READ_WRITE_TOKEN;
    }
  }

  throw new Error('BLOB_READ_WRITE_TOKEN is not configured in the environment or an .env file.');
}

async function listAllBlobs(options = {}) {
  const token = loadBlobToken();
  const blobs = [];
  let cursor;

  do {
    const result = await list({
      cursor,
      limit: 1000,
      token,
      prefix: options.prefix,
    });

    blobs.push(...(Array.isArray(result?.blobs) ? result.blobs : []));
    cursor = result?.cursor;
  } while (cursor);

  return blobs;
}

function buildPublicAssetMapFromBlobs(trackedFilenameMap, blobs) {
  const mapping = {};

  for (const blob of blobs) {
    const pathname = typeof blob?.pathname === 'string' ? blob.pathname : '';
    const url = typeof blob?.url === 'string' ? blob.url : '';
    const filename = path.posix.basename(pathname);

    if (!filename || !url || !trackedFilenameMap.has(filename)) {
      continue;
    }

    mapping[trackedFilenameMap.get(filename)] = url;
  }

  return mapping;
}

async function buildPublicAssetMap() {
  const guides = readJson(GUIDES_PATH);
  const trackedFilenameMap = buildTrackedFilenameMap(guides);
  const blobs = await listAllBlobs();
  const assets = buildPublicAssetMapFromBlobs(trackedFilenameMap, blobs);

  return {
    generatedAt: new Date().toISOString(),
    count: Object.keys(assets).length,
    assets,
  };
}

async function writePublicAssetMap() {
  const assetMap = await buildPublicAssetMap();
  fs.mkdirSync(path.dirname(OUTPUT_JSON_PATH), { recursive: true });
  fs.writeFileSync(OUTPUT_JSON_PATH, `${JSON.stringify(assetMap, null, 2)}\n`, 'utf8');
  fs.writeFileSync(
    OUTPUT_JS_PATH,
    `const publicAssetMap = ${JSON.stringify(assetMap, null, 2)};\n\nexport default publicAssetMap;\n`,
    'utf8'
  );
  return assetMap;
}

if (require.main === module) {
  writePublicAssetMap()
    .then((assetMap) => {
      console.log(`Generated public asset map with ${assetMap.count} Blob-backed asset URL(s).`);
      console.log(`JSON: ${OUTPUT_JSON_PATH}`);
      console.log(`JS: ${OUTPUT_JS_PATH}`);
    })
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
}

module.exports = {
  OUTPUT_JS_PATH,
  OUTPUT_JSON_PATH,
  buildPublicAssetMap,
  buildPublicAssetMapFromBlobs,
  loadBlobToken,
  parseDotEnv,
  writePublicAssetMap,
};
