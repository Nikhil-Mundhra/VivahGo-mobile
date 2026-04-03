const assert = require('node:assert/strict');

const { appPath, toFileUrl } = require('./helpers/testUtils.cjs');

async function loadModule() {
  return import(`${toFileUrl(appPath('src/plannerDefaults.js'))}?t=${Date.now()}`);
}

describe('VivahGo/src/plannerDefaults.js', function () {
  it('createBlankPlanner returns empty planner shape with multi-marriage support', async function () {
    const mod = await loadModule();
    const planner = mod.createBlankPlanner();

    assert.deepEqual(Object.keys(planner).sort(), ['activePlanId', 'customTemplates', 'events', 'expenses', 'guests', 'marriages', 'tasks', 'vendors', 'wedding']);
    assert.ok(planner.activePlanId, 'activePlanId should exist');
    assert.ok(planner.activePlanId.startsWith('plan_'), 'activePlanId should start with plan_');
    assert.deepEqual(planner.marriages.length, 1, 'should have one marriage plan');
    assert.equal(planner.marriages[0].id, planner.activePlanId, 'marriage id should match activePlanId');
    assert.deepEqual(planner.customTemplates, []);
    assert.deepEqual(planner.wedding, mod.EMPTY_WEDDING);
    assert.deepEqual(planner.events, []);
    assert.deepEqual(planner.expenses, []);
    assert.deepEqual(planner.guests, []);
    assert.deepEqual(planner.vendors, []);
    assert.deepEqual(planner.tasks, []);
  });

  it('buildWeddingWebsitePath uses stored slug, derived names, and preview fallback', async function () {
    const mod = await loadModule();

    assert.equal(mod.buildWeddingWebsitePath({ websiteSlug: 'isha-veer-2' }), '/isha-veer-2');
    assert.equal(mod.buildWeddingWebsitePath({ bride: 'Isha', groom: 'Veer' }), '/isha-veer-1');
    assert.equal(mod.buildWeddingWebsitePath({}, mod.EMPTY_WEDDING), '/wedding');
  });

  it('createDemoPlanner returns seeded planner with cloned collections and multi-marriage support', async function () {
    const mod = await loadModule();
    const demoA = mod.createDemoPlanner();
    const demoB = mod.createDemoPlanner();

    assert.equal(demoA.wedding.bride, 'Aarohi');
    assert.equal(demoA.wedding.groom, 'Pranav');
    assert.ok(Array.isArray(demoA.events));
    assert.ok(Array.isArray(demoA.tasks));
    assert.ok(demoA.events.length >= 15);
    assert.ok(demoA.guests.length >= 18);
    assert.ok(demoA.expenses.length >= 10);
    assert.ok(demoA.tasks.filter(task => task.done).length >= 10);
    assert.ok(demoA.marriages.length > 0, 'should have marriages');
    assert.ok(demoA.activePlanId, 'should have activePlanId');
    assert.equal(demoA.marriages[0].websiteSlug, 'aarohi-pranav-1');
    assert.ok(demoA.vendors.some(vendor => vendor.name === "VivahGo's Choice Pandit"));

    demoA.events[0].name = 'Mutated Event';
    assert.notEqual(demoB.events[0].name, 'Mutated Event');
  });

  it('normalizePlanner handles null/invalid and normalizes expense/task defaults', async function () {
    const mod = await loadModule();

    // For null/invalid input, check structure not exact IDs
    const nullResult = mod.normalizePlanner(null);
    const blankPlanner = mod.createBlankPlanner();
    assert.ok(nullResult.activePlanId, 'should have activePlanId');
    assert.ok(nullResult.marriages.length > 0, 'should have marriages');
    assert.deepEqual(Object.keys(nullResult).sort(), Object.keys(blankPlanner).sort(), 'should have same keys as blank planner');

    const badResult = mod.normalizePlanner('bad-input');
    assert.ok(badResult.activePlanId, 'should have activePlanId for bad input');
    assert.ok(badResult.marriages.length > 0, 'should have marriages for bad input');

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
    assert.equal(normalized.events.length, 1);
    assert.equal(normalized.events[0].id, 1);
    assert.ok(normalized.events[0].planId, 'events should have planId after migration');
    assert.equal(normalized.events[0].isPublicWebsiteVisible, true);

    assert.equal(normalized.expenses.length, 2);
    assert.equal(normalized.expenses[0].amount, 5000);
    assert.equal(normalized.expenses[0].area, 'ceremony');
    assert.ok(normalized.expenses[0].planId, 'expenses should have planId');
    assert.equal(normalized.expenses[1].area, 'guests');

    assert.equal(normalized.tasks.length, 1);
    assert.equal(normalized.tasks[0].done, true);
    assert.ok(normalized.tasks[0].planId, 'tasks should have planId');

    assert.deepEqual(normalized.guests, []);
    assert.equal(normalized.vendors.length, 1);
    assert.equal(normalized.vendors[0].id, 1);
    assert.ok(normalized.vendors[0].planId, 'vendors should have planId after migration');
  });

  it('normalizes website settings on marriages', async function () {
    const mod = await loadModule();

    const normalized = mod.normalizePlanner({
      marriages: [
        { id: 'plan_site', bride: 'Asha', groom: 'Rohan', websiteSettings: { isActive: false, showCountdown: false, theme: 'garden-sage', heroTagline: 'Celebrate with us' } },
      ],
      activePlanId: 'plan_site',
    });

    assert.equal(normalized.marriages[0].websiteSettings.isActive, false);
    assert.equal(normalized.marriages[0].websiteSettings.showCountdown, false);
    assert.equal(normalized.marriages[0].websiteSettings.showCalendar, true);
    assert.equal(normalized.marriages[0].websiteSettings.theme, 'garden-sage');
    assert.equal(normalized.marriages[0].websiteSettings.heroTagline, 'Celebrate with us');
    assert.equal(normalized.marriages[0].websiteSettings.scheduleTitle, 'Wedding Calendar');
  });

  it('normalizes and uses custom templates for plan collections', async function () {
    const mod = await loadModule();
    const planner = mod.normalizePlanner({
      customTemplates: [
        {
          id: 'custom_template_a',
          name: 'Temple Wedding',
          culture: 'Custom',
          emoji: '🛕',
          events: [
            { name: 'Welcome Dinner', emoji: '🍽️' },
            { name: 'Temple Ceremony', emoji: '🛕' },
          ],
        },
      ],
    });

    assert.equal(planner.customTemplates.length, 1);
    assert.equal(planner.customTemplates[0].eventCount, 2);

    const collections = mod.createTemplatePlanCollections('custom_template_a', planner.activePlanId, planner.customTemplates);
    assert.equal(collections.events.length, 2);
    assert.equal(collections.events[0].name, 'Welcome Dinner');
    assert.equal(collections.tasks.some(task => task.name.includes('Temple Ceremony')), true);
  });

  it('normalizePlanner migrates missing planId records to the active plan once', async function () {
    const mod = await loadModule();

    const normalized = mod.normalizePlanner({
      marriages: [
        { id: 'plan_a', bride: 'A', groom: 'B' },
        { id: 'plan_b', bride: 'C', groom: 'D' },
      ],
      activePlanId: 'plan_b',
      events: [{ id: 1, name: 'Haldi' }, { id: 2, name: 'Sangeet', planId: 'plan_a' }],
    });

    assert.equal(normalized.activePlanId, 'plan_b');
    assert.equal(normalized.events.length, 2);
    const migrated = normalized.events.find(item => item.id === 1);
    const untouched = normalized.events.find(item => item.id === 2);
    assert.equal(migrated.planId, 'plan_b');
    assert.equal(untouched.planId, 'plan_a');
  });

  it('hasWeddingProfile returns expected booleans for empty and populated fields', async function () {
    const mod = await loadModule();

    assert.equal(mod.hasWeddingProfile(null), false);
    assert.equal(mod.hasWeddingProfile(mod.EMPTY_WEDDING), false);
    assert.equal(mod.hasWeddingProfile({ bride: 'A' }), true);
    assert.equal(mod.hasWeddingProfile({ budget: '500000' }), true);
  });
});
