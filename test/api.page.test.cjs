const assert = require('node:assert/strict');

const { createRes } = require('./helpers/testUtils.cjs');
const {
  buildGuideMetadata,
  buildMarketingMetadata,
  buildRsvpMetadata,
  buildWebsiteMetadata,
  createPageHandler,
  injectMetadataIntoHtml,
} = require('../api/page');

describe('api/page.js', function () {
  it('injects fresh metadata into the built app shell', function () {
    const html = injectMetadataIntoHtml(
      '<!doctype html><html><head><title>Old</title><meta name="description" content="Old" /><script type="module" src="/assets/app.js"></script></head><body><div id="root"></div></body></html>',
      {
        title: 'Asha & Rohan | Wedding Website',
        description: 'Celebrate with Asha & Rohan.',
        canonicalPath: '/asha-rohan-1',
        robots: 'noindex, nofollow',
      },
      { headers: { host: 'vivahgo.com', 'x-forwarded-proto': 'https' } }
    );

    assert.match(html, /Asha &amp; Rohan \| Wedding Website/);
    assert.match(html, /meta name="robots" content="noindex, nofollow"/);
    assert.match(html, /meta property="og:url" content="https:\/\/vivahgo\.com\/asha-rohan-1"/);
    assert.doesNotMatch(html, /<title>Old<\/title>/);
  });

  it('builds marketing metadata for home, pricing, guides, and careers pages', function () {
    const req = { headers: { host: 'vivahgo.com', 'x-forwarded-proto': 'https' } };

    assert.equal(buildMarketingMetadata(req, 'home').canonicalPath, '/home');
    assert.equal(buildMarketingMetadata(req, 'pricing').canonicalPath, '/pricing');
    assert.equal(buildMarketingMetadata(req, 'guides').canonicalPath, '/guides');
    assert.equal(buildMarketingMetadata(req, 'careers').canonicalPath, '/careers');
  });

  it('builds guide metadata for a valid guide slug and noindexes missing guides', function () {
    const req = { headers: { host: 'vivahgo.com', 'x-forwarded-proto': 'https' } };
    const guideMeta = buildGuideMetadata(req, 'wedding-budget-planner', {
      guide: {
        slug: 'wedding-budget-planner',
        title: 'Indian Wedding Budget Planning Guide',
        seoDescription: 'Budget guide.',
        keywords: ['wedding budget planner'],
      },
    }, 200);
    const missingGuideMeta = buildGuideMetadata(req, 'missing-guide', { error: 'Guide not found.' }, 404);

    assert.match(guideMeta.title, /Budget Planning Guide/);
    assert.equal(guideMeta.canonicalPath, '/guides/wedding-budget-planner');
    assert.equal(missingGuideMeta.robots, 'noindex, nofollow');
  });

  it('builds wedding and rsvp metadata from planner payloads', function () {
    const req = { headers: { host: 'vivahgo.com', 'x-forwarded-proto': 'https' } };
    const websiteMeta = buildWebsiteMetadata(req, 'asha-rohan-1', {
      wedding: { bride: 'Asha', groom: 'Rohan', date: '12 Dec 2026', venue: 'Jaipur' },
      plan: { websiteSlug: 'asha-rohan-1' },
      events: [{ id: 1 }, { id: 2 }],
    }, 200);
    const rsvpMeta = buildRsvpMetadata(req, 'token-1', {
      wedding: { bride: 'Asha', groom: 'Rohan', date: '12 Dec 2026', venue: 'Jaipur' },
      plan: {},
      guest: { name: 'Rajesh Sharma' },
    }, 200);

    assert.match(websiteMeta.title, /Asha & Rohan/);
    assert.match(websiteMeta.description, /View 2 shared events/);
    assert.match(rsvpMeta.title, /Asha & Rohan/);
    assert.equal(rsvpMeta.robots, 'noindex, nofollow');
  });

  it('renders marketing html through the page handler', async function () {
    const handler = createPageHandler({
      loadHtmlTemplate: async () => '<!doctype html><html><head><script type="module" src="/assets/app.js"></script></head><body><div id="root"></div></body></html>',
      plannerHandlers: {},
    });
    const req = {
      method: 'GET',
      headers: { host: 'vivahgo.com', 'x-forwarded-proto': 'https' },
      query: { route: 'pricing' },
    };
    const res = createRes();

    await handler(req, res);

    assert.equal(res.statusCode, 200);
    assert.equal(res.headers['Content-Type'], 'text/html; charset=utf-8');
    assert.equal(res.headers['Cache-Control'], 'public, s-maxage=3600, stale-while-revalidate=86400');
    assert.equal(res.headers['X-Content-Type-Options'], 'nosniff');
    assert.equal(res.headers['X-Frame-Options'], 'SAMEORIGIN');
    assert.match(res.headers['Content-Security-Policy'], /default-src 'self'/);
    assert.match(res.headers['Content-Security-Policy'], /style-src 'self' 'unsafe-inline' https:\/\/fonts\.googleapis\.com/);
    assert.match(res.headers['Content-Security-Policy'], /font-src 'self' data: https:\/\/fonts\.gstatic\.com/);
    assert.equal(res.headers['Strict-Transport-Security'], 'max-age=63072000; includeSubDomains; preload');
    assert.match(res.body, /VivahGo Pricing/);
    assert.match(res.body, /application\/ld\+json/);
  });

  it('renders guide html for a valid guide slug', async function () {
    const handler = createPageHandler({
      loadHtmlTemplate: async () => '<!doctype html><html><head><script type="module" src="/assets/app.js"></script></head><body><div id="root"></div></body></html>',
      plannerHandlers: {},
    });
    const req = {
      method: 'GET',
      headers: { host: 'vivahgo.com', 'x-forwarded-proto': 'https' },
      query: { route: 'guide', slug: 'wedding-budget-planner' },
    };
    const res = createRes();

    await handler(req, res);

    assert.equal(res.statusCode, 200);
    assert.match(res.body, /Indian Wedding Budget Planning Guide/);
    assert.match(res.body, /https:\/\/vivahgo\.com\/guides\/wedding-budget-planner/);
  });

  it('renders guide html and returns 404 for an unknown guide slug', async function () {
    const handler = createPageHandler({
      loadHtmlTemplate: async () => '<!doctype html><html><head><script type="module" src="/assets/app.js"></script></head><body><div id="root"></div></body></html>',
      plannerHandlers: {},
    });
    const req = {
      method: 'GET',
      headers: { host: 'vivahgo.com', 'x-forwarded-proto': 'https' },
      query: { route: 'guide', slug: 'missing-guide' },
    };
    const res = createRes();

    await handler(req, res);

    assert.equal(res.statusCode, 404);
    assert.match(res.body, /Guide Not Found/);
    assert.match(res.body, /noindex, nofollow/);
  });

  it('renders public website html from planner data', async function () {
    const handler = createPageHandler({
      loadHtmlTemplate: async () => '<!doctype html><html><head><script type="module" src="/assets/app.js"></script></head><body><div id="root"></div></body></html>',
      plannerHandlers: {
        handlePlannerPublic: async (_req, res) => {
          res.status(200).json({
            wedding: { bride: 'Asha', groom: 'Rohan', date: '12 Dec 2026', venue: 'Jaipur' },
            plan: { websiteSlug: 'asha-rohan-1' },
            events: [{ id: 1 }],
          });
        },
      },
    });
    const req = {
      method: 'GET',
      headers: { host: 'vivahgo.com', 'x-forwarded-proto': 'https' },
      query: { route: 'website', slug: 'asha-rohan-1' },
    };
    const res = createRes();

    await handler(req, res);

    assert.equal(res.statusCode, 200);
    assert.equal(res.headers['Cache-Control'], 'public, s-maxage=600, stale-while-revalidate=3600');
    assert.match(res.body, /Asha &amp; Rohan \| Wedding Website/);
    assert.match(res.body, /https:\/\/vivahgo\.com\/asha-rohan-1/);
  });

  it('renders rsvp html with a 404 status when the token is invalid', async function () {
    const handler = createPageHandler({
      loadHtmlTemplate: async () => '<!doctype html><html><head><script type="module" src="/assets/app.js"></script></head><body><div id="root"></div></body></html>',
      plannerHandlers: {
        handlePlannerRsvp: async (_req, res) => {
          res.status(404).json({ error: 'Wedding invitation not found.' });
        },
      },
    });
    const req = {
      method: 'GET',
      headers: { host: 'vivahgo.com', 'x-forwarded-proto': 'https' },
      query: { route: 'rsvp', token: 'missing-token' },
    };
    const res = createRes();

    await handler(req, res);

    assert.equal(res.statusCode, 404);
    assert.equal(res.headers['Cache-Control'], 'no-store');
    assert.match(res.body, /RSVP Unavailable/);
    assert.match(res.body, /Wedding invitation not found/);
  });
});
