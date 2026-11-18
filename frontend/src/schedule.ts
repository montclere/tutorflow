import { api } from "./api.js"

export type ScheduleRole = "teacher" | "student" | "parent"
type Page<T> = { items: T[]; next_cursor: string | null }
type Card = { student_card_id: string; student_card_name: string; student_account_id?: string | null }
type Lesson = {
  lesson_id: string; student_card_id: string; title: string; description: string | null; preparation: string | null
  private_note?: string | null; starts_at: string; ends_at: string; duration_minutes: number; version: number
  status: "scheduled" | "completed" | "no_show" | "cancelled"; outcome_reason: string | null
  series_id?: string | null; is_series_exception?: boolean; uses_series_content?: boolean; series_position?: number
}
type Content = { title: string; description: string | null; preparation: string | null; private_note: string | null }
type Series = { series_id: string; timezone: string; version: number; lessons: Lesson[]; content_template: Content }
type Proposal = {
  request_id: string; requester_role: ScheduleRole; reason: string | null; status: string; version: number
  occurrences: { lesson_id: string; starts_at: string; ends_at: string; proposed_starts_at: string; proposed_ends_at: string }[]
  can_resolve: boolean; can_withdraw: boolean
}
type Absence = {
  notice_id: string; requester_role: ScheduleRole; reason: string | null; status: string; version: number; can_withdraw: boolean
}
type Activity = {
  event: string; occurred_at: string; actor_role: string | null; changed_fields?: string[]
  before?: { starts_at?: string }; after?: { starts_at?: string }; reason?: string | null
}
type Notification = {
  notification_id: string; student_card_id: string; event: string; occurred_at: string; lesson_id: string | null
  read: boolean; actionable: boolean
}
type Plan = { occurrences: { local_start: string; starts_at: string; conflicts: boolean }[]; preserved_lesson_ids: string[] }

const labels: Record<string, string> = {
  teacher: "Преподаватель", student: "Ученик", parent: "Родитель",
  scheduled: "Запланирован", completed: "Проведён", no_show: "Пропущен", cancelled: "Отменён",
  pending: "Ожидает ответа", accepted: "Согласован", declined: "Отклонён", withdrawn: "Отозван",
  expired: "Без ответа", superseded: "Закрыт", open: "Получено", closed: "Закрыто",
  lesson_scheduled: "Назначен урок", lesson_recorded: "Записан проведённый урок", lesson_edited: "Обновлено содержание",
  lesson_attendance: "Отмечена посещаемость", lesson_attendance_reset: "Снята отметка посещаемости",
  lesson_cancelled: "Урок отменён", lesson_restored: "Урок восстановлен", lesson_deleted: "Урок удалён",
  lesson_rescheduled: "Урок перенесён", series_scheduled: "Назначена серия", series_cancelled: "Будущие уроки серии отменены",
  reschedule_proposed: "Предложен перенос", reschedule_accepted: "Перенос принят", reschedule_declined: "Перенос отклонён",
  reschedule_withdrawn: "Предложение отозвано", reschedule_expired: "Перенос остался без ответа",
  absence_reported: "Предупреждение о неявке", absence_withdrawn: "Предупреждение отозвано",
  title: "название", description: "описание", preparation: "подготовка", private_note: "закрытая заметка",
}

function esc(value: unknown) {
  return String(value ?? "").replace(/[&<>"']/g, (char) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]!)
}

function link(path: string, label: string) {
  return `<a data-route href="${esc(path)}">${esc(label)}</a>`
}

function panel(content: string) {
  return `<section class="panel schedule-panel">${content}</section>`
}

function heading(title: string) {
  return `<div class="page-heading"><h1>${esc(title)}</h1></div>`
}

function dateLabel(value: string, zone: string) {
  return new Intl.DateTimeFormat("ru-RU", { dateStyle: "medium", timeStyle: "short", timeZone: zone }).format(new Date(value))
}

function local(value: Date, zone: string) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: zone, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit",
  }).formatToParts(value)
  const map = Object.fromEntries(parts.map(part => [part.type, part.value]))
  return `${map.year}-${map.month}-${map.day}T${map.hour}:${map.minute}`
}

