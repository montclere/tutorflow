import { expect, test } from "@playwright/test"
import { readFile, readdir, stat } from "node:fs/promises"
import { join } from "node:path"
import { randomInt, randomUUID } from "node:crypto"

// Сценарий на стеке ./scripts/dev.sh check: интерфейс на React, API students и lessons.
const password = "тестовая фраза для входа 2026"
// Зона браузера из списка городов формы — профиль получит тот же пояс, что и даты в тесте.
const timezoneId = "Europe/Moscow"

async function confirmationCode(contact, type) {
  const inbox = process.env.TUTORFLOW_TEST_INBOX
  if (type === "email") {
    const mailpit = process.env.TUTORFLOW_TEST_MAILPIT
    let code
    await expect.poll(async () => {
      const result = await fetch(mailpit + "/api/v1/messages")
      if (!result.ok) return undefined
      const listing = await result.json()
      const message = listing.messages.find(item => item.To.some(to => to.Address === contact))
      if (!message) return undefined
      const detail = await fetch(mailpit + "/api/v1/message/" + message.ID)
      if (!detail.ok) return undefined
      code = (await detail.json()).Text.match(/\b[0-9]{8}\b/)?.[0]
      return code
    }, { timeout: 8000 }).toMatch(/^\d{8}$/)
    return code
  }
  let code
  await expect.poll(async () => {
    const files = await Promise.all((await readdir(inbox)).map(async file => {
      const path = join(inbox, file)
      const [address, value] = (await readFile(path, "utf8")).trim().split("\n")
      return { address, value, time: (await stat(path)).mtimeMs }
    }))
    code = files.filter(file => file.address === `phone: ${contact}`)
      .sort((left, right) => right.time - left.time)[0]?.value
    return code
  }, { timeout: 8000 }).toMatch(/^\d{8}$/)
  return code
}

/** Форма регистрации — на главной (#signup) и на странице приглашения. */
async function register(scope, contact, type, name) {
  const label = type === "email" ? "Почта" : "Телефон"
  await scope.getByRole("button", { name: label, exact: true }).click()
  await scope.getByLabel(label, { exact: true }).fill(contact)
  await scope.getByRole("checkbox").check()
  await scope.getByRole("button", { name: "Получить код" }).click()
  // Полный код в первое поле — как автозаполнение из письма или SMS.
  await scope.getByLabel("Цифра 1").fill(await confirmationCode(contact, type))
  await scope.getByLabel("Как к вам обращаться").fill(name)
  await scope.getByLabel("Пароль", { exact: true }).fill(password)
  await scope.getByRole("button", { name: "Создать аккаунт" }).click()
}

async function registerTeacher(page, contact, name) {
  await page.goto("/")
  await register(page.locator("#signup"), contact, "email", name)
  await page.getByRole("button", { name: "Включить кабинет и перейти" }).click()
  await expect(page.getByRole("heading", { name: `Добрый день, ${name.split(" ")[0]}` })).toBeVisible()
}

