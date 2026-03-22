const assert = require('node:assert/strict');

const { appPath, readText } = require('./helpers/testUtils.cjs');

describe('VivahGo/src/api.js', function () {
  it('exports auth and planner request wrappers', function () {
    const text = readText(appPath('src/api.js'));

    assert.match(text, /export\s+function\s+loginWithGoogle\s*\(/);
    assert.match(text, /export\s+function\s+fetchPlanner\s*\(/);
    assert.match(text, /export\s+function\s+savePlanner\s*\(/);
  });

  it('contains base-url resolution branches for local, configured, and fallback API', function () {
    const text = readText(appPath('src/api.js'));

    assert.match(text, /function\s+resolveApiBaseUrl\s*\(/);
    assert.match(text, /VITE_API_BASE_URL/);
    assert.match(text, /VITE_USE_REMOTE_API/);
    assert.match(text, /http:\/\/localhost:4000\/api/);
    assert.match(text, /return '\/api'/);
  });
});
