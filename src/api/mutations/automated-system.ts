import type { ApiResponse, AutomatedSystemDto } from "@/types/api";

export async function updateAutomatedSystem(
  id: number,
  data: Partial<AutomatedSystemDto>,
): Promise<ApiResponse<AutomatedSystemDto>> {
  const response = await fetch(`/api/v1/automated-system/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!response.ok) {
    throw new Error(`Failed to update automated system: ${response.status}`);
  }
  return response.json();
}
