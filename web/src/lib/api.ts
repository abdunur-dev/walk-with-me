// Same origin in production (the API serves this site). In `next dev`, set NEXT_PUBLIC_API_BASE=http://localhost:8000
// and start the API with CORS_DEV_ORIGIN=http://localhost:3000.
export const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? "";

export type ApiErrorBody = { error?: { code?: string; message?: string; fix?: string } };

export class ApiError extends Error {
  constructor(public status: number, public code: string, message: string, public fix: string) {
    super(message);
  }
}

export async function api<T = unknown>(path: string, opts: { method?: string; body?: unknown; token?: string | null } = {}): Promise<T> {
  const headers: Record<string, string> = {};
  if (opts.body !== undefined) headers["Content-Type"] = "application/json";
  if (opts.token) headers["Authorization"] = `Bearer ${opts.token}`;
  let res: Response;
  try {
    res = await fetch(API_BASE + path, {
      method: opts.method ?? (opts.body !== undefined ? "POST" : "GET"),
      headers,
      body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
    });
  } catch {
    throw new ApiError(0, "network", "No internet, or the server cannot be reached.", "Check your connection and try again.");
  }
  if (!res.ok) {
    let b: ApiErrorBody = {};
    try { b = await res.json(); } catch { /* not JSON */ }
    throw new ApiError(res.status, b.error?.code ?? "http_error", b.error?.message ?? `The server answered ${res.status}.`,
      b.error?.fix ?? "Try again in a minute.");
  }
  const type = res.headers.get("content-type") ?? "";
  return (type.includes("application/json") ? res.json() : res.text()) as Promise<T>;
}

export function wsUrl(path: string): string {
  const base = API_BASE || (typeof window !== "undefined" ? window.location.origin : "");
  return base.replace(/^http/, "ws") + path;
}

// Site paths (basePath is /site). Links inside Next use <Link href="/jobs">; these are for plain anchors and the widget.
export const SAVANNA_DEMO = "/savanna/pages/concept-with-navigation.html";
