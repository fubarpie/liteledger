// Thin fetch wrapper for the LiteLedger server API. Cookies carry the session.

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

/** Fired when the server says the session is gone, so the app can drop back to the login screen. */
export const UNAUTHORIZED_EVENT = 'liteledger:unauthorized';

export async function api<T = any>(method: string, url: string, body?: unknown): Promise<T> {
  const res = await fetch(url, {
    method,
    credentials: 'same-origin',
    headers: body !== undefined ? { 'Content-Type': 'application/json' } : undefined,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let data: any = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    /* non-JSON error page */
  }
  if (!res.ok) {
    if (res.status === 401 && !url.startsWith('/api/auth/')) {
      window.dispatchEvent(new Event(UNAUTHORIZED_EVENT));
    }
    throw new ApiError(res.status, data?.error || `Request failed (${res.status})`);
  }
  return data as T;
}

export const apiGet = <T = any>(url: string) => api<T>('GET', url);
export const apiPost = <T = any>(url: string, body?: unknown) => api<T>('POST', url, body ?? {});
export const apiPatch = <T = any>(url: string, body: unknown) => api<T>('PATCH', url, body);
export const apiPut = <T = any>(url: string, body: unknown) => api<T>('PUT', url, body);
export const apiDelete = <T = any>(url: string) => api<T>('DELETE', url);

/** Client-generated ids let the UI update instantly while the server write happens in the background. */
export const newClientId = (prefix: string) => {
  const rand =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID().replace(/-/g, '').slice(0, 16)
      : Math.random().toString(36).slice(2, 18);
  return `${prefix}_${rand}`;
};
