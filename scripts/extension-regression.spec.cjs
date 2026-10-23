const { test, expect, chromium } = require('@playwright/test');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
let context, profile, worker;
const itemUrl = 'https://themeforest.net/item/example/123';
const previewUrl = 'https://preview.themeforest.net/item/example/full_screen_preview/123';
const demoUrl = 'https://demo.example.org/';
const extensionPath = path.resolve(process.env.PLAYWRIGHT_EXTENSION_PATH || process.cwd());
const item = '<h1>Example Product</h1><div class="js-purchase-price">$29</div><a href="https://preview.themeforest.net/item/example/full_screen_preview/123">Preview</a>';
async function settings(patch) { await worker.evaluate(patch => chrome.storage.sync.set(patch), patch); }
async function panel(page) {
  await page.evaluate(() => document.dispatchEvent(new CustomEvent('envato-xperience:test', {detail: {action: 'openPanel'}})));
  await expect.poll(() => page.frames().find(f => f.url().includes('/sidepanel.html'))?.url()).toBeTruthy();
  return page.frames().find(f => f.url().includes('/sidepanel.html'));
}
test.beforeAll(async () => {
  profile = fs.mkdtempSync(path.join(os.tmpdir(), 'envato-regression-'));
  context = await chromium.launchPersistentContext(profile, {
    channel: 'chromium', headless: true,
    ...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE ? {executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE} : {}),
    args: [`--disable-extensions-except=${extensionPath}`, `--load-extension=${extensionPath}`],
  });
  worker = context.serviceWorkers()[0] || await context.waitForEvent('serviceworker');
  await context.route(/^https:\/\/(themeforest\.net|preview\.themeforest\.net|demo\.example\.org|demo\.example\.org\.other\.test|unrelated\.example\.test)\//, async route => {
    const url = new URL(route.request().url());
    let body = item;
    if (url.hostname.startsWith('preview.')) body = `<a class="t-link--hidden-reversed" href="${itemUrl}">Example Product</a><a class="buy-btn" href="https://themeforest.net/checkout/123">Buy</a><iframe class="full-screen-preview__frame" src="${demoUrl}"></iframe>`;
    else if (url.hostname === 'demo.example.org') body = '<h1>Live Demo</h1>';
    else if (url.pathname === '/downloads') body = '<ul class="list--downloads"><li class="download" id="item-456"><h3>Removed Product</h3><div class="download__unavailable">Unavailable</div><a href="/license/456">License certificate</a></li></ul>';
    await route.fulfill({contentType:'text/html', body: `<!doctype html><html><body>${body}</body></html>`});
  });
});

test('late preview iframe and src still redirect to the saved widget destination', async () => {
  await settings({autoRemove:true, widgetMode:true});
  const page = await context.newPage();
  await page.route(previewUrl, route => route.fulfill({contentType:'text/html', body:'<!doctype html><html><body><h1>Late preview</h1></body></html>'}));
  await page.goto(previewUrl);
  await panel(page); // Acknowledges that document_idle initialization completed.
  await page.evaluate(() => {
    const iframe = document.createElement('iframe');
    iframe.className = 'full-screen-preview__frame';
    document.body.appendChild(iframe);
  });
  await page.evaluate(url => { document.querySelector('iframe.full-screen-preview__frame').src = url; }, demoUrl);
  await page.waitForURL(demoUrl);
  await expect(page.locator('#envato-custom-widget-root')).toBeVisible();
  await page.close();
});

test('marketplace styles do not alter generic content on unrelated sites', async () => {
  await settings({autoRemove:false, widgetMode:false, hideAds:true, hideDeprecated:true});
  const page = await context.newPage();
  await page.goto('https://unrelated.example.test/');
  await panel(page);
  await page.evaluate(() => {
    const element = document.createElement('div');
    element.className = 'cross-sell'; element.textContent = 'Unrelated content';
    document.body.appendChild(element);
  });
  await expect(page.locator('.cross-sell')).toBeVisible();
  await expect(page.locator('html')).not.toHaveAttribute('data-envato-hide-ads');
  await expect(page.locator('html')).not.toHaveAttribute('data-envato-hide-deprecated');
  await page.close();
});