function utc(value: string, zone: string, choice = "", boundary = false): string {
  const target = Date.parse(value + "Z")
  if (!Number.isFinite(target)) throw new Error("invalid_date")
  const candidates = new Set<number>()
  for (const hours of [-36, -12, 0, 12, 36]) {
    const probe = target + hours * 3600000
    const offset = Date.parse(local(new Date(probe), zone) + "Z") - probe
    const adjusted = target - offset
    if (local(new Date(adjusted), zone) === value) candidates.add(adjusted)
  }
  const matches = [...candidates].sort((left, right) => left - right)
  if (!matches.length && boundary) {
    for (let minute = 1; minute < 1440; minute++) {
      const adjusted = new Date(target + minute * 60000).toISOString().slice(0, 16)
      try { return utc(adjusted, zone, "earlier") }
      catch (error) { if (!(error instanceof ScheduleInput)) throw error }
    }
  }
  if (!matches.length) throw new ScheduleInput("Такого местного времени нет. Выберите другое время.")
  if (matches.length > 1 && !choice) throw new ScheduleInput("Это время встречается дважды. Выберите первое или второе вхождение.")
  return new Date(matches[choice === "later" ? matches.length - 1 : 0]).toISOString()
}

export class ScheduleInput extends Error {}

function shift(date: string, days: number) {
  const value = new Date(date + "T00:00Z")
  value.setUTCDate(value.getUTCDate() + days)
  return value.toISOString().slice(0, 10)
}

function monday(date: string) {
  return shift(date, -((new Date(date + "T00:00Z").getUTCDay() + 6) % 7))
}

async function all<T>(path: string): Promise<T[]> {
  const rows: T[] = []
  let cursor: string | null = null
  do {
    const query = new URLSearchParams({ limit: "100", ...(cursor ? { cursor } : {}) })
    const result: Page<T> = await api(path + (path.includes("?") ? "&" : "?") + query.toString())
    rows.push(...result.items)
    cursor = result.next_cursor
  } while (cursor)
  return rows
}

function contentFields(item?: Partial<Content>) {
  return `<label>Название<input name="title" maxlength="120" required value="${esc(item?.title)}"></label>
    <label>Описание<textarea name="description" maxlength="1500">${esc(item?.description)}</textarea></label>
    <label>Подготовка<textarea name="preparation" maxlength="500">${esc(item?.preparation)}</textarea></label>
    <label>Закрытая заметка<textarea name="private_note" maxlength="1500">${esc(item?.private_note)}</textarea></label>`
}

function reasonField() {
  return '<label>Причина <span class="hint">(необязательно, видна участникам)</span><textarea name="reason" maxlength="500"></textarea></label>'
}

function ambiguity() {
  return '<label>При переводе часов<select name="ambiguity"><option value="">Уточнить при необходимости</option><option value="earlier">Первое вхождение</option><option value="later">Второе вхождение</option></select></label>'
}

function dateFields(zone: string, past = false, duration = 60, first?: string) {
  const next = local(new Date(Date.now() + (past ? -86400000 : 3600000)), zone)
  return `<div class="schedule-fields">
    <label>${past ? "Фактическое начало" : "Начало"}<input type="datetime-local" name="start" required value="${esc(first ?? next)}"></label>
    <label>Длительность, мин<input type="number" name="duration" min="15" max="240" step="1" required value="${duration}"></label>
  </div>${ambiguity()}`
}

