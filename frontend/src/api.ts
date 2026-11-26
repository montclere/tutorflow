export type Contact = { type: "email" | "phone"; value: string };
export type Account = { id: string; roles: ("teacher" | "student" | "adult")[] };
export type Profile = { display_name: string | null; timezone: string | null };
export type CalendarBlock = {
  id: string;
  starts_at: string;
  timezone: string;
  duration_minutes: number;
};

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    readonly requestId?: string,
  ) {
    super(code);
  }
}

const errors: Record<string, string> = {
  invalid_contact: "Проверьте адрес почты или номер в международном формате.",
  invalid_credentials: "Неверный контакт или пароль.",
  challenge_invalid: "Код неверен, истёк или уже использован.",
  rate_limited: "Слишком много попыток. Попробуйте позже.",
  invalid_local_start: "Выберите однозначное местное время в часовом поясе профиля.",
  calendar_block_conflict: "Запрос устарел. Откройте список и повторите действие.",
  calendar_block_not_found: "Блок больше недоступен.",
  authentication_required: "Сессия закончилась. Войдите снова.",
  role_not_enabled: "У этого аккаунта пока нет кабинета преподавателя.",
  identity_unavailable: "API аккаунтов пока недоступен.",
};

export function message(error: unknown) {
  if (error instanceof ApiError) {
    if (error.status >= 500) {
      return `Сервис временно недоступен.${error.requestId ? ` Код обращения — ${error.requestId}.` : ""}`;
    }
    return errors[error.code] ?? "Проверьте введённые данные.";
  }
  return "Не удалось связаться с сервером. Попробуйте ещё раз.";
}

async function request<T>(
  path: string,
  method = "GET",
  body?: object,
  csrfToken?: string,
): Promise<T> {
  const headers = new Headers();
  if (body) headers.set("content-type", "application/json");
  if (csrfToken) headers.set("x-csrf-token", csrfToken);
  const response = await fetch(`/api/v1${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!response.ok) {
    const payload: unknown = await response.json().catch(() => null);
    const problem =
      payload && typeof payload === "object" ? (payload as Record<string, unknown>) : {};
    const code =
      typeof problem.code === "string"
        ? problem.code
        : typeof problem.detail === "string"
          ? problem.detail
          : "";
    throw new ApiError(response.status, code, response.headers.get("x-request-id") ?? undefined);
  }
  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

async function protectedRequest<T>(path: string, method: string, body?: object) {
  const csrf = await request<{ csrf_token: string }>("/auth/csrf");
  return request<T>(path, method, body, csrf.csrf_token);
}

export const blockPageSize = 50;

function blockListPath(after?: CalendarBlock) {
  const query = new URLSearchParams({ limit: String(blockPageSize) });
  if (after) {
    query.set("after_start", after.starts_at);
    query.set("after_id", after.id);
  }
  return `/me/calendar-blocks?${query}`;
}

export const api = {
  me: () => request<Account>("/me?role=teacher"),
  register: (login_contact: Contact) =>
    request<{ challenge_id: string }>("/auth/registrations", "POST", { login_contact }),
  confirm: (challenge_id: string, code: string, password: string) =>
    request<{ account: Account }>("/auth/registrations/complete", "POST", {
      challenge_id,
      code,
      password,
    }),
  login: (login_contact: Contact, password: string) =>
    request<{ account: Account }>("/auth/login", "POST", {
      login_contact,
      password,
      role: "teacher",
    }),
  logout: () => protectedRequest<void>("/auth/session", "DELETE"),
  profile: () => request<Profile>("/me/profile"),
  updateProfile: (profile: Partial<Profile>) =>
    protectedRequest<Profile>("/me/profile", "PATCH", profile),
  blocks: (after?: CalendarBlock) => request<CalendarBlock[]>(blockListPath(after)),
  addBlock: (local_start: string, duration_minutes: number, request_id: string) =>
    protectedRequest<CalendarBlock>("/me/calendar-blocks", "POST", {
      local_start,
      duration_minutes,
      request_id,
    }),
  replaceBlock: (id: string, local_start: string, duration_minutes: number) =>
    protectedRequest<CalendarBlock>(`/me/calendar-blocks/${id}`, "PUT", {
      local_start,
      duration_minutes,
    }),
  removeBlock: (id: string) => protectedRequest<void>(`/me/calendar-blocks/${id}`, "DELETE"),
};
