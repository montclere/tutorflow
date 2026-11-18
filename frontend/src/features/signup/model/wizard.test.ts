import { describe, expect, it, vi } from "vitest";
import { AuthError, type AuthApi } from "../../auth/api";
import { pasteCode } from "./codeInput";
import { createSignupWizard, progressOf, RESEND_DELAY_MS } from "./wizard";

const newTeacher = (name: string) => ({ user: { id: "u1", name }, isNew: true });

function setup(overrides: Partial<AuthApi> = {}) {
  const api: AuthApi = {
    startTelegramAuth: vi.fn(async () => newTeacher("Анна")),
    startGoogleAuth: vi.fn(async () => newTeacher("Анна Кузнецова")),
    requestEmailCode: vi.fn(async () => undefined),
    verifyEmailCode: vi.fn(async () => newTeacher("")),
    acceptConsent: vi.fn(async () => undefined),
    completeProfile: vi.fn(async () => undefined),
    ...overrides,
  };
  const track = vi.fn();
  const openCabinet = vi.fn();
  let time = 1_000_000;
  const wizard = createSignupWizard({
    api,
    track,
    openCabinet,
    consentVersion: "v1",
    timezone: { id: "Asia/Novosibirsk", label: "Новосибирск (UTC+7)" },
    now: () => time,
  });
  const advance = (ms: number) => {
    time += ms;
  };
  return { api, track, openCabinet, wizard, advance };
}

const enterCode = (wizard: ReturnType<typeof setup>["wizard"], code: string) => {
  const change = pasteCode(wizard.getState().code, code);
  if (change) wizard.changeCode(change.digits);
};

describe("отказ без согласия", () => {
  it.each(["telegram", "google", "email"] as const)("способ %s не запускает вход", (method) => {
    const { wizard, api, track } = setup();

    expect(wizard.chooseMethod(method)).toBe(false);

    const state = wizard.getState();
    expect(state.step).toBe("method");
    expect(state.consentMissing).toBe(true);
    expect(api.startTelegramAuth).not.toHaveBeenCalled();
    expect(api.startGoogleAuth).not.toHaveBeenCalled();
    expect(track).toHaveBeenCalledWith("signup_consent_missing");
  });

  it("ошибка исчезает, когда согласие отмечено", () => {
    const { wizard } = setup();
    wizard.chooseMethod("telegram");

    wizard.setConsent(true);

    expect(wizard.getState().consentMissing).toBe(false);
  });
});

describe("вход через Telegram и Google", () => {
  it("после входа сохраняет согласие и открывает шаг 2 с именем", async () => {
    const { wizard, api } = setup();
    wizard.setConsent(true);

    wizard.chooseMethod("google");
    await settled(wizard);

    expect(api.acceptConsent).toHaveBeenCalledWith("v1");
    expect(wizard.getState()).toMatchObject({ step: "profile", name: "Анна Кузнецова" });
    expect(progressOf(wizard.getState().step)).toBe(2);
  });

  it("зарегистрированного пользователя сразу ведёт в кабинет", async () => {
    const { wizard, openCabinet } = setup({
      startTelegramAuth: vi.fn(async () => ({ user: { id: "u1", name: "Анна" }, isNew: false })),
    });
    wizard.setConsent(true);

    wizard.chooseMethod("telegram");
    await settled(wizard);

    expect(openCabinet).toHaveBeenCalledOnce();
    expect(wizard.getState().step).toBe("method");
  });

  it("при отмене остаётся на шаге 1 с ошибкой и не сохраняет согласие", async () => {
    const { wizard, api } = setup({
      startTelegramAuth: vi.fn(async () => {
        throw new AuthError("cancelled");
      }),
    });
    wizard.setConsent(true);

    wizard.chooseMethod("telegram");
    await settled(wizard);

    expect(wizard.getState()).toMatchObject({ step: "method", error: "cancelled" });
    expect(api.acceptConsent).not.toHaveBeenCalled();
  });
});

