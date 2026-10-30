import { createContext, useContext, useEffect, useState } from 'react';
import * as auth from '../services/authService.js';
const Ctx = createContext(null);
export const useAuth = () => useContext(Ctx);
export function AuthProvider({ children }) {
  const [session, setSession] = useState(auth.getSession());
  useEffect(() => {
    let active = true;
    if (session?.token) auth.getMe().then(user => active && setSession({ token: session.token, user })).catch(() => { auth.logout(); active && setSession(null); });
    return () => { active = false; };
  }, []);
  const login = async (email, password) => { const d = await auth.login(email, password); setSession({ token: d.token, user: d.user }); };
  const logout = () => { auth.logout(); setSession(null); };
  return <Ctx.Provider value={{ user: session?.user, isAuthed: !!session?.token, login, logout }}>{children}</Ctx.Provider>;
}
