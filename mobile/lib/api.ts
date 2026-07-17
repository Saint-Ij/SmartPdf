import { Platform } from "react-native";
import { getToken, removeToken } from "./storage";

const ENV_URL = process.env.EXPO_PUBLIC_API_URL;
const IS_WEB = Platform.OS === "web";

// Web runs in the browser — localhost works when API is on the same machine.
// Native (iOS/Android) needs the LAN IP from EXPO_PUBLIC_API_URL.
const BASE_URL = IS_WEB
  ? (ENV_URL?.includes("localhost") ? ENV_URL : "http://localhost:3000/api/v1")
  : (ENV_URL || "http://localhost:3000/api/v1");

console.log(`[API] Platform=${Platform.OS} BASE_URL=${BASE_URL}`);

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

function toCamel(s: string): string {
  return s.replace(/_([a-z])/g, (_, c) => c.toUpperCase());
}

function camelizeKeys<T>(obj: unknown): T {
  if (Array.isArray(obj)) return obj.map(camelizeKeys) as T;
  if (obj !== null && typeof obj === "object" && !(obj instanceof Date)) {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(obj)) {
      out[toCamel(k)] = camelizeKeys(v);
    }
    return out as T;
  }
  return obj as T;
}

let onUnauthorized: (() => void) | null = null;

export function setOnUnauthorized(handler: () => void) {
  onUnauthorized = handler;
}

const REQUEST_TIMEOUT = 30_000;
const UPLOAD_TIMEOUT = 180_000;

async function request<T>(path: string, options: RequestInit = {}, timeoutMs = REQUEST_TIMEOUT): Promise<T> {
  const token = await getToken();
  const headers: Record<string, string> = {
    ...(options.headers as Record<string, string>),
  };

  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const isFormData = options.body instanceof FormData;
  if (!isFormData) {
    headers["Content-Type"] = "application/json";
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  let res: Response;
  try {
    res = await fetch(`${BASE_URL}${path}`, { ...options, headers, signal: controller.signal });
  } catch (e) {
    const isTimeout = (e as Error)?.name === "AbortError";
    const reason = isTimeout ? "Request timed out" : `Network error: ${(e as Error)?.message || e}`;
    console.error(`[API] ${options.method || "GET"} ${path} failed:`, reason);
    throw new ApiError(0, isTimeout
      ? "Request timed out. Check your connection and try again."
      : `Network error. Check your connection and try again.`);
  } finally {
    clearTimeout(timer);
  }

  if (res.status === 401) {
    await removeToken();
    onUnauthorized?.();
    throw new ApiError(401, "Session expired. Please log in again.");
  }

  if (!res.ok) {
    let body: { error?: string } = {};
    try {
      body = await res.json();
    } catch {
      body = { error: res.statusText };
    }
    console.error(`[API] ${options.method || "GET"} ${path} failed: ${res.status} ${body.error || res.statusText}`);
    throw new ApiError(res.status, body.error || `Request failed (HTTP ${res.status})`);
  }

  const body: unknown = await res.json();
  return camelizeKeys<T>(body);
}

export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body?: unknown) =>
    request<T>(path, {
      method: "POST",
      body: body instanceof FormData ? body : JSON.stringify(body),
    }),
  patch: <T>(path: string, body: unknown) =>
    request<T>(path, {
      method: "PATCH",
      body: JSON.stringify(body),
    }),
  delete: <T>(path: string) => request<T>(path, { method: "DELETE" }),
  upload: <T>(path: string, formData: FormData) =>
    request<T>(path, {
      method: "POST",
      body: formData,
    }, UPLOAD_TIMEOUT),
};

export { BASE_URL };
