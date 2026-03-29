const assert = require('node:assert/strict');
const { appPath, toFileUrl } = require('./helpers/testUtils.cjs');

async function load() {
  return import(toFileUrl(appPath('src/siteUrls.js')));
}

describe('VivahGo/src/siteUrls.js', function () {
  it('builds stable marketing and planner URLs', async function () {
    const mod = await load();

    assert.equal(mod.getMarketingUrl('/'), 'https://vivahgo.com/');
    assert.equal(mod.getMarketingUrl('/pricing'), 'https://vivahgo.com/pricing');
    assert.equal(mod.getPlannerUrl('/'), 'https://planner.vivahgo.com/');
    assert.equal(mod.getPlannerUrl('/vendor'), 'https://planner.vivahgo.com/vendor');
    assert.equal(
      mod.getMarketingUrl('/', { hostname: 'localhost', origin: 'http://localhost:5173' }),
      'http://localhost:5173/'
    );
    assert.equal(
      mod.getPlannerUrl('/', { hostname: 'localhost', origin: 'http://localhost:5173' }),
      'http://localhost:5173/planner'
    );
    assert.equal(
      mod.getPlannerUrl('/tasks', { hostname: 'localhost', origin: 'http://localhost:5173' }),
      'http://localhost:5173/planner/tasks'
    );
  });

  it('distinguishes planner, marketing, and local hosts', async function () {
    const mod = await load();

    assert.equal(mod.isPlannerHostname('planner.vivahgo.com'), true);
    assert.equal(mod.isPlannerHostname('vivahgo.com'), false);
    assert.equal(mod.shouldRenderMarketingHomeAtRoot('vivahgo.com'), true);
    assert.equal(mod.shouldRenderMarketingHomeAtRoot('www.vivahgo.com'), true);
    assert.equal(mod.shouldRenderMarketingHomeAtRoot('planner.vivahgo.com'), false);
    assert.equal(mod.shouldRenderMarketingHomeAtRoot('localhost:5173'), true);
  });
});
