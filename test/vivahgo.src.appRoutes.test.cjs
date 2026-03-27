const assert = require('node:assert/strict');
const { appPath, toFileUrl } = require('./helpers/testUtils.cjs');

async function load() {
  return import(toFileUrl(appPath('src/appRoutes.js')));
}

describe('VivahGo/src/appRoutes.js', function () {
  it('normalizes pathnames consistently', async function () {
    const mod = await load();

    assert.equal(mod.normalizePathname('/'), '/');
    assert.equal(mod.normalizePathname('/home/'), '/home');
    assert.equal(mod.normalizePathname('/vendor///'), '/vendor');
  });

  it('maps top-level routes to the same route metadata', async function () {
    const mod = await load();

    assert.equal(mod.getRouteInfo('/').bodyRoute, 'app');
    assert.equal(mod.getRouteInfo('/home').isMarketingHomeRoute, true);
    assert.equal(mod.getRouteInfo('/pricing').isPricingRoute, true);
    assert.equal(mod.getRouteInfo('/guides').isGuidesRoute, true);
    assert.equal(mod.getRouteInfo('/guides/wedding-budget-planner').guideSlug, 'wedding-budget-planner');
    assert.equal(mod.getRouteInfo('/rsvp/test-token').rsvpToken, 'test-token');
    assert.equal(mod.getRouteInfo('/careers').isCareersRoute, true);
    assert.equal(mod.getRouteInfo('/wedding').isWeddingWebsiteRoute, true);
    assert.equal(mod.getRouteInfo('/vendor').isVendorRoute, true);
    assert.equal(mod.getRouteInfo('/admin').isAdminRoute, true);
  });

  it('preserves public wedding slug detection', async function () {
    const mod = await load();

    assert.equal(mod.getRouteInfo('/riya-arjun').publicWeddingSlug, 'riya-arjun');
    assert.equal(mod.getRouteInfo('/home').publicWeddingSlug, '');
    assert.equal(mod.getRouteInfo('/pricing').publicWeddingSlug, '');
    assert.equal(mod.getRouteInfo('/guides').publicWeddingSlug, '');
    assert.equal(mod.getRouteInfo('/guides/wedding-budget-planner').publicWeddingSlug, '');
    assert.equal(mod.getRouteInfo('/rsvp/test-token').publicWeddingSlug, '');
    assert.equal(mod.getRouteInfo('/admin').publicWeddingSlug, '');
    assert.equal(mod.getRouteInfo('/wedding').bodyRoute, 'wedding');
    assert.equal(mod.getRouteInfo('/riya-arjun').bodyRoute, 'wedding');
    assert.equal(mod.getRouteInfo('/guides/wedding-budget-planner').bodyRoute, 'home');
  });
});
