import { expect, test } from '@playwright/test'

test('口语接入内容库并可搜索复述素材', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name:'口语', exact:true }).click()
  await page.getByRole('button', { name:'国内源', exact:true }).click()
  await page.getByLabel('搜索口语素材').fill('Explain the Circuit')
  await expect(page.locator('.speaking-grid article')).toHaveCount(1)
  await page.getByRole('button', { name:/开始练习/ }).click()
  await expect(page.getByRole('heading', { name:'Explain the Circuit Without Hiding Behind Jargon' })).toBeVisible()
  await page.getByRole('button', { name:'完成并保存记录' }).click()
  await page.getByRole('button', { name:'返回口语专栏' }).click()
  await expect(page.getByLabel('搜索口语素材')).toBeVisible()
})

test('逐题核对锁定作答，答题卡显示进度', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name:'训练', exact:true }).click()
  await page.getByLabel('作答模式').selectOption('practice')
  await page.getByRole('button', { name:/开始训练/ }).first().click()
  const question = page.locator('.question-card').first()
  await expect(question.locator('.explanation')).toHaveCount(0)
  await question.locator('.option-list button').first().click()
  await question.getByRole('button', { name:'核对本题答案' }).click()
  await expect(question.locator('.explanation')).toBeVisible()
  await expect(question.locator('.option-list button').first()).toBeDisabled()
  await expect(page.getByRole('navigation', { name:'答题卡' })).toContainText('已答 1/')
})