function createForm(cards: Card[], zone: string, selected?: string | null, copy?: Lesson) {
  const eligible = cards.filter(card => card.student_account_id)
  if (copy && !eligible.some(card => card.student_card_id === copy.student_card_id)) {
    return '<p class="empty">Чтобы назначить занятие на другое время, восстановите карточку ученика.</p>'
  }
  if (!eligible.length) return '<p class="empty">Чтобы назначить урок, подключите ученика.</p>'
  const options = eligible.map(card => `<option value="${esc(card.student_card_id)}"${card.student_card_id === (copy?.student_card_id ?? selected) ? " selected" : ""}>${esc(card.student_card_name)}</option>`).join("")
  return `<details class="schedule-action"${copy ? " open" : ""}><summary>${copy ? "Назначить на другое время" : "Назначить урок"}</summary>
    <form data-form="schedule" data-lesson-form="create" data-key="${crypto.randomUUID()}" data-zone="${esc(zone)}">
      <label>Ученик<select name="card" required>${options}</select></label>
      ${contentFields(copy)}${dateFields(zone, false, copy?.duration_minutes)}
      <label><input type="checkbox" name="repeat"> Повторять каждую неделю</label>
      <label data-repeat-count hidden>Количество уроков<input type="number" name="count" min="2" max="26" value="4" required disabled></label>
      <div data-plan aria-live="polite"></div><button class="primary">Назначить</button>
    </form></details>
    <details class="schedule-action"><summary>Записать проведённый урок</summary>
      <form data-form="schedule" data-lesson-form="record" data-key="${crypto.randomUUID()}" data-zone="${esc(zone)}">
        <label>Ученик<select name="card" required>${options}</select></label>
        ${contentFields()}${dateFields(zone, true)}<button class="primary">Записать</button>
      </form></details>`
}

export async function schedulePage(role: ScheduleRole, zone: string, lessonId?: string) {
  if (lessonId) return lessonPage(role, zone, lessonId)
  const query = new URLSearchParams(location.search)
  const now = local(new Date(), zone).slice(0, 10)
  const requested = query.get("week")
  const candidate = requested && /^\d{4}-\d\d-\d\d$/.test(requested) && Number.isFinite(Date.parse(requested)) ? requested : now
  const start = monday(candidate)
  const end = shift(start, 7)
  const card = query.get("card")
  const view = query.get("view") === "history" ? "history" : "calendar"
  const args = new URLSearchParams({ from: utc(start + "T00:00", zone, "earlier", true), to: utc(end + "T00:00", zone, "earlier", true), view })
  if (card) args.set("student_card_id", card)
  const copyId = role === "teacher" ? query.get("copy") : null
  const [lessons, cards, alerts, copy] = await Promise.all([
    all<Lesson>(`/${role}/lessons?${args}`),
    all<Card>(`/${role}/student-cards`),
    all<Notification>(`/${role}/lesson-notifications`),
    copyId ? api<Lesson>(`/teacher/lessons/${encodeURIComponent(copyId)}`) : Promise.resolve(undefined),
  ])
  const names = new Map(cards.map(item => [item.student_card_id, item.student_card_name]))
  const navigate = (week: string, mode = view, selected: string | null = card) => {
    const params = new URLSearchParams({ week, view: mode })
    if (selected) params.set("card", selected)
    return `/schedule/${role}?${params}`
  }
  const rows = lessons.map(lesson => `<li><div>
    ${link(`/schedule/${role}/${lesson.lesson_id}`, lesson.title)}
    <span>${esc(dateLabel(lesson.starts_at, zone))} · ${esc(lesson.duration_minutes)} мин${names.has(lesson.student_card_id) ? " · " + esc(names.get(lesson.student_card_id)) : ""}</span>
    </div><span>${esc(state(lesson, role))}</span></li>`).join("")
  const unread = alerts.filter(item => !item.read || item.actionable)
  const inbox = unread.length ? `<details class="schedule-action"><summary>Уведомления (${unread.length})</summary><ul class="card-list">
    ${unread.map(item => `<li><div>${item.lesson_id ? link(`/schedule/${role}/${item.lesson_id}`, labels[item.event] ?? item.event) : esc(labels[item.event] ?? item.event)}
      <span>${esc(dateLabel(item.occurred_at, zone))}${item.actionable ? " · Нужен ответ" : ""}</span></div>
      ${item.read ? "" : commandForm("read", role, "", item.notification_id, 1, "Прочитано", "", `data-card="${esc(item.student_card_id)}"`)}</li>`).join("")}
    </ul></details>` : ""
  return heading(view === "history" ? "История занятий" : "Расписание") + panel(`
    <nav class="actions schedule-nav" aria-label="Недели">
      ${link(navigate(shift(start, -7)), "← Предыдущая неделя")}
      ${link(navigate(monday(now)), "Текущая неделя")}
      ${link(navigate(end), "Следующая неделя →")}
    </nav>
    <p class="hint">${esc(start)} — ${esc(shift(end, -1))} · ${esc(zone)}</p>
    <div class="actions">${link(navigate(start, "calendar"), "Календарь")}${link(navigate(start, "history"), "История")}</div>
    <form data-form="schedule" data-lesson-form="filter" data-role="${role}" data-start="${start}" data-view="${view}" class="schedule-filter">
      <label>Карточка<select name="card"><option value="">Все</option>${cards.map(item => `<option value="${esc(item.student_card_id)}"${item.student_card_id === card ? " selected" : ""}>${esc(item.student_card_name)}</option>`).join("")}</select></label>
      <button class="secondary">Показать</button>
    </form>
    ${rows ? `<ul class="card-list">${rows}</ul>` : '<p class="empty">На этой неделе занятий нет.</p>'}
    ${role === "teacher" ? createForm(cards, zone, card, copy) : ""}${inbox}`)
}

