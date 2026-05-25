import AsyncStorage from "@react-native-async-storage/async-storage";
import React, { createContext, useCallback, useContext, useEffect, useState } from "react";

const API_BASE = process.env["EXPO_PUBLIC_DOMAIN"]
  ? `https://${process.env["EXPO_PUBLIC_DOMAIN"]}/api`
  : "/api";

export interface AuthUser {
  id: string;
  username: string;
  email: string;
  phone: string | null;
  address: string | null;
  city: string | null;
  avatarBase64: string | null;
  isVerified: boolean;
  createdAt: string;
}

interface AuthContextType {
  user: AuthUser | null;
  token: string | null;
  isLoading: boolean;
  login: (username: string, password: string) => Promise<{ ok: boolean; error?: string; notVerified?: boolean; email?: string }>;
  register: (data: RegisterData) => Promise<{ ok: boolean; error?: string; devVerifyLink?: string; emailSent?: boolean }>;
  logout: (keepToken?: boolean) => Promise<void>;
  tryAutoLogin: () => Promise<{ ok: boolean }>;
  updateProfile: (data: Partial<ProfileUpdateData>) => Promise<{ ok: boolean; error?: string }>;
  refreshUser: () => Promise<void>;
}

export interface RegisterData {
  username: string;
  email: string;
  password: string;
  phone?: string;
  address?: string;
  city?: string;
  avatarBase64?: string;
}

export interface ProfileUpdateData {
  username: string;
  phone: string;
  address: string;
  city: string;
  avatarBase64: string;
}

const TOKEN_KEY = "@trampaj_token_v1";

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    AsyncStorage.getItem(TOKEN_KEY).then(async (stored) => {
      if (stored) {
        try {
          const res = await fetch(`${API_BASE}/auth/me`, {
            headers: { Authorization: `Bearer ${stored}` },
          });
          if (res.ok) {
            const data = await res.json() as { user: AuthUser };
            setToken(stored);
            setUser(data.user);
          } else if (res.status === 401) {
            // Token genuinely expired/invalid — remove it
            await AsyncStorage.removeItem(TOKEN_KEY);
          }
          // 5xx or other errors: keep token, user stays unauthenticated until retry
        } catch {
          // offline — keep token but clear user
        }
      }
      setIsLoading(false);
    });
  }, []);

  const login = useCallback(async (username: string, password: string) => {
    try {
      const res = await fetch(`${API_BASE}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      const data = await res.json() as { token?: string; user?: AuthUser; error?: string; notVerified?: boolean; email?: string };
      if (!res.ok) {
        return { ok: false, error: data.error, notVerified: data.notVerified, email: data.email };
      }
      await AsyncStorage.setItem(TOKEN_KEY, data.token!);
      setToken(data.token!);
      setUser(data.user!);
      return { ok: true };
    } catch {
      return { ok: false, error: "Nema veze s poslužiteljem" };
    }
  }, []);

  const register = useCallback(async (data: RegisterData) => {
    try {
      const res = await fetch(`${API_BASE}/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      const json = await res.json() as { error?: string; devVerifyLink?: string; emailSent?: boolean };
      if (!res.ok) return { ok: false, error: json.error };
      return { ok: true, devVerifyLink: json.devVerifyLink, emailSent: json.emailSent };
    } catch {
      return { ok: false, error: "Nema veze s poslužiteljem" };
    }
  }, []);

  const logout = useCallback(async (keepToken?: boolean) => {
    if (!keepToken) await AsyncStorage.removeItem(TOKEN_KEY);
    setToken(null);
    setUser(null);
  }, []);

  const tryAutoLogin = useCallback(async (): Promise<{ ok: boolean }> => {
    try {
      const stored = await AsyncStorage.getItem(TOKEN_KEY);
      if (!stored) return { ok: false };
      const res = await fetch(`${API_BASE}/auth/me`, {
        headers: { Authorization: `Bearer ${stored}` },
      });
      if (res.ok) {
        const data = await res.json() as { user: AuthUser };
        setToken(stored);
        setUser(data.user);
        return { ok: true };
      }
      return { ok: false };
    } catch {
      return { ok: false };
    }
  }, []);

  const updateProfile = useCallback(async (data: Partial<ProfileUpdateData>) => {
    if (!token) return { ok: false, error: "Nije prijavljen" };
    try {
      const res = await fetch(`${API_BASE}/auth/profile`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(data),
      });
      const json = await res.json() as { user?: AuthUser; error?: string };
      if (!res.ok) return { ok: false, error: json.error };
      setUser(json.user!);
      return { ok: true };
    } catch {
      return { ok: false, error: "Nema veze s poslužiteljem" };
    }
  }, [token]);

  const refreshUser = useCallback(async () => {
    if (!token) return;
    try {
      const res = await fetch(`${API_BASE}/auth/me`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json() as { user: AuthUser };
        setUser(data.user);
      }
    } catch {}
  }, [token]);

  return (
    <AuthContext.Provider value={{ user, token, isLoading, login, register, logout, tryAutoLogin, updateProfile, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
