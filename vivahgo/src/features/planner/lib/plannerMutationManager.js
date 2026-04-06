const PLANNER_SECTION_KEYS = [
  "marriages",
  "activePlanId",
  "customTemplates",
  "wedding",
  "events",
  "expenses",
  "guests",
  "vendors",
  "tasks",
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

export function createPlannerMutationJournal(initialRevision = 0) {
  return {
    latestDispatchedSequence: 0,
    latestAcknowledgedRevision: Math.max(0, Number(initialRevision) || 0),
    pendingMutations: new Map(),
  };
}

export function buildPlannerRollbackPatch(previousPlanner = {}, nextPlanner = {}) {
  return PLANNER_SECTION_KEYS.reduce((patch, key) => {
    if (stableSerialize(previousPlanner?.[key]) === stableSerialize(nextPlanner?.[key])) {
      return patch;
    }

    patch.push({
      key,
      previousValue: cloneValue(previousPlanner?.[key]),
    });
    return patch;
  }, []);
}

export function applyPlannerRollbackPatch(currentPlanner = {}, rollbackPatch = []) {
  const nextPlanner = { ...currentPlanner };

  for (const entry of Array.isArray(rollbackPatch) ? rollbackPatch : []) {
    if (!entry || typeof entry.key !== "string") {
      continue;
    }

    nextPlanner[entry.key] = cloneValue(entry.previousValue);
  }

  return nextPlanner;
}

export function enqueueMutation(journal, { correlationId, baseRevision, nextPlanner, previousPlanner } = {}) {
  const sequence = journal.latestDispatchedSequence + 1;
  const mutation = {
    correlationId,
    baseRevision: Math.max(0, Number(baseRevision) || 0),
    clientSequence: sequence,
    nextPlanner: cloneValue(nextPlanner),
    nextPlannerHash: stableSerialize(nextPlanner),
    rollbackPatch: buildPlannerRollbackPatch(previousPlanner, nextPlanner),
  };

  journal.latestDispatchedSequence = sequence;
  journal.pendingMutations.set(correlationId, mutation);
  return mutation;
}

export function ackMutation(journal, { correlationId, plannerRevision } = {}) {
  journal.pendingMutations.delete(correlationId);
  journal.latestAcknowledgedRevision = Math.max(
    journal.latestAcknowledgedRevision,
    Math.max(0, Number(plannerRevision) || 0)
  );
}

export function failMutation(journal, { correlationId } = {}) {
  const mutation = journal.pendingMutations.get(correlationId) || null;
  journal.pendingMutations.delete(correlationId);
  return mutation;
}

export function maybeRollback(journal, { mutation, currentPlanner } = {}) {
  if (!mutation) {
    return { shouldRollback: false, reason: "missing-mutation", rollbackPlanner: currentPlanner };
  }

  if (mutation.clientSequence !== journal.latestDispatchedSequence) {
    return { shouldRollback: false, reason: "stale-mutation", rollbackPlanner: currentPlanner };
  }

  if (stableSerialize(currentPlanner) !== mutation.nextPlannerHash) {
    return { shouldRollback: false, reason: "planner-changed", rollbackPlanner: currentPlanner };
  }

  return {
    shouldRollback: true,
    reason: "latest-mutation-failed",
    rollbackPlanner: applyPlannerRollbackPatch(currentPlanner, mutation.rollbackPatch),
  };
}