async function invitation(teacher, purpose) {
  await teacher.getByRole("button", { name: purpose }).first().click()
  const dialog = teacher.getByRole("dialog")
  const link = dialog.getByLabel("Ссылка для приглашения")
  await expect(link).toHaveValue(/\/invite#token=/)
  await dialog.getByRole("button", { name: "Скопировать ссылку" }).click()
  await expect(teacher.getByText("Ссылка скопирована").first()).toBeVisible()
  const url = await link.inputValue()
  expect(await teacher.evaluate(() => navigator.clipboard.readText())).toBe(url)
  await dialog.getByRole("button", { name: "Готово" }).click()
  await expect(dialog).toHaveCount(0)
  return url
}

const email = () => `browser-${randomUUID()}@example.org`

test("репетитор, ученик и родитель проходят приглашения, кабинеты, урок и отзыв", async ({ browser }) => {
  const baseURL = process.env.TUTORFLOW_TEST_WEB_URL
  const teacherContext = await browser.newContext({ baseURL, timezoneId, permissions: ["clipboard-read", "clipboard-write"] })
  const learnerContext = await browser.newContext({ baseURL, timezoneId, viewport: { width: 390, height: 844 }, isMobile: true })
  const parentContext = await browser.newContext({ baseURL, timezoneId })
  const outsiderContext = await browser.newContext({ baseURL, timezoneId })
  try {
    const teacher = await teacherContext.newPage()
    await registerTeacher(teacher, email(), "Анна Репетитор")
    await teacher.getByRole("link", { name: "Ученики" }).click()
    await expect(teacher.getByRole("heading", { name: "Ученики" })).toBeVisible()

    // Ученик принимает приглашение сам — регистрация прямо на странице ссылки.
    const learnerUrl = await invitation(teacher, "Пригласить ученика")
    const learner = await learnerContext.newPage()
    await learner.goto(learnerUrl)
    await expect(learner.getByRole("heading", { name: "Приглашение для ученика" })).toBeVisible()
    const learnerContact = email()
    await register(learner, learnerContact, "email", "Илья Ученик")
    await learner.getByRole("button", { name: "Принять приглашение" }).click()
    await expect(learner.getByRole("heading", { name: "Илья Ученик" })).toBeVisible()
    expect(new URL(learner.url()).hash).toBe("")
    expect(await learner.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
    await expect(learner.getByText("Анна Репетитор")).toBeVisible()
    await learner.getByRole("button", { name: "Выйти" }).click()
    await learner.waitForURL(url => new URL(url).pathname === "/")
    // На телефоне шапка свёрнута — форму входа открывает якорь, как после выхода из кабинета.
    await learner.goto("/#login")
    const signup = learner.locator("#signup")
    await signup.getByLabel("Почта или телефон").fill(learnerContact)
    await signup.getByLabel("Пароль", { exact: true }).fill(password)
    await signup.getByRole("button", { name: "Войти", exact: true }).click()
    // Без кабинета репетитора вход ведёт в кабинет ученика.
    await expect(learner.getByRole("link", { name: "Ученик", exact: true })).toBeVisible()
    await expect(learner.getByRole("link", { name: /Илья Ученик/ })).toBeVisible()

    // Родитель: регистрация по телефону и две карточки детей.
    const parent = await parentContext.newPage()
    await parent.goto(await invitation(teacher, "Пригласить родителя"))
    await expect(parent.getByRole("heading", { name: "Приглашение для родителя" })).toBeVisible()
    await register(parent, `+7998${randomInt(1_000_000, 10_000_000)}`, "phone", "Ольга Родитель")
    await parent.getByLabel("Имя ребёнка").fill("Маша")
    await parent.getByRole("button", { name: "Принять приглашение" }).click()
    await expect(parent.getByRole("heading", { name: "Маша" })).toBeVisible()
    const firstCardUrl = parent.url()

    await parent.goto(await invitation(teacher, "Пригласить родителя"))
    await parent.getByLabel("Имя ребёнка").fill("Петя")
    await parent.getByRole("button", { name: "Принять приглашение" }).click()
    await expect(parent.getByRole("heading", { name: "Петя" })).toBeVisible()
    await parent.getByRole("link", { name: "Родитель", exact: true }).click()
    await expect(parent.getByRole("link", { name: /Маша/ })).toBeVisible()
    await expect(parent.getByRole("link", { name: /Петя/ })).toBeVisible()

    // Чужой аккаунт не видит карточку ни через API, ни по ссылке.
    const outsider = await outsiderContext.newPage()
    await registerTeacher(outsider, email(), "Другой аккаунт")
    const cardId = new URL(firstCardUrl).searchParams.get("card")
    expect((await outsider.request.get(`/api/v1/parent/student-cards/${cardId}`)).status()).toBe(404)
    await outsider.goto(firstCardUrl)
    await expect(outsider.getByRole("alert")).toContainText("Карточка недоступна")
    await expect(outsider.getByRole("heading", { name: "Маша" })).toHaveCount(0)

    // Урок ученику, принявшему приглашение: создать на завтра, отменить и восстановить.
    await teacher.getByRole("link", { name: "Расписание" }).click()
    await teacher.getByRole("button", { name: "Урок", exact: true }).first().click()
    const sheet = teacher.getByRole("dialog")
    const tomorrow = await teacher.evaluate(zone =>
      new Intl.DateTimeFormat("en-CA", { timeZone: zone, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(Date.now() + 86_400_000)), timezoneId)
    await sheet.getByLabel("Тема урока").fill("Квадратные уравнения")
    await sheet.getByLabel("Дата").fill(tomorrow)
    await sheet.getByLabel("Время").fill("16:00")
    await sheet.getByRole("button", { name: "Поставить урок" }).click()
    await expect(teacher.getByText("Урок поставлен").first()).toBeVisible()
    await teacher.getByRole("button", { name: /Илья Ученик · 16:00–17:00/ }).click()
    const lesson = teacher.getByRole("dialog")
    await lesson.getByRole("button", { name: "Отменить урок" }).click()
    await lesson.getByLabel(/Причина отмены/).fill("Каникулы")
    await lesson.getByRole("button", { name: "Отменить урок" }).click()
    await expect(lesson.getByText("Отменён", { exact: true })).toBeVisible()
    await lesson.getByRole("button", { name: "Восстановить урок" }).click()
    await expect(lesson.getByText("Запланирован", { exact: true })).toBeVisible()
    await teacher.keyboard.press("Escape")

    // Отзыв родительского доступа закрывает карточку по старой ссылке.
    await teacher.getByRole("link", { name: "Ученики" }).click()
    await teacher.getByRole("button", { name: "Открыть карточку: Маша" }).click()
    await expect(teacher.getByText("Ольга Родитель")).toBeVisible()
    await teacher.getByRole("button", { name: "Отозвать доступ" }).click()
    await expect(teacher.getByText("Доступ отозван", { exact: true }).first()).toBeVisible()
    await parent.goto(firstCardUrl)
    await expect(parent.getByRole("alert")).toContainText("Карточка недоступна")
    await parent.getByRole("link", { name: "Родитель", exact: true }).click()
    await expect(parent.getByRole("link", { name: /Петя/ })).toBeVisible()
    await expect(parent.getByRole("link", { name: /Маша/ })).toHaveCount(0)
  } finally {
    await Promise.all([teacherContext, learnerContext, parentContext, outsiderContext].map(context => context.close()))
  }
})
