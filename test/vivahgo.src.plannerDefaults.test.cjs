const assert = require('node:assert/strict');

const { appPath, readText } = require('./helpers/testUtils.cjs');

describe('VivahGo/src/plannerDefaults.js', function () {
  it('declares all expected planner factory/normalizer exports', function () {
    const text = readText(appPath('src/plannerDefaults.js'));

    assert.match(text, /export\s+const\s+EMPTY_WEDDING\s*=\s*\{/);
    assert.match(text, /export\s+function\s+createBlankPlanner\s*\(/);
    assert.match(text, /export\s+function\s+createDemoPlanner\s*\(/);
    assert.match(text, /export\s+function\s+normalizePlanner\s*\(/);
    assert.match(text, /export\s+function\s+hasWeddingProfile\s*\(/);
  });

  it('contains normalization helpers for expenses/tasks', function () {
    const text = readText(appPath('src/plannerDefaults.js'));

    assert.match(text, /function\s+normalizeExpense\s*\(/);
    assert.match(text, /function\s+normalizeTask\s*\(/);
    assert.match(text, /Array\.isArray\(planner\.expenses\)/);
    assert.match(text, /Array\.isArray\(planner\.tasks\)/);
  });
});
