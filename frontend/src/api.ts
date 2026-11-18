export class ApiError extends Error {
  constructor(readonly status: number, readonly code: string, message?: string) {
    super(message ?? (status >= 500 ? "Сервис временно недоступен. Попробуйте позже." : "Не удалось выполнить запрос."))
  }
}

let csrf: string | undefined

async function responseError(response: Response): Promise<ApiError> {
  const media = response.headers.get("Content-Type")?.split(";", 1)[0].trim()
  if (media === "application/problem+json") {
    const problem = await response.json().catch(() => null)
    if (problem && typeof problem.code === "string" && problem.status === response.status) {
      const message = problem.code === "resource_not_found"
        ? "Карточка недоступна."
        : [problem.title, problem.detail].filter((value) => typeof value === "string").join(". ")
      if (["authentication_required", "csrf_failed"].includes(problem.code)) csrf = undefined
      return new ApiError(response.status, problem.code, message || undefined)
    }
  }
  return new ApiError(response.status, "request_failed")
}

export async function api<T>(path: string, method = "GET", body?: object, additionalHeaders?: HeadersInit): Promise<T> {
  if (method !== "GET" && !csrf) {
    csrf = (await api<{ csrf_token: string }>("/auth/csrf")).csrf_token
  }
  const headers = new Headers(additionalHeaders)
  headers.set("Accept", "application/json, application/problem+json")
  if (method !== "GET" && csrf) headers.set("X-CSRF-Token", csrf)
  if (body) headers.set("Content-Type", "application/json")
  const response = await fetch("/api/v1" + path, {
    method, headers, credentials: "same-origin", body: body ? JSON.stringify(body) : undefined,
  })
  if (!response.ok) throw await responseError(response)
  if (response.status === 204) return undefined as T
  const json = await response.json()
  if (json?.csrf_token) csrf = json.csrf_token
  return json as T
}

export function clearContext() {
  csrf = undefined
}

export function describeError(error: unknown) {
  return error instanceof ApiError
    ? error.message
    : "Не удалось связаться с TutorFlow. Попробуйте ещё раз."
}
