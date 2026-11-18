import { AuthError, type AuthApi } from "./types";

// Серверной части регистрации ещё нет (см. docs/frontend-api.md), поэтому
// рабочая сборка честно сообщает о недоступности, а не имитирует успех.
const reject = () => Promise.reject(new AuthError("unavailable"));

export const unavailableAuthApi: AuthApi = {
  startTelegramAuth: reject,
  startGoogleAuth: reject,
  requestEmailCode: reject,
  verifyEmailCode: reject,
  acceptConsent: reject,
  completeProfile: reject,
};
