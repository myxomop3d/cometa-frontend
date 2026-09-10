// API-вызовы для аутентификации: логин и получение профиля
import { apiFetch } from "@/lib/api/create-crud-api";
import { deriveMtlsOrigin } from "@/lib/auth/mtls-origin";
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

/**
 * Начать вход по сертификату: полная навигация браузера на mTLS-шлюз. Браузер
 * запросит клиентский сертификат, бэкенд проверит его и вернёт 302 на
 * /auth/cert/callback с токеном во фрагменте URL.
 */
export function startCertLogin(): void {
  const override = (window as unknown as { __ENV__?: { MTLS_ORIGIN?: string } })
    .__ENV__?.MTLS_ORIGIN;
  const origin = deriveMtlsOrigin(
    window.location.protocol,
    window.location.host,
    override,
  );
  window.location.href = `${origin}/api/v1/auth/cert/start`;
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
