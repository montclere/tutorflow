import { AuthError, type AuthApi, type AuthResult } from "./types";

const MOCK_WRONG_CODE = "000000";
const MOCK_REGISTERED_EMAIL_PREFIX = "registered@";

const RESEND_INTERVAL_MS = 60_000;
const CODE_TTL_MS = 10 * 60_000;
const MAX_ATTEMPTS = 5;
const LATENCY_MS = 400;

type PendingCode = { email: string; sentAt: number; attempts: number };

const respond = <T>(produce: () => T) =>
  new Promise<T>((resolve, reject) => {
    setTimeout(() => {
      try {
        resolve(produce());
      } catch (error) {
        reject(error);
      }
    }, LATENCY_MS);
  });

const signedIn = (name: string, isNew = true): AuthResult => ({ user: { id: "mock-user", name }, isNew });

export function createMockAuthApi(now: () => number = Date.now): AuthApi {
  let pending: PendingCode | null = null;

  return {
    startTelegramAuth: () => respond(() => signedIn("Анна")),
    startGoogleAuth: () => respond(() => signedIn("Анна Кузнецова")),

    requestEmailCode: (email) =>
      respond(() => {
        if (!email.includes("@")) throw new AuthError("invalidEmail");
        if (pending?.email === email && now() - pending.sentAt < RESEND_INTERVAL_MS) {
          throw new AuthError("tooManyRequests");
        }
        pending = { email, sentAt: now(), attempts: 0 };
      }),

    verifyEmailCode: (email, code) =>
      respond(() => {
        if (!pending || pending.email !== email || now() - pending.sentAt > CODE_TTL_MS) {
          throw new AuthError("codeExpired");
        }
        if (pending.attempts >= MAX_ATTEMPTS) throw new AuthError("attemptsExceeded");
        if (code === MOCK_WRONG_CODE) {
          pending.attempts += 1;
          throw new AuthError("invalidCode");
        }
        pending = null;
        return signedIn("", !email.startsWith(MOCK_REGISTERED_EMAIL_PREFIX));
      }),

    acceptConsent: () => respond(() => undefined),
    completeProfile: (profile) =>
      respond(() => {
        if (!profile.name.trim() || profile.subjects.length === 0) throw new AuthError("validation");
      }),
  };
}
