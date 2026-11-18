import { AuthError, type AuthApi, type AuthErrorCode, type ContactType } from "../../auth/api";
import type { Track } from "../../../shared/analytics/track";
import { emptyCode, isComplete, type CodeDigits } from "./codeInput";
import type { Timezone } from "./timezone";
import { hasErrors, isValidContact, toContact, validatePassword, validateProfile, type ProfileErrors } from "./validation";

export const RESEND_DELAY_MS = 60_000;

/** Регистрация, вход и восстановление пароля (docs/api/identity.md, SIGNUP-*). */
export type Mode = "register" | "login" | "reset";
export type Step = "contact" | "code" | "profile" | "done" | "login" | "resetContact" | "resetCode";

type WizardState = {
  mode: Mode;
  step: Step;
  busy: boolean;
  error: AuthErrorCode | null;
  notice: "passwordReset" | null;
  consent: boolean;
  consentMissing: boolean;
  studentNoteOpen: boolean;
  contactType: ContactType;
  contact: string;
  challengeId: string | null;
  code: CodeDigits;
  resendAvailableAt: number;
  codeResent: boolean;
  name: string;
  password: string;
  profileErrors: ProfileErrors;
};

type WizardDeps = {
  api: AuthApi;
  track: Track;
  timezone: Timezone | null;
  openCabinet: () => void;
  now?: () => number;
};

const firstStep: Record<Mode, Step> = { register: "contact", login: "login", reset: "resetContact" };

const initialState: WizardState = {
  mode: "register",
  step: "contact",
  busy: false,
  error: null,
  notice: null,
  consent: false,
  consentMissing: false,
  studentNoteOpen: false,
  contactType: "email",
  contact: "",
  challengeId: null,
  code: emptyCode(),
  resendAvailableAt: 0,
  codeResent: false,
  name: "",
  password: "",
  profileErrors: {},
};

/** Полоса прогресса — только у регистрации: 1 — контакт и код, 2 — профиль, 3 — готово. */
export function progressOf(step: Step): number | null {
  if (step === "contact" || step === "code") return 1;
  if (step === "profile") return 2;
  if (step === "done") return 3;
  return null;
}

const errorCode = (error: unknown): AuthErrorCode => (error instanceof AuthError ? error.code : "unknown");

