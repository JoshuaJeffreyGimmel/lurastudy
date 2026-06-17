import React, { createContext, useCallback, useContext, useEffect, useState } from "react";
import { login as apiLogin, register as apiRegister, getMe } from "../api/client.js";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    try {
      const stored = localStorage.getItem("lurastudy_user");
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  });
  const [loading, setLoading] = useState(true);

  // On mount, verify the stored token is still valid
  useEffect(() => {
    const token = localStorage.getItem("lurastudy_token");
    if (!token) {
      setLoading(false);
      return;
    }
    getMe()
      .then((me) => {
        setUser(me);
        localStorage.setItem("lurastudy_user", JSON.stringify(me));
      })
      .catch(() => {
        // Token invalid — clear everything
        localStorage.removeItem("lurastudy_token");
        localStorage.removeItem("lurastudy_user");
        setUser(null);
      })
      .finally(() => setLoading(false));
  }, []);

  const login = useCallback(async (username, password) => {
    const { access_token } = await apiLogin(username, password);
    localStorage.setItem("lurastudy_token", access_token);
    const me = await getMe();
    localStorage.setItem("lurastudy_user", JSON.stringify(me));
    setUser(me);
    return me;
  }, []);

  const register = useCallback(async (username, password, email, inviteToken) => {
    const me = await apiRegister(username, password, email, inviteToken);
    // After registration, log in automatically
    const { access_token } = await apiLogin(username, password);
    localStorage.setItem("lurastudy_token", access_token);
    localStorage.setItem("lurastudy_user", JSON.stringify(me));
    setUser(me);
    return me;
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem("lurastudy_token");
    localStorage.removeItem("lurastudy_user");
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, register }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within an AuthProvider");
  return ctx;
}
