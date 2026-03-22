const assert = require('node:assert/strict');

const { appPath, readText } = require('./helpers/testUtils.cjs');

describe('VivahGo/server/index.js', function () {
  it('declares expected API routes and middleware', function () {
    const text = readText(appPath('server/index.js'));

    assert.match(text, /app\.use\(\s*cors\(/);
    assert.match(text, /app\.use\(express\.json\(/);
    assert.match(text, /app\.get\('\/api\/health'/);
    assert.match(text, /app\.post\('\/api\/auth\/google'/);
    assert.match(text, /app\.get\('\/api\/planner\/me'/);
    assert.match(text, /app\.put\('\/api\/planner\/me'/);
  });

  it('contains auth middleware and startup safeguards', function () {
    const text = readText(appPath('server/index.js'));

    assert.match(text, /function\s+authMiddleware\s*\(/);
    assert.match(text, /Authentication required\./);
    assert.match(text, /Session expired\. Please sign in again\./);
    assert.match(text, /if\s*\(!mongoUri\)/);
    assert.match(text, /throw new Error\('MONGODB_URI is required\.'/);
  });
});
