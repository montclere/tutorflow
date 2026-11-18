import { ApiError, clearApiContext, request } from "../../../shared/api/client";
import { AuthError, type AuthApi, type AuthErrorCode, type Contact } from "./types";

const loginContact = (contact: Contact) => ({ login_contact: { type: contact.type, value: contact.value } });
const entrypoint = (invitationToken?: string) => (invitationToken ? { entrypoint: "invitation", invitation_token: invitationToken } : { entrypoint: "teacher" });

/** Перевод ошибки API в код интерфейса: сервер отвечает стабильными code (docs/api/README.md). */
export function toAuthErrorCode(error: unknown): AuthErrorCode {
  if (!(error instanceof ApiError)) return "unknown";
  if (error.code === "challenge_invalid") return "invalidCode";
  if (error.code === "invalid_credentials") return "invalidCredentials";
  if (error.code === "authentication_required") return "unauthenticated";
  if (error.status === 429) return "tooManyRequests";
  if (error.status === 0 || error.status >= 500) return "unavailable";
  if (error.status === 422) {
    const fields = error.fields.map((item) => item.field);
    if (fields.some((field) => field.startsWith("login_contact"))) return "invalidContact";
    if (fields.includes("password")) return "weakPassword";
    return "validation";
  }
  return "unknown";
}

async function call<T>(operation: () => Promise<T>): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    throw new AuthError(toAuthErrorCode(error));
  }
}

type CabinetsView = { teacher_enabled: boolean; student_available: boolean; parent_available: boolean };

export const httpAuthApi: AuthApi = {
  // По ссылке-приглашению тот же токен нужен на обоих шагах; на пути репетитора он запрещён.
  startRegistration: (contact, invitationToken) =>
    call(
      async () =>
        (await request<{ challenge_id: string }>("/auth/registrations", "POST", { ...loginContact(contact), ...entrypoint(invitationToken) })).challenge_id,
    ),

  completeRegistration: ({ challengeId, code, password, displayName, timezone, invitationToken }) =>
    call(async () => {
      await request("/auth/registrations/complete", "POST", {
        challenge_id: challengeId,
        code,
        password,
        display_name: displayName,
        timezone,
        ...(invitationToken ? { invitation_token: invitationToken } : {}),
      });
    }),

  login: (contact, password) =>
    call(async () => {
      await request("/auth/login", "POST", { ...loginContact(contact), password });
    }),

  startPasswordReset: (contact) =>
    call(async () => (await request<{ challenge_id: string }>("/auth/password-resets", "POST", loginContact(contact))).challenge_id),

  completePasswordReset: ({ challengeId, code, password }) =>
    call(async () => {
      await request("/auth/password-resets/complete", "POST", { challenge_id: challengeId, code, password });
    }),

  cabinets: () =>
    call(async () => {
      const view = await request<CabinetsView>("/cabinets");
      return { teacherEnabled: view.teacher_enabled, studentAvailable: view.student_available, parentAvailable: view.parent_available };
    }),

  enableTeacherCabinet: () =>
    call(async () => {
      await request("/me/teacher-cabinet", "PUT");
    }),

  profile: () =>
    call(async () => {
      const view = await request<{ display_name: string; timezone: string; version: number }>("/me/profile");
      return { displayName: view.display_name, timezone: view.timezone, version: view.version };
    }),

  logout: () =>
    call(async () => {
      await request("/auth/session", "DELETE");
      clearApiContext();
    }),
};
