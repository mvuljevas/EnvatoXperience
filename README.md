<p align="center">
  <img src="assets/images/Envato Xperience_GitHub.png" alt="Envato XPerience" />
</p>

# Envato XPerience

A Chrome extension that enhances the Envato browsing experience with cleaner previews, preserved product context, optional live-demo helpers, and marketplace UI cleanup tools.

## Features

- **Auto-Remove Mode**: Automatically removes preview frames on visit (enabled by default).
- **Floating Control Panel**: A sleek, non-intrusive side panel with a focused Status view and a broader Admin view.
- **Premium UI**: "Glassmorphism" design with smooth, switch-like animations.
- **Context Preservation (Floating Widget)**: Optionally injects an elegant floating button panel on the creator's real external website, retaining Envato's "Buy Now" and "Details" links even after the redirect.
- **Hide Ads Toggle**: Optionally suppresses major Envato promotional surfaces such as top banners, Elements cross-sells, footer promos, marketplace switcher ads, `top-sellers` author sidebars, and account/download promos.
- **Hide Removed Items**: Optionally compacts deprecated/removed items in your Downloads page into elegant, sleek action bars. Offers Just-In-Time thumbnail extraction on hover, native fallback certificate downloads, and instant DOM cleanups.
- **Stable Product Identity**: Uses the canonical Envato `itemId` from `/item/.../<id>` URLs so product data stays aligned across item, reviews, comments, and support tabs.
- **Local Image Cache**: Stores product hero images in `IndexedDB` with TTL and eviction rules instead of bloating extension storage.
- **Contextual Status States**: Outside item pages, the panel switches to premium editorial states for browse, preview, and fallback contexts instead of showing a dead loading message.
- **Compact Product Card**: The sidepanel now renders a tighter, Envato-inspired product card with title, author, category, price, sales, rating, last update, and direct live preview access.
- **Support Section**: The Admin tab includes a lightweight funding card with GitHub Sponsors, Ko-fi, and PayPal support options for independent development.
- **Smart Detection**: Specifically extracts product metadata from Envato domains and targets the `.full-screen-preview__frame` container safely.
- **Shadow DOM Isolation**: The UI and floating widgets are strictly encapsulated in Shadow DOM to avoid CSS bleeding onto any theme's complex stylesheets.

## Installation

### From Source

1. Clone this repository:
   ```bash
   git clone https://github.com/mvuljevas/envato-xperience.git
   ```
2. Open Chrome and navigate to `chrome://extensions/`.
3. Enable **Developer mode** (toggle in top-right corner).
4. Click **Load unpacked** and select the `envato-xperience` folder.

## Usage

- **Auto-Remove**: Just browse Envato network sites (ThemeForest, CodeCanyon, VideoHive, etc.). Preview wrappers can redirect you directly into clean live demos.
- **Floating Control Panel**: Click the extension icon to toggle the floating panel on any Envato page. From there, you can:
    - Open the live preview directly from supported preview pages.
    - Use `Status` for the current marketplace or product context.
    - Use the `Admin` tab for core and enhancement controls such as **Auto Remove**, **Floating Widget**, **Hide Ads**, and **Hide Removed Items**.
    - Open the bottom gear-powered **Settings** surface inside `Admin` for `About` and `Support`.

## Technical Details

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
- validates authenticated account/download views using `/.env.local`, including fallback navigation through the user popover when needed

Useful overrides:
- `PLAYWRIGHT_EXTENSION_PROFILE_DIR`: reuse an existing Chrome/Chromium dev profile instead of the default local profile
- `PLAYWRIGHT_EXTENSION_PATH`: override the unpacked extension path
- `SMOKE_ITEM_URL`: override the item-page smoke URL
- `SMOKE_TOP_SELLERS_URL`: override the browse/top-sellers smoke URL

Notes:
- The baseline smoke currently passes `item page`, `top-sellers`, and authenticated `downloads`.
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
├── .env.local.example  # Local Playwright auth template for manual DOM debugging
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

## Credits

Crafted by [Mauricio Vuljevas](https://www.mvuljevas.com?utm_source=envatoxperience).

## License

MIT License.

### Deterministic regression checks

```bash
npm ci
npm test
npx playwright install chromium
npm run test:extension:regression
```

The regression suite uses an isolated temporary Chromium profile and locally fulfilled pages, without Envato credentials. It covers automatic and manual preview navigation, widget destination boundaries, product context across item subpages, and removed-item toggles. Node tests cover domain lookalikes, observer lifecycle, and responses arriving out of order. The existing live smoke remains necessary to check Envato selectors and authenticated downloads against the real website.

Set `PLAYWRIGHT_CHROMIUM_EXECUTABLE` only when using an existing compatible Chromium executable. Temporary browser profiles are removed after the run; test output stays under the ignored `test-results/` directory.

### Versioning

The extension uses stable SemVer `X.Y.Z`. `package.json` is the version source, the npm version hook updates `manifest.json`, and npm updates `package-lock.json`. The About panel reads `chrome.runtime.getManifest().version`, so no UI version is hardcoded. Version `1.1.0` includes the functional improvements following `1.0.0`.

- `npm run release:patch`: compatible bug fixes (`1.1.0` → `1.1.1`).
- `npm run release:minor`: compatible new functionality (`1.1.0` → `1.2.0`).
- `npm run release:major`: incompatible behavior changes (`1.1.0` → `2.0.0`).

These commands update files without creating a Git commit or tag. Run them on the release feature branch, review the diff, run `npm test` and the extension regressions, then commit and merge into `develop` before merging into `main`. `npm run version:check` also runs in CI through `npm test` and rejects mismatches.

Chrome-compatible versions use exactly three numeric components, each between 0 and 65535, without leading zeroes, prerelease/build suffixes, or `0.0.0`. Reload the extension and refresh its host tab to see a new version in Settings > About.
