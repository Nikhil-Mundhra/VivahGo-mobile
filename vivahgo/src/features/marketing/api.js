import { request } from "../../shared/api/request.js";

export function submitFeedback(payload) {
  return request("/feedback", {
    method: "POST",
    body: payload,
  });
}

export function fetchCareers() {
  return request("/careers");
}

export function submitCareerApplication(payload) {
  return request("/careers", {
    method: "POST",
    body: payload,
  });
}

export function getSubscriptionStatus(token) {
  return request("/subscription/status", { token });
}

export function createCheckoutSession(token, plan, billingCycle, couponCode) {
  return request("/subscription/checkout", {
    method: "POST",
    token,
    body: { plan, billingCycle, couponCode },
  });
}

export function getCheckoutQuote(token, plan, billingCycle, couponCode) {
  return request("/subscription/quote", {
    method: "POST",
    token,
    body: { plan, billingCycle, couponCode },
  });
}

export function confirmCheckoutPayment(token, payload) {
  return request("/subscription/confirm", {
    method: "POST",
    token,
    body: payload,
  });
}

export function createPortalSession(token) {
  return request("/subscription/portal", {
    method: "POST",
    token,
  });
}
