import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'

async function recordPerformance(page: Page) {
  await page.getByRole('button', { name: '10 seconds', exact: true }).click()
  const text = (await page.getByTestId('typing-text').getAttribute('data-target'))!
  const wrong = text[1] === 'r' ? 'x' : 'r'
  await page.keyboard.down(text[0]!)
  await page.clock.runFor(50)
  await page.keyboard.up(text[0]!)
  await page.clock.runFor(350)
  await page.keyboard.down(wrong)
  await page.clock.runFor(50)
  await page.keyboard.up(wrong)
  await page.clock.runFor(350)
  await page.keyboard.down('Backspace')
  await page.clock.runFor(50)
  await page.keyboard.up('Backspace')
  await page.clock.runFor(350)
  await page.keyboard.down(text[1]!)
  await page.clock.runFor(240)
  await page.keyboard.up(text[1]!)
  await page.clock.runFor(360)
  const boundary = text.indexOf(' ')
  if (boundary === 1) await page.keyboard.press('Backspace')
  else await page.keyboard.type(text.slice(2, boundary))
  await page.keyboard.press('Space')
  const prefix = text.slice(0, boundary + 1)
  await expect(page.getByRole('textbox')).toHaveValue(prefix)
  await page.clock.fastForward(8200)
  await expect(page.getByTestId('results')).toBeVisible()
  return { text, wrong, prefix }
}

async function seek(page: Page, time: number, settle = true) {
  await page.getByRole('slider', { name: 'Replay timeline' }).evaluate((element, value) => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(element, String(value))
    element.dispatchEvent(new Event('input', { bubbles: true }))
  }, time)
  if (settle) await page.clock.runFor(220)
}

test.beforeEach(async ({ page }) => {
  await page.clock.install({ time: new Date('2026-10-13T12:00:00Z') })
  await page.clock.pauseAt(new Date('2026-10-13T12:00:01Z'))
  await page.goto('/')
})

test('title is exactly JustType and replay automatically reproduces actual mistakes, corrections, and key releases', async ({ page }) => {
  await expect(page).toHaveTitle('JustType')
  const { text, wrong } = await recordPerformance(page)
  const replay = page.getByTestId('replay')
  await expect(replay.locator('.keycap')).toHaveCount(28)
  await expect(page.getByRole('button', { name: 'Pause replay' })).toBeVisible()
  await page.clock.runFor(450)
  await expect(replay).toHaveAttribute('data-input', text[0]! + wrong)
  await expect(replay.locator(`[data-key="${wrong}"]`)).toHaveAttribute('data-tone', 'incorrect')
  await expect(replay.locator('.character.incorrect')).toHaveCount(1)
  if (text[1] !== wrong && text[1] !== text[0]) {
    await expect(replay.locator(`[data-key="${text[1] === ' ' ? 'space' : text[1]}"]`)).toHaveAttribute('data-tone', 'neutral')
  }
  await page.clock.runFor(200)
  await expect(replay.locator(`[data-key="${wrong}"]`)).toHaveAttribute('data-tone', 'neutral')
  await page.clock.runFor(200)
  await expect(replay).toHaveAttribute('data-input', text[0]!)
  await expect(replay.locator('[data-key="backspace"]')).toHaveAttribute('data-tone', 'correct')
  await page.clock.runFor(450)
  await expect(replay).toHaveAttribute('data-input', text.slice(0, 2))
  await expect(replay.locator(`[data-key="${text[1] === ' ' ? 'space' : text[1]}"]`)).toHaveAttribute('data-tone', 'correct')
  await page.clock.runFor(250)
  await expect(replay.locator(`[data-key="${text[1] === ' ' ? 'space' : text[1]}"]`)).toHaveAttribute('data-tone', 'neutral')
})

