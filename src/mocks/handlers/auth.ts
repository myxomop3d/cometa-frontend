// Mock-режим авторизации: логин принимает любые учётные данные, /me
// возвращает профиль. Тела ответов «сырые» (без ApiResponse-конверта) —
// apiFetch возвращает body как есть для LoginResponse / UserProfile.
import { http, HttpResponse } from "msw";
import type { LoginRequest, LoginResponse, UserProfile } from "@/types/api";

const DEFAULT_SIGMA_LOGIN = "99000001";

// Логин, введённый в форму, чтобы /me мог вернуть тот же sigmaLogin
// (в футере сайдбара показывается именно он).
let lastSigmaLogin = DEFAULT_SIGMA_LOGIN;

export const authHandlers = [
  // Пароль-логин: принимаем что угодно, всегда выдаём токен.
  http.post("/api/v1/auth/login", async ({ request }) => {
    const body = (await request.json().catch(() => null)) as Partial<LoginRequest> | null;
    if (body?.sigmaLogin) {
      lastSigmaLogin = body.sigmaLogin;
    }
    const response: LoginResponse = { token: "mock-jwt-token" };
    return HttpResponse.json(response);
  }),

  // Профиль текущего пользователя.
  http.get("/api/v1/auth/me", () => {
    const profile: UserProfile = {
      sigmaLogin: lastSigmaLogin,
      authorities: ["ROLE_DEVELOPER"],
    };
    return HttpResponse.json(profile);
  }),
];
