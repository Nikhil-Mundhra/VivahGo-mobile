const assert = require('node:assert/strict');

const { appPath, toFileUrl } = require('./helpers/testUtils.cjs');

describe('VivahGo/eslint.config.js', function () {
  it('exports a flat config array with JS/JSX matcher', async function () {
    const mod = await import(toFileUrl(appPath('eslint.config.js')));

    assert.ok(Array.isArray(mod.default));

    const jsJsxConfig = mod.default.find(
      entry => entry && Array.isArray(entry.files) && entry.files.includes('**/*.{js,jsx}')
    );

    assert.ok(jsJsxConfig, 'expected a config entry targeting **/*.{js,jsx}');
    assert.equal(typeof jsJsxConfig.rules, 'object');
    assert.ok(Object.prototype.hasOwnProperty.call(jsJsxConfig.rules, 'no-unused-vars'));
  });
});
