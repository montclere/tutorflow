import { createMockAuthApi } from "./mock";
import type { AuthApi } from "./types";
import { unavailableAuthApi } from "./unavailable";

import { env } from "../../../config/env";

// Демо-сборка (VITE_DEMO=1) работает на заглушке; рабочая — на API.
export const authApi: AuthApi = env.demo ? createMockAuthApi() : unavailableAuthApi;

export { AuthError } from "./types";
export type { AuthApi, AuthErrorCode, AuthResult, ProfileInput, StudentsRange, User } from "./types";
