import { useEffect, useState, type FormEvent } from "react";

import { api, message, type CalendarBlock, type Profile } from "./api";

const timezones = Intl.supportedValuesOf("timeZone").filter((zone) => zone !== "UTC");

export function Cabinet({ onSignedOut }: { onSignedOut: () => void }) {
  const [profile, setProfile] = useState<Profile>();
  const [blocks, setBlocks] = useState<CalendarBlock[]>([]);
  const [editing, setEditing] = useState(false);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  useEffect(() => {
    let active = true;
    void Promise.all([api.profile(), api.blocks()]).then(
      ([current, calendar]) => {
        if (!active) return;
        setProfile(current);
        setBlocks(calendar);
      },
      (failure: unknown) => {
        if (active) setError(message(failure));
      },
    );
    return () => {
      active = false;
    };
  }, []);

  async function update(operation: () => Promise<void>, success = "") {
    setPending(true);
    setStatus("");
    setError("");
    try {
      await operation();
      setStatus(success);
    } catch (failure) {
      setError(message(failure));
    } finally {
      setPending(false);
    }
  }

  function saveProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const fields = new FormData(event.currentTarget);
    void update(async () => {
      setProfile(
        await api.updateProfile({
          display_name: String(fields.get("name") ?? "").trim() || null,
          timezone: String(fields.get("timezone") ?? "") || null,
        }),
      );
      setEditing(false);
    }, "Профиль сохранён.");
  }

  function createBlock(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const values = new FormData(form);
    void update(async () => {
      const block = await api.addBlock(
        String(values.get("local_start")),
        Number(values.get("duration")),
      );
      setBlocks((current) =>
        [...current, block].sort((a, b) => a.starts_at.localeCompare(b.starts_at)),
      );
      form.reset();
    }, "Личный блок добавлен.");
  }

  const zone = profile?.timezone;
  return (
    <>
      <div className="actions mb-6 justify-between">
        <h2>Кабинет преподавателя</h2>
        <button
          className="secondary"
          type="button"
          disabled={pending}
          onClick={() =>
            void update(async () => {
              await api.logout();
              onSignedOut();
            })
          }
        >
          Выйти
        </button>
      </div>
      {error && <p role="alert">{error}</p>}
      {status && <p role="status">{status}</p>}
      {!profile && !error && <p role="status">Загружаем кабинет…</p>}
      {profile && (
        <div className="grid gap-5 sm:grid-cols-2">
          <section className="panel" aria-labelledby="profile-title">
            <h3 id="profile-title">Профиль</h3>
            {profile.display_name && <p>{profile.display_name}</p>}
            {!editing ? (
              <button type="button" onClick={() => setEditing(true)} disabled={pending}>
                Настроить профиль
              </button>
            ) : (
              <form onSubmit={saveProfile}>
                <label>
                  Отображаемое имя
                  <input name="name" maxLength={120} defaultValue={profile.display_name ?? ""} />
                </label>
                <label>
                  Часовой пояс
                  <select name="timezone" defaultValue={zone ?? ""}>
                    <option value="">UTC по умолчанию</option>
                    <option value="UTC">UTC</option>
                    {zone && zone !== "UTC" && !timezones.includes(zone) && <option>{zone}</option>}
                    {timezones.map((value) => (
                      <option key={value}>{value}</option>
                    ))}
                  </select>
                </label>
                <div className="actions">
                  <button type="submit" disabled={pending}>
                    Сохранить профиль
                  </button>
                  <button
                    className="secondary"
                    type="button"
                    disabled={pending}
                    onClick={() => setEditing(false)}
                  >
                    Отмена
                  </button>
                </div>
              </form>
            )}
          </section>
          <section className="panel" aria-labelledby="calendar-title">
            <h3 id="calendar-title">Личные блоки календаря</h3>
            {blocks.length > 0 && (
              <ul aria-label="Созданные блоки">
                {blocks.map((block) => (
                  <li key={block.id}>
                    <time dateTime={block.starts_at}>
                      {new Intl.DateTimeFormat("ru", {
                        dateStyle: "short",
                        timeStyle: "short",
                        timeZone: block.timezone,
                      }).format(new Date(block.starts_at))}
                    </time>
                    {" · "}
                    {block.timezone}
                    {" · "}
                    {block.duration_minutes} мин
                  </li>
                ))}
              </ul>
            )}
            <form onSubmit={createBlock}>
              <label>
                Дата и время
                <input name="local_start" type="datetime-local" required />
                <small>Часовой пояс для нового блока — {zone ?? "UTC"}.</small>
              </label>
              <label>
                Длительность в минутах
                <input name="duration" type="number" min={5} max={480} defaultValue={60} required />
              </label>
              <button type="submit" disabled={pending}>
                Добавить личный блок
              </button>
            </form>
          </section>
        </div>
      )}
    </>
  );
}
