export type User = {
  id: string;
  name: string;
};

export type AuthResult = {
  user: User;
  isNew: boolean;
};

export type StudentsRange = "upTo5" | "from6To15" | "from16To30" | "over30";

export type ProfileInput = {
  name: string;
  subjects: string[];
  studentsRange: StudentsRange | null;
  timezone: string;
};

export type AuthErrorCode =
  | "cancelled"
  | "signatureInvalid"
  | "invalidEmail"
  | "tooManyRequests"
  | "invalidCode"
  | "codeExpired"
  | "attemptsExceeded"
  | "validation"
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

export interface AuthApi {
  startTelegramAuth(): Promise<AuthResult>;
  startGoogleAuth(): Promise<AuthResult>;
  requestEmailCode(email: string): Promise<void>;
  verifyEmailCode(email: string, code: string): Promise<AuthResult>;
  acceptConsent(version: string): Promise<void>;
  completeProfile(profile: ProfileInput): Promise<void>;
}
