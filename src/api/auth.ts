// API-вызовы для аутентификации: логин и получение профиля
import { apiFetch } from "@/lib/api/create-crud-api";
import type {
  LoginRequest,
  LoginResponse,
  UserProfile,
  RegisterRequest,
  CheckSigmaLoginResponse,
  PersonByEmailResponse,
} from "@/types/api";

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

/** Саморегистрация: создаёт учётку + person (+ связь с командой), редирект на логин. */
export async function register(request: RegisterRequest): Promise<void> {
  await apiFetch<void>("/api/v1/auth/register", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(request),
  });
}

/** Проверка занятости sigmaLogin (on-blur). */
export async function checkSigmaLogin(
  sigmaLogin: string,
): Promise<CheckSigmaLoginResponse> {
  return apiFetch<CheckSigmaLoginResponse>(
    `/api/v1/auth/check-sigma-login?sigmaLogin=${encodeURIComponent(sigmaLogin)}`,
  );
}

/** Поиск person по email (on-blur): для автозаполнения ФИО и проверки наличия учётки. */
export async function personByEmail(
  email: string,
): Promise<PersonByEmailResponse> {
  return apiFetch<PersonByEmailResponse>(
    `/api/v1/auth/person-by-email?email=${encodeURIComponent(email)}`,
  );
}

export type {
  LoginRequest,
  LoginResponse,
  UserProfile,
  RegisterRequest,
  CheckSigmaLoginResponse,
  PersonByEmailResponse,
};
