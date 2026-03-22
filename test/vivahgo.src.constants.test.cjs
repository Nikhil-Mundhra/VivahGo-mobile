const assert = require('node:assert/strict');
const { appPath, toFileUrl } = require('./helpers/testUtils.cjs');

async function load() {
  return import(toFileUrl(appPath('src/constants.js')));
}

describe('VivahGo/src/constants.js', function () {
  it('exports expected color keys and arrays', async function () {
    const mod = await load();

    assert.ok(mod.COLORS.crimson);
    assert.ok(mod.COLORS.gold);
    assert.ok(Array.isArray(mod.EVENT_COLORS));
    assert.equal(mod.EVENT_COLORS.length, 15);
  });

  it('exports vendor/nav/support constants', async function () {
    const mod = await load();

    assert.ok(Array.isArray(mod.VENDOR_TYPES));
    assert.ok(mod.VENDOR_TYPES.includes('Venue'));

    assert.match(mod.WHATSAPP_SUPPORT_NUMBER, /^\d+$/);
    assert.equal(mod.FEEDBACK_APP_VERSION, '1.0.0');
    assert.ok(Array.isArray(mod.NAV_ITEMS));
    assert.ok(mod.NAV_ITEMS.some(item => item.id === 'home'));
  });
});
