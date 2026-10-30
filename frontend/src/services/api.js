// Single API client for the Cinevia Express backend.
export const BASE = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000/api').replace(/\/$/, '');
export const TOKEN_KEY = 'auth_token';
export const getToken = () => localStorage.getItem(TOKEN_KEY);

export async function api(path, { method = 'GET', body, auth = true } = {}) {
  const token = getToken();
  const headers = { Accept: 'application/json' };
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (auth && token) headers.Authorization = `Bearer ${token}`;
  let response;
  try {
    response = await fetch(`${BASE}${path}`, {
      method, headers, body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw Object.assign(new Error('Cannot reach the Cinevia server. Check that the backend is running.'), { status: 0 });
  }
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const err = data.error || data;
    throw Object.assign(new Error(err.message || data.message || `Request failed (${response.status})`), {
      status: response.status, code: err.code, details: err.details,
    });
  }
  return data;
}