function state(lesson: Lesson, role: ScheduleRole) {
  return lesson.status === "scheduled" && new Date(lesson.ends_at).getTime() <= Date.now()
    ? role === "teacher" ? "Нужна отметка" : "Отметки пока нет"
    : labels[lesson.status]
}

function commandForm(kind: string, role: ScheduleRole, lesson: string, id: string, version: number,
                     title: string, fields = "", attrs = "") {
  return `<form data-form="schedule" data-lesson-form="${kind}" data-role="${role}" data-lesson="${esc(lesson)}"
    data-id="${esc(id)}" data-version="${version}" ${attrs}>${fields}<button class="secondary">${esc(title)}</button></form>`
}

async function lessonPage(role: ScheduleRole, zone: string, id: string) {
  const endpoint = `/${role}/lessons/${id}`
  const [lesson, proposals, notices, history] = await Promise.all([
    api<Lesson>(endpoint), all<Proposal>(endpoint + "/reschedule-requests"),
    all<Absence>(endpoint + "/absence-notices"),
    all<Activity>(endpoint + (role === "teacher" ? "/history" : "/activity")),
  ])
  const series = lesson.series_id ? await api<Series>(`/teacher/lesson-series/${lesson.series_id}`) : undefined
  const card = await api<Card>(`/${role}/student-cards/${lesson.student_card_id}`)
  const upcoming = new Date(lesson.starts_at).getTime() > Date.now() && lesson.status === "scheduled"
  const scheduled = lesson.status === "scheduled"
  const elapsed = new Date(lesson.ends_at).getTime() <= Date.now()
  const attrs = `data-zone="${esc(zone)}" data-series="${esc(series?.series_id)}" data-series-version="${series?.version ?? ""}" data-series-zone="${esc(series?.timezone)}"`
  const commands = (kind: string, label: string, fields = "", extra = "") => commandForm(
    kind, role, id, id, lesson.version, label, fields, attrs + " " + extra,
  )
  const edited = JSON.stringify({
    title: lesson.title, description: lesson.description, preparation: lesson.preparation, private_note: lesson.private_note ?? null,
  })
  const useTemplate = series ? `<fieldset data-series-choice hidden>
    <legend>Применить изменения</legend>
    <label><input type="radio" name="scope" value="one" checked> Только этот урок</label>
    <label><input type="radio" name="scope" value="all_future"> К будущим урокам серии</label>
    <div data-template-preview hidden><p class="hint" data-template-note></p></div>
  </fieldset>` : ""
  const teacher = role === "teacher" ? `
      <details class="schedule-action"><summary>Редактировать</summary>
        ${commands("edit", "Сохранить", contentFields(lesson) + useTemplate,
          `data-original="${esc(edited)}" data-template="${esc(JSON.stringify(series?.content_template ?? {}))}" data-affected="${series?.lessons.filter(item => item.uses_series_content && item.status === "scheduled" && Date.parse(item.starts_at) > Date.now()).length ?? 0}"`)}
      </details>
      ${scheduled ? `<details class="schedule-action"><summary>Отменить</summary>${commands("cancel", "Отменить урок", reasonField())}</details>` : ""}
      ${elapsed && lesson.status !== "cancelled" ? `<details class="schedule-action"><summary>Посещаемость</summary>
        ${commands("attended", "Проведён")}${commands("no-show", "Пропущен", reasonField())}
        ${scheduled ? "" : commands("reset", "Снять отметку")}
      </details>` : ""}
      ${lesson.status === "cancelled" ? `<div class="actions">
        ${Date.parse(lesson.starts_at) > Date.now() ? commands("restore", "Восстановить на исходное время") : ""}
        ${link(`/schedule/teacher?copy=${id}`, "Создать на другое время")}
      </div>` : ""}
      ${series && series.lessons.some(item => item.status === "scheduled" && Date.parse(item.starts_at) > Date.now())
        ? `<details class="schedule-action"><summary>Отменить будущие даты серии</summary>
          ${commands("cancel-series", "Подтвердить отмену", `<label>Область<select name="scope"><option value="all_future">Все будущие уроки</option>${upcoming ? '<option value="following">Этот и следующие</option>' : ""}</select></label>
            <p>Даты, которые будут отменены</p><ul class="schedule-dates">${series.lessons
              .filter(item => item.status === "scheduled" && Date.parse(item.starts_at) > Date.now())
              .map(item => `<li data-position="${item.series_position}">${esc(dateLabel(item.starts_at, zone))}</li>`).join("")}</ul>` + reasonField(),
              `data-position="${lesson.series_position}"`)}
        </details>` : ""}
      <details class="schedule-action"><summary>Удалить</summary><p>Запись исчезнет из расписания и истории.</p>${commands("delete", "Удалить урок")}</details>
  ` : ""
  const moving = upcoming ? `<details class="schedule-action"><summary>Изменить расписание</summary>
      ${commands("propose", "Предложить перенос", role === "teacher"
        ? `<label>Область<select name="scope"><option value="one">Только этот урок</option>${series && !lesson.is_series_exception ? '<option value="following">Этот и следующие</option>' : ""}</select></label>`
          + dateFields(zone, false, lesson.duration_minutes, local(new Date(lesson.starts_at), zone))
          + (series ? `<p class="hint" data-time-zone>Время указано в зоне ${esc(zone)}.</p>` : "")
          + reasonField() + '<div data-plan aria-live="polite"></div>'
        : `<label>Новое время<input type="datetime-local" name="start" required></label>${ambiguity()}${reasonField()}`)}
      ${role !== "teacher" ? commands("absence", "Не сможем прийти", reasonField()) : ""}
    </details>` : ""
  const requests = proposals.map(request => `<li><div><strong>${esc(labels[request.requester_role])} · ${esc(labels[request.status])}</strong>
    ${request.occurrences.map(item => `<p>${esc(dateLabel(item.starts_at, zone))} → ${esc(dateLabel(item.proposed_starts_at, zone))}</p>`).join("")}
    ${request.reason ? `<p>${esc(request.reason)}</p>` : ""}
    ${request.can_resolve ? `<div class="actions">${commandForm("accept", role, id, request.request_id, request.version, "Принять перенос")}
      ${commandForm("decline", role, id, request.request_id, request.version, "Отклонить")}</div>` : ""}
    ${request.can_withdraw ? commandForm("withdraw", role, id, request.request_id, request.version, "Отозвать предложение") : ""}
  </div></li>`).join("")
  const reports = notices.map(notice => `<li><div><strong>${esc(labels[notice.requester_role])} · ${esc(labels[notice.status])}</strong>
    ${notice.reason ? `<p>${esc(notice.reason)}</p>` : ""}
    ${notice.can_withdraw ? commandForm("withdraw-absence", role, id, notice.notice_id, notice.version, "Отозвать предупреждение") : ""}
    </div></li>`).join("")
  return `<div class="narrow">
    ${link(`/schedule/${role}`, "← К расписанию")}
    ${heading(lesson.title)}
    ${panel(`<p><strong>${esc(card.student_card_name)}</strong></p>
      <p>${esc(dateLabel(lesson.starts_at, zone))} · ${esc(lesson.duration_minutes)} мин</p>
      <p>${esc(state(lesson, role))}${series ? " · Еженедельная серия" : ""}</p>
      ${lesson.outcome_reason ? `<p>${esc(lesson.outcome_reason)}</p>` : ""}
      ${lesson.description ? `<h2>Описание</h2><p class="schedule-text">${esc(lesson.description)}</p>` : ""}
      ${lesson.preparation ? `<h2>Подготовка</h2><p class="schedule-text">${esc(lesson.preparation)}</p>` : ""}
      ${lesson.private_note ? `<h2>Закрытая заметка</h2><p class="schedule-text">${esc(lesson.private_note)}</p>` : ""}
      ${moving}${teacher}`)}
    ${requests ? panel(`<h2>Предложения переноса</h2><ul class="card-list">${requests}</ul>`) : ""}
    ${reports ? panel(`<h2>Предупреждения о неявке</h2><ul class="card-list">${reports}</ul>`) : ""}
    ${panel(`<h2>История урока</h2>${history.length ? `<ol class="card-list">
      ${history.map(item => `<li><div><strong>${esc(labels[item.event] ?? item.event)}</strong>
        ${item.event === "lesson_rescheduled" && item.before?.starts_at && item.after?.starts_at
          ? `<p>${esc(dateLabel(item.before.starts_at, zone))} → ${esc(dateLabel(item.after.starts_at, zone))}</p>` : ""}
        ${item.changed_fields?.length ? `<p>${esc(item.changed_fields.map(field => labels[field] ?? field).join(", "))}</p>` : ""}
        ${item.reason ? `<p>${esc(item.reason)}</p>` : ""}
        <span>${esc(dateLabel(item.occurred_at, zone))}${item.actor_role ? " · " + esc(labels[item.actor_role]) : ""}</span></div></li>`).join("")}
      </ol>` : '<p class="empty">Событий пока нет.</p>'}`)}
  </div>`
}

