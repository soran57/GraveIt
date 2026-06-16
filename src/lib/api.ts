/**
 * Typed fetch wrapper with proper error handling.
 * All API calls should use this instead of raw fetch().
 */
export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public body?: unknown
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export async function apiFetch<T = unknown>(
  url: string,
  options?: RequestInit
): Promise<T> {
  let res: Response;
  try {
    res = await fetch(url, options);
  } catch (err) {
    throw new ApiError("Network error — could not reach the server.", 0);
  }

  if (!res.ok) {
    let body: unknown;
    try {
      body = await res.json();
    } catch {
      body = null;
    }
    const message =
      (body as any)?.error ||
      (body as any)?.message ||
      `Server error (HTTP ${res.status})`;
    throw new ApiError(message, res.status, body);
  }

  // Handle empty 204 No Content responses
  if (res.status === 204) return undefined as T;

  return res.json() as Promise<T>;
}
