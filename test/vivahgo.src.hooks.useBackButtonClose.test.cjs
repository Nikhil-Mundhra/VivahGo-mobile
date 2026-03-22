const assert = require('node:assert/strict');

const { appPath, readText } = require('./helpers/testUtils.cjs');

describe('VivahGo/src/hooks/useBackButtonClose.js', function () {
  it('defines the back-state key and exported hook', function () {
    const text = readText(appPath('src/hooks/useBackButtonClose.js'));

    assert.match(text, /const\s+BACK_STATE_KEY\s*=\s*"__vivahgoModalToken"/);
    assert.match(text, /export\s+function\s+useBackButtonClose\s*\(/);
  });

  it('registers and cleans popstate listener correctly', function () {
    const text = readText(appPath('src/hooks/useBackButtonClose.js'));

    assert.match(text, /window\.history\.pushState\(/);
    assert.match(text, /window\.addEventListener\("popstate",\s*onPopState\)/);
    assert.match(text, /window\.removeEventListener\("popstate",\s*onPopState\)/);
  });
});
