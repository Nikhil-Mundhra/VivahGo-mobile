const assert = require('node:assert/strict');

const { appPath, readText } = require('./helpers/testUtils.cjs');

describe('VivahGo/src/hooks/useSwipeDown.js', function () {
  it('exports swipe hook with threshold argument', function () {
    const text = readText(appPath('src/hooks/useSwipeDown.js'));

    assert.match(text, /export\s+function\s+useSwipeDown\(onClose,\s*threshold\s*=\s*120\)/);
    assert.match(text, /const\s+modalProps\s*=\s*\{\s*ref:\s*setRef\s*\}/);
  });

  it('contains touch and mouse gesture handlers with cleanup', function () {
    const text = readText(appPath('src/hooks/useSwipeDown.js'));

    assert.match(text, /addEventListener\("touchstart"/);
    assert.match(text, /addEventListener\("touchmove"/);
    assert.match(text, /addEventListener\("mousemove"/);
    assert.match(text, /removeEventListener\("touchstart"/);
    assert.match(text, /removeEventListener\("mousemove"/);
  });
});
