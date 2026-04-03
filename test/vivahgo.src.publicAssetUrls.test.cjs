const assert = require('node:assert/strict');
const publicAssetMap = require('../vivahgo/src/generated/public-asset-map.json');

const { appPath, toFileUrl } = require('./helpers/testUtils.cjs');

async function loadPublicAssetModule() {
  return import(`${toFileUrl(appPath('src/publicAssetUrls.js'))}?t=${Date.now()}`);
}

describe('VivahGo/src/publicAssetUrls.js', function () {
  it('keeps guide images on local public paths even when a Blob mapping exists', async function () {
    const mod = await loadPublicAssetModule();

    assert.equal(
      mod.resolvePublicAssetUrl('/guides/Wedding-budget-planner.png'),
      '/guides/Wedding-budget-planner.png'
    );
  });

  it('still maps MainHero.png through Blob when a generated mapping exists', async function () {
    const mod = await loadPublicAssetModule();

    assert.equal(
      mod.resolvePublicAssetUrl('/MainHero.png'),
      publicAssetMap.assets['/MainHero.png']
    );
  });

  it('falls back to the original public path when an asset is not mapped', async function () {
    const mod = await loadPublicAssetModule();

    assert.equal(
      mod.resolvePublicAssetUrl('/guides/not-mapped.png'),
      '/guides/not-mapped.png'
    );
  });
});
