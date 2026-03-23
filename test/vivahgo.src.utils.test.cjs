const assert = require('node:assert/strict');

const { appPath, toFileUrl } = require('./helpers/testUtils.cjs');

async function load() {
  return import(`${toFileUrl(appPath('src/utils.js'))}?t=${Date.now()}`);
}

describe('VivahGo/src/utils.js', function () {
  it('daysUntil handles null, invalid, future, and past dates', async function () {
    const mod = await load();

    assert.equal(mod.daysUntil(''), null);
    assert.equal(mod.daysUntil('not-a-date'), null);

    const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

    assert.ok(mod.daysUntil(tomorrow) >= 0);
    assert.ok(mod.daysUntil(yesterday) <= 0);
  });

  it('formats currency and initials including edge cases', async function () {
    const mod = await load();

    assert.equal(mod.fmt(), '₹0');
    assert.equal(mod.fmt(0), '₹0');
    assert.equal(mod.fmt(1234567), '₹12,34,567');
    assert.equal(mod.fmt(-5000), '₹-5,000');

    assert.equal(mod.initials('Nikhil Rao'), 'NR');
    assert.equal(mod.initials('a b c'), 'AB');
    assert.equal(mod.initials('single'), 'S');
  });

  it('formats vendor price tier, guest range, and quick facts', async function () {
    const mod = await load();

    assert.equal(mod.formatVendorPriceTier(0), '₹');
    assert.equal(mod.formatVendorPriceTier(2), '₹₹');
    assert.equal(mod.formatVendorPriceTier(5), '₹₹₹₹');

    assert.equal(mod.formatVendorGuestRange({ guestRange: { min: 100, max: 300 } }), '100-300 guests');
    assert.equal(mod.formatVendorGuestRange({ guestRange: { min: 'x', max: 200 } }), '');

    assert.deepEqual(
      mod.getVendorQuickFacts({ guestRange: { min: 100, max: 300 }, typicalTiming: '4 hrs' }),
      ['100-300 guests', '4 hrs']
    );
    assert.deepEqual(mod.getVendorQuickFacts({}), []);
  });

  it('validates onboarding answers across all key branches', async function () {
    const mod = await load();

    assert.equal(mod.validateOnboardingAnswer('bride', '').isValid, false);
    assert.equal(mod.validateOnboardingAnswer('bride', 'A').isValid, false);
    assert.equal(mod.validateOnboardingAnswer('bride', 'Asha').isValid, true);

    assert.equal(mod.validateOnboardingAnswer('date', '').isValid, false);
    assert.equal(mod.validateOnboardingAnswer('date', 'bad-date').isValid, false);
    assert.equal(mod.validateOnboardingAnswer('date', '2000-01-01').isValid, false);
    const future = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
    assert.equal(mod.validateOnboardingAnswer('date', future).isValid, true);

    assert.equal(mod.validateOnboardingAnswer('guests', '').isValid, false);
    assert.equal(mod.validateOnboardingAnswer('guests', '0').isValid, false);
    assert.equal(mod.validateOnboardingAnswer('guests', '2001').isValid, false);
    assert.equal(mod.validateOnboardingAnswer('guests', '1,500').isValid, true);

    assert.equal(mod.validateOnboardingAnswer('budget', '').isValid, false);
    assert.equal(mod.validateOnboardingAnswer('budget', 'abc').isValid, false);
    assert.equal(mod.validateOnboardingAnswer('budget', '9000').isValid, false);
    assert.equal(mod.validateOnboardingAnswer('budget', '₹ 50,00,000').isValid, true);

    assert.equal(mod.validateOnboardingAnswer('unknown', 'anything').isValid, true);
  });
});
