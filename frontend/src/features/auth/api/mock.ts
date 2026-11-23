import { AuthError, type AuthApi, type Cabinets } from "./types";

// Демо-сборка (VITE_DEMO=1): поведение повторяет договор API, но без сервера.
const MOCK_WRONG_CODE = "00000000";
const MOCK_WRONG_PASSWORD = "неверный пароль";
const MIN_PASSWORD = 15;
const LATENCY_MS = 400;

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

export function createMockAuthApi(): AuthApi {
  let challenge = 0;
  let cabinets: Cabinets = { teacherEnabled: false, studentAvailable: false, parentAvailable: false };

  const checkCode = (code: string) => {
    if (code === MOCK_WRONG_CODE) throw new AuthError("invalidCode");
  };
  const checkPassword = (password: string) => {
    if (password.length < MIN_PASSWORD) throw new AuthError("weakPassword");
  };

  return {
    startRegistration: () => respond(() => `mock-${++challenge}`),
    completeRegistration: ({ code, password }) =>
      respond(() => {
        checkCode(code);
        checkPassword(password);
      }),
    login: (_contact, password) =>
      respond(() => {
        if (password === MOCK_WRONG_PASSWORD) throw new AuthError("invalidCredentials");
        // Демо: вошедший пользователь уже включал кабинет репетитора.
        cabinets = { ...cabinets, teacherEnabled: true };
      }),
    startPasswordReset: () => respond(() => `mock-${++challenge}`),
    completePasswordReset: ({ code, password }) =>
      respond(() => {
        checkCode(code);
        checkPassword(password);
      }),
    cabinets: () => respond(() => cabinets),
    enableTeacherCabinet: () =>
      respond(() => {
        cabinets = { ...cabinets, teacherEnabled: true };
      }),
    profile: () => respond(() => ({ displayName: "Анна Кузнецова", timezone: "Asia/Novosibirsk", version: 1 })),
    logout: () => respond(() => undefined),
  };
}
