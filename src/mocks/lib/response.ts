import { HttpResponse } from "msw";
import type { ApiResponse, AppMessage } from "@/types/api";

const successMessage: AppMessage = {
  message: "Успешное выполнение",
  semantic: "S",
  description: null,
  target: null,
};

export function apiResponse<T>(data: T, count?: number) {
  const body: ApiResponse<T> = {
    count: count ?? (Array.isArray(data) ? data.length : 0),
    data,
    messages: [successMessage],
  };
  return HttpResponse.json(body, {
    headers: { "Content-Type": "application/vnd.hal+json" },
  });
}

export function apiError(message: string, status: number) {
  return HttpResponse.json(
    {
      count: 0,
      data: null,
      messages: [
        {
          message,
          semantic: "E" as const,
          description: null,
          target: null,
        },
      ],
    },
    {
      status,
      headers: { "Content-Type": "application/vnd.hal+json" },
    },
  );
}
