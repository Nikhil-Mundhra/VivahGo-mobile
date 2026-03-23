const assert = require('node:assert/strict');

const { appPath, toFileUrl } = require('./helpers/testUtils.cjs');

async function loadModule() {
  return import(`${toFileUrl(appPath('src/plannerDefaults.js'))}?t=${Date.now()}`);
}

describe('VivahGo/src/plannerDefaults.js', function () {
  it('createBlankPlanner returns empty planner shape', async function () {
    const mod = await loadModule();
    const planner = mod.createBlankPlanner();

    assert.deepEqual(Object.keys(planner).sort(), ['events', 'expenses', 'guests', 'tasks', 'vendors', 'wedding']);
    assert.deepEqual(planner.wedding, mod.EMPTY_WEDDING);
    assert.deepEqual(planner.events, []);
    assert.deepEqual(planner.expenses, []);
    assert.deepEqual(planner.guests, []);
    assert.deepEqual(planner.vendors, []);
    assert.deepEqual(planner.tasks, []);
  });

  it('createDemoPlanner returns seeded planner with cloned collections', async function () {
    const mod = await loadModule();
    const demoA = mod.createDemoPlanner();
    const demoB = mod.createDemoPlanner();

    assert.equal(demoA.wedding.bride, 'Aarohi');
    assert.ok(Array.isArray(demoA.events));
    assert.ok(Array.isArray(demoA.tasks));
    assert.ok(demoA.events.length >= 6);
    assert.ok(demoA.vendors.some(vendor => vendor.name === 'Pandit Sharma Ji'));

    demoA.events[0].name = 'Mutated Event';
    assert.notEqual(demoB.events[0].name, 'Mutated Event');
  });

  it('normalizePlanner handles null/invalid and normalizes expense/task defaults', async function () {
    const mod = await loadModule();

    assert.deepEqual(mod.normalizePlanner(null), mod.createBlankPlanner());
    assert.deepEqual(mod.normalizePlanner('bad-input'), mod.createBlankPlanner());

    const before = Date.now();
    const normalized = mod.normalizePlanner({
      wedding: { bride: 'Aarohi' },
      events: [{ id: 1 }],
      expenses: [null, { name: 'Venue', amount: '5000', eventId: 4 }, { area: 'guests', eventId: '' }],
      tasks: [null, { name: 'Book venue', done: 1 }],
      guests: 'bad-guests',
      vendors: [{ id: 1 }],
    });

    assert.equal(normalized.wedding.bride, 'Aarohi');
    assert.equal(normalized.wedding.groom, '');
    assert.deepEqual(normalized.events, [{ id: 1 }]);

    assert.equal(normalized.expenses.length, 3);
    assert.equal(normalized.expenses[0].name, '');
    assert.ok(normalized.expenses[0].id >= before);
    assert.equal(normalized.expenses[1].amount, 5000);
    assert.equal(normalized.expenses[1].area, 'ceremony');
    assert.equal(normalized.expenses[2].area, 'guests');

    assert.equal(normalized.tasks.length, 2);
    assert.equal(normalized.tasks[0].done, false);
    assert.equal(normalized.tasks[1].done, true);

    assert.deepEqual(normalized.guests, []);
    assert.deepEqual(normalized.vendors, [{ id: 1 }]);
  });

  it('hasWeddingProfile returns expected booleans for empty and populated fields', async function () {
    const mod = await loadModule();

    assert.equal(mod.hasWeddingProfile(null), false);
    assert.equal(mod.hasWeddingProfile(mod.EMPTY_WEDDING), false);
    assert.equal(mod.hasWeddingProfile({ bride: 'A' }), true);
    assert.equal(mod.hasWeddingProfile({ budget: '500000' }), true);
  });
});
