const assert = require('node:assert/strict');
const { appPath, toFileUrl } = require('./helpers/testUtils.cjs');

async function load() {
  return import(toFileUrl(appPath('src/data.js')));
}

describe('VivahGo/src/data.js', function () {
  it('exports baseline collections with expected shape', async function () {
    const mod = await load();

    assert.ok(Array.isArray(mod.DEFAULT_EVENTS));
    assert.ok(Array.isArray(mod.BUDGET_CATEGORIES));
    assert.ok(Array.isArray(mod.DEFAULT_VENDORS));
    assert.ok(Array.isArray(mod.DEFAULT_TASKS));
    assert.ok(Array.isArray(mod.QUESTIONS));
    assert.ok(Array.isArray(mod.AI_RESPONSES));

    assert.ok(mod.DEFAULT_EVENTS.every(event => typeof event.id === 'number'));
    assert.ok(mod.DEFAULT_VENDORS.every(vendor => typeof vendor.name === 'string'));
    assert.ok(mod.DEFAULT_TASKS.every(task => 'done' in task));
  });

  it('contains required event milestones and vendor types', async function () {
    const mod = await load();

    const eventNames = new Set(mod.DEFAULT_EVENTS.map(e => e.name));
    assert.ok(eventNames.has('Haldi'));
    assert.ok(eventNames.has('Pheras'));
    assert.ok(eventNames.has('Reception'));

    const vendorTypes = new Set(mod.DEFAULT_VENDORS.map(v => v.type));
    assert.ok(vendorTypes.has('Photography'));
    assert.ok(vendorTypes.has('Venue'));
    assert.ok(vendorTypes.has('Wedding Planners'));
    assert.ok(vendorTypes.has('Bridal & Pre-Bridal'));
    assert.ok(vendorTypes.has('Groom Services'));
    assert.ok(mod.DEFAULT_VENDORS.every(v => v.name.startsWith("VivahGo's Choice ")));
  });
});
