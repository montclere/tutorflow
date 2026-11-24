import { useEffect, useState, type FormEvent } from "react";

import { api, message, type Profile } from "./api";
import { CalendarPanel } from "./CalendarPanel";

const timezones = (Intl.supportedValuesOf?.("timeZone") ?? []).filter((zone) => zone !== "UTC");

export function Cabinet({ onSignedOut }: { onSignedOut: () => void }) {
  const [profile, setProfile] = useState<Profile>();
  const [editing, setEditing] = useState(false);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  useEffect(() => {
    let active = true;
    void api.profile().then(
      (current) => {
        if (!active) return;
        setProfile(current);
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
    if (!profile) return;
    const name = String(fields.get("name") ?? "").trim() || null;
    const timezone = String(fields.get("timezone") ?? "") || null;
    const change: Partial<Profile> = {};
    if (name !== profile.display_name) change.display_name = name;
    if (timezone !== profile.timezone) change.timezone = timezone;
    if (Object.keys(change).length === 0) {
      setEditing(false);
      return;
    }
    void update(async () => {
      setProfile(await api.updateProfile(change));
      setEditing(false);
    }, "Профиль сохранён.");
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
      <div className="grid gap-5 sm:grid-cols-2">
        {profile && (
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
        )}
        <CalendarPanel zone={profile ? (zone ?? "UTC") : undefined} />
      </div>
    </>
  );
}
