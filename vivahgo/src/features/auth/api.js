import { request } from "../../shared/api/request.js";

export function loginWithGoogle(credential) {
  return request("/auth/google", {
    method: "POST",
    body: { credential },
  });
}

export function loginWithClerk(token, clerkUser = {}) {
  const sanitizedUser = clerkUser && typeof clerkUser === "object" ? clerkUser : {};
  const requestOptions = {
    method: "POST",
    body: {
      token,
      userId: sanitizedUser.id || "",
      email: sanitizedUser.email || "",
      name: sanitizedUser.name || "",
      picture: sanitizedUser.picture || "",
    },
  };

  return request("/auth/clerk", requestOptions).catch((error) => {
    if (!/404/.test(String(error?.message || ""))) {
      throw error;
    }

    return request("/auth?route=clerk", requestOptions);
  });
}

export function deleteAccount(token) {
  return request("/auth/me", {
    method: "DELETE",
    token,
  });
}

export function logoutSession(token) {
  return request("/auth/logout", {
    method: "POST",
    token,
  });
}
