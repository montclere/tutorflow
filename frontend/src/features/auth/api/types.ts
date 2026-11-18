export type ContactType = "email" | "phone";
export type Contact = { type: ContactType; value: string };

export type Profile = { displayName: string; timezone: string; version: number };

export type Cabinets = { teacherEnabled: boolean; studentAvailable: boolean; parentAvailable: boolean };

export type RegistrationInput = { challengeId: string; code: string; password: string; displayName: string; timezone: string };
export type PasswordResetInput = { challengeId: string; code: string; password: string };

export type AuthErrorCode =
  | "invalidContact"
  | "invalidCode"
  | "invalidCredentials"
  | "weakPassword"
  | "tooManyRequests"
  | "validation"
  | "unauthenticated"
  | "unavailable"
  | "unknown";

export class AuthError extends Error {
  readonly code: AuthErrorCode;

  constructor(code: AuthErrorCode, message: string = code) {
    super(message);
    this.name = "AuthError";
    this.code = code;
  }
}

/** Вход и регистрация по договору docs/api/identity.md. Методы возвращают challenge_id там, где сервер его выдаёт. */
export interface AuthApi {
  startRegistration(contact: Contact): Promise<string>;
  completeRegistration(input: RegistrationInput): Promise<void>;
  login(contact: Contact, password: string): Promise<void>;
  startPasswordReset(contact: Contact): Promise<string>;
  completePasswordReset(input: PasswordResetInput): Promise<void>;
  cabinets(): Promise<Cabinets>;
  enableTeacherCabinet(): Promise<void>;
  /** Профиль вошедшего; без сессии — AuthError("unauthenticated"). */
  profile(): Promise<Profile>;
  logout(): Promise<void>;
}
