const assert = require('node:assert/strict');
const { appPath, toFileUrl } = require('./helpers/testUtils.cjs');

async function load() {
  return import(toFileUrl(appPath('src/utils.js')));
}

describe('VivahGo/src/utils.js', function () {
  it('formats currency values', async function () {
    const mod = await load();

    assert.equal(mod.fmt(), '₹0');
    assert.equal(mod.fmt(0), '₹0');
    assert.equal(mod.fmt(1234567), '₹12,34,567');
  });

  it('builds initials safely from names', async function () {
    const mod = await load();

    assert.equal(mod.initials('Nikhil Rao'), 'NR');
    assert.equal(mod.initials('a b c'), 'AB');
  });

  it('formats vendor guest range and quick facts', async function () {
    const mod = await load();

    assert.equal(mod.formatVendorGuestRange({ guestRange: { min: 100, max: 300 } }), '100-300 guests');
    assert.equal(mod.formatVendorGuestRange({ guestRange: { min: 'x', max: 200 } }), '');

    assert.deepEqual(
      mod.getVendorQuickFacts({ guestRange: { min: 100, max: 300 }, typicalTiming: '4 hrs' }),
      ['100-300 guests', '4 hrs']
    );
  });

  it('validates onboarding answers for multiple keys', async function () {
    const mod = await load();

    assert.equal(mod.validateOnboardingAnswer('bride', 'A').isValid, false);
    assert.equal(mod.validateOnboardingAnswer('bride', 'Asha').isValid, true);

    assert.equal(mod.validateOnboardingAnswer('guests', '0').isValid, false);
    assert.equal(mod.validateOnboardingAnswer('guests', '350').isValid, true);

    assert.equal(mod.validateOnboardingAnswer('budget', '9000').isValid, false);
    assert.equal(mod.validateOnboardingAnswer('budget', '5,00,000').isValid, true);
  });
});
