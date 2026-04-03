import { request } from "../../shared/api/request.js";

export function fetchPublicWeddingWebsite(slug) {
  return request(`/planner/public?slug=${encodeURIComponent(slug)}`);
}
