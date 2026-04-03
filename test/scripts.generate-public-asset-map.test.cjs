const assert = require('node:assert/strict');
const path = require('node:path');

const {
  OUTPUT_JSON_PATH,
  buildPublicAssetMap,
} = require('../scripts/generate-public-asset-map.cjs');

describe('generate-public-asset-map', function () {
  it('falls back to the checked-in asset map when the Blob token is unavailable', async function () {
    const assetMap = await buildPublicAssetMap({
      listBlobs: async () => {
        throw new Error('BLOB_READ_WRITE_TOKEN is not configured in the environment or an .env file.');
      },
    });
    const existingAssetMap = require(path.resolve(OUTPUT_JSON_PATH));

    assert.deepEqual(assetMap.assets, existingAssetMap.assets);
    assert.equal(assetMap.count, existingAssetMap.count);
  });
});
