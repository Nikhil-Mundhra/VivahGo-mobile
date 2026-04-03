import { request } from "../../shared/api/request.js";

function withOwnerQuery(path, plannerOwnerId) {
  if (!plannerOwnerId) {
    return path;
  }

  const join = path.includes("?") ? "&" : "?";
  return `${path}${join}plannerOwnerId=${encodeURIComponent(plannerOwnerId)}`;
}

export function fetchPlanner(token, plannerOwnerId) {
  return request(withOwnerQuery("/planner/me", plannerOwnerId), { token });
}

export function savePlanner(token, planner, plannerOwnerId) {
  return request(withOwnerQuery("/planner/me", plannerOwnerId), {
    method: "PUT",
    token,
    body: { planner },
  });
}

export function fetchAccessiblePlanners(token) {
  return request("/planner/access", { token });
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
  return request("/planner/me/notifications", { token });
}

export function savePlannerNotificationSettings(token, notificationPreferences) {
  return request("/planner/me/notifications", {
    method: "PUT",
    token,
    body: { notificationPreferences },
  });
}

export function registerPlannerNotificationToken(token, payload) {
  return request("/planner/me/notifications", {
    method: "POST",
    token,
    body: payload,
  });
}

export function removePlannerNotificationToken(token, payload) {
  return request("/planner/me/notifications", {
    method: "DELETE",
    token,
    body: payload,
  });
}

export function addPlanCollaborator(token, payload) {
  return request(withOwnerQuery("/planner/me/collaborators", payload?.plannerOwnerId), {
    method: "POST",
    token,
    body: payload,
  });
}

export function updatePlanCollaboratorRole(token, payload) {
  return request(withOwnerQuery("/planner/me/collaborators", payload?.plannerOwnerId), {
    method: "PUT",
    token,
    body: payload,
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
  });
}