test('Admin controls persist and reverse marketplace suppression', async () => {
  await settings({autoRemove:false, widgetMode:false, hideAds:false, hideDeprecated:false});
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.setViewportSize({width:1440, height:900});
  await page.goto(itemUrl);
  await page.evaluate(() => {
    const element = document.createElement('div');
    element.className = 'cross-sell'; element.textContent = 'Marketplace promotion';
    document.body.appendChild(element);
  });
  const frame = await panel(page);
  await expect(frame.locator('#productTitleText')).toHaveText('Example Product');
  await frame.getByRole('button', {name:'Admin', exact:true}).click();
  const toggle = frame.locator('label.switch').filter({has:frame.locator('#adminHideAds')});
  await toggle.click();
  await expect(frame.locator('#adminHideAds')).toBeChecked();
  await expect(page.locator('.cross-sell')).toBeHidden();
  await expect.poll(() => frame.evaluate(async () => (await chrome.storage.sync.get('hideAds')).hideAds)).toBe(true);
  await toggle.click();
  await expect(frame.locator('#adminHideAds')).not.toBeChecked();
  await expect(page.locator('.cross-sell')).toBeVisible();
  await frame.locator('#openAdminSettings').click();
  await expect(frame.locator('#adminSettingsView')).toBeVisible();
  await frame.locator('#closeAdminSettings').click();
  await frame.getByRole('button', {name:'Status', exact:true}).click();
  await expect(frame.locator('#actionTab')).toHaveCSS('opacity','1');
  await expect(frame.locator('.tab-glider')).toHaveCSS('transform','none');
  await page.screenshot({path:path.join(os.tmpdir(),'envatoxperience-reconciled-panel.png')});
  await frame.locator('#closePanel').click();
  await expect(page.locator('#envato-xperience-root #panel-wrapper')).not.toHaveClass(/visible/);
  expect(errors).toEqual([]);
  await page.close();
});
test.afterAll(async () => {
  if (context) await context.close();
  if (profile) fs.rmSync(profile, {recursive:true, force:true});
});
test('auto redirect preserves widget actions only on the destination host', async () => {
  await settings({autoRemove:true, widgetMode:true});
  const page = await context.newPage();
  await page.goto(previewUrl);
  await page.waitForURL(demoUrl);
  await expect(page.locator('#envato-custom-widget-root').getByText('Example Product')).toBeVisible();
  await expect(page.locator('#envato-custom-widget-root').getByRole('link', {name:'Details'})).toHaveAttribute('href', itemUrl);
  await expect(page.locator('#envato-custom-widget-root').getByRole('link', {name:'Buy Now'})).toHaveAttribute('href', 'https://themeforest.net/checkout/123');
  await page.goto('https://demo.example.org.other.test/');
  await panel(page);
  await expect(page.locator('#envato-custom-widget-root')).toHaveCount(0);
  await page.close();
});
test('manual preview action works when auto redirect is disabled', async () => {
  await settings({autoRemove:false, widgetMode:false});
  const page = await context.newPage();
  await page.goto(previewUrl);
  const frame = await panel(page);
  expect(page.url()).toBe(previewUrl);
  await frame.locator('#removeNow').click();
  await page.waitForURL(demoUrl);
  await panel(page);
  await expect(page.locator('#envato-custom-widget-root')).toHaveCount(0);
  await page.close();
});
test('product identity continues across item, reviews, comments and support', async () => {
  await settings({autoRemove:false, widgetMode:false});
  const page = await context.newPage();
  for (const suffix of ['', '/reviews', '/comments', '/support']) {
    await page.goto(itemUrl + suffix);
    const frame = await panel(page);
    await expect(frame.locator('#extensionVersion')).toHaveText(require('../manifest.json').version);
    await expect(frame.locator('#productTitleText')).toHaveText('Example Product');
    await expect(frame.locator('#itemDetailsPrice')).toContainText('$29');
  }
  await page.close();
});
test('removed items restore visually, stop transforming while disabled and resume', async () => {
  await settings({hideDeprecated:true});
  const page = await context.newPage();
  await page.goto('https://themeforest.net/downloads');
  await expect(page.locator('.envato-xperience-removed-bar')).toBeVisible();
  await expect(page.locator('.ex-original-content')).toHaveCSS('max-height', '0px');
  await settings({hideDeprecated:false});
  await expect(page.locator('.envato-xperience-removed-bar')).toBeHidden();
  await expect(page.locator('.ex-original-content')).toHaveCSS('max-height', 'none');
  await page.evaluate(() => {
    const li = document.createElement('li'); li.id='item-789'; li.className='download';
    const unavailable = document.createElement('div'); unavailable.className='download__unavailable';
    li.append(unavailable); document.querySelector('ul').append(li);
  });
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  await expect(page.locator('#item-789')).not.toHaveAttribute('data-ex-processed', 'true');
  await settings({hideDeprecated:true});
  await expect(page.locator('#item-789 .envato-xperience-removed-bar')).toBeVisible();
  await page.close();
});
