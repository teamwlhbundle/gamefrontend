import axios, { type AxiosError } from "axios";

/**
 * API base URL.
 * - When NEXT_PUBLIC_API_URL is set (e.g. in production or local dev), use it so the
 *   client talks directly to the backend (CORS is handled by the server).
 * - When not set, fall back to "" so requests go to the same origin (useful only if a
 *   reverse proxy is configured in front of the frontend).
 */
export const getBaseUrl = (): string =>
  (typeof process !== "undefined" && process.env?.NEXT_PUBLIC_API_URL) || "";

/**
 * Read CSRF token from sessionStorage or cookie. Backend returns it in login response.
 */
export function getCsrfToken(): string | null {
  if (typeof window === "undefined") return null;
  const fromStorage = sessionStorage.getItem("csrf_token");
  if (fromStorage && fromStorage.trim()) return fromStorage.trim();
  const match = document.cookie.match(/csrf_token=([^;]+)/);
  return match ? decodeURIComponent(match[1].trim()) : null;
}

const apiClient = axios.create({
  baseURL: getBaseUrl(),
  withCredentials: true,
  headers: {
    Accept: "application/json",
    "Content-Type": "application/json",
  },
});

apiClient.interceptors.request.use((config) => {
  config.baseURL = getBaseUrl();
  const csrf = getCsrfToken();
  if (csrf) {
    config.headers.set("x-csrf-token", csrf);
  }
  return config;
});

apiClient.interceptors.response.use(
  (response) => response,
  (error: AxiosError<{ message?: string }>) => {
    const message =
      error.response?.data?.message ??
      (error.response?.status ? `Request failed with status ${error.response.status}` : error.message) ??
      "Request failed";
    throw new Error(message);
  }
);

export { apiClient };
