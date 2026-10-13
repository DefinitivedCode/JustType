import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'

async function target(page: Page): Promise<string> {
  return (await page.getByTestId('typing-text').getAttribute('data-target'))!
}
async function wordsMode(page: Page): Promise<string> {
  await page.getByRole('button', { name: 'words', exact: true }).click()
  await page.getByRole('button', { name: '10 words', exact: true }).click()
  return target(page)
}
async function finishWords(page: Page): Promise<string> {
  const text = await wordsMode(page)
  await page.keyboard.type(text.slice(0, -1))
  await page.clock.runFor(5000)
  await page.keyboard.type(text.slice(-1))
  await expect(page.getByTestId('results')).toBeVisible()
  return text
}

test.beforeEach(async ({ page }) => {
  await page.clock.install({ time: new Date('2026-10-13T12:00:00Z') })
  await page.clock.pauseAt(new Date('2026-10-13T12:00:01Z'))
  await page.goto('/')
})

test('loads a focused, ready test with the default mode and no console errors', async ({ page }, testInfo) => {
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  await expect(page.getByRole('button', { name: '15 seconds', exact: true })).toHaveAttribute('aria-pressed', 'true')
  await expect(page.getByRole('textbox', { name: 'Type the displayed words' })).toBeFocused()
  await expect(page.getByRole('region', { name: 'Typing test' })).toHaveAttribute('data-status', 'ready')
  await expect(page.locator('.keycap')).toHaveCount(28)
  await page.clock.runFor(600)
  await expect(page.getByTestId('progress')).toHaveText('15')
  await page.evaluate(() => document.fonts.ready)
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.screenshot({ path: testInfo.outputPath('landing.png'), fullPage: true })
  expect(errors).toEqual([])
})

test('first input starts the timer and live WPM uses actual elapsed time', async ({ page }) => {
  const text = await target(page)
  await page.keyboard.type(text[0]!)
  await expect(page.getByRole('region', { name: 'Typing test' })).toHaveAttribute('data-status', 'running')
  await expect(page.locator('.character.correct')).toHaveCount(1)
  await page.clock.runFor(1000)
  await expect(page.getByTestId('progress')).toHaveText('14')
  await expect(page.getByTestId('live-wpm')).toHaveText('12')
})

for (const seconds of [10, 15, 30, 60, 120]) {
  test(`${seconds}-second mode ends at its deadline, including a delayed clock`, async ({ page }) => {
    await page.getByRole('button', { name: `${seconds} seconds`, exact: true }).click()
    const text = await target(page)
    await page.keyboard.type(text[0]!)
    await page.clock.fastForward(seconds * 1000 + 250)
    await expect(page.getByTestId('results')).toBeVisible()
    await expect(page.getByTestId('result-wpm')).toHaveText(String(Math.round(12 / seconds)))
    await expect(page.locator('.result-test-info')).toContainText(`${seconds} seconds`)
    await expect(page.locator('.secondary-results')).toContainText(`${seconds}s`)
    await expect(page.getByTestId('replay')).toBeVisible()
    await expect(page.getByTestId('typing-text')).toHaveAttribute('data-target', text)
    await expect(page.getByRole('slider', { name: 'Replay timeline' })).toHaveAttribute('max', String(seconds * 1000))
  })
}

for (const count of [10, 25, 50, 100]) {
  test(`${count}-word mode generates and completes exactly its target`, async ({ page }) => {
    await page.getByRole('button', { name: 'words', exact: true }).click()
    await page.getByRole('button', { name: `${count} words`, exact: true }).click()
    const text = await target(page)
    expect(text.split(' ')).toHaveLength(count)
    await page.getByRole('textbox').fill(text.slice(0, -1))
    await expect(page.getByTestId('results')).toHaveCount(0)
    await page.clock.runFor(5000)
    await page.keyboard.type(text.slice(-1))
    await expect(page.getByTestId('results')).toBeVisible()
    await expect(page.locator('.result-test-info')).toContainText(`${count} words`)
    await expect(page.getByTestId('result-wpm')).toHaveText(String(Math.round(text.length * 2.4)))
    await expect(page.getByTestId('replay')).toBeVisible()
    await expect(page.getByTestId('typing-text')).toHaveAttribute('data-target', text)
    await expect(page.getByRole('slider', { name: 'Replay timeline' })).toHaveAttribute('max', '5000')
  })
}

test('correct keys flash blue and incorrect keys flash red, then release', async ({ page }) => {
  const text = await target(page)
  const correct = text[0]!
  await page.keyboard.type(correct)
  const correctKey = page.locator(`[data-key="${correct}"]`)
  await expect(correctKey).toHaveAttribute('data-tone', 'correct')
  await expect(correctKey).toHaveCSS('background-color', 'rgb(130, 172, 232)')
  const wrong = text[1] === 'x' ? 'z' : 'x'
  await page.keyboard.type(wrong)
  const wrongKey = page.locator(`[data-key="${wrong}"]`)
  await expect(wrongKey).toHaveAttribute('data-tone', 'incorrect')
  await expect(wrongKey).toHaveCSS('background-color', 'rgb(223, 131, 138)')
  await expect(page.locator('.character.incorrect')).toHaveCount(1)
  await page.clock.runFor(350)
  await expect(correctKey).toHaveAttribute('data-tone', 'neutral')
  await expect(wrongKey).toHaveAttribute('data-tone', 'neutral')
})

