// API-вызовы для аутентификации: логин и получение профиля
import { apiFetch } from "@/lib/api/create-crud-api";
import type { LoginRequest, LoginResponse, UserProfile } from "@/types/api";

export async function login(request: LoginRequest): Promise<LoginResponse> {
  return apiFetch<LoginResponse>("/api/v1/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(request),
  });
}

export async function getMe(): Promise<UserProfile> {
  return apiFetch<UserProfile>("/api/v1/auth/me");
}

/** Вход по клиентскому TLS-сертификату (mTLS). Тело запроса пустое, сертификат
 *  передаётся на уровне TLS-соединения. Заголовок x-forwarded-client-cert
 *  формируется nginx-прокси. */
export async function certLogin(): Promise<LoginResponse> {
  return apiFetch<LoginResponse>("/api/v1/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({}),
  });
}

export type { LoginRequest, LoginResponse, UserProfile };
