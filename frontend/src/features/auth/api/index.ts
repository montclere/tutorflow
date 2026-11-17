import { createMockAuthApi } from "./mock";
import type { AuthApi } from "./types";
import { unavailableAuthApi } from "./unavailable";

// Условие написано прямо через import.meta.env: сборщик подставляет PROD=true
// и выбрасывает заглушку из продакшен-бандла целиком.
const useMock = !import.meta.env.PROD && import.meta.env.VITE_AUTH_MOCK === "1";

export const authApi: AuthApi = useMock ? createMockAuthApi() : unavailableAuthApi;

export { AuthError } from "./types";
export type { AuthApi, AuthErrorCode, AuthResult, ProfileInput, StudentsRange, User } from "./types";
