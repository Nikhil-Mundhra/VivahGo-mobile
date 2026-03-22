const assert = require('node:assert/strict');
const fs = require('node:fs');

const { toAbs } = require('./helpers/testUtils.cjs');

const SOURCE_JS_FILES = [
  'api/_lib/core.js',
  'api/auth/google.js',
  'api/feedback.js',
  'api/health.js',
  'api/planner/me.js',
  'VivahGo/eslint.config.js',
  'VivahGo/server/index.js',
  'VivahGo/server/models/Planner.js',
  'VivahGo/server/models/User.js',
  'VivahGo/src/api.js',
  'VivahGo/src/constants.js',
  'VivahGo/src/data.js',
  'VivahGo/src/hooks/useBackButtonClose.js',
  'VivahGo/src/hooks/useSwipeDown.js',
  'VivahGo/src/plannerDefaults.js',
  'VivahGo/src/utils.js',
  'VivahGo/vite.config.js',
];

describe('source JS manifest', function () {
  it('ensures every tracked source .js file exists', function () {
    for (const file of SOURCE_JS_FILES) {
      assert.equal(fs.existsSync(toAbs(file)), true, `${file} should exist`);
    }
  });
});
