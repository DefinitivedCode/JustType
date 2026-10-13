# JustType

A minimalist typing test with real-time feedback, performance statistics, and interactive typing replays.

## Features

- Timed tests of 10, 15, 30, 60, or 120 seconds and word-count tests of 10, 25, 50, or 100 words.
- Live WPM, character highlighting, backspace correction, and an interactive QWERTY keyboard.
- Results with accuracy, consistency, character counts, corrections, and a WPM performance graph.
- Keystroke replay with the original mistakes, corrections, caret, and keyboard feedback; bidirectional timeline scrubbing and 0.5×, 1×, 1.5×, or 2× playback.
- Keyboard shortcuts, dark and light themes, and local personal-best tracking for each mode.
- Responsive layout, accessible controls, and reduced-motion support.

Tests start with the first letter or space. Preferences and personal bests stay in your browser. Replay recordings stay in memory for the current result; typing content is neither persisted nor sent to external services. Fonts and word lists are bundled locally.

## Getting started

Requires Node.js 22.12 or newer and npm.

```sh
npm ci
npm run dev
```

Build the production assets in `dist/` and preview them locally:

```sh
npm run build
npm run preview
```

`wrangler.jsonc` prepares `dist/` for [Cloudflare Workers Static Assets](https://developers.cloudflare.com/workers/static-assets/) with a single-page application fallback. After building, `npx wrangler dev --local` previews that configuration locally. Building requires no Cloudflare credentials.

## Keyboard shortcuts

- **Tab, then Enter:** restart from the typing input or start the next test from the initially focused results region.
- **Escape:** move from the typing input to the mode controls.
- **Shift + Tab:** navigate from the typing input to the mode controls.
- **Backspace:** correct the previous character.

Standard Tab navigation works throughout the other controls.

## Development checks

```sh
npm run check
npx playwright install chromium
npm run test:e2e
```

The checks cover TypeScript, ESLint, unit tests, the production build, and desktop and mobile browser tests. GitHub Actions runs them on pushes to `main` and pull requests.

## Technology

React, TypeScript, Vite, and custom CSS, with Vitest and Playwright for testing. Icons use Lucide; locally bundled fonts use Geist and JetBrains Mono. Font copyright and license notices are included in `public/licenses/` and copied into the production build.

## License

[MIT](LICENSE).
