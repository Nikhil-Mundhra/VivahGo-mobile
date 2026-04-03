import { request } from "../../shared/api/request.js";

export function fetchGuestRsvpDetails(rsvpToken) {
  return request(`/planner/rsvp?token=${encodeURIComponent(rsvpToken)}`);
}

export function submitGuestRsvp(rsvpToken, payload) {
  return request("/planner/rsvp", {
    method: "POST",
    body: {
      token: rsvpToken,
      ...payload,
    },
  });
}
