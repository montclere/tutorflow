import { AuthError, type AuthApi, type AuthErrorCode, type AuthResult, type StudentsRange } from "../../auth/api";
import type { SignupMethod, Track } from "../../../shared/analytics/track";
import { emptyCode, isComplete, type CodeDigits } from "./codeInput";
import { subjectIds, type SubjectId } from "./profile";
import type { Timezone } from "./timezone";
import { hasErrors, isValidEmail, validateProfile, type ProfileErrors } from "./validation";

export const RESEND_DELAY_MS = 60_000;

export type Step = "method" | "email" | "code" | "profile" | "done";

type WizardState = {
  step: Step;
  busy: boolean;
  error: AuthErrorCode | null;
  consent: boolean;
  consentMissing: boolean;
  studentNoteOpen: boolean;
  email: string;
  code: CodeDigits;
  resendAvailableAt: number;
  codeResent: boolean;
  name: string;
  subjects: SubjectId[];
  studentsRange: StudentsRange | null;
  profileErrors: ProfileErrors;
};

type WizardDeps = {
  api: AuthApi;
  track: Track;
  consentVersion: string;
  timezone: Timezone | null;
  openCabinet: () => void;
  now?: () => number;
};

const initialState: WizardState = {
  step: "method",
  busy: false,
  error: null,
  consent: false,
  consentMissing: false,
  studentNoteOpen: false,
  email: "",
  code: emptyCode(),
  resendAvailableAt: 0,
  codeResent: false,
  name: "",
  subjects: [],
  studentsRange: null,
  profileErrors: {},
};

export const progressOf = (step: Step) => (step === "done" ? 3 : step === "profile" ? 2 : 1);

const errorCode = (error: unknown): AuthErrorCode => (error instanceof AuthError ? error.code : "unknown");

export function createSignupWizard({ api, track, consentVersion, timezone, openCabinet, now = Date.now }: WizardDeps) {
  let state = initialState;
  const listeners = new Set<() => void>();

  const update = (patch: Partial<WizardState>) => {
    state = { ...state, ...patch };
    listeners.forEach((listener) => listener());
  };

  const goTo = (step: Step, patch: Partial<WizardState> = {}) => update({ step, error: null, busy: false, ...patch });

  async function run<T>(operation: () => Promise<T>, onError?: () => void): Promise<T | undefined> {
    if (state.busy) return undefined;
    update({ busy: true, error: null });
    try {
      return await operation();
    } catch (error) {
      onError?.();
      update({ busy: false, error: errorCode(error) });
      return undefined;
    }
  }

  async function signIn(authenticate: () => Promise<AuthResult>, onError?: () => void) {
    const result = await run(async () => {
      const auth = await authenticate();
      await api.acceptConsent(consentVersion);
      return auth;
    }, onError);
    if (!result) return;
    if (!result.isNew) {
      update({ busy: false });
      openCabinet();
      return;
    }
    goTo("profile", { name: result.user.name });
  }

  async function sendCode() {
    const sent = await run(async () => {
      await api.requestEmailCode(state.email.trim());
      return true;
    });
    if (sent) track("signup_code_sent");
    return Boolean(sent);
  }

  return {
    getState: () => state,

    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },

    timezone,

    restart() {
      update({ ...initialState, consent: state.consent });
    },

    setConsent(consent: boolean) {
      update({ consent, consentMissing: consent ? false : state.consentMissing });
    },

    toggleStudentNote() {
      update({ studentNoteOpen: !state.studentNoteOpen });
    },

    /** Возвращает false, если вход не запущен из-за отсутствия согласия. */
    chooseMethod(method: SignupMethod): boolean {
      track("signup_method_click", { method });
      if (!state.consent) {
        track("signup_consent_missing");
        update({ consentMissing: true });
        return false;
      }
      if (method === "email") goTo("email");
      else void signIn(() => (method === "telegram" ? api.startTelegramAuth() : api.startGoogleAuth()));
      return true;
    },

    backToMethod() {
      goTo("method");
    },

    setEmail(email: string) {
      update({ email, error: null });
    },

    async submitEmail() {
      if (!isValidEmail(state.email)) {
        update({ error: "invalidEmail" });
        return;
      }
      if (await sendCode()) {
        goTo("code", { code: emptyCode(), codeResent: false, resendAvailableAt: now() + RESEND_DELAY_MS });
      }
    },

    backToEmail() {
      goTo("email");
    },

    changeCode(code: CodeDigits) {
      update({ code, error: isComplete(code) ? null : state.error });
      if (!isComplete(code)) return;
      void signIn(
        () => api.verifyEmailCode(state.email.trim(), code.join("")),
        () => {
          track("signup_code_error");
          update({ code: emptyCode() });
        },
      );
    },

    async resendCode() {
      if (now() < state.resendAvailableAt) return;
      if (await sendCode()) {
        update({ busy: false, code: emptyCode(), codeResent: true, resendAvailableAt: now() + RESEND_DELAY_MS });
      }
    },

    setName(name: string) {
      update({ name, profileErrors: { ...state.profileErrors, name: undefined } });
    },

    toggleSubject(subject: SubjectId) {
      const selected = state.subjects.includes(subject)
        ? state.subjects.filter((current) => current !== subject)
        : [...state.subjects, subject];
      update({
        subjects: subjectIds.filter((id) => selected.includes(id)),
        profileErrors: { ...state.profileErrors, subjects: undefined },
      });
    },

    selectStudentsRange(range: StudentsRange) {
      update({ studentsRange: range });
    },

    /** Возвращает ошибки проверки, чтобы разметка перевела фокус на первое неверное поле. */
    async submitProfile(): Promise<ProfileErrors> {
      const profileErrors = validateProfile(state);
      update({ profileErrors });
      if (hasErrors(profileErrors)) return profileErrors;

      track("signup_profile_submit", { subjectsCount: state.subjects.length, studentsRange: state.studentsRange });
      const saved = await run(async () => {
        await api.completeProfile({
          name: state.name.trim(),
          subjects: state.subjects,
          studentsRange: state.studentsRange,
          timezone: timezone?.id ?? "",
        });
        return true;
      });
      if (saved) {
        goTo("done");
        track("signup_complete");
      }
      return {};
    },
  };
}