function preview(form: HTMLFormElement, plan: Plan, fingerprint: string, label: string) {
  const area = form.querySelector<HTMLElement>("[data-plan]")!
  area.innerHTML = `<h3>Предпросмотр серии</h3><ul class="schedule-dates">${plan.occurrences.map(item =>
    `<li>${esc(item.local_start.replace("T", " "))}${item.conflicts ? " · Время занято" : ""}</li>`).join("")}</ul>
    ${plan.preserved_lesson_ids.length ? `<p>Сохраняемых дат: ${plan.preserved_lesson_ids.length}.</p>` : ""}`
  if (plan.occurrences.some(item => item.conflicts)) throw new ScheduleInput("Измените время, чтобы убрать пересечения.")
  form.dataset.fingerprint = fingerprint
  form.querySelector("button")!.textContent = label
}

export function updateScheduleForm(target: HTMLInputElement | HTMLSelectElement) {
  const form = target.form
  if (!form) return
  if (target instanceof HTMLInputElement && target.name === "repeat") {
    const label = form.querySelector<HTMLElement>("[data-repeat-count]")!
    label.hidden = !target.checked
    const count = label.querySelector("input")!
    count.disabled = !target.checked
    if (target.checked) count.focus()
    return
  }
  if (target.name !== "scope") return
  if (form.dataset.lessonForm === "cancel-series") {
    form.querySelectorAll<HTMLElement>("li[data-position]").forEach(item => {
      item.hidden = target.value === "following" && Number(item.dataset.position) < Number(form.dataset.position)
    })
  }
  if (form.dataset.lessonForm === "propose") {
    const field = form.querySelector<HTMLInputElement>('input[name="start"]')
    const label = form.querySelector<HTMLElement>("[data-time-zone]")
    const previousZone = form.dataset.inputZone ?? form.dataset.zone ?? "UTC"
    const nextZone = (target.value === "following" ? form.dataset.seriesZone : form.dataset.zone) ?? previousZone
    if (!field || !label || nextZone === previousZone) return
    if (field.value) {
      try { field.value = local(new Date(utc(field.value, previousZone, "earlier")), nextZone) }
      catch { field.value = "" }
    }
    form.dataset.inputZone = nextZone
    label.textContent = `Время указано в зоне ${nextZone}.`
  }
}

