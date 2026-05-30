import { API_BASE_URL, STORAGE_KEYS } from "./config.js";

export class ApiError extends Error {
  constructor(message, status, data) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.data = data;
  }
}

async function parseJson(response) {
  try {
    return await response.json();
  } catch {
    return {};
  }
}

function isTokenExpired(token) {
  if (!token) return true;
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return true;
    const payload = JSON.parse(atob(parts[1]));
    const expiresAt = payload.exp * 1000; // exp is in seconds, convert to ms
    return Date.now() >= expiresAt;
  } catch {
    return true;
  }
}

async function sendRequest(path, options = {}) {
  const token = localStorage.getItem(STORAGE_KEYS.authToken);
  if (token && isTokenExpired(token)) {
    localStorage.clear();
    window.location.href = "/?reason=session";
    return;
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    mode: "cors",
    ...options,
  });
  const data = await parseJson(response);

  if (response.status === 401) {
    localStorage.clear();
    window.location.href = "/?reason=session";
    return;
  }

  if (!response.ok) {
    throw new ApiError(
      data.message || "Falha na comunicação com a API",
      response.status,
      data,
    );
  }

  return data;
}

export async function loginUser(payload) {
  return sendRequest("/auth/login", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
}

export async function registerUser(payload) {
  return sendRequest("/auth/register", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
}

export async function fetchDashboardSession(token) {
  return sendRequest("/dashboard", {
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
}

export async function fetchAdminOverview(token) {
  return sendRequest("/auth/admin/overview", {
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
}

export async function updateAdminStatus(token, payload) {
  return sendRequest("/auth/admin/status", {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  });
}

export async function fetchFreelancers(token, search = "") {
  const queryString = new URLSearchParams({ search }).toString();
  const path = `/marketplace/freelancers${queryString ? `?${queryString}` : ""}`;

  return sendRequest(path, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
}

export async function fetchMyFreelancerProfile(token) {
  return sendRequest("/marketplace/me/freelancer-profile", {
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
}

export async function saveMyFreelancerProfile(token, payload) {
  return sendRequest("/marketplace/me/freelancer-profile", {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  });
}

export async function sendMessage(token, payload) {
  return sendRequest("/marketplace/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  });
}

export async function fetchMessages(token) {
  return sendRequest("/marketplace/messages", {
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
}

export async function createJob(token, payload) {
  return sendRequest("/marketplace/jobs", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  });
}

export async function fetchJobs(token, status = "open") {
  const queryString = new URLSearchParams({ status }).toString();
  const path = `/marketplace/jobs?${queryString}`;

  return sendRequest(path, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
}

export async function applyToJob(token, payload) {
  return sendRequest("/marketplace/jobs/apply", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  });
}

export async function fetchJobApplications(token, jobId) {
  return sendRequest(`/marketplace/jobs/${jobId}/applications`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
}

export async function updateApplicationStatus(token, payload) {
  return sendRequest("/marketplace/jobs/applications/status", {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  });
}

export async function completeJob(token, jobId) {
  return sendRequest(`/marketplace/jobs/${jobId}/complete`, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
}

export async function payJob(token, jobId) {
  return sendRequest(`/marketplace/jobs/${jobId}/pay`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
}

export async function deactivateAccount(token, days = 180) {
  return sendRequest("/marketplace/account/deactivate", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ days }),
  });
}

export async function reactivateAccount(token) {
  return sendRequest("/marketplace/account/reactivate", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
}

export async function deleteAccount(token) {
  return sendRequest("/marketplace/account", {
    method: "DELETE",
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
}

export async function getAccountStatus(token) {
  return sendRequest("/marketplace/account/status", {
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
}

export async function updateProfile(token, payload) {
  return sendRequest("/marketplace/users/profile", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  });
}

export async function fetchBillingStatus(token) {
  return sendRequest("/billing/status", {
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
}

export async function createCheckoutSession(token, payload) {
  return sendRequest("/billing/checkout-session", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  });
}

export async function createBillingPortalSession(token) {
  return sendRequest("/billing/portal", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
}

export async function fetchMyPayout(token) {
  return sendRequest("/marketplace/me/payout", {
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
}

export async function updateMyPayout(token, payload) {
  return sendRequest("/marketplace/me/payout", {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  });
}
