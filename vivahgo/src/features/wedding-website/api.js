import { request } from "../../shared/api/request.js";

export function fetchPublicWeddingWebsite(slug) {
  return request(`/planner/public?slug=${encodeURIComponent(slug)}`, {
    ttlMs: 60 * 1000,
    cacheKey: `planner-public:${String(slug || "").trim().toLowerCase()}`,
  });
}
