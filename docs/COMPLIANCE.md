# Chrome Compliance Notes

## Current Technical Compliance Posture

- **Manifest V3 only**: the extension uses a service worker in `background.js` and does not rely on deprecated Manifest V2 behaviors.
- **Packaged logic only**: all JavaScript executed by the extension is bundled locally. The extension does not download or execute remote JavaScript at runtime.
- **No remote extension-page assets**: the floating panel no longer loads external Google Fonts. The panel now uses packaged local `Oswald` font files, which keeps the extension page self-contained.
- **Safer rendering**: product data extracted from Envato pages, including removed-items UI overlays, is rendered with DOM APIs and `textContent` instead of `innerHTML`.
- **Shadow DOM isolation**: injected UI stays isolated from host pages.
- **Early packaged overrides**: marketplace promo suppression is driven by bundled `document_start` assets (`marketplace-init.js` + `marketplace-overrides.css`) instead of remote resources or late inline style injection.
- **Scoped promo suppression**: `Hide Ads` is implemented through packaged selectors and a root `data-envato-hide-ads` flag on `<html>`, keeping the behavior deterministic and reviewable without remote policy lists.
- **Shared packaged helpers**: host detection, item identity parsing, and setting compatibility live in `envato-shared.js` so behavior stays consistent across `document_start`, `document_idle`, and panel contexts.
- **Scoped storage**: settings remain in `chrome.storage.sync`, preview context stays in `chrome.storage.local`, and cached product images live in `IndexedDB`. There is no remote backend and no analytics pipeline in the codebase.
- **Stable product mapping**: Envato `itemId` values from item URLs are used as the canonical internal key, which reduces heuristic matching across reviews/comments/support routes.
- **Contextual fallback UI**: non-item pages render explicit informational states instead of an indefinite product-loading state, which makes panel behavior deterministic and reviewable.

## Permission Rationale

- `storage`: required for user settings and short-lived preview context.
- `activeTab`: required to react to explicit action-button clicks.
- `host_permissions` including `<all_urls>`: required by the current Floating Widget design, because the extension injects a widget on the final redirected demo site, which may live on any origin.

## Important Store Review Notes

- The `<all_urls>` access must be justified clearly in the Chrome Web Store listing and in the extension description. It exists for a real feature, but it is still a broad permission.
- The extension should keep a **single-purpose** positioning: enhancing Envato preview and marketplace browsing while preserving purchase context on redirected demos.
- If the product is published, Mauricio should host a privacy disclosure page on a site he controls. Even if data stays local, the store listing should clearly state that the extension reads page metadata only to render the feature and does not transmit it to external servers.
- The Chrome Web Store developer account must have 2-Step Verification enabled before publishing updates.

## Manifest Notes

- `name`, `version`, `description`, and `homepage_url` are valid manifest fields used by this project.
- `author` is not added to `manifest.json`. This is intentional to stay within the documented manifest field set. The author is surfaced in the UI and project documentation instead.

## Pre-Publish Checklist

1. Reload the unpacked extension in the latest stable Chrome build.
2. Test both main modes:
   - Auto Remove on Envato preview pages.
   - Floating Widget on redirected external demo sites.
   - Hide Ads on Envato browse, `top-sellers`, account/download pages, and item pages, confirming there is no visible placeholder gap or delayed flicker on supported promo blocks.
3. Verify there are no console errors in:
   - the service worker
   - the Envato preview page
   - the redirected target site
4. Ensure the Chrome Web Store listing explains why broad host access is required.
5. Link a public privacy/disclosure page from the listing or homepage.

## Authenticated test data

Public CI uses synthetic fixtures without credentials. Real-account tests are isolated in a manual workflow restricted to main with protected-environment approval. Credentials exist only in environment secrets and the private process environment; browser profiles are temporary, diagnostics suppressed, and no authenticated artifacts are uploaded. See `AUTHENTICATED_SMOKE.md` for setup, origin restrictions, cleanup and limitations.
