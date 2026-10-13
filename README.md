# JustType

A minimal typing test built with Vite, React, strict TypeScript, and custom CSS. No accounts, backend, remote word API, or external font requests.

## Features

- Time tests: 10, 15, 30, 60, and 120 seconds. Word tests: 10, 25, 50, and 100 words.
- Starts with the first letter or space. A monotonic clock controls the deadline; switching tabs does not pause a test.
- Character-level correctness, backspace correction, an accurate caret, and a three-line viewport that follows the active line.
- A responsive QWERTY keyboard with blue/red feedback and a spacebar. Real textarea input supports touch keyboards and composition; paste and drop are disabled.
- Results with speed, historical accuracy, consistency, character counts, correction counts, and a real SVG performance chart. Chart samples are also available as a screen-reader table.
- Dark/light themes, per-mode personal bests, and validated local preferences.
- Locally bundled Geist and JetBrains Mono fonts. Reduced-motion support and keyboard-accessible controls.

## Run locally

Requires Node.js 22.12 or newer and npm.

```sh
npm ci
npm run dev
```

Open the printed URL (normally `http://127.0.0.1:5173`). Tap the words on touch devices to open the native keyboard if the browser blocks automatic focus.

```sh
npm run build       # TypeScript check + production bundle in dist/
npm run preview     # Serve the production bundle locally
```

The production output is static and can be served on any static host. Word generation and fonts need no external service; a fresh page load still needs its app assets to be served. A service worker is not included.

## Verification

```sh
npm run typecheck
npm run lint
npm test
npm run check        # TypeScript, lint, unit tests, build
npx playwright install chromium
npm run test:e2e     # Chromium desktop + emulated mobile
```

Playwright starts Vite or reuses the local server at port 5173. Tests use Playwright's clock to verify long tests without real-time waits, capture landing/results screenshots, and run axe WCAG accessibility checks on both themes and screens. Reports and screenshots are ignored by Git. Mobile browser emulation verifies layout and input handling; it does not replace checking a real phone's software keyboard. GitHub Actions runs these checks on pushes and pull requests.

## Shortcuts and input rules

- **Tab, then Enter:** focus Restart/Next test and immediately generate a new test. Works in the typing surface and the initially focused results region.
- **Escape:** leave the typing input and focus the current mode control.
- **Shift + Tab:** navigate from the input to mode controls.
- Normal Tab navigation remains available outside the typing input. From the restart button, another Tab continues to page controls.
- **Backspace:** remove the previous character. Native word deletion is supported when the browser sends it.

Tests use a sequential character-position model. Every accepted ASCII letter (case-sensitive) or space advances one target position. An incorrect space still advances one position. Backspace removes positions; completing the last position finishes a word test even if errors remain. Uppercase letters count as incorrect against the lowercase target. Non-letter symbols, navigation keys, paste, and drop do not contribute to speed or accuracy.

## Statistics

Spaces count as characters; one standard word is five characters. Metrics use exact elapsed time, not the number of timer callbacks.

| Metric | Definition |
| --- | --- |
| WPM | `(currently correct characters / 5) / elapsed minutes` |
| Raw WPM | `(all accepted character input events / 5) / elapsed minutes` |
| Accuracy | `correct input events / all input events × 100` |
| Characters | Correct and incorrect characters remaining in the final input |
| Keystrokes | All accepted character inputs, including retyped characters; excludes backspace |
| Corrections | Incorrect characters removed with backspace |
| Consistency | `100 × (1 − population standard deviation / mean)` of interval raw WPM, clamped to 0–100 |

Accuracy is **historical keystroke accuracy**: correcting a mistake repairs visible correctness and net WPM, but does not erase the original error. Raw speed includes retyping. There are no extra/missed categories because this model does not skip positions or add characters between them.

The engine records cumulative WPM and raw WPM at one-second boundaries, plus a final partial sample. It advances before each input, so delayed timer callbacks do not move inputs into earlier samples. Corrections never rewrite previous samples. Error markers use the actual input event timestamps. Consistency uses per-interval input counts, with duration-weighted final partial intervals. Fewer than two usable intervals or no typing gives an unavailable consistency score. Zero-duration tests produce finite zero speed. Live speed stays blank during the first second to avoid an unstable initial estimate.

Personal bests compare unrounded net WPM within the selected mode. Tests shorter than one second are excluded. There is no accuracy threshold. The results screen also explains the metrics.

## Local storage

Versioned keys: `justtype.mode.v1`, `justtype.theme.v1`, and `justtype.bests.v1`. Stored settings and records are validated. Malformed JSON, unsupported modes, and blocked/full storage do not crash the app. Records stay in this browser on this device; clearing site data removes them. No typing content is stored or transmitted.

## Structure

`src/lib/typingEngine.ts` holds the pure state machine. `statistics.ts`, `wordGenerator.ts`, and `storage.ts` handle calculations, shuffled local word bags, and persistence. `useTypingTest` coordinates real input and the rendering clock. Components handle presentation and caret geometry; test metrics never inspect the DOM.
