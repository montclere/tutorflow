import { expect, test } from "@playwright/test";

test("преподаватель регистрируется, настраивает профиль и создаёт личный блок", async ({
  page,
  request,
}) => {
  const email = `uc001-${Date.now()}@example.com`;
  const password = "длинный пароль преподавателя";

  await page.goto("/");
  await page.getByRole("button", { name: "Создать аккаунт" }).click();
  await page.getByRole("textbox", { name: "Электронная почта", exact: true }).fill(email);
  await page.getByRole("button", { name: "Получить код" }).click();
  await expect(page.getByLabel("Код подтверждения")).toBeVisible();
  let code = "";
  await expect
    .poll(async () => {
      const response = await request.get("http://127.0.0.1:8865/__e2e/code", {
        params: { kind: "email", contact: email },
      });
      if (!response.ok()) return "";
      code = ((await response.json()) as { code: string }).code;
      return code;
    })
    .toMatch(/^\d{8}$/);
  await page.getByLabel("Код подтверждения").fill(code);
  await page.getByLabel("Пароль").fill(password);
  await page.getByRole("button", { name: "Подтвердить", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Кабинет преподавателя" })).toBeVisible();

  await page.getByRole("button", { name: "Настроить профиль" }).click();
  await expect(page.getByLabel("Отображаемое имя")).toHaveValue("");
  await page.getByRole("button", { name: "Отмена", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Кабинет преподавателя" })).toBeVisible();
  await page.getByRole("button", { name: "Настроить профиль" }).click();
  await page.getByLabel("Отображаемое имя").fill("Анна");
  await page.getByRole("combobox", { name: /^Часовой пояс/ }).selectOption("Asia/Krasnoyarsk");
  await page.getByRole("button", { name: "Сохранить профиль" }).click();
  await expect(page.getByRole("status")).toHaveText("Профиль сохранён.");
  await page.getByLabel("Дата и время").fill("2026-12-01T10:00");
  await page.getByRole("button", { name: "Добавить личный блок" }).click();
  const blocks = page.getByRole("list", { name: "Созданные блоки" });
  await expect(blocks.locator("time")).toHaveAttribute("datetime", "2026-12-01T03:00:00Z");
  await expect(blocks).toContainText("Asia/Krasnoyarsk");

  await page.getByRole("button", { name: "Выйти" }).click();
  await page.getByRole("textbox", { name: "Электронная почта", exact: true }).fill(email);
  await page.getByLabel("Пароль").fill(password);
  await page.getByRole("button", { name: "Войти", exact: true }).click();
  await expect(page.getByText("Анна", { exact: true })).toBeVisible();
  await expect(blocks.locator("time")).toHaveAttribute("datetime", "2026-12-01T03:00:00Z");
});
