const assert = require('node:assert/strict');

const { appPath, toFileUrl } = require('./helpers/testUtils.cjs');

async function load() {
  return import(`${toFileUrl(appPath('src/features/planner/lib/plannerMutationManager.js'))}?t=${Date.now()}`);
}

function makePlanner(overrides = {}) {
  return {
    marriages: [{ id: 'plan_1', bride: 'Asha', groom: 'Rohan' }],
    activePlanId: 'plan_1',
    customTemplates: [],
    wedding: { bride: 'Asha', groom: 'Rohan', date: '', venue: '', guests: '', budget: '' },
    events: [],
    expenses: [],
    guests: [],
    vendors: [],
    tasks: [],
    ...overrides,
  };
}

describe('VivahGo planner mutation manager', function () {
  it('rolls back the latest failed mutation only', async function () {
    const mod = await load();
    const journal = mod.createPlannerMutationJournal(1);

    const basePlanner = makePlanner();
    const firstPlanner = makePlanner({ wedding: { ...basePlanner.wedding, bride: 'Priya' } });
    const secondPlanner = makePlanner({ wedding: { ...basePlanner.wedding, bride: 'Priya', groom: 'Kabir' } });

    const mutationA = mod.enqueueMutation(journal, {
      correlationId: 'a',
      baseRevision: 1,
      previousPlanner: basePlanner,
      nextPlanner: firstPlanner,
    });
    const mutationB = mod.enqueueMutation(journal, {
      correlationId: 'b',
      baseRevision: 1,
      previousPlanner: firstPlanner,
      nextPlanner: secondPlanner,
    });

    const failedA = mod.failMutation(journal, { correlationId: mutationA.correlationId });
    const decisionA = mod.maybeRollback(journal, {
      mutation: failedA,
      currentPlanner: secondPlanner,
    });
    assert.equal(decisionA.shouldRollback, false);
    assert.equal(decisionA.reason, 'stale-mutation');

    const failedB = mod.failMutation(journal, { correlationId: mutationB.correlationId });
    const decisionB = mod.maybeRollback(journal, {
      mutation: failedB,
      currentPlanner: secondPlanner,
    });
    assert.equal(decisionB.shouldRollback, true);
    assert.equal(decisionB.rollbackPlanner.wedding.groom, 'Rohan');
    assert.equal(decisionB.rollbackPlanner.wedding.bride, 'Priya');
  });

  it('does not roll back when the planner changed after dispatch', async function () {
    const mod = await load();
    const journal = mod.createPlannerMutationJournal(4);

    const previousPlanner = makePlanner();
    const dispatchedPlanner = makePlanner({ wedding: { ...previousPlanner.wedding, bride: 'Maya' } });
    const laterLocalPlanner = makePlanner({ wedding: { ...previousPlanner.wedding, bride: 'Maya', venue: 'Jaipur' } });

    const mutation = mod.enqueueMutation(journal, {
      correlationId: 'mutation-1',
      baseRevision: 4,
      previousPlanner,
      nextPlanner: dispatchedPlanner,
    });

    const failed = mod.failMutation(journal, { correlationId: mutation.correlationId });
    const decision = mod.maybeRollback(journal, {
      mutation: failed,
      currentPlanner: laterLocalPlanner,
    });

    assert.equal(decision.shouldRollback, false);
    assert.equal(decision.reason, 'planner-changed');
  });

  it('tracks the highest acknowledged planner revision', async function () {
    const mod = await load();
    const journal = mod.createPlannerMutationJournal(2);

    mod.enqueueMutation(journal, {
      correlationId: 'mutation-2',
      baseRevision: 2,
      previousPlanner: makePlanner(),
      nextPlanner: makePlanner({ wedding: { bride: 'Aarohi', groom: 'Rohan', date: '', venue: '', guests: '', budget: '' } }),
    });

    mod.ackMutation(journal, { correlationId: 'mutation-2', plannerRevision: 5 });

    assert.equal(journal.latestAcknowledgedRevision, 5);
    assert.equal(journal.pendingMutations.size, 0);
  });
});
