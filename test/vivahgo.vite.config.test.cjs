const assert = require('node:assert/strict');

const { appPath, toFileUrl } = require('./helpers/testUtils.cjs');

describe('VivahGo/vite.config.js', function () {
  it('exports a config object with plugins', async function () {
    const mod = await import(toFileUrl(appPath('vite.config.js')));

    assert.equal(typeof mod.default, 'object');
    assert.ok(Array.isArray(mod.default.plugins));
    assert.ok(mod.default.plugins.length >= 1);
  });
});