describe("вход по почте", () => {
  it("неверный адрес не отправляет код", async () => {
    const { wizard, api } = setup();
    wizard.setConsent(true);
    wizard.chooseMethod("email");
    wizard.setEmail("anna@mail");

    await wizard.submitEmail();

    expect(wizard.getState()).toMatchObject({ step: "email", error: "invalidEmail" });
    expect(api.requestEmailCode).not.toHaveBeenCalled();
  });

  it("почта → код → шаг 2; код уходит автоматически после шести цифр", async () => {
    const { wizard, api, track } = setup();
    wizard.setConsent(true);
    wizard.chooseMethod("email");
    wizard.setEmail(" anna@mail.ru ");

    await wizard.submitEmail();
    expect(api.requestEmailCode).toHaveBeenCalledWith("anna@mail.ru");
    expect(track).toHaveBeenCalledWith("signup_code_sent");
    expect(wizard.getState().step).toBe("code");

    enterCode(wizard, "12345");
    expect(api.verifyEmailCode).not.toHaveBeenCalled();

    enterCode(wizard, "123456");
    await settled(wizard);

    expect(api.verifyEmailCode).toHaveBeenCalledWith("anna@mail.ru", "123456");
    expect(api.acceptConsent).toHaveBeenCalledWith("v1");
    expect(wizard.getState().step).toBe("profile");
  });

  it("неверный код показывает ошибку и очищает поля", async () => {
    const { wizard, track } = setup({
      verifyEmailCode: vi.fn(async () => {
        throw new AuthError("invalidCode");
      }),
    });
    wizard.setConsent(true);
    wizard.chooseMethod("email");
    wizard.setEmail("anna@mail.ru");
    await wizard.submitEmail();

    enterCode(wizard, "000000");
    await settled(wizard);

    expect(wizard.getState()).toMatchObject({ step: "code", error: "invalidCode", code: ["", "", "", "", "", ""] });
    expect(track).toHaveBeenCalledWith("signup_code_error");
  });

  it("повторная отправка доступна только через 60 секунд", async () => {
    const { wizard, api, advance } = setup();
    wizard.setConsent(true);
    wizard.chooseMethod("email");
    wizard.setEmail("anna@mail.ru");
    await wizard.submitEmail();

    advance(RESEND_DELAY_MS - 1);
    await wizard.resendCode();
    expect(api.requestEmailCode).toHaveBeenCalledTimes(1);

    advance(1);
    await wizard.resendCode();
    expect(api.requestEmailCode).toHaveBeenCalledTimes(2);
    expect(wizard.getState().codeResent).toBe(true);
  });

  it("«Изменить почту» возвращает на ввод почты", async () => {
    const { wizard } = setup();
    wizard.setConsent(true);
    wizard.chooseMethod("email");
    wizard.setEmail("anna@mail.ru");
    await wizard.submitEmail();

    wizard.backToEmail();

    expect(wizard.getState()).toMatchObject({ step: "email", email: "anna@mail.ru" });
  });
});

describe("шаг «О себе»", () => {
  async function atProfile(overrides: Partial<AuthApi> = {}) {
    const context = setup(overrides);
    context.wizard.setConsent(true);
    context.wizard.chooseMethod("telegram");
    await settled(context.wizard);
    return context;
  }

  it("без имени и предмета не отправляет профиль", async () => {
    const { wizard, api } = await atProfile();
    wizard.setName(" ");

    const errors = await wizard.submitProfile();

    expect(errors).toEqual({ name: "nameRequired", subjects: "subjectsRequired" });
    expect(wizard.getState().step).toBe("profile");
    expect(api.completeProfile).not.toHaveBeenCalled();
  });

  it("предметы — множественный выбор, количество учеников — одиночный", async () => {
    const { wizard } = await atProfile();

    wizard.toggleSubject("physics");
    wizard.toggleSubject("math");
    wizard.toggleSubject("english");
    wizard.toggleSubject("english");
    wizard.selectStudentsRange("upTo5");
    wizard.selectStudentsRange("from16To30");

    expect(wizard.getState()).toMatchObject({ subjects: ["math", "physics"], studentsRange: "from16To30" });
  });

  it("сохраняет профиль и показывает шаг 3", async () => {
    const { wizard, api, track } = await atProfile();
    wizard.setName(" Анна Кузнецова ");
    wizard.toggleSubject("english");

    await wizard.submitProfile();

    expect(api.completeProfile).toHaveBeenCalledWith({
      name: "Анна Кузнецова",
      subjects: ["english"],
      studentsRange: null,
      timezone: "Asia/Novosibirsk",
    });
    expect(track).toHaveBeenCalledWith("signup_profile_submit", { subjectsCount: 1, studentsRange: null });
    expect(track).toHaveBeenCalledWith("signup_complete");
    expect(wizard.getState().step).toBe("done");
    expect(progressOf("done")).toBe(3);
  });
});

describe("кнопка «Войти»", () => {
  it("возвращает мастер на шаг 1", async () => {
    const { wizard } = setup();
    wizard.setConsent(true);
    wizard.chooseMethod("email");

    wizard.restart();

    expect(wizard.getState().step).toBe("method");
  });
});

function settled(wizard: ReturnType<typeof setup>["wizard"]) {
  return vi.waitFor(() => expect(wizard.getState().busy).toBe(false));
}
