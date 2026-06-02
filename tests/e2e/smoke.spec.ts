import { test, expect } from '@playwright/test'

test('home page loads', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'Таблица' })).toBeVisible({ timeout: 30_000 })
})

test('excel health proxy responds', async ({ request }) => {
  const res = await request.get('/api/excel/health')
  expect(res.status()).toBeLessThan(500)
  const body = await res.json()
  expect(body).toHaveProperty('status')
})
