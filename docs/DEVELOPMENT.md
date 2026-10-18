# Development reference

This document is for contributors and maintainers. For installation, everyday use, privacy and support, start with the [user guide](../README.md).

## Architecture


- **Manifest V3**: Compliant with the latest Chrome Extension standards, utilizing `chrome.storage.local` context passing mechanisms and full domain permissions `<all_urls>` for cross-origin widget injection.
- **Architecture**:
    - `envato-shared.js`: Shared helpers for Envato host detection, canonical `itemId` parsing, site naming, and settings compatibility/migration.
    - `marketplace-init.js`: Early `document_start` bootstrap that mirrors the `Hide Ads` setting into the page root before the marketplace paints, using both extension storage and a per-host `localStorage` mirror to reduce first-paint flicker.
    - `marketplace-overrides.css`: Declarative anti-flicker stylesheet that collapses supported Envato ad surfaces immediately when `Hide Ads` is enabled, including shared browse/category sidebars and downloads/account promo rails.
    - `content.js`: Captures Envato metadata on previews, uses Envato `itemId` as the stable product key, fires secure redirects, and injects floating Shadow DOM widgets into third-party target showcase websites.
    - `removed-items.js`: Isolated DOM-safe transformer for unavailable downloads, including compact action bars, JIT thumbnail hydration, and lightweight downloads-list observation.
    - `content.css`: Base layout requirements for the floating panel.
    - `assets/`: Shared UI assets grouped into `fonts/`, `images/`, and `icons/`.
    - `sidepanel.html/css/js`: An aesthetic UI implementation loaded inside an isolated inner iframe, with a compact Status view, an Admin control surface, and a bottom-triggered Settings sub-view.
    - `image-cache.js`: `IndexedDB`-backed image cache with checksum, TTL, and eviction rules for product artwork.
    - `background.js`: Event handler orchestration (relaying extension clicks).

## Compliance

- The extension is packaged as a self-contained Manifest V3 project with no remote JavaScript.
- The panel typography is bundled locally, including `Oswald`, with no remote font dependency.
- Product metadata is rendered using safe DOM APIs rather than `innerHTML`.
- Cached product images are stored in `IndexedDB`, not `chrome.storage.local`.
- Envato ad suppression is applied through packaged `document_start` CSS and a lightweight local bootstrap with a host-level mirror, reducing visible flicker without remote dependencies.
- Compliance notes and pre-publish review guidance live in `docs/COMPLIANCE.md`.
- Cache architecture and storage rationale live in `docs/IMAGECACHE.md`.

## Development

### Smoke Automation

For repeatable local smoke checks, the repo now includes a Playwright-based extension runner:

```bash
npm install
npm run smoke:extension
```

What it does:
- launches Chromium with the unpacked extension loaded from the repo
- uses a standard persistent profile directory at `.playwright/chrome-extension-dev`
- opens the floating panel through a small DOM test bridge in `content.js`
- validates `Hide Ads` on supported item, browse, and `top-sellers` pages
- keeps authenticated checks in the separate protected manual workflow described below

Useful overrides:
- `PLAYWRIGHT_EXTENSION_PROFILE_DIR`: reuse an existing Chrome/Chromium dev profile instead of the default local profile
- `PLAYWRIGHT_EXTENSION_PATH`: override the unpacked extension path
- `SMOKE_ITEM_URL`: override the item-page smoke URL
- `SMOKE_TOP_SELLERS_URL`: override the browse/top-sellers smoke URL

Notes:
- The public live smoke covers `item page` and `top-sellers`; authenticated downloads use the private runner.
- Reusing a real Chrome profile works only when Chrome is not already holding the same root user-data directory lock.

### File Structure

```
envato-xperience/
├── manifest.json       # Extension configuration
├── background.js       # Service worker
├── envato-shared.js    # Shared helpers for hosts, item IDs, and settings
├── marketplace-init.js # Early settings bootstrap for host-page overrides
├── marketplace-overrides.css # Early ad-suppression rules for Envato pages
├── package.json        # Local Playwright smoke tooling entrypoints
├── scripts/            # Playwright extension smoke config/spec
├── .env.local.example  # Reference names; CI secrets are entered directly in GitHub
├── content.js          # Preview, widget, and panel bridge logic
├── removed-items.js    # Removed/unavailable downloads UI enhancement
├── content.css         # Container styles
├── assets/             # Shared UI assets
│   ├── fonts/          # Local bundled fonts for extension UI
│   ├── icons/          # Sidepanel/support SVG icons
│   └── images/         # UI images, logos, and README artwork
├── image-cache.js      # IndexedDB-backed image cache
├── sidepanel.html      # Panel Structure
├── sidepanel.css       # Panel Styles
├── sidepanel.js        # Panel Logic
├── icons/              # Assets
├── docs/               # Workflow, roadmap, compliance, cache notes
└── README.md           # This file
```


## Regression tests and versioning


```bash
npm ci
npm test
npx playwright install chromium
npm run test:extension:regression
```

The regression suite uses an isolated temporary Chromium profile and locally fulfilled pages, without Envato credentials. It covers automatic and manual preview navigation, widget destination boundaries, product context across item subpages, and removed-item toggles. Node tests cover domain lookalikes, observer lifecycle, and responses arriving out of order. The public live smoke checks real Envato selectors; the separate protected manual workflow checks authenticated downloads.

Set `PLAYWRIGHT_CHROMIUM_EXECUTABLE` only when using an existing compatible Chromium executable. Temporary browser profiles are removed after the run; test output stays under the ignored `test-results/` directory.

### Versioning

The extension uses stable SemVer `X.Y.Z`. `package.json` is the version source, the npm version hook updates `manifest.json`, and npm updates `package-lock.json`. The About panel reads `chrome.runtime.getManifest().version`, so no UI version is hardcoded. Version `1.1.0` includes the functional improvements following `1.0.0`.

- `npm run release:patch`: compatible bug fixes (`1.1.0` → `1.1.1`).
- `npm run release:minor`: compatible new functionality (`1.1.0` → `1.2.0`).
- `npm run release:major`: incompatible behavior changes (`1.1.0` → `2.0.0`).

These commands update files without creating a Git commit or tag. Run them on the release feature branch, review the diff, run `npm test` and the extension regressions, then commit and merge into `develop` before merging into `main`. `npm run version:check` also runs in CI through `npm test` and rejects mismatches.

Chrome-compatible versions use exactly three numeric components, each between 0 and 65535, without leading zeroes, prerelease/build suffixes, or `0.0.0`. Reload the extension and refresh its host tab to see a new version in Settings > About.

## Authenticated checks in a public repository

Authenticated downloads are tested only through the manual **Private authenticated smoke** workflow on `main`, behind the `envato-auth-smoke` environment approval. Add `ENVATO_TEST_USERNAME` and `ENVATO_TEST_PASSWORD` directly as environment secrets in GitHub, using a dedicated account. No authenticated screenshots, reports, traces or profiles are published. See [setup, protections and limitations](docs/AUTHENTICATED_SMOKE.md).

## Store package

Run `npm run package:extension` to create a ZIP in `dist/`. The allowlist contains only runtime files, required images, fonts, icons and the license; it rejects symlinks and verifies local HTML/CSS references. Tests verify that development tools and secret files cannot enter the ZIP. Python 3 (standard library only) is required to build the archive. Never upload a ZIP of the full checkout.
