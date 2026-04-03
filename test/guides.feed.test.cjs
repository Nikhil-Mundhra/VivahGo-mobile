const assert = require('node:assert/strict');
const path = require('node:path');

const { ROOT, readText } = require('./helpers/testUtils.cjs');

const {
  buildGuidesFeed,
  OUTPUT_PATH,
} = require('../scripts/generate-guides-feed.cjs');
const guides = require('../vivahgo/src/shared/content/guides.json');

describe('guides RSS feed', function () {
  it('matches the generated XML from the current guide library', function () {
    const expectedXml = buildGuidesFeed(guides);
    const actualXml = readText(path.relative(ROOT, OUTPUT_PATH));

    assert.equal(actualXml, expectedXml);
  });

  it('includes the main feed metadata and every guide URL', function () {
    const xml = readText(path.relative(ROOT, OUTPUT_PATH));

    assert.match(xml, /<title>VivahGo Guides<\/title>/);
    assert.match(xml, /<atom:link href="https:\/\/vivahgo\.com\/guides\/feed\.xml" rel="self" type="application\/rss\+xml" \/>/);

    for (const guide of guides) {
      assert.match(xml, new RegExp(`<link>https://vivahgo\\.com/guides/${guide.slug}</link>`));
      assert.match(xml, new RegExp(`<pubDate>${new Date(`${guide.publishedAt}T00:00:00.000Z`).toUTCString().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}</pubDate>`));
    }
  });
});
