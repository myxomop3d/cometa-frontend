// Контекст авторизации: хранение токена и профиля, методы login/logout, провайдер для всего приложения
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useNavigate } from "@tanstack/react-router";
import { login as loginApi, getMe, startCertLogin, type UserProfile, type LoginRequest } from "@/api/auth";

export interface AuthState {
  user: UserProfile | null;
  token: string | null;
  isLoading: boolean;
  isAuthenticated: boolean;
}

export interface AuthContextValue extends AuthState {
  login: (data: LoginRequest) => Promise<void>;
  logout: () => void;
  handleCertLogin: () => Promise<void>;
  completeCertLogin: (token: string) => Promise<void>;
}

const TOKEN_KEY = "cometa-auth-token";

const AuthContext = createContext<AuthContextValue | null>(null);

function storeToken(token: string | null) {
  if (token) {
    localStorage.setItem(TOKEN_KEY, token);
  } else {
    localStorage.removeItem(TOKEN_KEY);
  }
}

function getStoredToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const [token, setToken] = useState<string | null>(getStoredToken);
  const [user, setUser] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // On mount: if we have a stored token, validate it via GET /me
  useEffect(() => {
    const stored = getStoredToken();
    if (!stored) {
      setIsLoading(false);
      return;
    }
    // Temporarily set for apiFetch to pick up
    setToken(stored);
    getMe()
      .then((profile) => {
        setUser(profile);
      })
      .catch(() => {
        // Token invalid or expired — clear
        storeToken(null);
        setToken(null);
        setUser(null);
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, []);

  const login = useCallback(
    async (data: LoginRequest) => {
      const { token: newToken } = await loginApi(data);
      storeToken(newToken);
      setToken(newToken);
      const profile = await getMe();
      setUser(profile);
      navigate({ to: "/automated-system", replace: true });
    },
    [],
  );

  const logout = useCallback(() => {
    storeToken(null);
    setToken(null);
    setUser(null);
    navigate({ to: "/login", replace: true });
  }, []);

  const handleCertLogin = useCallback(() => {
    // Уходим со страницы на mTLS-шлюз; токен придёт на /auth/cert/callback.
    startCertLogin();
  }, []);

  const completeCertLogin = useCallback(
    async (newToken: string) => {
      storeToken(newToken);
      setToken(newToken);
      const profile = await getMe();
      setUser(profile);
      navigate({ to: "/automated-system", replace: true });
    },
    [navigate],
  );

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      token,
      isLoading,
      isAuthenticated: !!token && !!user,
      login,
      logout,
      handleCertLogin,
      completeCertLogin,
    }),
    [user, token, isLoading, login, logout, handleCertLogin, completeCertLogin],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return ctx;
}
