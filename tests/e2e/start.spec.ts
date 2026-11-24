import { expect, test } from '@playwright/test'

test('показывает стартовую страницу TutorFlow', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'TutorFlow' })).toBeVisible()
})