export async function submitSchedule(form: HTMLFormElement): Promise<string | null | undefined> {
  const values = new FormData(form)
  const value = (key: string) => String(values.get(key) ?? "").trim()
  const kind = form.dataset.lessonForm
  const role = form.dataset.role ?? "teacher"
  const zone = form.dataset.zone ?? "UTC"
  const id = form.dataset.id
  const expected_version = Number(form.dataset.version)
  const base = `/${role}/lessons/${form.dataset.lesson}`
  const content: Content = {
    title: value("title"), description: value("description") || null, preparation: value("preparation") || null,
    private_note: value("private_note") || null,
  }
  const reason = value("reason") || undefined
  const ambiguous_time = value("ambiguity") || undefined

  if (kind === "filter") {
    const query = new URLSearchParams({ week: form.dataset.start!, view: form.dataset.view! })
    if (value("card")) query.set("card", value("card"))
    return `/schedule/${role}?${query}`
  }
  if (kind === "read") {
    await api(`/${role}/student-cards/${form.dataset.card}/lesson-notifications/${id}/read`, "POST")
    return null
  }
  if (kind === "create" || kind === "record") {
    const shared = {
      student_card_id: value("card"), duration_minutes: Number(value("duration")),
      ...content, client_request_id: form.dataset.key!,
    }
    const count = values.has("repeat") ? Number(value("count")) : 1
    if (count > 1 && kind === "create") {
      const planBody = {
        student_card_id: shared.student_card_id, duration_minutes: shared.duration_minutes,
        first_local_start: value("start"), timezone: zone, count, ambiguous_time,
      }
      const fingerprint = JSON.stringify(planBody)
      if (form.dataset.fingerprint !== fingerprint) {
        preview(form, await api<Plan>("/teacher/lesson-series/preview", "POST", planBody), fingerprint, "Назначить серию")
        return undefined
      }
      const series = await api<Series>("/teacher/lesson-series", "POST", { ...shared, ...planBody })
      return `/schedule/teacher/${series.lessons[0].lesson_id}`
    }
    const lesson = await api<Lesson>("/teacher/lessons" + (kind === "record" ? "/record-completed" : ""), "POST", {
      ...shared, starts_at: utc(value("start"), zone, ambiguous_time),
    })
    return `/schedule/teacher/${lesson.lesson_id}`
  }
  if (kind === "edit") {
    const original = JSON.parse(form.dataset.original!) as Content
    const changes = Object.fromEntries((Object.keys(content) as (keyof Content)[])
      .filter(key => content[key] !== original[key]).map(key => [key, content[key]]))
    if (!Object.keys(changes).length) throw new ScheduleInput("Измените хотя бы одно поле.")
    if (form.dataset.series && form.dataset.showScope !== "true") {
      form.dataset.showScope = "true"
      const fieldset = form.querySelector<HTMLElement>("[data-series-choice]")!
      fieldset.hidden = false
      fieldset.querySelector("input")?.focus()
      form.querySelector("button")!.textContent = "Применить изменения"
      return undefined
    }
    if (value("scope") === "all_future") {
      const template = JSON.parse(form.dataset.template!) as Content
      const revised = { ...template, ...changes }
      const review = form.querySelector<HTMLElement>("[data-template-preview]")!
      const fingerprint = JSON.stringify(revised)
      if (form.dataset.templateFingerprint !== fingerprint) {
        review.hidden = false
        review.querySelector("[data-template-note]")!.textContent =
          `Будущих уроков, использующих шаблон: ${form.dataset.affected}. Новое название: «${revised.title}».`
        form.dataset.templateFingerprint = fingerprint
        form.querySelector("button")!.textContent = "Сохранить шаблон"
        return undefined
      }
      await api(`/teacher/lesson-series/${form.dataset.series}/content`, "PATCH", {
        ...changes, expected_version: Number(form.dataset.seriesVersion),
      })
    } else await api(base, "PATCH", { ...changes, expected_version })
    return null
  }
  if (kind === "propose" && value("scope") === "following") {
    const seriesUrl = `/teacher/lesson-series/${form.dataset.series}`
    const data = {
      from_lesson_id: form.dataset.lesson, first_local_start: value("start"),
      expected_version: Number(form.dataset.seriesVersion), duration_minutes: Number(value("duration")), ambiguous_time,
    }
    const fingerprint = JSON.stringify(data)
    if (form.dataset.fingerprint !== fingerprint) {
      preview(form, await api<Plan>(seriesUrl + "/reschedule/preview", "POST", data), fingerprint, "Отправить предложение")
      return undefined
    }
    await api(seriesUrl + "/reschedule-requests", "POST", { ...data, reason })
    return null
  }
  if (kind === "propose") {
    await api(base + "/reschedule-requests", "POST", {
      expected_version, reason, proposed_starts_at: utc(value("start"), zone, ambiguous_time),
      ...(role === "teacher" ? { duration_minutes: Number(value("duration")) } : {}),
    })
    return null
  }
  if (kind === "cancel-series") {
    const scope = value("scope")
    await api(`/teacher/lesson-series/${form.dataset.series}/cancel`, "POST", {
      scope, expected_version: Number(form.dataset.seriesVersion), reason,
      ...(scope === "following" ? { from_lesson_id: form.dataset.lesson } : {}),
    })
    return null
  }
  if (kind === "delete") {
    await api(base, "DELETE", undefined, { "If-Match": `"${expected_version}"` })
    return `/schedule/${role}`
  }
  const basic = { expected_version }
  switch (kind) {
    case "absence": await api(base + "/absence-notices", "POST", { ...basic, reason }); break
    case "withdraw-absence": await api(`/${role}/absence-notices/${id}/withdraw`, "POST", basic); break
    case "accept":
    case "decline": await api(`/${role}/reschedule-requests/${id}/resolve`, "POST", { ...basic, decision: kind }); break
    case "withdraw": await api(`/${role}/reschedule-requests/${id}/withdraw`, "POST", basic); break
    case "cancel": await api(base + "/cancel", "POST", { ...basic, reason }); break
    case "restore": await api(base + "/restore", "POST", basic); break
    case "reset": await api(base + "/attendance/reset", "POST", basic); break
    case "attended": await api(base + "/attendance", "POST", { ...basic, status: "completed" }); break
    case "no-show": await api(base + "/attendance", "POST", { ...basic, status: "no_show", reason }); break
  }
  return null
}
