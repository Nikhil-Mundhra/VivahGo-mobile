const assert = require('node:assert/strict');

const { appPath, toFileUrl } = require('./helpers/testUtils.cjs');

describe('VivahGo/server/models/Planner.js', function () {
  it('exports a mongoose model with expected paths', async function () {
    const mod = await import(toFileUrl(appPath('server/models/Planner.js')));
    const Planner = mod.default;

    assert.equal(typeof Planner, 'function');
    assert.ok(Planner.schema.path('googleId'));
    assert.ok(Planner.schema.path('customTemplates'));
    assert.ok(Planner.schema.path('wedding'));
    assert.ok(Planner.schema.path('events'));
    assert.ok(Planner.schema.path('expenses'));
    assert.ok(Planner.schema.path('tasks'));
    assert.ok(Planner.schema.path('marriages.reminderSettings'));
  });

  it('applies array/object defaults for planner sections', async function () {
    const mod = await import(toFileUrl(appPath('server/models/Planner.js')));
    const Planner = mod.default;

    const doc = new Planner({ googleId: 'test-google-id' });
    const err = doc.validateSync();

    assert.equal(err, undefined);
    assert.deepEqual(doc.wedding, {});
    assert.deepEqual(doc.customTemplates, []);
    assert.deepEqual(doc.events, []);
    assert.deepEqual(doc.expenses, []);
    assert.deepEqual(doc.guests, []);
    assert.deepEqual(doc.vendors, []);
    assert.deepEqual(doc.tasks, []);
  });
});
