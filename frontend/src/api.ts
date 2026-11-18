export class ApiError extends Error {
  constructor(readonly status: number, readonly code: string) {
    super(code)
  }
}

let csrf: string | undefined

export async function api<T>(path: string, method = "GET", body?: object): Promise<T> {
  if (method !== "GET" && !csrf) {
    csrf = (await api<{ csrf_token: string }>("/auth/csrf")).csrf_token
  }
  const headers = new Headers({ Accept: "application/json" })
  if (method !== "GET" && csrf) headers.set("X-CSRF-Token", csrf)
  if (body) headers.set("Content-Type", "application/json")
  const response = await fetch("/api/v1" + path, {
    method, headers, credentials: "same-origin", body: body ? JSON.stringify(body) : undefined,
  })
  if (response.status === 204) return undefined as T
  const json = await response.json()
  if (!response.ok) {
    if (response.status === 401 || json.code === "csrf_failed") csrf = undefined
    throw new ApiError(response.status, json.code ?? "request_failed")
  }
  if (json?.csrf_token) csrf = json.csrf_token
  return json as T
}

export function clearContext() {
  csrf = undefined
}

const messages: Record<string, string> = {
  authentication_required: "Войдите, чтобы продолжить.",
  invalid_credentials: "Не удалось войти. Проверьте контакт и пароль.",
  challenge_invalid: "Код неверный или истёк. Проверьте код или запросите новый.",
  csrf_failed: "Сессия изменилась. Повторите действие.",
  invitation_unavailable: "Приглашение недоступно. Попросите репетитора прислать новую ссылку.",
  invitation_already_accepted: "Приглашение уже принято.",
  student_card_already_linked: "У вас уже есть карточка у этого репетитора.",
  invitation_acceptance_conflict: "Эта ссылка уже была принята с другими данными.",
  delivery_unavailable: "Канал доставки недоступен. Попробуйте другой контакт.",
  validation_failed: "Проверьте формат и заполнение полей.",
  rate_limited: "Слишком много попыток. Попробуйте позже.",
  version_conflict: "Запись уже изменилась. Откройте её заново перед сохранением.",
  dependency_unavailable: "Сервис временно недоступен. Попробуйте позже.",
  resource_not_found: "Карточка недоступна.",
}

export function describeError(error: unknown) {
  return error instanceof ApiError
    ? messages[error.code] ?? "Не удалось выполнить запрос."
    : "Не удалось связаться с TutorFlow. Попробуйте ещё раз."
}
