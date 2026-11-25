import { useEffect, useState, type FormEvent } from "react";

import { api, ApiError, message, type Account, type Contact } from "./api";
import { Cabinet } from "./Cabinet";

type Stage = "login" | "register" | "confirm";

function Entry({ onSignedIn }: { onSignedIn: (account: Account) => void }) {
  const [stage, setStage] = useState<Stage>("login");
  const [contactType, setContactType] = useState<Contact["type"]>("email");
  const [challenge, setChallenge] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  function changeStage(next: Stage) {
    setStage(next);
    setError("");
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const values = new FormData(event.currentTarget);
    const password = String(values.get("password") ?? "");
    const contact = { type: contactType, value: String(values.get("contact") ?? "") };
    setPending(true);
    setError("");
    try {
      if (stage === "register") {
        const result = await api.register(contact);
        setChallenge(result.challenge_id);
        setStage("confirm");
      } else {
        const result =
          stage === "login"
            ? await api.login(contact, password)
            : await api.confirm(challenge, String(values.get("code") ?? ""), password);
        onSignedIn(result.account);
      }
    } catch (failure) {
      setError(message(failure));
    } finally {
      setPending(false);
    }
  }

  return (
    <section className="panel max-w-lg" aria-labelledby="entry-title">
      <h2 id="entry-title">{stage === "login" ? "Вход" : "Регистрация преподавателя"}</h2>
      {stage === "confirm" && (
        <p>
          Введите код из сообщения и придумайте пароль. Если код не пришёл, запросите новый через 45
          секунд.
        </p>
      )}
      <form key={stage} onSubmit={(event) => void submit(event)}>
        {stage !== "confirm" && (
          <>
            <label>
              Способ входа
              <select
                value={contactType}
                onChange={(event) => setContactType(event.target.value as Contact["type"])}
              >
                <option value="email">Электронная почта</option>
                <option value="phone">Телефон</option>
              </select>
            </label>
            <label>
              {contactType === "email" ? "Электронная почта" : "Телефон"}
              <input
                key={contactType}
                name="contact"
                type={contactType === "email" ? "email" : "tel"}
                autoComplete={contactType === "email" ? "email" : "tel"}
                placeholder={contactType === "phone" ? "+79991234567" : undefined}
                required
              />
            </label>
          </>
        )}
        {stage === "confirm" && (
          <label>
            Код подтверждения
            <input
              name="code"
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern="[0-9]{8}"
              maxLength={8}
              required
            />
          </label>
        )}
        {stage !== "register" && (
          <label>
            Пароль
            <input
              name="password"
              type="password"
              autoComplete={stage === "login" ? "current-password" : "new-password"}
              minLength={stage === "confirm" ? 15 : undefined}
              maxLength={128}
              required
            />
            {stage === "confirm" && <small>Не менее 15 символов.</small>}
          </label>
        )}
        {error && <p role="alert">{error}</p>}
        <div className="actions">
          <button type="submit" disabled={pending}>
            {stage === "login" ? "Войти" : stage === "register" ? "Получить код" : "Подтвердить"}
          </button>
          <button
            type="button"
            className="secondary"
            disabled={pending}
            onClick={() => changeStage(stage === "register" ? "login" : "register")}
          >
            {stage === "login"
              ? "Создать аккаунт"
              : stage === "register"
                ? "Уже есть аккаунт"
                : "Запросить новый код"}
          </button>
        </div>
      </form>
    </section>
  );
}

export function App() {
  const [account, setAccount] = useState<Account | null | undefined>(undefined);
  const [startupError, setStartupError] = useState("");

  useEffect(() => {
    let active = true;
    void api.me().then(
      (value) => {
        if (active) setAccount(value);
      },
      (failure: unknown) => {
        if (!active) return;
        if (!(failure instanceof ApiError && failure.status === 401)) {
          setStartupError(message(failure));
        }
        setAccount(null);
      },
    );
    return () => {
      active = false;
    };
  }, []);

  return (
    <main className="mx-auto max-w-4xl px-5 py-12 sm:px-8">
      <header className="mb-8">
        <h1 className="text-4xl font-semibold tracking-tight">TutorFlow</h1>
      </header>
      {account === undefined && <p role="status">Проверяем сессию…</p>}
      {account === null && (
        <>
          {startupError && <p role="alert">{startupError}</p>}
          <Entry
            onSignedIn={(value) => {
              setStartupError("");
              setAccount(value);
            }}
          />
        </>
      )}
      {account && <Cabinet key={account.id} onSignedOut={() => setAccount(null)} />}
    </main>
  );
}
