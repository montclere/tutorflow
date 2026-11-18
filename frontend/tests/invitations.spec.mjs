import { expect, test } from "@playwright/test"
import { readFile, readdir, stat } from "node:fs/promises"
import { join } from "node:path"
import { randomInt, randomUUID } from "node:crypto"

const password = "тестовая фраза для входа 2026"

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

async function register(page, contact, type, name) {
  await page.getByRole("button", { name: "Создать аккаунт", exact: true }).click()
  await expect(page.getByRole("button", { name: "Получить код" })).toBeVisible()
  await page.getByLabel("Способ подтверждения").selectOption(type)
  await page.getByLabel("Контакт", { exact: true }).fill(contact)
  await page.getByRole("button", { name: "Получить код" }).click()
  await expect(page.getByLabel("Код подтверждения")).toBeVisible()
  await page.getByLabel("Код подтверждения").fill(await confirmationCode(contact, type))
  await page.getByLabel("Имя в профиле").fill(name)
  await page.getByLabel("Пароль", { exact: true }).fill(password)
  await page.getByRole("button", { name: "Завершить регистрацию" }).click()
}

async function invitation(teacher, purpose) {
  const link = teacher.getByLabel("Ссылка для приглашения")
  const previous = (await link.count()) ? await link.inputValue() : ""
  await teacher.getByRole("button", { name: purpose }).click()
  await expect(link).not.toHaveValue(previous)
  await expect(link).toHaveValue(/\/invite#token=/)
  await teacher.getByRole("button", { name: "Скопировать ссылку" }).click()
  await expect(teacher.getByRole("status")).toContainText("Ссылка скопирована")
  const url = await link.inputValue()
  expect(await teacher.evaluate(() => navigator.clipboard.readText())).toBe(url)
  return url
}

const email = () => `browser-${randomUUID()}@example.org`

test("репетитор, ученик и родитель проходят приглашения, кабинеты и отзыв", async ({ browser }) => {
  const baseURL = process.env.TUTORFLOW_TEST_WEB_URL
  const teacherContext = await browser.newContext({ baseURL, permissions: ["clipboard-read", "clipboard-write"] })
  const learnerContext = await browser.newContext({ baseURL, viewport: { width: 390, height: 844 }, isMobile: true })
  const parentContext = await browser.newContext({ baseURL })
  const outsiderContext = await browser.newContext({ baseURL })
  try {
    const teacher = await teacherContext.newPage()
    await teacher.goto("/")
    await expect(teacher.getByRole("link", { name: "TutorFlow" })).toBeVisible()
    await teacher.keyboard.press("Tab")
    await expect(teacher.getByRole("link", { name: "TutorFlow" })).toBeFocused()
    await teacher.getByRole("link", { name: "Начать как репетитор" }).click()
    await register(teacher, email(), "email", "Анна Репетитор")
    await teacher.getByRole("link", { name: "Профиль" }).click()
    await expect(teacher.getByLabel("Имя в профиле")).toHaveValue("Анна Репетитор")
    await teacher.getByRole("link", { name: "Обзор" }).click()
    await teacher.getByRole("button", { name: "Включить кабинет репетитора" }).click()
    await expect(teacher.getByRole("heading", { name: "Карточки учеников" })).toBeVisible()

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
    await learner.getByRole("link", { name: "Войти", exact: true }).click()
    await learner.getByLabel("Логин — почта или телефон").fill(learnerContact)
    await learner.getByLabel("Пароль", { exact: true }).fill(password)
    await learner.getByRole("button", { name: "Войти", exact: true }).click()
    await learner.getByRole("link", { name: "Ученик" }).click()
    await expect(learner.getByRole("link", { name: "Илья Ученик" })).toBeVisible()

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
    await parent.getByRole("link", { name: "Родитель" }).click()
    await expect(parent.getByRole("link", { name: "Маша" })).toBeVisible()
    await expect(parent.getByRole("link", { name: "Петя" })).toBeVisible()

    const outsider = await outsiderContext.newPage()
    await outsider.goto("/")
    await outsider.getByRole("link", { name: "Начать как репетитор" }).click()
    await register(outsider, email(), "email", "Другой аккаунт")
    await expect(outsider.getByRole("heading", { name: "Обзор" })).toBeVisible()
    const cardId = new URL(firstCardUrl).pathname.split("/").at(-1)
    expect((await outsider.request.get(`/api/v1/parent/student-cards/${cardId}`)).status()).toBe(404)
    await outsider.goto(firstCardUrl)
    await expect(outsider.getByRole("alert")).toContainText("Карточка недоступна")
    await expect(outsider.getByRole("heading", { name: "Маша" })).toHaveCount(0)

    await teacher.reload()
    await teacher.getByRole("link", { name: "Маша" }).click()
    await expect(teacher.getByText("Ольга Родитель")).toBeVisible()
    await teacher.getByRole("button", { name: "Отозвать доступ" }).click()
    await expect(teacher.getByText("Доступ отозван", { exact: true })).toBeVisible()
    await parent.goto(firstCardUrl)
    await expect(parent.getByRole("alert")).toContainText("Карточка недоступна")
    await parent.getByRole("link", { name: "Родитель" }).click()
    await expect(parent.getByRole("link", { name: "Петя" })).toBeVisible()
    await expect(parent.getByRole("link", { name: "Маша" })).toHaveCount(0)
  } finally {
    await Promise.all([teacherContext, learnerContext, parentContext, outsiderContext].map(context => context.close()))
  }
})


test("логин и восстановление по тому же email либо телефону", async ({ browser }) => {
  for (const type of ["email", "phone"]) {
    const context = await browser.newContext({ baseURL: process.env.TUTORFLOW_TEST_WEB_URL })
    const old = await browser.newContext({ baseURL: process.env.TUTORFLOW_TEST_WEB_URL })
    try {
      const contact = type === "email" ? email() : `+7997${randomInt(1_000_000, 10_000_000)}`
      const page = await context.newPage()
      await page.goto("/start")
      await register(page, contact, type, "Тест восстановления")
      await expect(page.getByRole("heading", { name: "Обзор" })).toBeVisible()
      await page.getByRole("button", { name: "Выйти" }).click()
      await page.goto("/login")
      await page.getByLabel("Логин — почта или телефон").fill(contact)
      await page.getByLabel("Пароль", { exact: true }).fill(password)
      await page.getByRole("button", { name: "Войти", exact: true }).click()
      await expect(page.getByRole("heading", { name: "Обзор" })).toBeVisible()
      const previousSession = await old.newPage()
      await previousSession.goto("/login")
      await previousSession.getByLabel("Логин — почта или телефон").fill(contact)
      await previousSession.getByLabel("Пароль", { exact: true }).fill(password)
      await previousSession.getByRole("button", { name: "Войти", exact: true }).click()
      await expect(previousSession.getByRole("heading", { name: "Обзор" })).toBeVisible()
      await page.getByRole("button", { name: "Выйти" }).click()
      await page.goto("/login")
      await page.getByRole("button", { name: "Восстановить пароль" }).click()
      await page.getByLabel("Логин — почта или телефон").fill(contact)
      const previous = await confirmationCode(contact, type)
      await page.getByRole("button", { name: "Получить код" }).click()
      await expect(page.getByLabel("Код подтверждения")).toBeVisible()
      let code
      await expect.poll(async () => {
        code = await confirmationCode(contact, type)
        return code
      }).not.toBe(previous)
      const updated = "новая фраза для входа после сброса"
      await page.getByLabel("Код подтверждения").fill(code === "00000000" ? "00000001" : "00000000")
      await page.getByLabel("Пароль", { exact: true }).fill(updated)
      await page.getByRole("button", { name: "Сохранить новый пароль" }).click()
      await expect(page.getByRole("alert")).toContainText("Код неверный")
      await page.getByLabel("Код подтверждения").fill(code)
      await page.getByRole("button", { name: "Сохранить новый пароль" }).click()
      await expect(page.getByRole("status")).toContainText("Пароль обновлён")
      expect((await old.request.get("/api/v1/me")).status()).toBe(403)
      expect((await page.request.get("/api/v1/me")).status()).toBe(403)
      await page.getByLabel("Логин — почта или телефон").fill(contact)
      await page.getByLabel("Пароль", { exact: true }).fill(password)
      await page.getByRole("button", { name: "Войти", exact: true }).click()
      await expect(page.getByRole("alert")).toContainText("Не удалось войти")
      await page.getByLabel("Пароль", { exact: true }).fill(updated)
      await page.getByRole("button", { name: "Войти", exact: true }).click()
      await expect(page.getByRole("heading", { name: "Обзор" })).toBeVisible()
    } finally {
      await Promise.all([context.close(), old.close()])
    }
  }
})

test("интерфейс безопасно обрабатывает ответ прокси вне API", async ({ page }) => {
  await page.route("**/api/v1/me", route => route.fulfill({
    status: 502,
    contentType: "text/html",
    body: "<h1>upstream-private-text</h1>",
  }))
  await page.goto("/")
  await expect(page.getByRole("alert")).toContainText("Сервис временно недоступен")
  await expect(page.getByText("upstream-private-text")).toHaveCount(0)
})

test("серийный урок доступен ученику и переносится после согласия", async ({ browser }) => {
  const baseURL = process.env.TUTORFLOW_TEST_WEB_URL
  const teacherContext = await browser.newContext({ baseURL, timezoneId: "UTC" })
  const studentContext = await browser.newContext({ baseURL, timezoneId: "UTC", viewport: { width: 390, height: 844 }, isMobile: true })
  const parentContext = await browser.newContext({ baseURL, timezoneId: "UTC" })
  try {
    const teacher = await teacherContext.newPage()
    await teacher.goto("/")
    await teacher.getByRole("link", { name: "Начать как репетитор" }).click()
    await register(teacher, email(), "email", "Репетитор расписания")
    await teacher.getByRole("button", { name: "Включить кабинет репетитора" }).click()
    await teacher.getByRole("button", { name: "Пригласить ученика" }).click()
    const invite = teacher.getByLabel("Ссылка для приглашения")
    await expect(invite).toHaveValue(/\/invite#token=/)
    const student = await studentContext.newPage()
    await student.goto(await invite.inputValue())
    await register(student, email(), "email", "Ученик расписания")
    await student.getByRole("button", { name: "Принять приглашение" }).click()
    await expect(student.getByRole("heading", { name: "Ученик расписания" })).toBeVisible()

    await teacher.getByRole("link", { name: "Расписание", exact: true }).click()
    await teacher.getByText("Назначить урок", { exact: true }).click()
    const create = teacher.locator('form[data-lesson-form="create"]')
    await create.getByLabel("Название").fill("Геометрия")
    await create.getByLabel("Повторять каждую неделю").check()
    await create.getByLabel("Количество уроков").fill("3")
    await create.getByRole("button", { name: "Назначить", exact: true }).click()
    await expect(create.getByRole("heading", { name: "Предпросмотр серии" })).toBeVisible()
    await create.getByRole("button", { name: "Назначить серию", exact: true }).click()
    await expect(teacher.getByRole("heading", { name: "Геометрия" })).toBeVisible()
    const teacherPath = new URL(teacher.url()).pathname
    await teacher.getByRole("link", { name: "Обзор" }).click()
    await teacher.getByRole("link", { name: "Ученик расписания" }).click()
    await teacher.getByRole("button", { name: "Пригласить к этой карточке" }).click()
    const parentLink = teacher.getByLabel("Ссылка для родителя")
    await expect(parentLink).toHaveValue(/\/parent-invite#token=/)
    const parent = await parentContext.newPage()
    await parent.goto(await parentLink.inputValue())
    await register(parent, email(), "email", "Родитель расписания")
    await parent.getByRole("button", { name: "Запросить доступ" }).click()
    await expect(parent.getByText("Заявка отправлена.", { exact: false })).toBeVisible()
    const parentPath = teacherPath.replace("/teacher/", "/parent/")
    await parent.goto(parentPath)
    await expect(parent.getByRole("alert")).toContainText("Карточка недоступна")
    await teacher.reload()
    await teacher.getByRole("button", { name: "Одобрить" }).click()
    await expect(teacher.getByText("Одобрено", { exact: true })).toBeVisible()
    await parent.goto(parentPath)
    await expect(parent.getByRole("heading", { name: "Геометрия" })).toBeVisible()
    await teacher.goto(teacherPath)
    await student.goto(teacherPath.replace("/teacher/", "/student/"))
    await expect(student.getByRole("heading", { name: "Геометрия" })).toBeVisible()
    expect(await student.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
    await student.getByText("Изменить расписание", { exact: true }).click()
    const proposed = new Date(Date.now() + 2 * 86400000).toISOString().slice(0, 16)
    await student.getByLabel("Новое время").fill(proposed)
    await student.getByRole("button", { name: "Предложить перенос" }).click()
    await expect(student.getByText("Ученик · Ожидает ответа")).toBeVisible()

    await teacher.reload()
    await teacher.getByRole("button", { name: "Принять перенос" }).click()
    await expect(teacher.getByText("Ученик · Согласован")).toBeVisible()
    await student.reload()
    await expect(student.getByText("Урок перенесён", { exact: true })).toBeVisible()
    await parent.reload()
    await expect(parent.getByText("Урок перенесён", { exact: true })).toBeVisible()
  } finally {
    await Promise.all([teacherContext.close(), studentContext.close(), parentContext.close()])
  }
})
