import { describe, expect, it, vi } from "vitest";
import { AuthError, type AuthApi } from "../../auth/api";
import { createSignupWizard, progressOf, RESEND_DELAY_MS } from "./wizard";

const digits = (value: string) => value.split("");
const PASSWORD = "тестовая фраза для входа";

function setup(overrides: Partial<AuthApi> = {}, invitation?: { token?: string; onSignedIn: () => void }) {
  const api: AuthApi = {
    startRegistration: vi.fn(async () => "ch-1"),
    completeRegistration: vi.fn(async () => undefined),
    login: vi.fn(async () => undefined),
    startPasswordReset: vi.fn(async () => "ch-r"),
    completePasswordReset: vi.fn(async () => undefined),
    cabinets: vi.fn(async () => ({ teacherEnabled: true, studentAvailable: false, parentAvailable: false })),
    enableTeacherCabinet: vi.fn(async () => undefined),
    profile: vi.fn(async () => ({ displayName: "Анна", timezone: "UTC", version: 1 })),
    logout: vi.fn(async () => undefined),
    ...overrides,
  };
  const track = vi.fn();
  const openCabinet = vi.fn();
  let time = 1_000_000;
  const wizard = createSignupWizard({ api, track, timezone: { id: "Asia/Novosibirsk", label: "Новосибирск" }, openCabinet, now: () => time, invitation });
  return { api, track, openCabinet, wizard, advance: (ms: number) => (time += ms) };
}

async function toProfile(wizard: ReturnType<typeof setup>["wizard"]) {
  wizard.setConsent(true);
  wizard.setContact("anna@mail.ru");
  await wizard.submitContact();
  wizard.changeCode(digits("12345678"));
}

describe("регистрация", () => {
  it("без согласия код не запрашивается (SIGNUP-1)", async () => {
    const { wizard, api, track } = setup();
    wizard.setContact("anna@mail.ru");
    await wizard.submitContact();
    expect(api.startRegistration).not.toHaveBeenCalled();
    expect(wizard.getState().consentMissing).toBe(true);
    expect(track).toHaveBeenCalledWith("signup_consent_missing");
  });

  it("неверный контакт не отправляется", async () => {
    const { wizard, api } = setup();
    wizard.setConsent(true);
    wizard.setContactType("phone");
    wizard.setContact("89991234567");
    await wizard.submitContact();
    expect(api.startRegistration).not.toHaveBeenCalled();
    expect(wizard.getState().error).toBe("invalidContact");
  });

  it("телефон приводится к международному виду", async () => {
    const { wizard, api } = setup();
    wizard.setConsent(true);
    wizard.setContactType("phone");
    wizard.setContact("+7 (999) 123-45-67");
    await wizard.submitContact();
    expect(api.startRegistration).toHaveBeenCalledWith({ type: "phone", value: "+79991234567" }, undefined);
    expect(wizard.getState().step).toBe("code");
  });

  it("полный код ведёт к профилю, профиль отправляется одним запросом с кодом", async () => {
    const { wizard, api, track } = setup();
    await toProfile(wizard);
    expect(wizard.getState().step).toBe("profile");
    expect(progressOf("profile")).toBe(2);
    wizard.setName(" Анна ");
    wizard.setPassword(PASSWORD);
    await wizard.submitProfile();
    expect(api.completeRegistration).toHaveBeenCalledWith({ challengeId: "ch-1", code: "12345678", password: PASSWORD, displayName: "Анна", timezone: "Asia/Novosibirsk" });
    expect(wizard.getState().step).toBe("done");
    expect(wizard.getState().password).toBe("");
    expect(track).toHaveBeenCalledWith("signup_complete");
  });

  it("с профиля можно вернуться к вводу кода", async () => {
    const { wizard } = setup();
    await toProfile(wizard);
    wizard.backToCode();
    expect(wizard.getState().step).toBe("code");
    expect(wizard.getState().code.join("")).toBe("");
  });

  it("профиль требует имя и пароль от 15 символов", async () => {
    const { wizard, api } = setup();
    await toProfile(wizard);
    wizard.setPassword("коротко");
    const errors = await wizard.submitProfile();
    expect(errors).toEqual({ name: "nameRequired", password: "passwordLength" });
    expect(api.completeRegistration).not.toHaveBeenCalled();
  });

  it("неверный код выясняется при отправке профиля и возвращает к вводу кода", async () => {
    const { wizard } = setup({ completeRegistration: vi.fn(async () => Promise.reject(new AuthError("invalidCode"))) });
    await toProfile(wizard);
    wizard.setName("Анна");
    wizard.setPassword(PASSWORD);
    await wizard.submitProfile();
    expect(wizard.getState()).toMatchObject({ step: "code", error: "invalidCode" });
    expect(wizard.getState().code.join("")).toBe("");
  });

  it("код можно запросить повторно только через минуту (SIGNUP-5)", async () => {
    const { wizard, api, advance } = setup();
    wizard.setConsent(true);
    wizard.setContact("anna@mail.ru");
    await wizard.submitContact();
    await wizard.resendCode();
    expect(api.startRegistration).toHaveBeenCalledTimes(1);
    advance(RESEND_DELAY_MS);
    await wizard.resendCode();
    expect(api.startRegistration).toHaveBeenCalledTimes(2);
    expect(wizard.getState().codeResent).toBe(true);
  });

  it("кабинет включается явно и только потом открывается", async () => {
    const { wizard, api, openCabinet } = setup();
    await wizard.enterCabinet();
    expect(api.enableTeacherCabinet).toHaveBeenCalled();
    expect(openCabinet).toHaveBeenCalledWith("teacher");
  });
});

