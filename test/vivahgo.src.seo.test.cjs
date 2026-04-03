const assert = require('node:assert/strict');
const { JSDOM } = require('jsdom');

const { appPath, toFileUrl } = require('./helpers/testUtils.cjs');

async function loadSeoModule() {
  return import(`${toFileUrl(appPath('src/seo.js'))}?t=${Date.now()}`);
}

describe('VivahGo/src/seo.js', function () {
  it('resolves site URLs from env, browser origin, and fallback defaults', async function () {
    const mod = await loadSeoModule();

    assert.equal(
      mod.resolveSiteUrl({ VITE_SITE_URL: 'https://preview.vivahgo.com/' }, undefined),
      'https://preview.vivahgo.com'
    );

    assert.equal(
      mod.resolveSiteUrl({}, { location: { hostname: 'app.vivahgo.com', origin: 'https://app.vivahgo.com' } }),
      'https://app.vivahgo.com'
    );

    assert.equal(
      mod.resolveSiteUrl({}, { location: { hostname: 'localhost', origin: 'http://localhost:5173' } }),
      mod.DEFAULT_SITE_URL
    );
  });

  it('builds absolute URLs from relative and absolute values', async function () {
    const mod = await loadSeoModule();

    assert.equal(
      mod.buildAbsoluteUrl('/pricing', { siteUrl: 'https://vivahgo.com' }),
      'https://vivahgo.com/pricing'
    );
    assert.equal(
      mod.buildAbsoluteUrl('https://cdn.example.com/cover.png', { siteUrl: 'https://vivahgo.com' }),
      'https://cdn.example.com/cover.png'
    );
  });

  it('applies SEO tags, canonical links, and structured data', async function () {
    const mod = await loadSeoModule();
    const dom = new JSDOM('<!doctype html><html><head></head><body></body></html>', {
      url: 'https://vivahgo.com/home',
    });

    mod.applySeoMetadata({
      title: 'VivahGo Pricing',
      description: 'Compare plans.',
      path: '/pricing',
      image: '/social-preview.jpg',
      structuredData: { '@context': 'https://schema.org', '@type': 'WebPage', name: 'Pricing' },
    }, {
      doc: dom.window.document,
      win: dom.window,
      env: {},
    });

    assert.equal(dom.window.document.title, 'VivahGo Pricing');
    assert.equal(
      dom.window.document.querySelector('meta[name="description"]').getAttribute('content'),
      'Compare plans.'
    );
    assert.equal(
      dom.window.document.querySelector('meta[property="og:url"]').getAttribute('content'),
      'https://vivahgo.com/pricing'
    );
    assert.equal(
      dom.window.document.querySelector('meta[property="og:locale"]').getAttribute('content'),
      'en_IN'
    );
    assert.equal(
      dom.window.document.querySelector('meta[name="twitter:image"]').getAttribute('content'),
      'https://vivahgo.com/social-preview.jpg'
    );
    assert.equal(
      dom.window.document.querySelector('link[rel="canonical"]').getAttribute('href'),
      'https://vivahgo.com/pricing'
    );
    assert.equal(
      dom.window.document.querySelectorAll('script[type="application/ld+json"]').length,
      1
    );
  });

  it('manages alternate feed links alongside canonical metadata', async function () {
    const mod = await loadSeoModule();
    const dom = new JSDOM('<!doctype html><html><head></head><body></body></html>', {
      url: 'https://vivahgo.com/guides',
    });

    mod.applySeoMetadata({
      title: 'VivahGo Guides',
      description: 'Guide library.',
      path: '/guides',
      alternateLinks: [
        {
          rel: 'alternate',
          type: 'application/rss+xml',
          title: 'VivahGo Guides RSS Feed',
          href: 'https://vivahgo.com/guides/feed.xml',
        },
      ],
    }, {
      doc: dom.window.document,
      win: dom.window,
      env: {},
    });

    const alternateLink = dom.window.document.querySelector('link[rel="alternate"][type="application/rss+xml"]');
    assert.ok(alternateLink);
    assert.equal(alternateLink.getAttribute('href'), 'https://vivahgo.com/guides/feed.xml');

    mod.applySeoMetadata({
      title: 'VivahGo Pricing',
      description: 'Compare plans.',
      path: '/pricing',
    }, {
      doc: dom.window.document,
      win: dom.window,
      env: {},
    });

    assert.equal(
      dom.window.document.querySelectorAll('link[rel="alternate"][type="application/rss+xml"]').length,
      0
    );
  });

  it('switches robots directives and clears old structured data when needed', async function () {
    const mod = await loadSeoModule();
    const dom = new JSDOM('<!doctype html><html><head></head><body></body></html>', {
      url: 'https://vivahgo.com/rsvp/test-token',
    });

    mod.applySeoMetadata({
      title: 'RSVP',
      description: 'Confirm your invitation.',
      path: '/rsvp/test-token',
      noindex: true,
      structuredData: { '@context': 'https://schema.org', '@type': 'WebPage', name: 'RSVP' },
    }, {
      doc: dom.window.document,
      win: dom.window,
      env: {},
    });

    mod.applySeoMetadata({
      title: 'RSVP',
      description: 'Confirm your invitation.',
      path: '/rsvp/test-token',
      noindex: true,
    }, {
      doc: dom.window.document,
      win: dom.window,
      env: {},
    });

    assert.equal(
      dom.window.document.querySelector('meta[name="robots"]').getAttribute('content'),
      'noindex, nofollow'
    );
    assert.equal(
      dom.window.document.querySelectorAll('script[type="application/ld+json"]').length,
      0
    );
  });
});
