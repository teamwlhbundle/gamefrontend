# Admin Auth: HTTP-Only Cookie Migration Plan

**Goal:** Replace JWT-in-localStorage with HTTP-only secure cookies. Token must never be exposed to client JS.

---

## Current State (Summary)

| Component | Current behaviour |
|-----------|-------------------|
| **lib/auth.ts** | `getAdminToken` / `setAdminToken` / `clearAdminToken` use `localStorage` key `adminToken`. |
| **lib/api.ts** | `login()` returns token from `/api/auth/login`; caller stores it. `verifyAdminSession(token)` calls `/api/admin/me` with `Authorization: Bearer <token>`. |
| **lib/admin-auth-context.tsx** | On mount: reads token via `getAdminToken()`, calls `verifyAdminSession(token)`, then sets `isAuthenticated`. `logout` only clears token and state. `setAuthenticated(token)` stores token and sets state. |
| **app/admin/login/page.tsx** | Calls `login()`, then `setAdminToken(token)` + `setAuthenticated(token)`, then redirects. |
| **AdminRouteGuard** | Uses `isAuthenticated` / `isLoading` from context; redirects unauthenticated to `/admin/login`, authenticated on login page to `/admin/dashboard`. |
| **Backend** | External API (`NEXT_PUBLIC_API_URL`). Login returns token in JSON. No cookie or logout endpoint assumed. |

---

## Backend Changes (Required)

Backend is external; these must be implemented on the API server.

### 1. Login (`POST /api/auth/login`)

- On successful auth:
  - **Set an HTTP-only, Secure cookie** containing the JWT (e.g. name: `adminSession` or `adminToken`).
  - **Recommended cookie options:** `HttpOnly`, `Secure`, `SameSite=Strict` (or `Lax` if cross-site redirects are needed), `Path=/` (or scoped to `/api` if preferred).
  - Optionally **do not return the token in the response body** (so no token ever reaches client JS). If you must keep body for backward compatibility during rollout, frontend will ignore it.
- Response: e.g. `{ "success": true }` or minimal user info. No token in body for new flow.

### 2. Session verification (`GET /api/admin/me`)

- **Read the session only from the cookie** (no `Authorization` header).
- If cookie is missing or invalid/expired: return 401.
- If valid: return 200 and optionally minimal user payload (e.g. `{ "id", "email" }`).
- Ensure CORS allows `credentials: true` and the request origin is in `Access-Control-Allow-Origin` (no `*` when using credentials).

### 3. Logout (`POST /api/auth/logout` or `GET`)

- New endpoint that:
  - Clears the session cookie (e.g. set same cookie name with `Max-Age=0` or `Expires` in the past).
  - Returns 200.
- Frontend will call this so that logout is server-side and cookie is removed.

---

## Frontend Changes

### 1. Remove localStorage token usage

- **lib/auth.ts**
  - Remove or repurpose:
    - `getAdminToken()` – no longer needed (client never has token).
    - `setAdminToken()` – remove; not used in cookie flow.
    - `clearAdminToken()` – remove; logout will call backend and cookie is cleared server-side.
  - Either delete the file or keep only a stub (e.g. `isAdminLoggedIn()` removed, as “logged in” is derived from `/api/admin/me` only).
- **lib/admin-auth-context.tsx**
  - Remove all imports and usages of `getAdminToken`, `setAdminToken`, `clearAdminToken`.
  - Remove `setAuthenticated(token: string)`. Replace with `setAuthenticated()` (no args) when login succeeds (cookie already set by backend).
  - `logout`: call new API `logout()` (see below) then set `isAuthenticated = false`; do not touch localStorage.
- **app/admin/login/page.tsx**
  - After successful `login()`: do not read or store any token. Call `setAuthenticated()` (no args) and redirect to `/admin/dashboard`. Remove `setAdminToken(token)`.

### 2. Login flow (frontend)

- **lib/api.ts – `login()`**
  - Use `credentials: 'include'` so the response can set cookies.
  - Do not read or return token from response body (or ignore it if backend still sends it).
  - On success (e.g. 200 and optionally body), return void or a simple success flag; caller only needs “success”.
