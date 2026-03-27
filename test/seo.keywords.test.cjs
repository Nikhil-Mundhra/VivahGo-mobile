const assert = require('node:assert/strict');

const keywordLibrary = require('../vivahgo/src/generated/seo-keywords.json');

describe('generated SEO keyword library', function () {
  it('contains more than 1000 unique keywords from local site sources', function () {
    assert.ok(keywordLibrary.summary.keywordCount > 1000);
    assert.equal(keywordLibrary.summary.keywordCount, keywordLibrary.keywords.length);
    assert.equal(new Set(keywordLibrary.keywords).size, keywordLibrary.keywords.length);
  });

  it('covers cultural, ceremony, vendor, and location-based Indian wedding searches', function () {
    assert.ok(keywordLibrary.keywords.includes('indian wedding planner'));
    assert.ok(keywordLibrary.keywords.includes('punjabi wedding planner'));
    assert.ok(keywordLibrary.keywords.includes('mehndi checklist'));
    assert.ok(keywordLibrary.keywords.includes('wedding decorators for indian weddings'));
    assert.ok(keywordLibrary.keywords.includes('jaipur wedding planner'));
  });
});
