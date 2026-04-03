import { request } from "../../shared/api/request.js";

export function fetchAdminSession(token) {
  return request("/admin/me", { token });
}

export function fetchAdminVendors(token) {
  return request("/admin/vendors", { token });
}

export function fetchAdminChoiceProfiles(token) {
  return request("/admin/choice", { token });
}

export function fetchAdminApplications(token) {
  return request("/admin/applications", { token });
}

export function fetchAdminResumeAccessUrl(token, { key, filename, mode = "download" }) {
  const query = new URLSearchParams({
    key: key || "",
    filename: filename || "resume.pdf",
    mode: mode === "preview" ? "preview" : "download",
    response: "json",
  });

  return request(`/admin/resume-download?${query.toString()}`, { token });
}

export function saveAdminCareerRejectionTemplate(token, payload) {
  return request("/admin/applications", {
    method: "PATCH",
    token,
    body: {
      action: "save-rejection-template",
      ...payload,
    },
  });
}

export function rejectAdminCareerApplication(token, payload) {
  return request("/admin/applications", {
    method: "PATCH",
    token,
    body: {
      action: "reject-application",
      ...payload,
    },
  });
}

export function fetchAdminSubscribers(token) {
  return request("/admin/subscribers", { token });
}

export function updateAdminVendorApproval(token, payload) {
  return request("/admin/vendors", {
    method: "PATCH",
    token,
    body: payload,
  });
}

export function updateAdminChoiceProfile(token, payload) {
  return request("/admin/choice", {
    method: "PATCH",
    token,
    body: payload,
  });
}

export function fetchAdminChoiceMediaPresignedUrl(token, payload) {
  return request("/admin/choice-media-upload", {
    method: "POST",
    token,
    body: payload,
  });
}

export function fetchAdminStaff(token) {
  return request("/admin/staff", { token });
}

export function addAdminStaff(token, payload) {
  return request("/admin/staff", {
    method: "POST",
    token,
    body: payload,
  });
}

export function updateAdminStaff(token, payload) {
  return request("/admin/staff", {
    method: "PUT",
    token,
    body: payload,
  });
}

export function removeAdminStaff(token, email) {
  return request(`/admin/staff?email=${encodeURIComponent(email)}`, {
    method: "DELETE",
    token,
    body: { email },
  });
}
