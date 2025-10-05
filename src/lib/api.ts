// src/lib/api.ts

// Client-side: go through Next's /api proxy (includes cookies automatically)
export async function apiGet<T>(path: string): Promise<T> {
  const r = await fetch(`/api${path}`, {
    credentials: 'include',
    cache: 'no-store',
    headers: { Accept: 'application/json' },
  });
  if (!r.ok) throw new Error(await r.text());
  return r.json() as Promise<T>;
}
export async function apiPost<T>(path: string, body: unknown): Promise<T> {
  const r = await fetch(`/api${path}`, {
    method: 'POST',
    credentials: 'include',
    cache: 'no-store',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  if (!r.ok) throw new Error(await r.text());
  return r.json() as Promise<T>;
}

export async function serverApiGet<T>(path: string): Promise<T> {
  const base = process.env.API_BASE_URL || process.env.NEXT_PUBLIC_API_BASE_URL;
  if (!base) throw new Error('API base URL missing. Set NEXT_PUBLIC_API_BASE_URL in .env.local');
  const r = await fetch(`${base}${path}`, {
    cache: 'no-store',
    headers: { Accept: 'application/json' },
  });
  if (!r.ok) throw new Error(await r.text());
  return r.json() as Promise<T>;
}
// Add this (replace your apiLogin)
// A loose shape many backends return; adjust if your server has a stricter schema
export type LoginResponse = {
  user?: {
    _id?: string;
    email?: string;
    firstName?: string;
    lastName?: string;
  };
} | Record<string, unknown>;
// src/lib/api.ts
export async function apiLogin(
  email: string,
  password: string
): Promise<Record<string, unknown>> {
  // Try /api/login first, then fallback to /api/users/login
  let r = await fetch(`/api/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ email, password }),
  });

  if (r.status === 404) {
    r = await fetch(`/api/users/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ email, password }),
    });
  }

  if (!r.ok) throw new Error(`${r.status} ${await r.text()}`);
  return r.json().catch(() => ({}));
}
// src/lib/api.ts
export type Me = { email?: string; _id?: string; firstName?: string; lastName?: string } | null;

export async function apiMe(): Promise<Me> {
  // Try common paths; adjust to your backend
  let r = await fetch('/api/me', { credentials: 'include' });
  if (r.status === 404) r = await fetch('/api/users/me', { credentials: 'include' });
  if (!r.ok) return null;
  return r.json().catch(() => null);
}
