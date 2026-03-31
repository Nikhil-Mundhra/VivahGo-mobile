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
    assert.equal(mod.getRouteInfo('/wedding-planner-app').queryPageSlug, 'wedding-planner-app');
    assert.equal(mod.getRouteInfo('/free-wedding-budget-template').queryPageSlug, 'free-wedding-budget-template');
    assert.equal(mod.getRouteInfo('/for-wedding-planners').queryPageSlug, 'for-wedding-planners');
    assert.equal(mod.getRouteInfo('/wedding-planner-app').bodyRoute, 'home');
    assert.equal(mod.getRouteInfo('/rsvp/test-token').rsvpToken, 'test-token');
    assert.equal(mod.getRouteInfo('/rsvp/test-token').bodyRoute, 'rsvp');
    assert.equal(mod.getRouteInfo('/careers').isCareersRoute, true);
    assert.equal(mod.getRouteInfo('/wedding').isWeddingWebsiteRoute, true);
    assert.equal(mod.getRouteInfo('/vendor').isVendorRoute, true);
    assert.equal(mod.getRouteInfo('/admin').isAdminRoute, true);
  });

  it('uses hostname-aware routing for main-site and planner root paths', async function () {
    const mod = await load();

    assert.equal(mod.getRouteInfo('/', { hostname: 'vivahgo.com' }).bodyRoute, 'home');
    assert.equal(mod.getRouteInfo('/', { hostname: 'vivahgo.com' }).isMarketingHomeRoute, true);
    assert.equal(mod.getRouteInfo('/home', { hostname: 'vivahgo.com' }).isMarketingHomeRoute, true);

    assert.equal(mod.getRouteInfo('/', { hostname: 'planner.vivahgo.com' }).bodyRoute, 'app');
    assert.equal(mod.getRouteInfo('/', { hostname: 'planner.vivahgo.com' }).isMarketingHomeRoute, false);
    assert.equal(mod.getRouteInfo('/home', { hostname: 'planner.vivahgo.com' }).bodyRoute, 'app');
    assert.equal(mod.getRouteInfo('/home', { hostname: 'planner.vivahgo.com' }).isMarketingHomeRoute, false);

    assert.equal(mod.getRouteInfo('/', { hostname: 'localhost' }).bodyRoute, 'home');
    assert.equal(mod.getRouteInfo('/', { hostname: 'localhost' }).isMarketingHomeRoute, true);
    assert.equal(mod.getRouteInfo('/planner', { hostname: 'localhost' }).bodyRoute, 'app');
    assert.equal(mod.getRouteInfo('/planner', { hostname: 'localhost' }).publicWeddingSlug, '');
  });

  it('preserves public wedding slug detection', async function () {
    const mod = await load();

    assert.equal(mod.getRouteInfo('/riya-arjun').publicWeddingSlug, 'riya-arjun');
    assert.equal(mod.getRouteInfo('/home').publicWeddingSlug, '');
    assert.equal(mod.getRouteInfo('/pricing').publicWeddingSlug, '');
    assert.equal(mod.getRouteInfo('/guides').publicWeddingSlug, '');
    assert.equal(mod.getRouteInfo('/guides/wedding-budget-planner').publicWeddingSlug, '');
    assert.equal(mod.getRouteInfo('/wedding-planner-app').publicWeddingSlug, '');
    assert.equal(mod.getRouteInfo('/free-wedding-budget-template').publicWeddingSlug, '');
    assert.equal(mod.getRouteInfo('/for-wedding-planners').publicWeddingSlug, '');
    assert.equal(mod.getRouteInfo('/rsvp/test-token').publicWeddingSlug, '');
    assert.equal(mod.getRouteInfo('/admin').publicWeddingSlug, '');
    assert.equal(mod.getRouteInfo('/wedding').bodyRoute, 'wedding');
    assert.equal(mod.getRouteInfo('/riya-arjun').bodyRoute, 'wedding');
    assert.equal(mod.getRouteInfo('/guides/wedding-budget-planner').bodyRoute, 'home');
    assert.equal(mod.getRouteInfo('/guest-list-rsvp-app').queryPageSlug, 'guest-list-rsvp-app');
    assert.equal(mod.getRouteInfo('/wedding-guest-list-template').queryPageSlug, 'wedding-guest-list-template');
  });
});
