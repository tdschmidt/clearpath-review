export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}
export async function api<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(url, options);
  const body = await response.json().catch(() => ({}));
  if (!response.ok)
    throw new ApiError(
      body.error || "The request could not be saved. Please try again.",
      response.status,
    );
  return body;
}
export function json(data: unknown): RequestInit {
  return {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  };
}
export function multipart(
  payload: unknown,
  files: File[],
  key: string,
): RequestInit {
  const body = new FormData();
  body.append("payload", JSON.stringify(payload));
  files.forEach((file) => body.append("files", file));
  return { method: "POST", headers: { "Idempotency-Key": key }, body };
}
