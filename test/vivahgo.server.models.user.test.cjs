const assert = require('node:assert/strict');

const { appPath, toFileUrl } = require('./helpers/testUtils.cjs');

describe('VivahGo/server/models/User.js', function () {
  it('exports a mongoose model with expected paths', async function () {
    const mod = await import(toFileUrl(appPath('server/models/User.js')));
    const User = mod.default;

    assert.equal(typeof User, 'function');
    assert.ok(User.schema.path('googleId'));
    assert.ok(User.schema.path('email'));
    assert.ok(User.schema.path('name'));
    assert.ok(User.schema.path('picture'));
    assert.ok(User.schema.path('staffRole'));
    assert.ok(User.schema.path('staffAddedBy'));
    assert.ok(User.schema.path('staffGrantedAt'));
    assert.ok(User.schema.path('notificationPreferences'));
    assert.ok(User.schema.path('notificationDevices'));
  });

  it('lowercases and trims email when creating documents', async function () {
    const mod = await import(toFileUrl(appPath('server/models/User.js')));
    const User = mod.default;

    const doc = new User({
      googleId: 'abc',
      email: '  USER@EXAMPLE.COM ',
      name: ' Test User ',
    });

    const err = doc.validateSync();

    assert.equal(err, undefined);
    assert.equal(doc.email, 'user@example.com');
    assert.equal(doc.name, 'Test User');
  });
});
