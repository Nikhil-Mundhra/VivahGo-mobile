const VENDOR_SECTION_KEYS = [
  "businessName",
  "type",
  "subType",
  "bundledServices",
  "description",
  "country",
  "state",
  "city",
  "googleMapsLink",
  "coverageAreas",
  "phone",
  "website",
  "budgetRange",
  "availabilitySettings",
  "media",
  "verificationStatus",
  "verificationNotes",
  "verificationReviewedAt",
  "verificationReviewedBy",
  "verificationDocuments",
  "isApproved",
  "tier",
];

function cloneValue(value) {
  if (typeof structuredClone === "function") {
    return structuredClone(value);
  }

  return JSON.parse(JSON.stringify(value));
}

function stableSerialize(value) {
  return JSON.stringify(value);
}

export function createVendorMutationJournal(initialRevision = 0) {
  return {
    latestDispatchedSequence: 0,
    latestAcknowledgedRevision: Math.max(0, Number(initialRevision) || 0),
    pendingMutations: new Map(),
  };
}

export function buildVendorRollbackPatch(previousVendor = {}, nextVendor = {}) {
  return VENDOR_SECTION_KEYS.reduce((patch, key) => {
    if (stableSerialize(previousVendor?.[key]) === stableSerialize(nextVendor?.[key])) {
      return patch;
    }

    patch.push({
      key,
      previousValue: cloneValue(previousVendor?.[key]),
    });
    return patch;
  }, []);
}

export function applyVendorRollbackPatch(currentVendor = {}, rollbackPatch = []) {
  const nextVendor = { ...currentVendor };

  for (const entry of Array.isArray(rollbackPatch) ? rollbackPatch : []) {
    if (!entry || typeof entry.key !== "string") {
      continue;
    }

    nextVendor[entry.key] = cloneValue(entry.previousValue);
  }

  return nextVendor;
}

export function enqueueMutation(journal, { correlationId, baseRevision, nextVendor, previousVendor } = {}) {
  const sequence = journal.latestDispatchedSequence + 1;
  const mutation = {
    correlationId,
    baseRevision: Math.max(0, Number(baseRevision) || 0),
    clientSequence: sequence,
    nextVendor: cloneValue(nextVendor),
    nextVendorHash: stableSerialize(nextVendor),
    rollbackPatch: buildVendorRollbackPatch(previousVendor, nextVendor),
  };

  journal.latestDispatchedSequence = sequence;
  journal.pendingMutations.set(correlationId, mutation);
  return mutation;
}

export function ackMutation(journal, { correlationId, vendorRevision } = {}) {
  journal.pendingMutations.delete(correlationId);
  journal.latestAcknowledgedRevision = Math.max(
    journal.latestAcknowledgedRevision,
    Math.max(0, Number(vendorRevision) || 0)
  );
}

export function failMutation(journal, { correlationId } = {}) {
  const mutation = journal.pendingMutations.get(correlationId) || null;
  journal.pendingMutations.delete(correlationId);
  return mutation;
}

export function maybeRollback(journal, { mutation, currentVendor } = {}) {
  if (!mutation) {
    return { shouldRollback: false, reason: "missing-mutation", rollbackVendor: currentVendor };
  }

  if (mutation.clientSequence !== journal.latestDispatchedSequence) {
    return { shouldRollback: false, reason: "stale-mutation", rollbackVendor: currentVendor };
  }

  if (stableSerialize(currentVendor) !== mutation.nextVendorHash) {
    return { shouldRollback: false, reason: "vendor-changed", rollbackVendor: currentVendor };
  }

  return {
    shouldRollback: true,
    reason: "latest-mutation-failed",
    rollbackVendor: applyVendorRollbackPatch(currentVendor, mutation.rollbackPatch),
  };
}