describe("вход", () => {
  it("с включённым кабинетом сразу открывает кабинет", async () => {
    const { wizard, api, openCabinet } = setup();
    wizard.restart("login");
    wizard.setContact(" anna@mail.ru ");
    wizard.setPassword(PASSWORD);
    await wizard.submitLogin();
    expect(api.login).toHaveBeenCalledWith({ type: "email", value: "anna@mail.ru" }, PASSWORD);
    expect(openCabinet).toHaveBeenCalledWith("teacher");
  });

  it("ученик без кабинета репетитора попадает в кабинет ученика", async () => {
    const { wizard, openCabinet } = setup({ cabinets: vi.fn(async () => ({ teacherEnabled: false, studentAvailable: true, parentAvailable: false })) });
    wizard.restart("login");
    wizard.setContact("anna@mail.ru");
    wizard.setPassword(PASSWORD);
    await wizard.submitLogin();
    expect(openCabinet).toHaveBeenCalledWith("student");
  });

  it("без кабинетов предлагает включить кабинет репетитора", async () => {
    const { wizard, openCabinet } = setup({ cabinets: vi.fn(async () => ({ teacherEnabled: false, studentAvailable: false, parentAvailable: false })) });
    wizard.restart("login");
    wizard.setContact("+79991234567");
    wizard.setPassword(PASSWORD);
    await wizard.submitLogin();
    expect(openCabinet).not.toHaveBeenCalled();
    expect(wizard.getState().step).toBe("done");
  });

  it("неверный пароль показывает ошибку и оставляет на шаге входа", async () => {
    const { wizard } = setup({ login: vi.fn(async () => Promise.reject(new AuthError("invalidCredentials"))) });
    wizard.restart("login");
    wizard.setContact("anna@mail.ru");
    wizard.setPassword("что-то");
    await wizard.submitLogin();
    expect(wizard.getState()).toMatchObject({ step: "login", error: "invalidCredentials" });
  });
});

describe("восстановление пароля", () => {
  it("код и новый пароль возвращают на вход с сообщением", async () => {
    const { wizard, api } = setup();
    wizard.restart("login");
    wizard.startReset();
    wizard.setContact("anna@mail.ru");
    await wizard.submitResetContact();
    expect(wizard.getState().step).toBe("resetCode");
    wizard.changeCode(digits("87654321"));
    expect(wizard.getState().step).toBe("resetCode");
    wizard.setPassword(PASSWORD);
    await wizard.submitReset();
    expect(api.completePasswordReset).toHaveBeenCalledWith({ challengeId: "ch-r", code: "87654321", password: PASSWORD });
    expect(wizard.getState()).toMatchObject({ mode: "login", step: "login", notice: "passwordReset", password: "" });
  });

  it("без полного кода и с коротким паролем не отправляется", async () => {
    const { wizard, api } = setup();
    wizard.startReset();
    wizard.setContact("anna@mail.ru");
    await wizard.submitResetContact();
    await wizard.submitReset();
    expect(wizard.getState().error).toBe("invalidCode");
    wizard.changeCode(digits("87654321"));
    wizard.setPassword("коротко");
    await wizard.submitReset();
    expect(wizard.getState().profileErrors.password).toBe("passwordLength");
    expect(api.completePasswordReset).not.toHaveBeenCalled();
  });
});

describe("по приглашению", () => {
  it("регистрация передаёт токен на обоих шагах и возвращает к принятию ссылки", async () => {
    const onSignedIn = vi.fn();
    const { wizard, api, openCabinet } = setup({}, { token: "tok", onSignedIn });
    expect(wizard.invitation).toBe(true);
    await toProfile(wizard);
    expect(api.startRegistration).toHaveBeenCalledWith({ type: "email", value: "anna@mail.ru" }, "tok");
    wizard.setName("Илья");
    wizard.setPassword(PASSWORD);
    await wizard.submitProfile();
    expect(api.completeRegistration).toHaveBeenCalledWith(expect.objectContaining({ invitationToken: "tok" }));
    expect(onSignedIn).toHaveBeenCalled();
    expect(openCabinet).not.toHaveBeenCalled();
  });

  it("вход не выбирает кабинет, а возвращает к принятию ссылки", async () => {
    const onSignedIn = vi.fn();
    const { wizard, api } = setup({}, { onSignedIn });
    wizard.restart("login");
    wizard.setContact("anna@mail.ru");
    wizard.setPassword(PASSWORD);
    await wizard.submitLogin();
    expect(onSignedIn).toHaveBeenCalled();
    expect(api.cabinets).not.toHaveBeenCalled();
  });
});
