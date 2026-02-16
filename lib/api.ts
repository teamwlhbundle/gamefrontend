const getBaseUrl = () =>
  typeof window !== "undefined"
    ? process.env.NEXT_PUBLIC_API_URL || ""
    : process.env.NEXT_PUBLIC_API_URL || "";

/**
 * Read CSRF token from cookie (set by backend on admin login).
 * Required for POST/PUT/PATCH/DELETE to admin API.
 */
export function getCsrfToken(): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(/csrf_token=([^;]+)/);
  return match ? decodeURIComponent(match[1].trim()) : null;
}

export async function login(email: string, password: string): Promise<string> {
  const res = await fetch(`${getBaseUrl()}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    const message =
      typeof data?.message === "string" ? data.message : "Login failed";
    throw new Error(message);
  }

  const token = data?.token ?? data?.accessToken ?? data?.access_token;
  if (!token || typeof token !== "string") {
    throw new Error("Invalid response: no token received");
  }

  return token;
}

/**
 * Verify admin session using HTTP-only cookie (credentials: 'include').
 * Used for route protection when using cookie-based auth.
 */
export async function checkAdminSessionCookie(): Promise<boolean> {
  const baseUrl = getBaseUrl();
  try {
    const res = await fetch(`${baseUrl}/api/admin/me`, {
      method: "GET",
      credentials: "include",
    });
    return res.ok;
  } catch {
    return false;
  }
}

/**
 * Verify admin token by calling a protected endpoint.
 * Used for route protection to ensure token is still valid.
 */
export async function verifyAdminSession(token: string): Promise<boolean> {
  const baseUrl = getBaseUrl();
  if (!baseUrl) return true; // no API URL: trust token presence
  try {
    const res = await fetch(`${baseUrl}/api/admin/me`, {
      method: "GET",
      headers: { Authorization: `Bearer ${token}` },
    });
    return res.ok;
  } catch {
    return false;
  }
}

export type DailyPlannerItem = {
  gameId: string;
  name: string;
  resultTime: string;
  scheduleType: string;
  resultNumber: string | null;
  source: string | null;
  status: string;
  resultStatus: "Publish" | "Random Publish" | "Scheduled" | "pending";
  isRandom?: boolean;
  publishAt?: string;
};

export type DailyPlannerResponse = {
  date: string;
  items: DailyPlannerItem[];
};

/**
 * Fetch daily planner (Result Manager) for a date. Uses admin cookie auth.
 */
export async function getDailyPlanner(date: string): Promise<DailyPlannerResponse> {
  const baseUrl = getBaseUrl();
  const res = await fetch(
    `${baseUrl}/api/admin/daily-planner?date=${encodeURIComponent(date)}`,
    { credentials: "include" }
  );
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = typeof data?.message === "string" ? data.message : "Failed to load results";
    throw new Error(msg);
  }
  return data as DailyPlannerResponse;
}

export type SubmitResultPayload = {
  gameId: string;
  date: string;
  time?: string;
  resultNumber: string;
};

/**
 * Add or update a scheduled result. Uses admin cookie + CSRF.
 */
export async function submitResult(payload: SubmitResultPayload): Promise<void> {
  const baseUrl = getBaseUrl();
  const csrf = getCsrfToken();
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (csrf) headers["x-csrf-token"] = csrf;
  const res = await fetch(`${baseUrl}/api/admin/result`, {
    method: "POST",
    credentials: "include",
    headers,
    body: JSON.stringify(payload),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = typeof data?.message === "string" ? data.message : "Failed to save result";
    throw new Error(msg);
  }
}

// --- Game Manager (unpublished scheduled results) ---

export type UnpublishedItem = {
  _id: string | null;
  gameId: string;
  gameName: string;
  date: string;
  time: string;
  fullDateTime: string;
  resultNumber: string | null;
};

export type UnpublishedResponse = {
  items: UnpublishedItem[];
};

export type UnpublishedParams = {
  start?: string;
  end?: string;
  gameId?: string;
  futureOnly?: boolean;
};

export async function getUnpublishedScheduledResults(
  params?: UnpublishedParams
): Promise<UnpublishedResponse> {
  const baseUrl = getBaseUrl();
  const search = new URLSearchParams();
  if (params?.start) search.set("start", params.start);
  if (params?.end) search.set("end", params.end);
  if (params?.gameId) search.set("gameId", params.gameId);
  if (params?.futureOnly === true) search.set("futureOnly", "true");
  const qs = search.toString();
  const url = `${baseUrl}/api/admin/scheduled-results/unpublished${qs ? `?${qs}` : ""}`;
  const res = await fetch(url, { credentials: "include" });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = typeof data?.message === "string" ? data.message : "Failed to load unpublished results";
    throw new Error(msg);
  }
  return data as UnpublishedResponse;
}

export async function deleteScheduledResult(id: string): Promise<void> {
  const baseUrl = getBaseUrl();
  const csrf = getCsrfToken();
  const headers: Record<string, string> = {};
  if (csrf) headers["x-csrf-token"] = csrf;
  const res = await fetch(`${baseUrl}/api/admin/scheduled-results/${encodeURIComponent(id)}`, {
    method: "DELETE",
    credentials: "include",
    headers,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = typeof data?.message === "string" ? data.message : "Failed to delete";
    throw new Error(msg);
  }
}

export type CancelSlotPayload = {
  gameId: string;
  date: string;
  time: string;
};

/**
 * Cancel a single future slot (pending or scheduled). Uses admin cookie + CSRF.
 */
export async function cancelSlot(payload: CancelSlotPayload): Promise<void> {
  const baseUrl = getBaseUrl();
  const csrf = getCsrfToken();
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (csrf) headers["x-csrf-token"] = csrf;
  const res = await fetch(`${baseUrl}/api/admin/slots/cancel`, {
    method: "POST",
    credentials: "include",
    headers,
    body: JSON.stringify(payload),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = typeof data?.message === "string" ? data.message : "Failed to cancel slot";
    throw new Error(msg);
  }
}

export type DeleteScheduledResultsByGameResponse = {
  deletedCount: number;
  skippedCount: number;
  cancelledPendingCount: number;
};

/**
 * Delete all future unpublished scheduled results for a game (and cancel pending slots). Uses admin cookie + CSRF.
 */
export async function deleteScheduledResultsByGame(
  gameId: string
): Promise<DeleteScheduledResultsByGameResponse> {
  const baseUrl = getBaseUrl();
  const csrf = getCsrfToken();
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (csrf) headers["x-csrf-token"] = csrf;
  const res = await fetch(`${baseUrl}/api/admin/scheduled-results/bulk-by-game`, {
    method: "DELETE",
    credentials: "include",
    headers,
    body: JSON.stringify({ gameId }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = typeof data?.message === "string" ? data.message : "Failed to delete by game";
    throw new Error(msg);
  }
  return data as DeleteScheduledResultsByGameResponse;
}

export async function deleteScheduledResultsBulk(ids: string[]): Promise<{ deletedCount: number; skippedCount: number }> {
  const baseUrl = getBaseUrl();
  const csrf = getCsrfToken();
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (csrf) headers["x-csrf-token"] = csrf;
  const res = await fetch(`${baseUrl}/api/admin/scheduled-results/bulk`, {
    method: "DELETE",
    credentials: "include",
    headers,
    body: JSON.stringify({ ids }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = typeof data?.message === "string" ? data.message : "Failed to delete";
    throw new Error(msg);
  }
  return data as { deletedCount: number; skippedCount: number };
}

export async function updateScheduledResultsBulk(
  ids: string[],
  resultNumber: string
): Promise<{ updatedCount: number; skippedCount: number }> {
  const baseUrl = getBaseUrl();
  const csrf = getCsrfToken();
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (csrf) headers["x-csrf-token"] = csrf;
  const res = await fetch(`${baseUrl}/api/admin/scheduled-results/bulk`, {
    method: "PATCH",
    credentials: "include",
    headers,
    body: JSON.stringify({ ids, resultNumber }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = typeof data?.message === "string" ? data.message : "Failed to update";
    throw new Error(msg);
  }
  return data as { updatedCount: number; skippedCount: number };
}

/**
 * Hard reset: delete all game data (games, schedules, results, cancelled slots).
 * Uses admin cookie + CSRF. Call only after frontend double confirmation.
 */
export async function hardReset(): Promise<{ ok: true; message: string }> {
  const baseUrl = getBaseUrl();
  const csrf = getCsrfToken();
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (csrf) headers["x-csrf-token"] = csrf;
  const res = await fetch(`${baseUrl}/api/admin/hard-reset`, {
    method: "POST",
    credentials: "include",
    headers,
    body: JSON.stringify({}),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = typeof data?.message === "string" ? data.message : "Hard reset failed";
    throw new Error(msg);
  }
  return data as { ok: true; message: string };
}
