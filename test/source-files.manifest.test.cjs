const assert = require('node:assert/strict');
const fs = require('node:fs');

const { appPath, toAbs } = require('./helpers/testUtils.cjs');

const SOURCE_JS_FILES = [
  'api/_lib/core.js',
  'api/_lib/b2.js',
  'api/_lib/blob.js',
  'api/admin.js',
  'api/auth.js',
  'api/careers.js',
  'api/media.js',
  'api/page.js',
  'api/planner.js',
  'api/system.js',
  'api/vendor.js',
  'api-handlers/media/appUpload.js',
  'api-handlers/media/presignedUrl.js',
  'api-handlers/media/readJsonBody.js',
  'api-handlers/media/verificationPresignedUrl.js',
  'api-handlers/system/feedback.js',
  'api-handlers/system/health.js',
  appPath('eslint.config.js'),
  appPath('server/index.js'),
  appPath('server/models/CareerApplication.js'),
  appPath('server/models/Planner.js'),
  appPath('server/models/User.js'),
  appPath('src/api.js'),
  appPath('src/appRoutes.js'),
  appPath('src/constants.js'),
  appPath('src/data.js'),
  appPath('src/hooks/useBackButtonClose.js'),
  appPath('src/publicAssetUrls.js'),
  appPath('src/hooks/useSwipeDown.js'),
  appPath('src/plannerDefaults.js'),
  appPath('src/utils.js'),
  appPath('vite.config.js'),
];

describe('source JS manifest', function () {
  it('ensures every tracked source .js file exists', function () {
    for (const file of SOURCE_JS_FILES) {
      assert.equal(fs.existsSync(toAbs(file)), true, `${file} should exist`);
    }
  });
});
