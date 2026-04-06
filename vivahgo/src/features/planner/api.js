import { request } from "../../shared/api/request.js";

const PLANNER_CACHE_TTL_MS = 15 * 1000;
const PLANNER_ACCESS_CACHE_KEY = "planner:access";
const PLANNER_NOTIFICATIONS_CACHE_KEY = "planner:notifications";

export function plannerQueryKey(plannerOwnerId) {
  return ["planner", plannerOwnerId || "self"];
}

export function plannerAccessQueryKey() {
  return ["planner-access"];
}

export function plannerNotificationsQueryKey() {
  return ["planner-notifications"];
}

function withOwnerQuery(path, plannerOwnerId) {
  if (!plannerOwnerId) {
    return path;
  }

  const join = path.includes("?") ? "&" : "?";
  return `${path}${join}plannerOwnerId=${encodeURIComponent(plannerOwnerId)}`;
}

export function fetchPlanner(token, plannerOwnerId) {
  const cacheKey = `planner:${plannerOwnerId || "self"}`;
  return request(withOwnerQuery("/planner/me", plannerOwnerId), {
    token,
    ttlMs: PLANNER_CACHE_TTL_MS,
    cacheKey,
  });
}

export function savePlanner(token, planner, plannerOwnerId) {
  return savePlannerMutation(token, planner, plannerOwnerId);
}

export function savePlannerMutation(token, planner, plannerOwnerId, mutationMeta = {}) {
  const invalidateKeys = [
    `planner:${plannerOwnerId || "self"}`,
    PLANNER_ACCESS_CACHE_KEY,
  ];
  return request(withOwnerQuery("/planner/me", plannerOwnerId), {
    method: "PUT",
    token,
    body: {
      planner,
      correlationId: mutationMeta.correlationId || "",
      clientSequence: mutationMeta.clientSequence ?? null,
      baseRevision: mutationMeta.baseRevision ?? null,
    },
    invalidateKeys,
  });
}

export function fetchAccessiblePlanners(token) {
  return request("/planner/access", {
    token,
    ttlMs: 30 * 1000,
    cacheKey: PLANNER_ACCESS_CACHE_KEY,
  });
}

export function createGuestRsvpLink(token, payload) {
  return request("/planner/me/rsvp-link", {
    method: "POST",
    token,
    body: payload,
  });
}

export function fetchPlanCollaborators(token, planId, plannerOwnerId) {
  const query = planId ? `?planId=${encodeURIComponent(planId)}` : "";
  const path = withOwnerQuery(`/planner/me/collaborators${query}`, plannerOwnerId);
  return request(path, { token });
}

export function fetchPlannerNotificationSettings(token) {
  return request("/planner/me/notifications", {
    token,
    ttlMs: 30 * 1000,
    cacheKey: PLANNER_NOTIFICATIONS_CACHE_KEY,
  });
}

export function savePlannerNotificationSettings(token, notificationPreferences) {
  return request("/planner/me/notifications", {
    method: "PUT",
    token,
    body: { notificationPreferences },
    invalidateKeys: [PLANNER_NOTIFICATIONS_CACHE_KEY],
  });
}

export function registerPlannerNotificationToken(token, payload) {
  return request("/planner/me/notifications", {
    method: "POST",
    token,
    body: payload,
    invalidateKeys: [PLANNER_NOTIFICATIONS_CACHE_KEY],
  });
}

export function removePlannerNotificationToken(token, payload) {
  return request("/planner/me/notifications", {
    method: "DELETE",
    token,
    body: payload,
    invalidateKeys: [PLANNER_NOTIFICATIONS_CACHE_KEY],
  });
}

export function addPlanCollaborator(token, payload) {
  return request(withOwnerQuery("/planner/me/collaborators", payload?.plannerOwnerId), {
    method: "POST",
    token,
    body: payload,
    invalidateKeys: [
      `planner:${payload?.plannerOwnerId || "self"}`,
      PLANNER_ACCESS_CACHE_KEY,
    ],
  });
}

export function updatePlanCollaboratorRole(token, payload) {
  return request(withOwnerQuery("/planner/me/collaborators", payload?.plannerOwnerId), {
    method: "PUT",
    token,
    body: payload,
    invalidateKeys: [
      `planner:${payload?.plannerOwnerId || "self"}`,
      PLANNER_ACCESS_CACHE_KEY,
    ],
  });
}

export function removePlanCollaborator(token, payload) {
  const query = payload?.email
    ? `?planId=${encodeURIComponent(payload.planId || "")}&email=${encodeURIComponent(payload.email)}`
    : "";
  const path = withOwnerQuery(`/planner/me/collaborators${query}`, payload?.plannerOwnerId);

  return request(path, {
    method: "DELETE",
    token,
    body: payload,
    invalidateKeys: [
      `planner:${payload?.plannerOwnerId || "self"}`,
      PLANNER_ACCESS_CACHE_KEY,
    ],
  });
}