test('seeking to a fractional word-test endpoint includes the final character and keyboard press', async ({ page }) => {
  await page.getByRole('button', { name: 'words', exact: true }).click()
  await page.getByRole('button', { name: '10 words', exact: true }).click()
  const target = (await page.getByTestId('typing-text').getAttribute('data-target'))!
  await page.getByRole('textbox').fill(target.slice(0, -1))
  await page.clock.runFor(1000)
  // Real performance.now() timestamps include fractions of a millisecond.
  await page.evaluate(() => {
    const now = performance.now.bind(performance)
    Object.defineProperty(performance, 'now', { configurable: true, value: () => now() + 0.25 })
  })
  await page.keyboard.press(target.at(-1)!)
  await expect(page.getByTestId('results')).toBeVisible()
  const slider = page.getByRole('slider', { name: 'Replay timeline' })
  await expect(slider).toHaveAttribute('max', '1000.25')
  await slider.focus()
  await slider.press('End')
  await page.clock.runFor(220)
  await expect(slider).toHaveValue('1000.25')
  await expect(page.getByTestId('replay')).toHaveAttribute('data-input', target)
  await expect(page.locator(`.replay-section [data-key="${target.at(-1)!}"]`)).toHaveAttribute('data-tone', 'correct')
  await slider.press('Home')
  await page.clock.runFor(220)
  await expect(page.getByTestId('replay')).toHaveAttribute('data-input', '')
  await expect(page.locator('.replay-section .keycap[data-tone="correct"]')).toHaveCount(0)
})

test('pausing freezes text and keyboard; resuming and space feedback preserve the original rhythm', async ({ page }) => {
  const { text, prefix } = await recordPerformance(page)
  await page.clock.runFor(850)
  await page.getByRole('button', { name: 'Pause replay' }).click()
  const at = await page.getByTestId('replay').getAttribute('data-time')
  await page.clock.runFor(2000)
  await expect(page.getByTestId('replay')).toHaveAttribute('data-time', at!)
  await expect(page.getByTestId('replay')).toHaveAttribute('data-input', text[0]!)
  await expect(page.locator('[data-key="backspace"]')).toHaveAttribute('data-tone', 'correct')
  await page.getByRole('button', { name: 'Play replay' }).click()
  await page.clock.runFor(1050)
  await expect(page.getByTestId('replay')).toHaveAttribute('data-input', prefix)
  await expect(page.locator('[data-key="space"]')).toHaveAttribute('data-tone', 'correct')
})

test('reverse seeks restore deleted mistakes and rewind keyboard feedback and caret', async ({ page }) => {
  const { text, wrong, prefix } = await recordPerformance(page)
  await page.getByRole('button', { name: 'Pause replay' }).click()
  await seek(page, 1900)
  await expect(page.getByTestId('replay')).toHaveAttribute('data-input', prefix)
  await expect(page.locator('[data-key="space"]')).toHaveAttribute('data-tone', 'correct')
  await seek(page, 850)
  await expect(page.getByTestId('replay')).toHaveAttribute('data-input', text[0]!)
  await expect(page.locator('[data-key="backspace"]')).toHaveAttribute('data-tone', 'correct')
  await seek(page, 450)
  await expect(page.getByTestId('replay')).toHaveAttribute('data-input', text[0]! + wrong)
  await expect(page.locator(`[data-key="${wrong}"]`)).toHaveAttribute('data-tone', 'incorrect')
  const caret = (await page.locator('.replay-section .caret').boundingBox())!
  const position = (await page.locator('.replay-section [data-position="2"]').boundingBox())!
  expect(Math.abs(caret.x - position.x)).toBeLessThan(1)
  await seek(page, 850)
  await expect(page.getByTestId('replay')).toHaveAttribute('data-input', text[0]!)
  await expect(page.locator('[data-key="backspace"]')).toHaveAttribute('data-tone', 'correct')
})

test('a large reverse seek visibly traverses intermediate edits rather than cutting to the final target', async ({ page }) => {
  const { text, wrong } = await recordPerformance(page)
  await page.getByRole('button', { name: 'Pause replay' }).click()
  await seek(page, 2000)
  await page.evaluate(() => {
    const root = document.querySelector('[data-testid="replay"]')!
    const states: string[] = []
    const observer = new MutationObserver(() => states.push(root.getAttribute('data-input')!))
    observer.observe(root, { attributes: true, attributeFilter: ['data-input'] })
    ;(window as unknown as { replayStates: string[] }).replayStates = states
  })
  await seek(page, 0, false)
  expect(Number(await page.getByTestId('replay').getAttribute('data-time'))).toBe(2000)
  await page.clock.runFor(220)
  const states = await page.evaluate(() => (window as unknown as { replayStates: string[] }).replayStates)
  expect(states).toContain(text.slice(0, 2))
  expect(states).toContain(text[0]! + wrong)
  expect(states.at(-1)).toBe('')
  await expect(page.locator('[data-tone="correct"], [data-tone="incorrect"]')).toHaveCount(0)
})

