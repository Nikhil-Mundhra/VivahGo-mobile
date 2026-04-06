const assert = require('node:assert/strict');

const { appPath, toFileUrl } = require('./helpers/testUtils.cjs');

async function loadVendorMutationManager() {
  return import(`${toFileUrl(appPath('src/features/vendor/lib/vendorMutationManager.js'))}?t=${Date.now()}`);
}

describe('VivahGo vendor mutation manager', function () {
  it('rolls back the latest failed vendor mutation only', async function () {
    const mod = await loadVendorMutationManager();
    const journal = mod.createVendorMutationJournal(2);

    const first = mod.enqueueMutation(journal, {
      correlationId: 'mutation-1',
      baseRevision: 2,
      previousVendor: { businessName: 'Lotus Events', city: 'Jaipur' },
      nextVendor: { businessName: 'Lotus Events', city: 'Delhi' },
    });
    const second = mod.enqueueMutation(journal, {
      correlationId: 'mutation-2',
      baseRevision: 2,
      previousVendor: { businessName: 'Lotus Events', city: 'Delhi' },
      nextVendor: { businessName: 'Lotus Events Studio', city: 'Delhi' },
    });

    mod.failMutation(journal, { correlationId: first.correlationId });
    const failedLatest = mod.failMutation(journal, { correlationId: second.correlationId });
    const rollback = mod.maybeRollback(journal, {
      mutation: failedLatest,
      currentVendor: { businessName: 'Lotus Events Studio', city: 'Delhi' },
    });

    assert.equal(rollback.shouldRollback, true);
    assert.deepEqual(rollback.rollbackVendor, { businessName: 'Lotus Events', city: 'Delhi' });
  });

  it('does not roll back when a newer vendor mutation has already been dispatched', async function () {
    const mod = await loadVendorMutationManager();
    const journal = mod.createVendorMutationJournal(0);

    const first = mod.enqueueMutation(journal, {
      correlationId: 'mutation-1',
      baseRevision: 0,
      previousVendor: { businessName: 'Lotus Events' },
      nextVendor: { businessName: 'Lotus Events Prime' },
    });

    mod.enqueueMutation(journal, {
      correlationId: 'mutation-2',
      baseRevision: 0,
      previousVendor: { businessName: 'Lotus Events Prime' },
      nextVendor: { businessName: 'Lotus Events Studio' },
    });

    const rollback = mod.maybeRollback(journal, {
      mutation: first,
      currentVendor: { businessName: 'Lotus Events Studio' },
    });

    assert.equal(rollback.shouldRollback, false);
    assert.equal(rollback.reason, 'stale-mutation');
  });

  it('tracks the highest acknowledged vendor revision', async function () {
    const mod = await loadVendorMutationManager();
    const journal = mod.createVendorMutationJournal(1);

    mod.enqueueMutation(journal, {
      correlationId: 'mutation-1',
      baseRevision: 1,
      previousVendor: { businessName: 'Lotus Events' },
      nextVendor: { businessName: 'Lotus Events Prime' },
    });

    mod.ackMutation(journal, {
      correlationId: 'mutation-1',
      vendorRevision: 4,
    });

    assert.equal(journal.latestAcknowledgedRevision, 4);
    assert.equal(journal.pendingMutations.size, 0);
  });
});
