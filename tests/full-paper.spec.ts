import { expect,test } from '@playwright/test'

// 原创空白PDF夹具只验证阅读器，不把测试题冒充真题。
function fixturePdf() {
  const objects = ['<< /Type /Catalog /Pages 2 0 R >>',`<< /Type /Pages /Count 9 /Kids [${Array.from({length:9},(_,i) => `${3+i*2} 0 R`).join(' ')}] >>`]
  for (let i=0;i<9;i++) {
    objects.push(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents ${4+i*2} 0 R >>`)
    const stream = '0.8 g 50 600 400 100 re f\n'
    objects.push(`<< /Length ${stream.length} >>\nstream\n${stream}endstream`)
  }
  let pdf = '%PDF-1.7\n'
  const offsets = [0]
  objects.forEach((object,i) => {offsets.push(pdf.length);pdf+=`${i+1} 0 obj\n${object}\nendobj\n`})
  const start = pdf.length
  pdf+=`xref\n0 ${offsets.length}\n0000000000 65535 f \n${offsets.slice(1).map((offset) => `${String(offset).padStart(10,'0')} 00000 n \n`).join('')}trailer\n<< /Size ${offsets.length} /Root 1 0 R >>\nstartxref\n${start}\n%%EOF`
  return Buffer.from(pdf)
}

test('真题默认进入专项，整套练习可读原卷、恢复草稿、交卷并进入专项错题',async ({page}) => {
  await page.route('**/api/past-paper-material?*',async (route) => {await route.fulfill({status:200,contentType:'application/pdf',body:fixturePdf()})})
  await page.goto('/')
  await page.getByRole('button',{name:'训练',exact:true}).click()
  await expect(page.getByRole('navigation',{name:'选择专项题型'})).toBeVisible()
  await expect(page.getByText(/筛选与作答设置/)).toBeVisible()
  await expect(page.locator('.training-card').first()).toContainText('2026年6月四级 · 第1套')
  await page.getByRole('button',{name:'整套真题',exact:true}).click()
  await expect(page.locator('.training-card')).toHaveCount(39)
  await expect(page.locator('.training-card').first()).toContainText('2026年6月四级 · 第1套')
  await page.locator('.training-card').filter({hasText:'2024年6月四级 · 第1套'}).getByRole('button',{name:/开始训练/}).click()
  await expect(page.getByLabel('写作作答')).toBeVisible()
  await expect(page.getByRole('status')).toHaveCount(0)
  await expect(page.locator('.past-paper-reader canvas')).toHaveJSProperty('height',1263)
  await page.getByLabel('写作作答').fill('My full paper essay draft.')
  await page.getByRole('button',{name:'翻译',exact:true}).click()
  await page.getByLabel('翻译作答').fill('My full paper translation draft.')
  await page.getByRole('button',{name:'选词填空',exact:true}).click()
  await page.locator('.question-card').first().getByRole('button',{name:'D 原卷选项 D',exact:true}).click()
  await page.getByRole('button',{name:'← 保存并退出'}).click()
  await page.getByRole('button',{name:'专项训练',exact:true}).click()
  await page.getByRole('button',{name:'继续',exact:true}).click()
  await expect(page.getByLabel('写作作答')).toHaveValue('My full paper essay draft.')
  await page.getByRole('button',{name:'继续',exact:true}).click()
  await page.getByRole('button',{name:'翻译',exact:true}).click()
  await expect(page.getByLabel('翻译作答')).toHaveValue('My full paper translation draft.')
  await page.getByRole('button',{name:'阅读理解',exact:true}).click()
  await expect(page.locator('.question-card')).toHaveCount(10)
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  await page.screenshot({path:`test-results/full-paper-${test.info().project.name}.png`,fullPage:true})
  await page.getByRole('button',{name:/提交并判分/}).click()
  await expect(page.getByRole('heading',{name:'1/55 题正确 · 2%'})).toBeVisible()
  await page.getByText('查看原答案资料（对应卷型）',{exact:true}).click()
  await expect(page.getByRole('region',{name:'原答案资料'})).toBeVisible()
  await page.getByRole('button',{name:'← 返回训练列表'}).click()
  await page.getByRole('button',{name:/错题巩固 ·/}).click()
  await expect(page.locator('.training-review-list article')).toHaveCount(4)
  await expect(page.locator('.training-review-list')).toContainText('选词填空 · 9 道待巩固')
})

test('原卷读取失败不清空作答，AI缺配置时保留本地推荐',async ({page}) => {
  await page.route('**/api/past-paper-material?*',async (route) => {await route.fulfill({status:502,json:{error:'源暂时不可用'}})})
  await page.goto('/')
  await page.getByRole('button',{name:'训练',exact:true}).click()
  await page.getByText('根据错题继续练 / AI 选题',{exact:true}).click()
  await page.getByRole('button',{name:'AI 按错题选题'}).click()
  await expect(page.getByRole('alert')).toContainText('仍可使用本地错题推荐')
  await expect(page.locator('.training-recommendations>div button')).toHaveCount(3)
  await page.getByRole('button',{name:'整套真题',exact:true}).click()
  await page.getByRole('button',{name:/开始训练/}).first().click()
  await page.getByLabel('写作作答').fill('My answer survives network errors.')
  await expect(page.getByRole('alert')).toContainText('已填写答案仍保留')
  await page.getByRole('button',{name:'重试读取'}).click()
  await expect(page.getByLabel('写作作答')).toHaveValue('My answer survives network errors.')
})

test('专项入口首屏可见，考研近六年每套直接作答',async ({page}) => {
  await page.route('**/api/past-paper-material?*',route => route.fulfill({status:200,contentType:'application/pdf',body:fixturePdf()}))
  await page.goto('/')
  await page.getByRole('button',{name:'训练',exact:true}).click()
  await page.screenshot({path:`test-results/training-entry-${test.info().project.name}.png`})
  await expect(page.locator('.training-card').first().getByRole('button',{name:/开始训练/})).toBeInViewport()
  await page.getByRole('button',{name:'考研一',exact:true}).click()
  await page.getByRole('navigation',{name:'选择专项题型'}).getByRole('button',{name:'完形填空',exact:true}).click()
  await expect(page.locator('.training-card')).toHaveCount(6)
  await page.getByRole('button',{name:'整套真题',exact:true}).click()
  await expect(page.locator('.training-card')).toHaveCount(6)
  await page.getByLabel('真题年份').selectOption('2025')
  await expect(page.locator('.training-card')).toHaveCount(1)
  await page.getByRole('button',{name:/开始训练/}).click()
  await expect(page.getByLabel('写作作答')).toBeVisible()
  await expect(page.getByRole('navigation',{name:'整卷分区'}).getByRole('button',{name:'听力',exact:true})).toHaveCount(0)
  await page.getByRole('button',{name:'完形填空',exact:true}).click()
  await expect(page.locator('.question-card')).toHaveCount(20)
  await page.getByRole('button',{name:'新题型',exact:true}).click()
  await expect(page.locator('.question-card')).toHaveCount(5)
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
})