test('dragging the real slider backwards and forwards continuously synchronises the full keyboard', async ({ page }) => {
  const { text, wrong } = await recordPerformance(page)
  const slider = page.getByRole('slider', { name: 'Replay timeline' })
  await slider.scrollIntoViewIfNeeded()
  const box = (await slider.boundingBox())!
  const x = (time: number) => box.x + 5 + (box.width - 10) * time / 10000
  const y = box.y + box.height / 2
  await page.mouse.move(x(2000), y)
  await page.mouse.down()
  await page.clock.runFor(220)
  for (const time of [1300, 850, 450, 850, 450, 0, 1300]) {
    await page.mouse.move(x(time), y, { steps: 3 })
    await page.clock.runFor(220)
    const state = page.getByTestId('replay')
    await expect(state).toHaveAttribute('data-playing', 'false')
    if (time === 450) {
      await expect(state).toHaveAttribute('data-input', text[0]! + wrong)
      await expect(page.locator(`[data-key="${wrong}"]`)).toHaveAttribute('data-tone', 'incorrect')
    } else if (time === 850) {
      await expect(state).toHaveAttribute('data-input', text[0]!)
      await expect(page.locator('[data-key="backspace"]')).toHaveAttribute('data-tone', 'correct')
    } else if (time === 0) {
      await expect(state).toHaveAttribute('data-input', '')
      await expect(page.locator('[data-tone="correct"], [data-tone="incorrect"]')).toHaveCount(0)
    } else {
      await expect(state).toHaveAttribute('data-input', text.slice(0, 2))
      await expect(page.locator(`[data-key="${text[1] === ' ' ? 'space' : text[1]}"]`)).toHaveAttribute('data-tone', 'correct')
    }
  }
  // Reverse direction again before the preceding animation has settled.
  await page.mouse.move(x(0), y)
  await page.clock.runFor(32)
  const backwards = Number(await page.getByTestId('replay').getAttribute('data-time'))
  await page.mouse.move(x(1900), y)
  await page.clock.runFor(32)
  expect(Number(await page.getByTestId('replay').getAttribute('data-time'))).toBeGreaterThan(backwards)
  await page.mouse.move(x(850), y)
  await page.clock.runFor(220)
  await expect(page.getByTestId('replay')).toHaveAttribute('data-input', text[0]!)
  await expect(page.locator('[data-key="backspace"]')).toHaveAttribute('data-tone', 'correct')
  await page.mouse.up()
})

test('all playback speeds work; restarting cancels the previous animation and keeps results intact', async ({ page }) => {
  const { text, prefix } = await recordPerformance(page)
  const result = await page.getByTestId('result-wpm').textContent()
  for (const speed of [0.5, 1, 1.5, 2]) {
    await page.getByRole('combobox', { name: 'Playback speed' }).selectOption(String(speed))
    await page.getByRole('button', { name: 'Restart replay' }).click()
    await page.clock.runFor(200)
    await page.getByRole('button', { name: 'Pause replay' }).click()
    expect(Number(await page.getByTestId('replay').getAttribute('data-time'))).toBeCloseTo(200 * speed, -1)
    await expect(page.getByTestId('result-wpm')).toHaveText(result!)
  }
  await seek(page, 10000)
  await expect(page.getByTestId('replay')).toHaveAttribute('data-input', prefix)
  await expect(page.locator('[data-tone="correct"], [data-tone="incorrect"]')).toHaveCount(0)
  await page.getByRole('button', { name: 'Restart replay' }).click()
  await expect(page.getByTestId('replay')).toHaveAttribute('data-input', '')
  await page.clock.runFor(50)
  await expect(page.getByTestId('replay')).toHaveAttribute('data-input', text[0]!)
  await expect(page).toHaveTitle('JustType')
})

test('repeated actual keydown events retain separate feedback during reverse scrubbing', async ({ page }) => {
  await page.getByRole('button', { name: '10 seconds', exact: true }).click()
  const text = (await page.getByTestId('typing-text').getAttribute('data-target'))!
  const key = text[0]!
  await page.keyboard.down(key)
  await page.clock.runFor(300)
  await page.keyboard.down(key)
  await page.clock.runFor(400)
  await page.keyboard.up(key)
  await page.clock.fastForward(9300)
  await page.getByRole('button', { name: 'Pause replay' }).click()
  await seek(page, 500)
  await expect(page.getByTestId('replay')).toHaveAttribute('data-input', key + key)
  await expect(page.locator(`[data-key="${key}"]`)).toHaveAttribute('data-tone', text[1] === key ? 'correct' : 'incorrect')
  await seek(page, 100)
  await expect(page.getByTestId('replay')).toHaveAttribute('data-input', key)
  await expect(page.locator(`[data-key="${key}"]`)).toHaveAttribute('data-tone', 'correct')
  await seek(page, 250)
  await expect(page.locator(`[data-key="${key}"]`)).toHaveAttribute('data-pressed', 'true')
  await seek(page, 800)
  await expect(page.locator(`[data-key="${key}"]`)).toHaveAttribute('data-tone', 'neutral')
})