test('repeated keypress feedback restarts its release deadline', async ({ page }) => {
  const text = await target(page)
  const wrong = ['x', 'z', 'q'].find((letter) => letter !== text[0] && letter !== text[1])!
  await page.keyboard.type(wrong)
  await page.clock.runFor(100)
  await page.keyboard.type(wrong)
  await page.clock.runFor(100)
  await expect(page.locator(`[data-key="${wrong}"]`)).toHaveAttribute('data-tone', 'incorrect')
  await page.clock.runFor(100)
  await expect(page.locator(`[data-key="${wrong}"]`)).toHaveAttribute('data-tone', 'neutral')
})

test('space feedback uses the processed position and backspace corrects it', async ({ page }) => {
  const text = await target(page)
  const first = text.split(' ')[0]!
  await page.keyboard.type(first)
  await page.keyboard.press('Space')
  await expect(page.locator('[data-key="space"]')).toHaveAttribute('data-tone', 'correct')
  await page.keyboard.press('Space')
  await expect(page.locator('[data-key="space"]')).toHaveAttribute('data-tone', 'incorrect')
  await page.keyboard.press('Backspace')
  await expect(page.getByRole('textbox')).toHaveValue(`${first} `)
  await expect(page.locator('.character.incorrect')).toHaveCount(0)
})

test('results contain calculated historical accuracy, corrections, and recorded chart points', async ({ page }, testInfo) => {
  const text = await wordsMode(page)
  await page.keyboard.type(text[0] === 'x' ? 'z' : 'x')
  await page.clock.runFor(500)
  await page.keyboard.press('Backspace')
  await page.keyboard.type(text.slice(0, -1))
  await page.clock.runFor(4500)
  await page.keyboard.type(text.slice(-1))
  await expect(page.getByTestId('results')).toBeVisible()
  await expect(page.getByTestId('result-wpm')).toHaveText(String(Math.round(text.length * 2.4)))
  await expect(page.getByTestId('result-raw')).toHaveText(String(Math.round((text.length + 1) * 2.4)))
  await expect(page.getByTestId('result-accuracy')).toHaveText(`${Number((text.length / (text.length + 1) * 100).toFixed(1))}%`)
  await expect(page.locator('.character-count')).toHaveText(`${text.length} / 0`)
  await expect(page.locator('.secondary-results').filter({ hasText: 'corrections' })).toContainText('1errors removed')
  await expect(page.locator('.chart-error')).toHaveCount(1)
  await expect(page.locator('.performance-chart tbody tr')).toHaveCount(6)
  await page.evaluate(() => document.fonts.ready)
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.screenshot({ path: testInfo.outputPath('results.png'), fullPage: true })
})

test('Tab then Enter restarts during a test and resets all visible state', async ({ page }) => {
  const prior = await target(page)
  await page.keyboard.type(prior.slice(0, 5))
  await page.clock.runFor(1000)
  await page.keyboard.press('Tab')
  await expect(page.getByRole('button', { name: 'Restart test' })).toBeFocused()
  await page.keyboard.press('Enter')
  await expect(page.getByRole('textbox')).toBeFocused()
  await expect(page.getByRole('textbox')).toHaveValue('')
  await expect(page.getByTestId('progress')).toHaveText('15')
  await expect(page.getByTestId('live-wpm')).toHaveText('—')
  await expect(page.locator('[data-tone="correct"]')).toHaveCount(0)
  expect(await target(page)).not.toBe(prior)
})

test('Tab then Enter works from results and the Next test button also works', async ({ page }) => {
  await finishWords(page)
  await expect(page.getByTestId('results')).toBeFocused()
  await page.keyboard.press('Tab')
  await expect(page.getByRole('button', { name: 'Next test' })).toBeFocused()
  await page.keyboard.press('Enter')
  await expect(page.getByRole('textbox')).toBeFocused()
  await expect(page.getByRole('textbox')).toHaveValue('')
  await finishWords(page)
  await page.getByRole('button', { name: 'Next test' }).click()
  await expect(page.getByRole('textbox')).toBeFocused()
  await expect(page.getByTestId('results')).toHaveCount(0)
})

test('Escape and Shift Tab reach page controls without trapping keyboard navigation', async ({ page }) => {
  await page.keyboard.press('Escape')
  await expect(page.getByRole('button', { name: 'time', exact: true })).toBeFocused()
  await page.keyboard.press('Tab')
  await expect(page.getByRole('button', { name: 'words', exact: true })).toBeFocused()
  await page.getByRole('button', { name: '15 seconds', exact: true }).click()
  await page.keyboard.press('Shift+Tab')
  await expect(page.getByRole('button', { name: '120 seconds', exact: true })).toBeFocused()
})

