const assert = require('node:assert/strict');

const { createRes } = require('./helpers/testUtils.cjs');
const {
  buildGuideMetadata,
  buildMarketingMetadata,
  buildQueryPageMetadata,
  buildRsvpMetadata,
  buildRouteSnapshot,
  buildWebsiteMetadata,
  createPageHandler,
  injectMetadataIntoHtml,
  injectRootMarkupIntoHtml,
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

  it('injects crawlable root markup into the app shell', function () {
    const html = injectRootMarkupIntoHtml(
      '<!doctype html><html><head></head><body><div id="root"></div></body></html>',
      '<main><h1>Wedding planner app</h1><p>Server snapshot</p></main>'
    );

    assert.match(html, /<div id="root"><main><h1>Wedding planner app<\/h1><p>Server snapshot<\/p><\/main><\/div>/);
  });

  it('builds marketing metadata for home, pricing, guides, and careers pages', function () {
    const req = { headers: { host: 'vivahgo.com', 'x-forwarded-proto': 'https' } };
    const plannerReq = { headers: { host: 'planner.vivahgo.com', 'x-forwarded-proto': 'https' } };

    assert.equal(buildMarketingMetadata(req, 'home').canonicalUrl, 'https://vivahgo.com/');
    assert.equal(buildMarketingMetadata(req, 'pricing').canonicalUrl, 'https://vivahgo.com/pricing');
    assert.equal(buildMarketingMetadata(req, 'guides').canonicalUrl, 'https://vivahgo.com/guides');
    assert.equal(buildMarketingMetadata(req, 'careers').canonicalUrl, 'https://vivahgo.com/careers');
    assert.equal(buildMarketingMetadata(plannerReq, 'home').canonicalUrl, 'https://vivahgo.com/');
    assert.equal(buildMarketingMetadata(plannerReq, 'pricing').canonicalUrl, 'https://vivahgo.com/pricing');
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

  it('builds query page metadata for a valid slug and noindexes missing pages', function () {
    const req = { headers: { host: 'vivahgo.com', 'x-forwarded-proto': 'https' } };
    const queryMeta = buildQueryPageMetadata(req, 'wedding-planner-app', {
      page: {
        slug: 'wedding-planner-app',
        title: 'Wedding Planner App',
        seoTitle: 'VivahGo Wedding Planner App',
        seoDescription: 'Query page description.',
        highlights: [{ title: 'One workspace' }],
        faqs: [{ question: 'Who is it for?', answer: 'Couples and planners.' }],
      },
    }, 200);
    const missingMeta = buildQueryPageMetadata(req, 'missing-page', { error: 'Planning page not found.' }, 404);

    assert.equal(queryMeta.canonicalPath, '/wedding-planner-app');
    assert.match(queryMeta.title, /Wedding Planner App/);
    assert.equal(missingMeta.robots, 'noindex, nofollow');
  });

  it('builds crawlable snapshots for indexable marketing routes', function () {
    const homeSnapshot = buildRouteSnapshot({ route: 'home', statusCode: 200, payload: null });
    const guideSnapshot = buildRouteSnapshot({
      route: 'guide',
      statusCode: 200,
      payload: {
        guide: {
          slug: 'wedding-budget-planner',
          title: 'Indian Wedding Budget Planning Guide',
          summary: 'Budget summary.',
          seoDescription: 'Budget SEO description.',
          sections: [
            {
              heading: 'Track the budget',
              paragraphs: ['Paragraph body.'],
              bullets: ['Watch pending balances.'],
            },
          ],
        },
      },
    });
    const querySnapshot = buildRouteSnapshot({
      route: 'query',
      statusCode: 200,
      payload: {
        page: {
          slug: 'wedding-planner-app',
          title: 'Wedding Planner App',
          heroKicker: 'Wedding planner app',
          heroTitle: 'The wedding planner app that keeps your wedding organized.',
          heroSummary: 'Summary.',
          heroBody: 'Body copy.',
          heroPrimaryLabel: 'Download free CSV',
          heroPrimaryHref: '/templates/wedding-budget-template.csv',
          heroPrimaryDownload: true,
          highlights: [{ title: 'One workspace', description: 'Description.' }],
          sections: [{ heading: 'Why it matters', paragraphs: ['Paragraph body.'], bullets: ['Bullet item.'] }],
          faqs: [{ question: 'Who is it for?', answer: 'Couples and planners.' }],
          relatedPageSlugs: [],
          relatedGuideSlugs: [],
        },
      },
    });

    assert.match(homeSnapshot, /The wedding planner app that keeps your entire wedding in one place/);
    assert.match(homeSnapshot, /Wedding checklist app/);
    assert.match(guideSnapshot, /Indian Wedding Budget Planning Guide/);
    assert.match(guideSnapshot, /Watch pending balances/);
    assert.match(querySnapshot, /The wedding planner app that keeps your wedding organized/);
    assert.match(querySnapshot, /Bullet item/);
    assert.match(querySnapshot, /download/);
    assert.match(querySnapshot, /\/templates\/wedding-budget-template\.csv/);
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
    assert.match(res.headers['Content-Security-Policy'], /script-src 'self' https:\/\/accounts\.google\.com https:\/\/apis\.google\.com https:\/\/www\.gstatic\.com https:\/\/www\.chatbase\.co/);
    assert.match(res.headers['Content-Security-Policy'], /connect-src 'self' https: http:\/\/localhost:\* http:\/\/127\.0\.0\.1:\* ws:\/\/localhost:\* ws:\/\/127\.0\.0\.1:\* https:\/\/www\.chatbase\.co/);
    assert.match(res.headers['Content-Security-Policy'], /frame-src 'self' https:\/\/www\.google\.com https:\/\/accounts\.google\.com https:\/\/www\.chatbase\.co/);
    assert.equal(res.headers['Strict-Transport-Security'], 'max-age=63072000; includeSubDomains; preload');
    assert.match(res.body, /VivahGo Pricing/);
    assert.match(res.body, /<link rel="canonical" href="https:\/\/vivahgo\.com\/pricing"/);
    assert.match(res.body, /application\/ld\+json/);
    assert.match(res.body, /Wedding Planner App Pricing/);
    assert.match(res.body, /Starter/);
  });

  it('renders crawlable home html through the page handler', async function () {
    const handler = createPageHandler({
      loadHtmlTemplate: async () => '<!doctype html><html><head><script type="module" src="/assets/app.js"></script></head><body><div id="root"></div></body></html>',
      plannerHandlers: {},
    });
    const req = {
      method: 'GET',
      headers: { host: 'vivahgo.com', 'x-forwarded-proto': 'https' },
      query: { route: 'home' },
    };
    const res = createRes();

    await handler(req, res);

    assert.equal(res.statusCode, 200);
    assert.match(res.body, /Wedding Planner App for Indian Weddings/);
    assert.match(res.body, /The wedding planner app that keeps your entire wedding in one place/);
    assert.match(res.body, /Wedding checklist app/);
    assert.match(res.body, /https:\/\/vivahgo\.com\/guides\/indian-wedding-checklist/);
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
    assert.match(res.body, /Budget by category and by ceremony/);
  });

  it('renders query page html for a valid query slug', async function () {
    const handler = createPageHandler({
      loadHtmlTemplate: async () => '<!doctype html><html><head><script type="module" src="/assets/app.js"></script></head><body><div id="root"></div></body></html>',
      plannerHandlers: {},
    });
    const req = {
      method: 'GET',
      headers: { host: 'vivahgo.com', 'x-forwarded-proto': 'https' },
      query: { route: 'query', slug: 'wedding-planner-app' },
    };
    const res = createRes();

    await handler(req, res);

    assert.equal(res.statusCode, 200);
    assert.match(res.body, /VivahGo Wedding Planner App/);
    assert.match(res.body, /The wedding planner app that keeps your entire wedding organized in one place/);
    assert.match(res.body, /https:\/\/vivahgo\.com\/wedding-planner-app/);
  });

  it('renders template query page html with a downloadable csv action', async function () {
    const handler = createPageHandler({
      loadHtmlTemplate: async () => '<!doctype html><html><head><script type="module" src="/assets/app.js"></script></head><body><div id="root"></div></body></html>',
      plannerHandlers: {},
    });
    const req = {
      method: 'GET',
      headers: { host: 'vivahgo.com', 'x-forwarded-proto': 'https' },
      query: { route: 'query', slug: 'free-wedding-budget-template' },
    };
    const res = createRes();

    await handler(req, res);

    assert.equal(res.statusCode, 200);
    assert.match(res.body, /Free Wedding Budget Template/);
    assert.match(res.body, /Download free CSV/);
    assert.match(res.body, /href="\/templates\/wedding-budget-template\.csv"/);
    assert.match(res.body, /download/);
  });

  it('redirects missing query pages to the marketing home', async function () {
    const handler = createPageHandler({
      loadHtmlTemplate: async () => {
        throw new Error('html template should not load for redirects');
      },
      plannerHandlers: {},
    });
    const req = {
      method: 'GET',
      headers: { host: 'vivahgo.com', 'x-forwarded-proto': 'https' },
      query: { route: 'query', slug: 'missing-page' },
    };
    const res = createRes();

    await handler(req, res);

    assert.equal(res.statusCode, 302);
    assert.equal(res.headers.Location, '/');
    assert.equal(res.headers['Cache-Control'], 'no-store');
    assert.equal(res.body, null);
    assert.equal(res.ended, true);
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
