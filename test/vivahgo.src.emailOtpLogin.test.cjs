const assert = require('node:assert/strict');

const { appPath, readText } = require('./helpers/testUtils.cjs');

describe('VivahGo/src/components/EmailOtpLogin.jsx', function () {
  it('includes Clerk captcha mount point for custom sign-up protection', function () {
    const source = readText(appPath('src/components/EmailOtpLogin.jsx'));

    assert.match(source, /id="clerk-captcha"/);
    assert.match(source, /data-cl-theme="auto"/);
    assert.match(source, /data-cl-size="flexible"/);
  });
});