import { api, ApiError, clearContext, describeError } from "./api.js"

type Role = "teacher" | "student" | "parent"
type ContactType = "email" | "phone"
type Contact = { type: ContactType; value: string }
type Purpose = "new_student_card_for_student" | "new_student_card_for_parent"
type Account = { account_id: string; login_contact: Contact }
type Profile = { display_name: string; timezone: string; version: number }
type Cabinets = { teacher_enabled: boolean; student_available: boolean; parent_available: boolean }
type Card = {
  student_card_id: string; student_card_name: string; subject: string | null
  learning_goal: string | null; teacher_display_name?: string; private_note?: string | null
}
type Access = { parent_access_id: string; parent_display_name: string | null; status: "active" | "revoked" }
type Invitation = { invitation_id: string; purpose: Purpose; status: string; expires_at: string }
type Page<T> = { items: T[]; next_cursor: string | null }
type AuthMode = "login" | "register" | "reset"

const root = document.querySelector<HTMLElement>("#app")!
const invitationNames = {
  new_student_card_for_student: "Для ученика", new_student_card_for_parent: "Для родителя",
}
const invitationStates: Record<string, string> = {
  pending: "Ожидает принятия", accepted: "Принято", revoked: "Отозвано", expired: "Срок истёк",
}

let account: Account | undefined
let profile: Profile | undefined
let authMode: AuthMode = "login"
let challenge: { id: string; contact: Contact } | undefined
let latestLink = ""
let renderVersion = 0