export function createSignupWizard({ api, track, timezone, openCabinet, now = Date.now }: WizardDeps) {
  let state = initialState;
  const listeners = new Set<() => void>();

  const update = (patch: Partial<WizardState>) => {
    state = { ...state, ...patch };
    listeners.forEach((listener) => listener());
  };

  const goTo = (step: Step, patch: Partial<WizardState> = {}) => update({ step, error: null, busy: false, ...patch });

  async function run<T>(operation: () => Promise<T>): Promise<{ ok: true; value: T } | { ok: false; code: AuthErrorCode }> {
    if (state.busy) return { ok: false, code: "unknown" };
    update({ busy: true, error: null });
    try {
      const value = await operation();
      update({ busy: false });
      return { ok: true, value };
    } catch (error) {
      const code = errorCode(error);
      update({ busy: false, error: code });
      return { ok: false, code };
    }
  }

  const currentContact = () => toContact(state.contact, state.mode === "register" ? state.contactType : undefined);

  /** Запросить код регистрации или восстановления; сервер выдаёт новый challenge_id. */
  async function requestCode(): Promise<boolean> {
    const contact = currentContact();
    if (!isValidContact(contact)) {
      update({ error: "invalidContact" });
      return false;
    }
    const result = await run(() => (state.mode === "reset" ? api.startPasswordReset(contact) : api.startRegistration(contact)));
    if (!result.ok) return false;
    track("signup_code_sent");
    update({ challengeId: result.value, code: emptyCode(), resendAvailableAt: now() + RESEND_DELAY_MS });
    return true;
  }

  /** После входа: если кабинет репетитора уже включён — сразу в кабинет, иначе — шаг включения. */
  async function afterSignIn() {
    const cabinets = await run(() => api.cabinets());
    if (!cabinets.ok) return;
    if (cabinets.value.teacherEnabled) openCabinet();
    else goTo("done");
  }

  return {
    getState: () => state,

    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },

    timezone,

    restart(mode: Mode = "register") {
      update({ ...initialState, mode, step: firstStep[mode], consent: state.consent });
    },

    setMode(mode: Mode) {
      if (state.mode === mode) return;
      goTo(firstStep[mode], { mode, notice: null, password: "", code: emptyCode(), challengeId: null, profileErrors: {} });
    },

    setConsent(consent: boolean) {
      update({ consent, consentMissing: consent ? false : state.consentMissing });
    },

    toggleStudentNote() {
      update({ studentNoteOpen: !state.studentNoteOpen });
    },

    setContactType(contactType: ContactType) {
      update({ contactType, contact: "", error: null });
    },

    setContact(contact: string) {
      update({ contact, error: null });
    },

    /** Регистрация начинается только с согласием (SIGNUP-1). */
    async submitContact() {
      if (!state.consent) {
        track("signup_consent_missing");
        update({ consentMissing: true });
        return;
      }
      if (await requestCode()) goTo("code", { codeResent: false });
    },

    backToCode() {
      goTo("code", { code: emptyCode() });
    },

    backToContact() {
      goTo(firstStep[state.mode], { code: emptyCode() });
    },

    /** Код проверяет сервер вместе с паролем, поэтому полный код просто ведёт к профилю. */
    changeCode(code: CodeDigits) {
      update({ code, error: isComplete(code) ? null : state.error });
      if (state.mode === "register" && isComplete(code)) goTo("profile");
    },

    async resendCode() {
      if (now() < state.resendAvailableAt) return;
      if (await requestCode()) update({ codeResent: true });
    },

    setName(name: string) {
      update({ name, profileErrors: { ...state.profileErrors, name: undefined } });
    },

    setPassword(password: string) {
      update({ password, error: null, profileErrors: { ...state.profileErrors, password: undefined } });
    },

    /** Возвращает ошибки проверки, чтобы разметка перевела фокус на первое неверное поле. */
    async submitProfile(): Promise<ProfileErrors> {
      const profileErrors = validateProfile(state);
      update({ profileErrors });
      if (hasErrors(profileErrors) || !state.challengeId) return profileErrors;

      track("signup_profile_submit");
      const result = await run(() =>
        api.completeRegistration({
          challengeId: state.challengeId ?? "",
          code: state.code.join(""),
          password: state.password,
          displayName: state.name.trim(),
          timezone: timezone?.id || "UTC",
        }),
      );
      if (result.ok) {
        track("signup_complete");
        goTo("done", { password: "" });
      } else if (result.code === "invalidCode") {
        // Неверный или устаревший код выясняется только здесь — возвращаем к вводу кода.
        track("signup_code_error");
        goTo("code", { code: emptyCode(), error: "invalidCode" });
      }
      return {};
    },

    /** Кабинет репетитора включается явно (IDN-15), затем — переход в него. */
    async enterCabinet() {
      const result = await run(() => api.enableTeacherCabinet());
      if (result.ok) openCabinet();
    },

    async submitLogin() {
      const contact = currentContact();
      if (!isValidContact(contact)) {
        update({ error: "invalidContact" });
        return;
      }
      if (!state.password) {
        update({ error: "invalidCredentials" });
        return;
      }
      const result = await run(() => api.login(contact, state.password));
      if (result.ok) {
        update({ password: "", notice: null });
        await afterSignIn();
      }
    },

    startReset() {
      goTo("resetContact", { mode: "reset", notice: null, password: "", code: emptyCode(), challengeId: null });
    },

    async submitResetContact() {
      if (await requestCode()) goTo("resetCode", { codeResent: false });
    },

    async submitReset() {
      if (!isComplete(state.code)) {
        update({ error: "invalidCode" });
        return;
      }
      const password = validatePassword(state.password);
      if (password) {
        update({ profileErrors: { password } });
        return;
      }
      const result = await run(() =>
        api.completePasswordReset({ challengeId: state.challengeId ?? "", code: state.code.join(""), password: state.password }),
      );
      if (result.ok) goTo("login", { mode: "login", notice: "passwordReset", password: "", code: emptyCode(), challengeId: null });
      else if (result.code === "invalidCode") update({ code: emptyCode() });
    },
  };
}

export type SignupWizard = ReturnType<typeof createSignupWizard>;
