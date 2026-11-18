import { env } from "../../../config/env";
import { httpAuthApi } from "./http";
import { createMockAuthApi } from "./mock";
import type { AuthApi } from "./types";

// Демо-сборка (VITE_DEMO=1) работает на заглушке; рабочая — на API (INF-7.2).
export const authApi: AuthApi = env.demo ? createMockAuthApi() : httpAuthApi;

export { AuthError } from "./types";
export type { AuthApi, AuthErrorCode, Cabinets, Contact, ContactType, Profile } from "./types";