test('the physical key releases at its recorded keyup, independently of the brief feedback colour', async ({ page }) => {
  const { wrong } = await recordPerformance(page)
  await page.getByRole('button', { name: 'Pause replay' }).click()
  await seek(page, 425)
  await expect(page.locator(`[data-key="${wrong}"]`)).toHaveAttribute('data-pressed', 'true')
  await seek(page, 475)
  await expect(page.locator(`[data-key="${wrong}"]`)).toHaveAttribute('data-pressed', 'false')
  await expect(page.locator(`[data-key="${wrong}"]`)).toHaveAttribute('data-tone', 'incorrect')
  await seek(page, 600)
  await expect(page.locator(`[data-key="${wrong}"]`)).toHaveAttribute('data-tone', 'neutral')
})

test('unfocused keys stay unrecorded, and replay cannot interfere with Tab then Enter or a new test', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  await page.getByRole('button', { name: '10 seconds', exact: true }).click()
  const text = (await page.getByTestId('typing-text').getAttribute('data-target'))!
  await page.keyboard.type(text[0]!)
  await page.getByRole('button', { name: 'Switch to dark theme' }).click()
  await page.keyboard.press('x')
  await page.clock.fastForward(10000)
  await page.getByRole('button', { name: 'Pause replay' }).click()
  await seek(page, 5000)
  await expect(page.getByTestId('replay')).toHaveAttribute('data-input', text[0]!)
  await page.getByTestId('results').focus()
  await page.keyboard.press('Tab')
  await expect(page.getByRole('button', { name: 'Next test' })).toBeFocused()
  await page.keyboard.press('Enter')
  await expect(page.getByRole('textbox')).toBeFocused()
  await expect(page.getByRole('textbox')).toHaveValue('')
  await expect(page.getByTestId('replay')).toHaveCount(0)
  await page.clock.runFor(2000)
  await expect(page.getByRole('region', { name: 'Typing test' })).toHaveAttribute('data-status', 'ready')
  expect(errors).toEqual([])
})

test('touch input and an instant word test produce an independent short replay with the original target', async ({ page }) => {
  await page.getByRole('button', { name: 'words', exact: true }).click()
  await page.getByRole('button', { name: '10 words', exact: true }).click()
  const text = (await page.getByTestId('typing-text').getAttribute('data-target'))!
  await page.getByRole('textbox').fill(text)
  await expect(page.getByTestId('results')).toBeVisible()
  await expect(page.getByTestId('typing-text')).toHaveAttribute('data-target', text)
  await page.clock.runFor(32)
  await expect(page.getByTestId('replay')).toHaveAttribute('data-input', text)
  await expect(page.locator('[data-tone="correct"]')).not.toHaveCount(0)
  await page.clock.runFor(220)
  await expect(page.locator('[data-tone="correct"]')).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Play replay' })).toBeVisible()
})

test('replay stays responsive and its keyboard remains visible in a short mobile viewport', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 360, height: 540 })
  await recordPerformance(page)
  await page.getByRole('button', { name: 'Pause replay' }).click()
  await seek(page, 450)
  await expect(page.locator('.replay-section .virtual-keyboard')).toBeVisible()
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  const footer = (await page.locator('.footer').boundingBox())!
  const main = (await page.locator('.main-content').boundingBox())!
  expect(footer.y).toBeGreaterThanOrEqual(main.y + main.height)
  await page.evaluate(() => document.fonts.ready)
  await page.screenshot({ path: testInfo.outputPath('replay-mobile.png'), fullPage: true })
})

test('desktop results preserve their statistics and graph above the complete replay keyboard', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 2560, height: 1440 })
  await recordPerformance(page)
  await page.getByRole('button', { name: 'Pause replay' }).click()
  await seek(page, 450)
  await page.evaluate(() => document.fonts.ready)
  const replay = (await page.getByTestId('replay').boundingBox())!
  const stats = (await page.locator('.secondary-results').boundingBox())!
  expect(replay.y).toBeGreaterThan(stats.y + stats.height)
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  await page.screenshot({ path: testInfo.outputPath('replay-desktop.png'), fullPage: true })
})