function escape(value: string | null | undefined) {
  return (value ?? "").replace(/[&<>"']/g, (char) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]!)
}

function deadline(timestamp: string) {
  return new Intl.DateTimeFormat("ru-RU", { dateStyle: "medium", timeStyle: "short" })
    .format(new Date(timestamp))
}

function route(url: string, replace = false) {
  if (replace) history.replaceState(null, "", url)
  else history.pushState(null, "", url)
  challenge = undefined
  authMode = "login"
  void render(true)
}

function link(url: string, text: string, className = "") {
  const active = location.pathname === url ? ' aria-current="page"' : ""
  return `<a data-route href="${escape(url)}" class="${className}"${active}>${escape(text)}</a>`
}

function panel(body: string, style = "") {
  return `<section class="panel ${style}">${body}</section>`
}

function frame(body: string, cabinets?: Cabinets) {
  const cabinetLinks = cabinets ? `
    <nav aria-label="Кабинет">
      ${link("/cabinet", "Обзор")}
      ${cabinets.student_available || location.pathname.startsWith("/cabinet/student")
        ? link("/cabinet/student", "Ученик") : ""}
      ${cabinets.parent_available || location.pathname.startsWith("/cabinet/parent")
        ? link("/cabinet/parent", "Родитель") : ""}
      ${link("/profile", "Профиль")}
    </nav>
    <div class="session">
      <span title="${escape(profile?.display_name)}">${escape(profile?.display_name)}</span>
      <button class="quiet" data-action="logout">Выйти</button>
    </div>` : `
      ${account
        ? `<div class="session">${link("/cabinet", "Кабинет", "button secondary")}<button class="quiet" data-action="logout">Выйти</button></div>`
        : (location.pathname === "/login" ? "" : link("/login", "Войти", "button secondary"))}`
  return `<header class="topbar">
    <div class="topbar-inner">
      <a class="brand" data-route href="${account ? "/cabinet" : "/"}"><span class="brand-mark" aria-hidden="true">↗</span>TutorFlow</a>
      ${cabinetLinks}
    </div>
  </header>
  <main id="main" tabindex="-1">
    <div class="notice" id="notice" role="status" aria-live="polite"></div>
    <div class="notice error" id="error" role="alert"></div>
    ${body}
  </main>`
}

function notify(text: string, error = false) {
  const target = root.querySelector(error ? "#error" : "#notice")
  if (target) target.textContent = text
}

async function loadAccount() {
  try {
    account = await api<Account>("/me")
    profile = await api<Profile>("/me/profile")
  } catch (error) {
    if (!(error instanceof ApiError) || error.status !== 401) throw error
    account = undefined
    profile = undefined
  }
}

async function list<T>(endpoint: string): Promise<T[]> {
  const items: T[] = []
  let cursor: string | null = null
  do {
    const query = cursor ? "?cursor=" + encodeURIComponent(cursor) : ""
    const page: Page<T> = await api<Page<T>>(endpoint + query)
    items.push(...page.items)
    cursor = page.next_cursor
  } while (cursor)
  return items
}

function pageHeading(title: string, description?: string) {
  return `<div class="page-heading"><h1>${escape(title)}</h1>${
    description ? `<p>${escape(description)}</p>` : ""}</div>`
}

function landing() {
  return `<section class="hero">
    <div class="hero-content">
      <h1>Ваш кабинет<br>репетитора</h1>
      <p>Приглашайте учеников и родителей. У каждого ученика — своя карточка и свой доступ.</p>
      <div class="actions">${link("/start", "Начать как репетитор", "button primary")}
      ${link("/login", "Войти в аккаунт", "button on-dark")}</div>
    </div>
    <div class="hero-steps">
      <p>Как начать</p>
      <ol>
        <li><span>1</span> Подтвердите email или телефон</li>
        <li><span>2</span> Включите кабинет репетитора</li>
        <li><span>3</span> Отправьте одноразовую ссылку</li>
      </ol>
    </div>
  </section>`
}

function contactInputs(contact?: Contact) {
  return `<label>Способ подтверждения
    <select name="type">
      <option value="email" ${contact?.type === "email" ? "selected" : ""}>Email</option>
      <option value="phone" ${contact?.type === "phone" ? "selected" : ""}>Телефон</option>
    </select>
  </label>
  <label>Контакт<input name="contact" value="${escape(contact?.value)}" maxlength="320" required autocomplete="username"></label>`
}

function loginInput() {
  return `<label>Логин — почта или телефон
    <input name="login" maxlength="320" required autocomplete="username" autocapitalize="none">
  </label>`
}

function passwordInput(create: boolean) {
  return `<label>Пароль<input name="password" type="password" maxlength="128"
    ${create ? 'minlength="15" autocomplete="new-password"' : 'autocomplete="current-password"'}
    required></label>`
}

function authForm() {
  const tabs = `<div class="segmented" aria-label="Действие с аккаунтом">
    <button data-mode="login" aria-pressed="${authMode === "login"}">Вход</button>
    <button data-mode="register" aria-pressed="${authMode === "register"}">Создать аккаунт</button>
  </div>`
  if (authMode === "login") {
    return tabs + `<form data-form="login">
      ${loginInput()}${passwordInput(false)}
      <div class="actions"><button class="primary">Войти</button>
        <button type="button" class="quiet" data-mode="reset">Восстановить пароль</button></div>
    </form>`
  }
  if (!challenge) {
    return tabs + `<form data-form="challenge">
      ${authMode === "reset" ? "<h2>Восстановление пароля</h2>" : ""}
      ${authMode === "reset" ? loginInput() : contactInputs()}
      <button class="primary">Получить код</button>
    </form>`
  }
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC"
  return tabs + `<form data-form="complete">
    <p class="hint">Если запрос доступен, код придёт на указанный контакт. Он действует 10 минут.</p>
    <label>Код подтверждения<input name="code" inputmode="numeric" autocomplete="one-time-code"
      pattern="[0-9]{8}" maxlength="8" required></label>
    ${authMode === "register" ? `<label>Имя в профиле<input name="display_name" autocomplete="name" maxlength="80" required></label>
      <label>Часовой пояс<input name="timezone" value="${escape(timezone)}" maxlength="64" required></label>` : ""}
    ${passwordInput(true)}
    <div class="actions"><button class="primary">${authMode === "register" ? "Завершить регистрацию" : "Сохранить новый пароль"}</button>
      <button type="button" class="quiet" data-action="new-code">Запросить новый код</button></div>
  </form>`
}

function updateAuthForm() {
  const authPanel = root.querySelector(".auth-panel")
  if (authPanel) authPanel.innerHTML = authForm()
}

function inviteToken() {
  return location.pathname === "/invite" ? new URLSearchParams(location.hash.slice(1)).get("token") : null
}

async function invitePage() {
  const token = inviteToken()
  if (!token) throw new ApiError(400, "invitation_unavailable")
  const invitation = await api<{ purpose: Purpose; expires_at: string }>(
    "/invitations/preview", "POST", { invitation_token: token },
  )
  const parent = invitation.purpose === "new_student_card_for_parent"
  const title = parent ? "Приглашение для родителя" : "Приглашение для ученика"
  const details = parent
    ? "Репетитор создаст карточку ребёнка. Вы получите доступ к ней из своего аккаунта."
    : "После принятия у репетитора появится ваша карточка. Вы сможете открыть её в кабинете."
  const action = account
    ? `<form data-form="accept" data-role="${parent ? "parent" : "student"}">
      ${parent ? '<label>Имя ребёнка<input name="student_card_name" maxlength="80" required></label>' : ""}
      <button class="primary">Принять приглашение</button>
    </form>`
    : authForm()
  return `<div class="narrow">${pageHeading(title, details)}
    <p class="expiry">Действует до ${deadline(invitation.expires_at)}</p>
    ${panel(action, account ? "" : "auth-panel")}</div>`
}

function cardList(cards: Card[], role: Role) {
  return cards.length ? `<ul class="card-list">${cards.map((card) => `<li>
    ${link(`/cabinet/${role}/${encodeURIComponent(card.student_card_id)}`, card.student_card_name)}
    ${card.teacher_display_name ? `<span>${escape(card.teacher_display_name)}</span>` : ""}
  </li>`).join("")}</ul>` : '<p class="empty">Карточек пока нет.</p>'
}

async function teacherPage(cabinets: Cabinets) {
  if (!cabinets.teacher_enabled) {
    return pageHeading("Обзор") + panel(`<h2>Кабинет репетитора</h2>
      <p>Включите кабинет, чтобы приглашать учеников и родителей.</p>
      <button class="primary" data-action="enable">Включить кабинет репетитора</button>`, "welcome")
  }
  const [cards, invitations] = await Promise.all([
    list<Card>("/teacher/student-cards"), list<Invitation>("/teacher/invitations"),
  ])
  return pageHeading("Кабинет репетитора") + `<div class="dashboard-grid">
    ${panel(`<h2>Карточки учеников</h2>${cardList(cards, "teacher")}`)}
    ${panel(`<h2>Приглашения</h2>
      <p>Создайте ссылку и передайте её получателю. После принятия появится отдельная карточка.</p>
      <div class="actions">
        <button class="primary" data-action="issue" data-purpose="new_student_card_for_student">Пригласить ученика</button>
        <button class="secondary" data-action="issue" data-purpose="new_student_card_for_parent">Пригласить родителя</button>
      </div>
      ${latestLink ? `<div class="issued">
        <label>Ссылка для приглашения<input name="latest_link" readonly value="${escape(latestLink)}"></label>
        <button class="secondary" data-action="copy">Скопировать ссылку</button>
      </div>` : ""}
      ${invitations.length ? `<ul class="card-list invitation-list">${invitations.map((invitation) =>
        `<li><div><strong>${invitationNames[invitation.purpose]}</strong>
           <span>${invitationStates[invitation.status]} · ${deadline(invitation.expires_at)}</span></div>
         ${invitation.status === "pending" ? `<button class="quiet" data-action="revoke-invite"
           data-id="${escape(invitation.invitation_id)}">Отозвать ссылку</button>` : ""}</li>`).join("")}</ul>`
        : '<p class="empty">Приглашений пока нет.</p>'}`)}
  </div>`
}

async function cabinet(role: Role, cardId?: string) {
  if (!cardId) {
    const cards = await list<Card>(`/${role}/student-cards`)
    return pageHeading(role === "student" ? "Кабинет ученика" : "Кабинет родителя")
      + panel(`<h2>Доступные карточки</h2>${cardList(cards, role)}`)
  }
  const endpoint = `/${role}/student-cards/${encodeURIComponent(cardId)}`
  const card = await api<Card>(endpoint)
  const allowed = role === "teacher" ? await list<Access>(endpoint + "/parent-access") : []
  return `<div class="narrow">
    ${link(role === "teacher" ? "/cabinet" : `/cabinet/${role}`, "← К списку карточек", "back")}
    ${pageHeading(card.student_card_name)}
    ${panel(`<h2>Сведения об ученике</h2>
      ${card.teacher_display_name ? `<dl><dt>Репетитор</dt><dd>${escape(card.teacher_display_name)}</dd></dl>` : ""}
      <dl><dt>Предмет</dt><dd>${escape(card.subject) || "Не указан"}</dd>
      <dt>Учебная цель</dt><dd>${escape(card.learning_goal) || "Не указана"}</dd>
      ${role === "teacher" && card.private_note ? `<dt>Закрытая заметка</dt><dd>${escape(card.private_note)}</dd>` : ""}</dl>`)}
    ${role === "teacher" ? panel(`<h2>Родительский доступ</h2>
      ${allowed.length ? `<ul class="card-list">${allowed.map((access) => `<li>
        <strong>${escape(access.parent_display_name) || "Родитель"}</strong>
        ${access.status === "active" ? `<button class="danger quiet" data-action="revoke-access"
          data-id="${escape(access.parent_access_id)}">Отозвать доступ</button>`
          : "<span>Доступ отозван</span>"}
      </li>`).join("")}</ul>` : '<p class="empty">Родительского доступа нет.</p>'}`) : ""}
  </div>`
}

function profilePage() {
  return `<div class="narrow">${pageHeading("Профиль")}
    ${panel(`<form data-form="profile">
      <label>Имя в профиле<input name="display_name" value="${escape(profile?.display_name)}" maxlength="80" required></label>
      <label>Часовой пояс<input name="timezone" value="${escape(profile?.timezone)}" maxlength="64" required></label>
      <p class="hint">Контакт для входа: ${escape(account?.login_contact.value)}</p>
      <button class="primary">Сохранить профиль</button>
    </form>`)}
  </div>`
}

async function render(focus = false) {
  const version = ++renderVersion
  const path = location.pathname
  let body: string
  let cabinets: Cabinets | undefined
  let failed: unknown
  try {
    if (account && path !== "/invite") cabinets = await api<Cabinets>("/cabinets")
    const match = path.match(/^\/cabinet\/(teacher|student|parent)(?:\/([a-f0-9-]+))?$/)
    if (path === "/invite") body = await invitePage()
    else if (!account && path === "/") body = landing()
    else if (!account) body = `<div class="narrow">${pageHeading("Ваш аккаунт", "Войдите или подтвердите один контакт для регистрации.")}${panel(authForm(), "auth-panel")}</div>`
    else if (path === "/profile") body = profilePage()
    else if (match && (match[1] !== "teacher" || match[2])) body = await cabinet(match[1] as Role, match[2])
    else body = await teacherPage(cabinets!)
  } catch (error) {
    failed = error
    body = pageHeading(path === "/invite" ? "Приглашение" : "Кабинет")
  }
  if (version !== renderVersion) return
  root.innerHTML = frame(body, cabinets)
  if (failed) notify(describeError(failed), true)
  if (focus) root.querySelector<HTMLElement>("#main")?.focus()
}

function contactOf(data: FormData): Contact {
  const input = String(data.get("login") ?? data.get("contact") ?? "").trim()
  const type = (data.get("type") as ContactType | null) ?? (input.includes("@") ? "email" : "phone")
  const value = type === "phone" ? input.replace(/[\s()-]/g, "") : input
  return { type, value }
}

async function submit(form: HTMLFormElement) {
  const values = new FormData(form)
  const token = inviteToken()
  const invitation = token ? { invitation_token: token } : {}
  switch (form.dataset.form) {
    case "login":
      await api("/auth/login", "POST", { login_contact: contactOf(values), password: values.get("password") })
      await loadAccount()
      if (token) await render(true)
      else route("/cabinet")
      break
    case "challenge": {
      const contact = contactOf(values)
      const request = authMode === "reset" ? { login_contact: contact } : {
        login_contact: contact, entrypoint: token ? "invitation" : "teacher", ...invitation,
      }
      const path = authMode === "reset" ? "/auth/password-resets" : "/auth/registrations"
      const result = await api<{ challenge_id: string }>(path, "POST", request)
      challenge = { id: result.challenge_id, contact }
      updateAuthForm()
      root.querySelector<HTMLInputElement>('[name="code"]')?.focus()
      break
    }
    case "complete": {
      if (!challenge) return
      const request = { challenge_id: challenge.id, code: values.get("code"), password: values.get("password") }
      if (authMode === "reset") {
        await api("/auth/password-resets/complete", "POST", request)
        clearContext()
        account = undefined
        profile = undefined
        authMode = "login"
        challenge = undefined
        await render(true)
        notify("Пароль обновлён. Войдите с новым паролем.")
      } else {
        await api("/auth/registrations/complete", "POST", {
          ...request, ...invitation, display_name: values.get("display_name"), timezone: values.get("timezone"),
        })
        challenge = undefined
        await loadAccount()
        if (token) await render(true)
        else route("/cabinet")
      }
      break
    }
    case "accept": {
      const childName = values.get("student_card_name")
      const card = await api<{ student_card_id: string }>("/invitations/accept", "POST", {
        ...invitation, ...(childName === null ? {} : { student_card_name: childName }),
      })
      route(`/cabinet/${form.dataset.role}/${encodeURIComponent(card.student_card_id)}`, true)
      break
    }
    case "profile":
      profile = await api<Profile>("/me/profile", "PATCH", {
        display_name: values.get("display_name"), timezone: values.get("timezone"), expected_version: profile!.version,
      })
      await render(true)
      notify("Профиль сохранён.")
      break
  }
}

async function action(button: HTMLButtonElement) {
  if (button.dataset.mode) {
    authMode = button.dataset.mode as AuthMode
    challenge = undefined
    updateAuthForm()
    root.querySelector<HTMLInputElement>('[name="login"], [name="contact"]')?.focus()
    return
  }
  switch (button.dataset.action) {
    case "logout":
      await api("/auth/session", "DELETE")
      account = undefined
      profile = undefined
      latestLink = ""
      clearContext()
      if (inviteToken()) {
        authMode = "login"
        challenge = undefined
        await render(true)
      } else route("/")
      break
    case "enable":
      await api("/me/teacher-cabinet", "PUT")
      await render(true)
      notify("Кабинет включён.")
      break
    case "issue": {
      const result = await api<{ invitation_token: string }>("/teacher/invitations", "POST", {
        purpose: button.dataset.purpose,
      })
      const url = new URL("/invite", location.origin)
      url.hash = new URLSearchParams({ token: result.invitation_token }).toString()
      latestLink = url.toString()
      await render()
      root.querySelector<HTMLInputElement>('[name="latest_link"]')?.focus()
      notify("Ссылка готова. Скопируйте её и отправьте получателю.")
      break
    }
    case "copy":
      try {
        await navigator.clipboard.writeText(latestLink)
        notify("Ссылка скопирована.")
      } catch {
        root.querySelector<HTMLInputElement>('[name="latest_link"]')?.select()
        notify("Ссылка выделена. Скопируйте её вручную.")
      }
      break
    case "revoke-invite":
      await api(`/teacher/invitations/${encodeURIComponent(button.dataset.id!)}`, "DELETE")
      latestLink = ""
      await render(true)
      notify("Приглашение отозвано.")
      break
    case "revoke-access":
      await api(`/parent-access/${encodeURIComponent(button.dataset.id!)}`, "DELETE")
      await render(true)
      notify("Родительский доступ отозван.")
      break
    case "new-code":
      challenge = undefined
      updateAuthForm()
      root.querySelector<HTMLInputElement>('[name="login"], [name="contact"]')?.focus()
      break
  }
}

async function perform(button: HTMLButtonElement | null, work: () => Promise<void>) {
  notify("", true)
  notify("")
  if (button) button.disabled = true
  try { await work() }
  catch (error) { notify(describeError(error), true) }
  finally { if (button) button.disabled = false }
}

root.addEventListener("click", (event) => {
  if (!(event.target instanceof Element)) return
  const anchor = event.target.closest<HTMLAnchorElement>("a[data-route]")
  if (anchor && !event.ctrlKey && !event.metaKey && !event.shiftKey && !event.altKey) {
    event.preventDefault()
    route(anchor.pathname)
    return
  }
  const button = event.target.closest<HTMLButtonElement>("button[data-mode],button[data-action]")
  if (!button) return
  event.preventDefault()
  void perform(button, () => action(button))
})

root.addEventListener("submit", (event) => {
  if (!(event.target instanceof HTMLFormElement)) return
  event.preventDefault()
  const form = event.target
  const button = event.submitter instanceof HTMLButtonElement ? event.submitter : null
  void perform(button, () => submit(form))
})

window.addEventListener("popstate", () => {
  challenge = undefined
  authMode = "login"
  void render(true)
})

try { await loadAccount() }
catch (error) {
  root.innerHTML = frame(pageHeading("TutorFlow"))
  notify(describeError(error), true)
}
if (!root.querySelector("#error")) await render()