- **app/admin/login/page.tsx**
  - `const success = await login(email, password);` (or await and check no throw).
  - Then `setAuthenticated()` and `router.replace("/admin/dashboard")`. No token in client.

### 3. Admin fetch wrapper / verification

- **lib/api.ts**
  - **verifyAdminSession:** change to `verifyAdminSession()` with **no token argument**.
    - Call `GET /api/admin/me` with `credentials: 'include'` and **no `Authorization` header**.
    - Return `res.ok` (cookie is sent automatically).
  - Any other admin API helpers (if added later) must use `credentials: 'include'` and must **not** set `Authorization` from client.

### 4. `/api/admin/me` usage

- No frontend code change for the route itself (backend owns it). Frontend only changes how it calls:
  - Always use `credentials: 'include'`.
  - Never send `Authorization` header; backend verifies cookie only.

### 5. Logout and cookie clearing

- **Backend:** Implement logout endpoint that clears the session cookie (see above).
- **Frontend – lib/api.ts**
  - Add `logout(): Promise<void>` that calls `POST /api/auth/logout` (or GET) with `credentials: 'include'` so the cookie is sent and server can clear it.
- **Frontend – lib/admin-auth-context.tsx**
  - In `logout` callback: call `logout()` from api, then `setAuthenticated(false)`. No localStorage.

### 6. Route protection (unchanged)

- **AdminAuthProvider** and **AdminRouteGuard** stay; only their data source changes:
  - **AdminAuthProvider:** On mount, call `verifyAdminSession()` (no token). If 200 → `isAuthenticated = true`, else false. No token read from storage. Expose `logout` (which calls API then sets state) and `setAuthenticated()` (no args) for login success.
  - **AdminRouteGuard:** Keep same logic: use `isAuthenticated` and `isLoading`; redirect unauthenticated to `/admin/login`, authenticated away from login to `/admin/dashboard`. No changes to redirect rules.

### 7. No token exposure

- No JWT in localStorage, sessionStorage, or any client-accessible storage.
- No JWT in response body consumed by frontend (or explicitly ignored).
- No `Authorization` header set from frontend; cookie only.

### 8. No refresh token

- Single HTTP-only cookie with access token only; no refresh flow. Session ends when cookie expires or user logs out.

---

## File-by-File Checklist

| File | Action |
|------|--------|
| **Backend** | Set cookie on login; verify cookie in `/api/admin/me`; add logout endpoint that clears cookie; CORS with credentials support. |
| **lib/auth.ts** | Remove token get/set/clear; delete or minimal stub. |
| **lib/api.ts** | Login: `credentials: 'include'`, don’t return token. `verifyAdminSession()`: no token, `credentials: 'include'`, no Authorization. Add `logout()` calling backend with `credentials: 'include'`. |
| **lib/admin-auth-context.tsx** | No token in state; check auth via `verifyAdminSession()`; `setAuthenticated()` no args; `logout` calls api `logout()` then set state. |
| **app/admin/login/page.tsx** | Call `login()` then `setAuthenticated()` and redirect; remove `setAdminToken` and any token handling. |
| **app/admin/AdminRouteGuard.tsx** | No change. |
| **app/admin/layout.tsx** | No change. |

---

## Testing Checklist

- [ ] Login: cookie set by backend, no token in JS, redirect to dashboard.
- [ ] Reload dashboard: `verifyAdminSession()` succeeds via cookie, no localStorage.
- [ ] Logout: backend clears cookie, frontend state cleared; next request to `/api/admin/me` returns 401.
- [ ] Direct visit to `/admin/dashboard` without cookie: redirect to `/admin/login`.
- [ ] No `Authorization` header and no token in any client code path.
- [ ] CORS and cookie domain/path correct for your host (e.g. same-site or configured domain).

---

## Rollout Order

1. Backend: implement cookie on login, cookie verification on `/api/admin/me`, and logout endpoint.
2. Frontend: remove localStorage usage and switch to cookie-based auth and logout API as above.
3. Deploy backend first, then frontend, so cookie is always set and verified before dropping token from client.

---

*Document version: 1.0 — Migration plan only; no refresh token.*
