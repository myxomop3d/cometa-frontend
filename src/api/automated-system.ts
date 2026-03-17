import type { ApiResponse, AutomatedSystemDto } from "@/types/api";

export async function fetchAutomatedSystems(): Promise<
  ApiResponse<AutomatedSystemDto[]>
> {
  const response = await fetch("/api/v1/automated-system");
  if (!response.ok) {
    throw new Error(`Failed to fetch automated systems: ${response.status}`);
  }
  return response.json();
}
