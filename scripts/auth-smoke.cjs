// Private authenticated smoke: never print browser errors, page content or credentials.
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const LOGIN_ORIGINS = new Set(['https://themeforest.net', 'https://account.envato.com']);

function assertLoginOrigin(url) {
  const parsed = new URL(url);
  if (!LOGIN_ORIGINS.has(parsed.origin) || parsed.username || parsed.password) {
    throw new Error('Unsupported authentication origin.');
  }
}

function runPrivateSmoke({ env = process.env, spawn = spawnSync, log = console.log } = {}) {
  if (env.CI && (env.GITHUB_EVENT_NAME !== 'workflow_dispatch' || env.GITHUB_REF !== 'refs/heads/main' || env.GITHUB_REPOSITORY !== 'mvuljevas/EnvatoXperience')) {
    log('Authenticated smoke refused: trusted manual main run required.');
    return 1;
  }
  if (!env.ENVATO_TEST_USERNAME || !env.ENVATO_TEST_PASSWORD) {
    log('Authenticated smoke not run: required environment secrets are missing.');
    return 1;
  }
  const base = env.AUTH_SMOKE_ROOT || os.tmpdir();
  fs.mkdirSync(base, {recursive: true, mode: 0o700});
  const privateDir = fs.mkdtempSync(path.join(base, 'envato-private-'));
  fs.chmodSync(privateDir, 0o700);
  try {
    const childEnv = {};
    for (const key of ['PATH', 'HOME', 'TMPDIR', 'TEMP', 'TMP', 'SystemRoot', 'PLAYWRIGHT_BROWSERS_PATH', 'PLAYWRIGHT_CHROMIUM_EXECUTABLE']) {
      if (env[key]) childEnv[key] = env[key];
    }
    childEnv.ENVATO_TEST_USERNAME = env.ENVATO_TEST_USERNAME;
    childEnv.ENVATO_TEST_PASSWORD = env.ENVATO_TEST_PASSWORD;
    childEnv.ENVATO_PRIVATE_PROFILE = path.join(privateDir, 'profile');
    const result = spawn(process.execPath, [__filename, '--worker'], {
      env: childEnv, stdio: 'ignore', timeout: 120000, killSignal: 'SIGKILL',
    });
    const ok = result.status === 0;
    log(ok ? 'Authenticated downloads smoke passed.' : 'Authenticated downloads smoke failed; private diagnostics were suppressed.');
    return ok ? 0 : 1;
  } catch (_) {
    log('Authenticated smoke failed; private diagnostics were suppressed.');
    return 1;
  } finally {
    fs.rmSync(privateDir, {recursive: true, force: true});
  }
}

async function runWorker() {
  const { chromium } = require('@playwright/test');
  let context;
  try {
    context = await chromium.launchPersistentContext(process.env.ENVATO_PRIVATE_PROFILE, {
      channel: 'chromium', headless: true, acceptDownloads: false,
      viewport: {width:1440, height:1280},
      ...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE ? {executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE} : {}),
      args: [`--disable-extensions-except=${path.resolve(__dirname, '..')}`, `--load-extension=${path.resolve(__dirname, '..')}`],
    });
    const worker = context.serviceWorkers()[0] || await context.waitForEvent('serviceworker', {timeout:15000});
    await worker.evaluate(() => chrome.storage.sync.set({autoRemove:false, widgetMode:false, hideAds:true}));
    // Deny third-party POSTs, including accidental credential submission or analytics.
    await context.route('**/*', route => {
      const request = route.request();
      if (request.method() === 'POST' && !LOGIN_ORIGINS.has(new URL(request.url()).origin)) return route.abort();
      return route.continue();
    });
    const page = await context.newPage();
    page.setDefaultTimeout(15000);
    page.setDefaultNavigationTimeout(30000);
    await page.goto('https://themeforest.net/sign_in', {waitUntil:'domcontentloaded'});
    const username = page.locator('input[name="username"], input[name="email"], input[type="email"]').first();
    await username.waitFor({state:'visible'});
    assertLoginOrigin(page.url());
    await username.fill(process.env.ENVATO_TEST_USERNAME);
    const password = page.locator('input[name="password"], input[type="password"]').first();
    await password.waitFor({state:'visible'});
    assertLoginOrigin(page.url());
    await password.fill(process.env.ENVATO_TEST_PASSWORD);
    assertLoginOrigin(page.url());
    await Promise.all([
      page.waitForURL(url => url.hostname === 'themeforest.net' && !url.pathname.includes('/sign_in'), {timeout:30000}),
      page.getByRole('button', {name:/^sign in$/i}).first().click(),
    ]);
    await page.goto('https://themeforest.net/downloads', {waitUntil:'domcontentloaded'});
    await page.locator('.list--downloads, .list-downloads[data-view="downloads"]').first().waitFor({state:'attached'});
    await page.waitForFunction(() => document.documentElement.dataset.envatoHideAds === 'true');
    const valid = await page.evaluate(() => {
      const content = document.querySelector('#content > .grid-container.h-mb3 > div > .content-l');
      const sidebar = document.querySelector('#content > .grid-container.h-mb3 > div > .sidebar-s.sidebar-right');
      return Boolean(content && parseFloat(getComputedStyle(content).width) > 900 && (!sidebar || getComputedStyle(sidebar).display === 'none'));
    });
    if (!valid) throw new Error('Downloads layout check failed.');
  } finally {
    if (context) await context.close();
  }
}

if (require.main === module) {
  if (process.argv.includes('--worker')) {
    runWorker().catch(() => { process.exitCode = 1; });
  } else {
    try { process.exitCode = runPrivateSmoke(); }
    catch (_) { console.error('Authenticated smoke failed; private diagnostics were suppressed.'); process.exitCode = 1; }
  }
}
module.exports = { assertLoginOrigin, runPrivateSmoke };
