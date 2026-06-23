# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev          # Start dev server on port 3000, binds to 0.0.0.0
npm run build        # Production build to dist/
npm run lint         # Type-check only (tsc --noEmit, no ESLint)
npm run preview      # Preview production build locally
```

Tests are standalone Node.js scripts in `tests/` (not part of `npm test`). Run individually:
```bash
node tests/full-pipeline-test.mjs   # Static analysis of game ZIPs against VFS
node tests/auto-browser-test.mjs    # Puppeteer + Edge browser E2E (req. puppeteer-core)
```

## Architecture

This is a **React 19 + Vite 6 + TypeScript** SPA that emulates RPG Maker MZ/MV games in-browser via a **WebAssembly virtual filesystem (WASM VFS)** engine, paired with language-learning tools (dictionary lookup, translation, OCR, Anki sync).

### Application stages

`App.tsx` manages a single `UIState` object driving all UI. The app has two stages (`AppStage`): `HOME` (game library) and `PLAYING` (emulator + overlays). Stage transitions happen in `App.tsx` via `setCurrentStage`. All child components receive `uiState` + `setUIState` as props (state lifting, no Redux).

### Emulator core (`src/services/emulatorBridge.ts`)

The most critical and complex module. Manages:
- **WASM VFS initialization**: Dynamically imports `wasm_vfs.js` (lives in `public/`) at runtime via `new Function('specifier', 'return import(specifier)')` — this bypasses Rollup static analysis so `wasm_vfs.js` is served as a plain file, not bundled.
- **IndexedDB game library** (`rm-vfs-games`): Stores uploaded ZIP blobs, metadata, encryption keys, and thumbnails.
- **Sandbox iframe construction** (`buildFullSandboxDocument`): Rewrites game HTML to work within a sandboxed iframe — rewrites `<script src>` to blob URLs served from VFS, inlines CSS with VFS-resolved `url()` references, extracts fonts as base64 `@font-face` rules, and injects the sandbox IIFE (`public/sandbox.js`) plus font-fallback CSS.
- **Game text capture** for the translation/dictionary pipeline.
- **Encryption support**: Detects RPG Maker encrypted assets and derives decryption keys.

The WASM VFS engine and its dependencies (`public/pkg/`, `public/wasm_vfs.js`) are the legacy core from the original `test-rpgmz-main` project. The React app is a shell around this core.

### Persistence (dual-storage strategy)

Two separate storage backends, used for different purposes:
- **IndexedDB** (`emulatorBridge.ts`): Game ZIP binaries (raw `ArrayBuffer`), encryption keys, play history. Not synced to React state directly.
- **localStorage** (`storageService.ts`): UI settings, vocabulary, sentences, notes, game metadata (but NOT zip data). Auto-persisted via `useEffect` in `App.tsx` whenever relevant state slices change.

Game metadata is loaded from IndexedDB at boot (async), then synced into `uiState.games` and persisted to localStorage for faster reads on subsequent loads.

### Service layer

All in `src/services/`, each self-contained with its own caching:
- `dictionaryService.ts` — Merges local offline dictionary + Free Dictionary API. Supports `local`/`api`/`all` source modes with in-memory LRU cache.
- `translationService.ts` — MyMemory API (free, 5000 char/day limit). Batch translation with sentence splitting and LRU cache.
- `tokenizerService.ts` — Multi-strategy text segmentation: `Intl.Segmenter` (browser native), kuromoji.js (Japanese morphological analysis, loaded on demand from CDN), space-based, character-based, or none. Includes English lemmatization rules.
- `ocrService.ts` — Tesseract.js v5 with Web Workers. Supports multiple languages, element/frame capture. Dynamically imported to reduce initial bundle size.
- `storageService.ts` — localStorage CRUD for vocab, sentences, notes, settings, and game metadata. Includes CSV/JSON export.
- `emulatorBridge.ts` — WASM VFS lifecycle, IndexedDB game library, iframe sandbox construction.

### Component hierarchy

```
App
├── HomeView (game library grid, game import)
├── EmulatorView (WASM engine host + iframe management)
│   ├── TextOverlay (transparent clickable word layer over game iframe)
│   └── VirtualGamepad (touch/keyboard gamepad overlay)
├── SidePanel (right: SETTINGS | ANKI | GAMEPAD | DATA tabs)
├── LeftPanel (left: SAVES | SCREENSHOTS | NOTES tabs)
├── DictionarySidebar (dictionary search: local/api/vocab/tampermonkey/web tabs)
├── FloatingLookupCard (word definition popup with add-to-vocab/Anki actions)
├── NoteEditor (full-screen note editor)
├── EditEntryModal (game metadata editor)
├── DevToolbar (development utilities)
└── ConfirmModal (generic confirmation dialog)
```

### Key patterns

- **Dynamic imports for heavy libraries**: Tesseract.js, kuromoji.js, and WASM VFS are all dynamically imported — they don't contribute to initial bundle size and fail gracefully if unavailable.
- **`@/` path alias** resolves to project root (configured in both `tsconfig.json` and `vite.config.ts`). All imports in `src/` use relative paths, but the alias is available.
- **`base: '/test-rpgmz/'`** in Vite config — deployed to GitHub Pages under this subpath. All dynamic asset imports use `import.meta.env.BASE_URL`.
- **No router** — navigation is purely state-driven via `currentStage`.
- **Anki sync** tries `AnkiConnect` (localhost HTTP API), falls back to clipboard copy with user prompt.
- **OCR is optional** — the Tesseract.js import is fully dynamic; the feature silently degrades if the library isn't installed.

### Public directory structure

- `public/wasm_vfs.js` — WASM VFS runtime (loaded dynamically, NOT bundled)
- `public/pkg/` — Rust/WASM compiled binaries used by the VFS engine
- `public/sandbox.js` — IIFE injected into game iframes to intercept network requests
- `public/fonts/fallback.css` — Fallback font definitions for Japanese/Chinese game text
- `public/404.html` — GitHub Pages SPA redirect page

### Deployment

GitHub Actions (`.github/workflows/deploy.yml`) builds and force-pushes `dist/` to the `gh-pages` branch. Triggers on push to `deploy` branch, manual dispatch, or weekly cron. Generates a SPA-aware 404.html that redirects to index.html with path preservation.
