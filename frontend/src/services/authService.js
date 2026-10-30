import { api } from './api.js';
const K = 'auth_token', U = 'auth_user';
export const getSession = () => {
  try { const token = localStorage.getItem(K); return token ? { token, user: JSON.parse(localStorage.getItem(U) || 'null') } : null; }
  catch { return null; }
};
const save = data => { localStorage.setItem(K, data.token); localStorage.setItem(U, JSON.stringify(data.user)); return data; };
export const login = async (email, password) => save(await api('/auth/login', { method: 'POST', body: { email, password }, auth: false }));
export const register = (username, email, password) => api('/auth/register', { method: 'POST', body: { username, email, password }, auth: false });
export const getMe = async () => { const d = await api('/auth/me'); localStorage.setItem(U, JSON.stringify(d.user)); return d.user; };
export const logout = () => { localStorage.removeItem(K); localStorage.removeItem(U); };
export const forgotPassword = async () => { throw new Error('Password reset is not available in this demo.'); };
export const resetPassword = async () => { throw new Error('Password reset is not available in this demo.'); };
