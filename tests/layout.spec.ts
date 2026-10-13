import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'

const VIEWPORTS = [
  { width: 1440, height: 900 },
  { width: 1920, height: 1080 },
  { width: 2560, height: 1440 },
  { width: 3840, height: 2160 },
  { width: 390, height: 844 },
  { width: 320, height: 740 },
]

async function bounds(page: Page, selector: string) {
  const box = await page.locator(selector).boundingBox()
  expect(box, `${selector} should have a visible layout box`).not.toBeNull()
  return box!
}

async function expectNoOverflow(page: Page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  const main = await bounds(page, '.main-content')
  const footer = await bounds(page, '.footer')
  expect(footer.y).toBeGreaterThanOrEqual(main.y + main.height)
}

for (const viewport of VIEWPORTS) {
  test(`layout at ${viewport.width}×${viewport.height}: edge-aligned regions, centred typing, and flowing results`, async ({ page }, testInfo) => {
    await page.setViewportSize(viewport)
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await page.clock.install({ time: new Date('2026-10-13T12:00:00Z') })
    await page.clock.pauseAt(new Date('2026-10-13T12:00:01Z'))
    await page.addInitScript(() => {
      localStorage.setItem('justtype.bests.v1', JSON.stringify({
        'time:15': { wpm: 72, accuracy: 98, date: '2026-10-13T12:00:00Z' },
      }))
    })
    await page.goto('/')
    await page.evaluate(() => document.fonts.ready)
    await expect(page.getByRole('textbox')).toBeFocused()
    await expectNoOverflow(page)

    const header = await bounds(page, '.header')
    const footer = await bounds(page, '.footer')
    const brand = await bounds(page, '.brand')
    const theme = await bounds(page, '.header .icon-button')
    const footerLeft = await bounds(page, '.footer > span:first-child')
    const footerRight = await bounds(page, '.footer > span:last-child')
    const main = await bounds(page, '.main-content')
    expect(header.x).toBe(0)
    expect(header.width).toBe(viewport.width)
    expect(footer.x).toBe(0)
    expect(footer.width).toBe(viewport.width)
    expect(Math.abs(footerLeft.x - brand.x)).toBeLessThan(1)
    expect(Math.abs(main.x + main.width / 2 - viewport.width / 2)).toBeLessThan(1)
    for (const selector of ['.mode-selector', '.virtual-keyboard', '.restart-controls']) {
      const box = await bounds(page, selector)
      expect(Math.abs(box.x + box.width / 2 - viewport.width / 2)).toBeLessThan(1)
    }
    if (viewport.width >= 1440) {
      expect(brand.x).toBeGreaterThanOrEqual(32)
      expect(brand.x).toBeLessThanOrEqual(48)
      expect(Math.abs(footerRight.x + footerRight.width - theme.x - theme.width)).toBeLessThan(1)
      expect(main.width).toBeGreaterThanOrEqual(950)
      expect(main.width).toBeLessThanOrEqual(1100)
      const bottomGap = viewport.height - footer.y - footer.height
      expect(bottomGap).toBeGreaterThanOrEqual(16)
      expect(bottomGap).toBeLessThanOrEqual(48)
    }
    if (viewport.width >= 2560) {
      const size = await page.locator('.typing-viewport').evaluate((element) => parseFloat(getComputedStyle(element).fontSize))
      expect(size).toBeGreaterThanOrEqual(30)
      expect(size).toBeLessThanOrEqual(34)
    }
    await page.screenshot({ path: testInfo.outputPath('typing-layout.png'), fullPage: true })

    // Check the actual caret after multiple lines wrap at each font size.
    const target = (await page.getByTestId('typing-text').getAttribute('data-target'))!
    const prefix = target.split(' ').slice(0, 25).join(' ') + ' '
    await page.getByRole('textbox').fill(prefix)
    await expect.poll(async () => {
      const caret = await bounds(page, '.caret')
      const current = await bounds(page, `[data-position="${prefix.length}"]`)
      return Math.abs(caret.x - current.x)
    }).toBeLessThan(1)
    const caret = await bounds(page, '.caret')
    const textViewport = await bounds(page, '.typing-viewport')
    expect(caret.y).toBeGreaterThanOrEqual(textViewport.y)
    expect(caret.y + caret.height).toBeLessThanOrEqual(textViewport.y + textViewport.height)

    await page.getByRole('button', { name: 'words', exact: true }).click()
    await page.getByRole('button', { name: '10 words', exact: true }).click()
    const words = (await page.getByTestId('typing-text').getAttribute('data-target'))!
    await page.getByRole('textbox').fill(words.slice(0, -1))
    await page.clock.runFor(5000)
    await page.keyboard.type(words.slice(-1))
    await expect(page.getByTestId('results')).toBeVisible()
    await expectNoOverflow(page)
    await page.screenshot({ path: testInfo.outputPath('results-layout.png'), fullPage: true })
    await page.getByText('How these numbers work', { exact: true }).click()
    await expectNoOverflow(page)
  })
}
