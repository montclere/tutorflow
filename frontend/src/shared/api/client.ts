/**
 * Единственный клиент HTTP API (INF-7.2): cookie-сессия того же origin, CSRF для изменяющих запросов,
 * ошибки Problem Details (RFC 9457) по стабильному `code` — см. docs/api/README.md.
 */

export const API_BASE = "/api/v1";

const FALLBACK_SERVER = "Сервис временно недоступен. Попробуйте позже.";
const FALLBACK_REQUEST = "Не удалось выполнить запрос.";
const FALLBACK_NETWORK = "Не удалось связаться с TutorFlow. Попробуйте ещё раз.";
// Коды, после которых CSRF-контекст сервера недействителен и токен нужно получить заново.
const CONTEXT_RESET_CODES = new Set(["authentication_required", "csrf_failed"]);

export type FieldError = { field: string; code: string };

export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly fields: FieldError[];
  readonly retryAfter: number | null;

  constructor(status: number, code: string, message?: string, fields: FieldError[] = [], retryAfter: number | null = null) {
    super(message ?? (status >= 500 ? FALLBACK_SERVER : FALLBACK_REQUEST));
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.fields = fields;
    this.retryAfter = retryAfter;
  }
}

type Method = "GET" | "POST" | "PATCH" | "PUT" | "DELETE";

type Problem = { code?: unknown; status?: unknown; title?: unknown; detail?: unknown; errors?: unknown };

let csrfToken: string | undefined;

/** Сбросить CSRF-контекст — после выхода или смены сессии. */
export function clearApiContext(): void {
  csrfToken = undefined;
}

function isFieldError(value: unknown): value is FieldError {
  return typeof value === "object" && value !== null && typeof (value as FieldError).field === "string" && typeof (value as FieldError).code === "string";
}

async function toApiError(response: Response): Promise<ApiError> {
  const media = response.headers.get("Content-Type")?.split(";", 1)[0]?.trim();
  const retryHeader = response.headers.get("Retry-After");
  const retryAfter = retryHeader !== null && /^\d+$/.test(retryHeader) ? Number(retryHeader) : null;
  if (media === "application/problem+json") {
    const problem = (await response.json().catch(() => null)) as Problem | null;
    if (problem && typeof problem.code === "string" && problem.status === response.status) {
      if (CONTEXT_RESET_CODES.has(problem.code)) clearApiContext();
      const message = [problem.title, problem.detail].filter((part): part is string => typeof part === "string").join(". ");
      const fields = Array.isArray(problem.errors) ? problem.errors.filter(isFieldError) : [];
      return new ApiError(response.status, problem.code, message || undefined, fields, retryAfter);
    }
  }
  return new ApiError(response.status, "request_failed", undefined, [], retryAfter);
}

async function ensureCsrf(): Promise<string> {
  if (!csrfToken) csrfToken = (await request<{ csrf_token: string }>("/auth/csrf")).csrf_token;
  return csrfToken;
}

export type RequestOptions = { headers?: HeadersInit; signal?: AbortSignal };

/** Запрос к API. Тело — JSON; ответ 204 даёт undefined; ошибка — ApiError. */
export async function request<T>(path: string, method: Method = "GET", body?: object, options: RequestOptions = {}): Promise<T> {
  const headers = new Headers(options.headers);
  headers.set("Accept", "application/json, application/problem+json");
  if (method !== "GET") headers.set("X-CSRF-Token", await ensureCsrf());
  if (body) headers.set("Content-Type", "application/json");

  let response: Response;
  try {
    response = await fetch(API_BASE + path, {
      method,
      headers,
      credentials: "same-origin",
      body: body ? JSON.stringify(body) : undefined,
      signal: options.signal,
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") throw error;
    throw new ApiError(0, "network_failed", FALLBACK_NETWORK);
  }

  if (!response.ok) throw await toApiError(response);
  if (response.status === 204) return undefined as T;
  const json = (await response.json()) as T & { csrf_token?: unknown };
  // Вход и регистрация выдают новый CSRF-токен вместе с новой сессией.
  if (typeof json?.csrf_token === "string") csrfToken = json.csrf_token;
  return json;
}

/** Понятный текст ошибки для интерфейса. */
export function describeError(error: unknown): string {
  return error instanceof ApiError ? error.message : FALLBACK_NETWORK;
}

export type Page<T> = { items: T[]; next_cursor: string | null };

/** Все страницы списка по курсору (лимит страницы — 100, см. docs/api/README.md). */
export async function requestAll<T>(path: string, params: Record<string, string | undefined> = {}): Promise<T[]> {
  const items: T[] = [];
  let cursor: string | null = null;
  do {
    const query = new URLSearchParams({ limit: "100" });
    for (const [key, value] of Object.entries(params)) if (value !== undefined) query.set(key, value);
    if (cursor) query.set("cursor", cursor);
    const page: Page<T> = await request<Page<T>>(`${path}?${query.toString()}`);
    items.push(...page.items);
    cursor = page.next_cursor;
  } while (cursor);
  return items;
}
