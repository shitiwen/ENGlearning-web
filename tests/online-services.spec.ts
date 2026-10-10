import { expect, test } from '@playwright/test'

test('更新内容后可以站内阅读，重复更新不重复添加', async ({ page }) => {
  await page.route('**/api/content-feed', (route) => route.fulfill({ contentType:'application/json', body:JSON.stringify({ items:[{ title:'RSS Test Summary', creator:'Official source', publisher:'Official source', sourceUrl:'https://example.org/summary', publishedAt:'2026-10-08T08:00:00Z', kind:'news', accessScope:'china', estimatedMinutes:2, topics:['科技'], text:'Official RSS summary — not the full article.\n\nA useful English learning summary.' }] }) }))
  await page.goto('/')
  await page.getByRole('button', { name:'内容', exact:true }).click()
  await expect(page.getByText('RSS Test Summary', { exact:true })).toBeVisible()
  await expect(page.getByText('RSS Test Summary', { exact:true })).toHaveCount(1)
  await page.getByText('更多操作', { exact:true }).click()
  await page.getByRole('button', { name:'更新官方源' }).click()
  await expect(page.getByText(/新增 0 条/)).toBeVisible()
  await page.getByText('RSS Test Summary', { exact:true }).locator('..').getByRole('button', { name:'开始阅读' }).click()
  await expect(page.locator('.article-text')).toContainText('not the full article')
})

test('题包刷新走真实本地接口且失败时内置训练仍能启动', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name:'训练', exact:true }).click()
  await page.getByRole('button', { name:'刷新审核题包' }).click()
  await expect(page.getByText(/已更新：已检查本站/)).toBeVisible()
  await page.route('**/api/practice-feed', (route) => route.fulfill({ contentType:'text/html', body:'<!doctype html><html></html>' }))
  await page.getByRole('button', { name:'刷新审核题包' }).click()
  await expect(page.getByText(/题包更新失败.*在线服务暂不可用/)).toBeVisible()
  await page.getByRole('button', { name:/开始训练/ }).first().click()
  await expect(page.locator('.question-card').first()).toBeVisible()
})

test('AI 错误显示中文，自己的 Key 保存在当前设备', async ({ page }) => {
  await page.route('**/api/ai/test', (route) => route.fulfill({ contentType:'text/html', body:'<!doctype html>' }))
  await page.goto('/')
  if (!await page.getByRole('button', { name:'AI 接口', exact:true }).isVisible()) await page.locator('.nav-more > summary').click()
  await page.getByRole('button', { name:'AI 接口', exact:true }).click()
  await page.getByLabel('API Key').fill('sk-e2e-test-key-only')
  await page.getByRole('button', { name:'保存到当前设备' }).click()
  await page.getByRole('button', { name:'测试连接' }).click()
  await expect(page.getByText(/在线服务暂不可用/)).toBeVisible()
  await expect(page.getByText(/Unexpected token/)).toHaveCount(0)
})