test('mode changes reset a running test and persist across reloads', async ({ page }) => {
  await page.keyboard.type((await target(page)).slice(0, 4))
  await page.clock.runFor(1000)
  await page.getByRole('button', { name: '60 seconds', exact: true }).click()
  await expect(page.getByRole('textbox')).toHaveValue('')
  await expect(page.getByTestId('progress')).toHaveText('60')
  await page.reload()
  await expect(page.getByRole('button', { name: '60 seconds', exact: true })).toHaveAttribute('aria-pressed', 'true')
  await expect(page.getByRole('textbox')).toBeFocused()
})

test('timed text extends without changing existing positions or finishing early', async ({ page }) => {
  const prior = await target(page)
  await page.getByRole('textbox').fill(prior)
  await expect(page.getByTestId('results')).toHaveCount(0)
  expect((await target(page)).startsWith(`${prior} `)).toBe(true)
  await page.keyboard.press('Space')
  await expect(page.getByRole('textbox')).toHaveValue(`${prior} `)
  await expect(page.locator('[data-key="space"]')).toHaveAttribute('data-tone', 'correct')
  await page.clock.runFor(200)
  const caret = await page.locator('.caret').boundingBox()
  const viewport = await page.locator('.typing-viewport').boundingBox()
  expect(caret!.y).toBeGreaterThanOrEqual(viewport!.y)
  expect(caret!.y + caret!.height).toBeLessThanOrEqual(viewport!.y + viewport!.height)
})

test('narrow layouts, reduced motion, and mobile-style input stay functional', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 740 })
  await page.emulateMedia({ reducedMotion: 'reduce' })
  const text = await target(page)
  await page.getByRole('textbox').fill(text.slice(0, 20))
  await expect(page.getByRole('textbox')).toHaveValue(text.slice(0, 20))
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  await expect(page.locator('.caret')).toHaveCSS('animation-name', 'none')
  await finishWords(page)
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  await expect(page.getByRole('button', { name: 'Next test' })).toBeVisible()
})

test('theme and personal bests survive reloads; corrupt storage is safe', async ({ page }) => {
  await page.getByRole('button', { name: 'Switch to light theme' }).click()
  await finishWords(page)
  await expect(page.locator('.personal-best')).toBeVisible()
  await page.reload()
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light')
  await expect(page.locator('.footer')).toContainText('personal best')
  await page.evaluate(() => { localStorage.setItem('justtype.mode.v1', 'broken'); localStorage.setItem('justtype.bests.v1', '{bad') })
  await page.reload()
  await expect(page.getByTestId('progress')).toHaveText('15')
  await expect(page.getByRole('textbox')).toBeFocused()
})

test('focus loss keeps elapsed time running and shortcuts never become text', async ({ page }) => {
  const text = await target(page)
  await page.keyboard.press('Enter')
  await expect(page.getByRole('textbox')).toHaveValue('')
  await page.keyboard.type(text[0]!)
  await page.getByRole('button', { name: 'Switch to light theme' }).click()
  await page.clock.fastForward(16000)
  await expect(page.getByTestId('results')).toBeVisible()
  await expect(page.getByTestId('result-accuracy')).toHaveText('100%')
})

test('composition commits once and invalid characters do not start a test', async ({ page }) => {
  await page.keyboard.type('123!')
  await expect(page.getByRole('textbox')).toHaveValue('')
  await expect(page.getByRole('region', { name: 'Typing test' })).toHaveAttribute('data-status', 'ready')
  const character = (await target(page))[0]!
  await page.getByRole('textbox').dispatchEvent('compositionstart')
  await page.getByRole('textbox').fill(character)
  await expect(page.getByRole('region', { name: 'Typing test' })).toHaveAttribute('data-status', 'ready')
  await page.getByRole('textbox').dispatchEvent('compositionend', { data: character })
  await expect(page.getByRole('region', { name: 'Typing test' })).toHaveAttribute('data-status', 'running')
  await expect(page.getByRole('textbox')).toHaveValue(character)
  await expect(page.locator('.character.correct')).toHaveCount(1)
})

test('held keys process repeats at the updated cursor', async ({ page }) => {
  const text = await target(page)
  const character = text[0]!
  await page.keyboard.down(character)
  await page.keyboard.down(character)
  await page.keyboard.up(character)
  await expect(page.getByRole('textbox')).toHaveValue(character + character)
  await expect(page.locator(`[data-key="${character}"]`)).toHaveAttribute('data-tone', text[1] === character ? 'correct' : 'incorrect')
})

test('typing and results pass automated WCAG checks in both themes', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  const audit = async () => {
    // axe schedules its own work; the app's paused deterministic clock would
    // also freeze the auditor. Resume it before each accessibility scan.
    await page.clock.resume()
    const result = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze()
    return result.violations.map((violation) => ({ id: violation.id, nodes: violation.nodes.map((node) => ({ target: node.target, summary: node.failureSummary })) }))
  }
  expect(await audit()).toEqual([])
  await page.getByRole('button', { name: 'Switch to light theme' }).click()
  expect(await audit()).toEqual([])
  await finishWords(page)
  expect(await audit()).toEqual([])
  await page.getByRole('button', { name: 'Switch to dark theme' }).click()
  expect(await audit()).toEqual([])
})
