import { useEffect, useRef, useState, type FormEvent } from "react";

import { api, blockPageSize, message, type CalendarBlock } from "./api";

function displayZone(zone: string) {
  try {
    return new Intl.DateTimeFormat("ru", { timeZone: zone }).resolvedOptions().timeZone;
  } catch {
    return "UTC";
  }
}

function formatStart(block: CalendarBlock, zone: string) {
  return new Intl.DateTimeFormat("ru", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: zone,
  }).format(new Date(block.starts_at));
}

function localInput(block: CalendarBlock, zone: string) {
  const parts = new Intl.DateTimeFormat("sv-SE", {
    timeZone: displayZone(zone),
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  });
  return parts.format(new Date(block.starts_at)).replace(" ", "T");
}

export function CalendarPanel({ zone }: { zone: string | undefined }) {
  const [blocks, setBlocks] = useState<CalendarBlock[]>();
  const [editing, setEditing] = useState<CalendarBlock>();
  const [hasMore, setHasMore] = useState(false);
  const [pending, setPending] = useState(true);
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");
  const retry = useRef<{ body: string; requestId: string }>(null);

  useEffect(() => {
    let active = true;
    void api.blocks().then(
      (page) => {
        if (!active) return;
        setBlocks(page);
        setHasMore(page.length === blockPageSize);
        setPending(false);
      },
      (failure: unknown) => {
        if (!active) return;
        setError(message(failure));
        setPending(false);
      },
    );
    return () => {
      active = false;
    };
  }, []);

  async function update(operation: () => Promise<void>) {
    setPending(true);
    setError("");
    setStatus("");
    try {
      await operation();
    } catch (failure) {
      setError(message(failure));
    } finally {
      setPending(false);
    }
  }

  async function loadPage(after?: CalendarBlock) {
    const page = await api.blocks(after);
    setBlocks((current) => {
      if (!after || !current) return page;
      const known = new Set(current.map((block) => block.id));
      return [...current, ...page.filter((block) => !known.has(block.id))];
    });
    setHasMore(page.length === blockPageSize);
  }

  function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!zone) return;
    const form = event.currentTarget;
    const fields = new FormData(form);
    const start = String(fields.get("local_start"));
    const duration = Number(fields.get("duration"));

    void update(async () => {
      if (editing) {
        await api.replaceBlock(editing.id, start, duration);
      } else {
        const body = JSON.stringify([start, duration]);
        if (retry.current?.body !== body) retry.current = { body, requestId: crypto.randomUUID() };
        await api.addBlock(start, duration, retry.current.requestId);
      }
      const wasEditing = Boolean(editing);
      setEditing(undefined);
      form.reset();
      retry.current = null;
      setStatus(wasEditing ? "Личный блок сохранён." : "Личный блок добавлен.");
      await loadPage();
    });
  }

  function remove(block: CalendarBlock) {
    if (!window.confirm("Удалить личный блок?")) return;
    void update(async () => {
      await api.removeBlock(block.id);
      if (editing?.id === block.id) setEditing(undefined);
      setStatus("Личный блок удалён.");
      await loadPage();
    });
  }

  return (
    <section className="panel" aria-labelledby="calendar-title">
      <h3 id="calendar-title">Личные блоки календаря</h3>
      {error && <p role="alert">{error}</p>}
      {status && <p role="status">{status}</p>}
      {!blocks && pending && <p role="status">Загружаем блоки…</p>}
      {!blocks && !pending && (
        <button type="button" onClick={() => void update(() => loadPage())}>
          Загрузить блоки
        </button>
      )}
      {blocks && blocks.length > 0 && (
        <ul aria-label="Созданные блоки">
          {blocks.map((block) => {
            const shownZone = displayZone(block.timezone);
            return (
              <li key={block.id}>
                <time dateTime={block.starts_at}>{formatStart(block, shownZone)}</time>
                {" · "}
                {shownZone === "UTC" ? shownZone : block.timezone}
                {" · "}
                {block.duration_minutes} мин
                <div className="actions">
                  <button
                    type="button"
                    disabled={pending || !zone}
                    onClick={() => setEditing(block)}
                  >
                    Изменить блок
                  </button>
                  <button type="button" disabled={pending} onClick={() => remove(block)}>
                    Удалить блок
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
      {hasMore && blocks && (
        <button
          type="button"
          disabled={pending}
          onClick={() => void update(() => loadPage(blocks.at(-1)))}
        >
          Показать ещё
        </button>
      )}
      <form key={editing?.id ?? "new"} onSubmit={save}>
        <label>
          Дата и время
          <input
            name="local_start"
            type="datetime-local"
            required
            defaultValue={editing && zone ? localInput(editing, zone) : undefined}
            step={1}
          />
          <small>{zone ? `Часовой пояс профиля — ${zone}.` : "Ожидаем данные профиля."}</small>
        </label>
        <label>
          Длительность в минутах
          <input
            name="duration"
            type="number"
            min={5}
            max={480}
            defaultValue={editing?.duration_minutes ?? 60}
            required
          />
        </label>
        <button type="submit" disabled={pending || !zone}>
          {editing ? "Сохранить блок" : "Добавить личный блок"}
        </button>
        {editing && (
          <button type="button" disabled={pending} onClick={() => setEditing(undefined)}>
            Отменить изменение
          </button>
        )}
      </form>
    </section>
  );
}
