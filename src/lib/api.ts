// src/lib/api.ts

// Build /api/* path from a short path like "/me" or "me"
function apiPath(path: string) {
  const p = path.startsWith('/') ? path : `/${path}`;
  return `/api${p}`;
}

// ----- generic helpers (client-side) -----
export async function apiGet<T>(path: string): Promise<T> {
  const r = await fetch(apiPath(path), {
    credentials: 'include',
    cache: 'no-store',
    headers: { Accept: 'application/json' },
  });
  const text = await r.text();
  if (!r.ok) throw new Error(text || `HTTP ${r.status}`);
  try { return JSON.parse(text) as T; } catch { throw new Error(`Expected JSON: ${text.slice(0,200)}`); }
}

export async function apiPost<T>(path: string, body: unknown): Promise<T> {
  const r = await fetch(apiPath(path), {
    method: 'POST',
    credentials: 'include',
    cache: 'no-store',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  const text = await r.text();
  if (!r.ok) throw new Error(text || `HTTP ${r.status}`);
  try { return JSON.parse(text) as T; } catch { throw new Error(`Expected JSON: ${text.slice(0,200)}`); }
}

// ----- auth-specific helpers -----
export type MeUser = { id: string; firstName?: string; email?: string; role?: string };
export type MeResp = { ok: boolean; user: MeUser | null };

export async function apiLogin(email: string, password: string): Promise<{ ok: boolean; user?: MeUser; error?: string; }> {
  // ONLY /api/login — no fallbacks to /api/users/*
  const r = await fetch('/api/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ email, password }),
  });

  const text = await r.text();
  if (!r.ok) {
    // surface server error (e.g., Invalid credentials)
    let msg = text;
    try { msg = (JSON.parse(text).error as string) || msg; } catch {}
    throw new Error(msg || `HTTP ${r.status}`);
  }
  try { return JSON.parse(text); } catch { throw new Error(`Expected JSON: ${text.slice(0,200)}`); }
}

export async function apiMe(): Promise<MeResp> {
  const r = await fetch('/api/me', { credentials: 'include', cache: 'no-store', headers: { Accept: 'application/json' }});
  const text = await r.text();
  try { return JSON.parse(text) as MeResp; } catch { return { ok:false, user:null }; }
}

export async function apiLogout(): Promise<{ ok: boolean }> {
  const r = await fetch('/api/logout', { method: 'POST', credentials: 'include', headers: { Accept: 'application/json' }});
  const text = await r.text();
  try { return JSON.parse(text) as { ok: boolean }; } catch { return { ok:false }; }
}
