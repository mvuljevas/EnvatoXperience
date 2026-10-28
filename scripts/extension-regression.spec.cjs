const { test, expect, chromium } = require('@playwright/test');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
let context, profile, worker;
const itemUrl = 'https://themeforest.net/item/example/123';
const previewUrl = 'https://preview.themeforest.net/item/example/full_screen_preview/123';
const demoUrl = 'https://demo.example.org/';
const extensionPath = path.resolve(process.env.PLAYWRIGHT_EXTENSION_PATH || process.cwd());
const item = '<h1>Example Product</h1><meta name="description" content="A clean, flexible theme for creative studios."><div class="js-purchase-price">$29</div><div class="item-preview"><img src="https://demo.example.org/widget-featured.svg"></div><div class="author-header"><a href="/user/example-studio">Example Studio</a><img class="avatar" src="https://demo.example.org/widget-avatar.svg"></div><meta itemprop="ratingValue" content="4.2"><meta itemprop="reviewCount" content="128"><table><tr><td>Created</td><td>12 January 2024</td></tr></table><time class="updated">18 October 2026</time><a target="_blank" href="https://preview.themeforest.net/item/example/full_screen_preview/123">Preview</a>';

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
    if (url.pathname === '/widget-featured.svg') return route.fulfill({contentType:'image/svg+xml', body:'<svg xmlns="http://www.w3.org/2000/svg" width="600" height="324"><rect width="600" height="324" fill="#101310"/><rect x="310" y="30" width="260" height="290" fill="#e9ede5"/><text x="25" y="60" fill="white" font-family="Arial" font-size="24" font-weight="bold">Example Studio.</text><text x="25" y="150" fill="white" font-family="Arial" font-size="32">Made for</text><text x="25" y="190" fill="white" font-family="Arial" font-size="32">creative minds.</text><rect x="340" y="90" width="195" height="120" fill="#79a824"/></svg>'});
    if (url.pathname === '/widget-avatar.svg') return route.fulfill({contentType:'image/svg+xml', body:'<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48"><rect width="48" height="48" rx="10" fill="#e8ecdf"/><text x="24" y="30" text-anchor="middle" font-family="Arial" font-size="18" fill="#345322">ES</text></svg>'});
    let body = item;
    if (url.hostname.startsWith('preview.')) body = `<title>Example Product Preview - ThemeForest</title><a class="buy-btn" href="https://themeforest.net/checkout/123">Buy</a><iframe class="full-screen-preview__frame" src="${demoUrl}"></iframe>`;
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
test('auto redirect preserves widget actions only on the destination host', async ({}, testInfo) => {
  await settings({autoRemove:true, widgetMode:true});
  await worker.evaluate(() => chrome.storage.local.remove('envatoWidgetIntroSeen'));
  const page = await context.newPage();
  await page.goto(itemUrl);
  await expect.poll(() => worker.evaluate(async () => Object.entries(await chrome.storage.session.get(null)).some(([key,value]) => key.startsWith('envatoWidgetSource:') && value.imageUrl && value.avatarUrl))).toBeTruthy();
  await page.goto(previewUrl);
  await page.waitForURL(demoUrl);
  await expect(page.locator('#envato-custom-widget-root').getByText('Example Product')).toBeVisible();
  await expect(page.locator('#envato-custom-widget-root').getByRole('link', {name:'Back to item'})).toHaveAttribute('href', itemUrl);
  await expect(page.locator('#envato-custom-widget-root').getByRole('link', {name:'Buy now'})).toHaveAttribute('href', 'https://themeforest.net/checkout/123');
  const widget = page.locator('#envato-custom-widget-root');
  await expect(widget.getByRole('button', {name:'Collapse product details'})).toHaveAttribute('aria-expanded', 'true');
  await expect(widget.getByText('4.2 · 128 ratings')).toBeVisible();
  await expect(widget.getByText('12 January 2024')).toBeVisible();
  await widget.locator('.card').hover();
  const bounds = await widget.boundingBox();
  await page.screenshot({path:testInfo.outputPath('widget-expanded.png'), clip:{x:0, y:Math.max(0,bounds.y-12), width:360, height:Math.min(bounds.height+24, page.viewportSize().height-bounds.y+12)}});
  // Hover pauses the introduction; leaving starts its four-second countdown.
  await page.waitForTimeout(4100);
  await expect(widget.locator('.toggle')).toHaveAttribute('aria-expanded','true');
  await page.mouse.move(900,10);
  await expect(widget.locator('.toggle')).toHaveAttribute('aria-expanded','false',{timeout:5000});
  await page.screenshot({path:testInfo.outputPath('widget-collapsed.png')});
  await page.reload();
  await expect(page.locator('#envato-custom-widget-root .toggle')).toHaveAttribute('aria-expanded','false');
  await page.locator('#envato-custom-widget-root .toggle').click();
  await expect(page.locator('#envato-custom-widget-root .toggle')).toHaveAttribute('aria-expanded','true');
  await page.locator('#envato-custom-widget-root .toggle').press('Escape');
  await expect(page.locator('#envato-custom-widget-root .toggle')).toHaveAttribute('aria-expanded','false');
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

test('widget remains usable on narrow screens and omits unavailable or unsafe data', async () => {
  await settings({autoRemove:false, widgetMode:true});
  const page = await context.newPage();
  await page.setViewportSize({width:375,height:667});
  await page.goto(demoUrl);
  await worker.evaluate(async () => {
    await chrome.storage.local.set({envatoWidgetIntroSeen:true});
    const tabs = await chrome.tabs.query({url:'https://demo.example.org/'});
    await chrome.storage.session.set({[`envatoWidgetContext:${tabs[0].id}`]:{
      title:'<img src=x onerror="window.widgetInjected=true">', itemId:'456', itemUrl:'https://themeforest.net/item/other/456', buyUrl:'javascript:alert(1)', imageUrl:'javascript:alert(1)', savedAt:Date.now(), timestamp:Date.now(), targetDomain:'demo.example.org',
    }});
  });
  await page.reload();
  const widget = page.locator('#envato-custom-widget-root');
  await widget.locator('.toggle').click();
  await expect(widget.locator('h2')).toHaveText('<img src=x onerror="window.widgetInjected=true">');
  await expect(widget.locator('.featured, .rating, .dates, .buy')).toHaveCount(0);
  await expect(widget.getByRole('link',{name:'Back to item'})).toBeVisible();
  await expect.poll(async () => Math.round((await widget.locator('.card').boundingBox()).x)).toBe(0);
  const card = await widget.locator('.card').boundingBox();
  expect(card.x).toBeGreaterThanOrEqual(0);
  expect(card.x+card.width+44).toBeLessThanOrEqual(375);
  expect(card.y+card.height).toBeLessThanOrEqual(667);
  expect(await page.evaluate(() => window.widgetInjected)).toBeUndefined();
  await widget.locator('.toggle').press('Escape');
  await expect(widget.locator('.toggle')).toHaveAttribute('aria-expanded','false');
  await page.close();
});

test('disabling widget mode removes the drawer and clears its temporary context', async () => {
  await settings({widgetMode:true});
  const page = await context.newPage();
  await page.goto(demoUrl);
  await worker.evaluate(async () => {
    const tabs = await chrome.tabs.query({url:'https://demo.example.org/'});
    await chrome.storage.session.set({[`envatoWidgetContext:${tabs[0].id}`]:{
      title:'Example Product', itemId:'123', itemUrl:'https://themeforest.net/item/example/123',
      buyUrl:'https://themeforest.net/checkout/123', targetDomain:'demo.example.org', savedAt:Date.now(),
    }});
  });
  await page.reload();
  await expect(page.locator('#envato-custom-widget-root')).toBeVisible();
  await settings({widgetMode:false});
  await expect(page.locator('#envato-custom-widget-root')).toHaveCount(0);
  await expect.poll(() => worker.evaluate(async () =>
    Object.keys(await chrome.storage.session.get(null)).filter(key => key.startsWith('envatoWidget')).length
  )).toBe(0);
  await page.close();
});

test('live preview in a new tab receives real source DOM images and discards context when closed', async () => {
  await settings({autoRemove:true,widgetMode:true});
  const source = await context.newPage();
  await source.goto(itemUrl);
  await expect.poll(() => worker.evaluate(async () => Object.entries(await chrome.storage.session.get(null)).some(([key,value]) => key.startsWith('envatoWidgetSource:') && value.avatarUrl))).toBeTruthy();
  const opened = context.waitForEvent('page');
  await source.getByRole('link',{name:'Preview',exact:true}).click();
  const demo = await opened;
  await demo.waitForURL(demoUrl);
  const widget = demo.locator('#envato-custom-widget-root');
  await widget.locator('.toggle').click();
  await expect(widget.locator('.featured')).toHaveAttribute('src','https://demo.example.org/widget-featured.svg');
  await expect(widget.locator('.avatar')).toHaveAttribute('src','https://demo.example.org/widget-avatar.svg');
  await expect(widget.getByRole('link',{name:'Back to item'})).toHaveAttribute('href',itemUrl);
  await source.close();
  await expect(widget.locator('.featured')).toBeVisible();
  await demo.close();
  await expect.poll(() => worker.evaluate(async () => Object.keys(await chrome.storage.session.get(null)).filter(key => key.startsWith('envatoWidget')).length)).toBe(0);
});

test('enabling the widget after item load captures current and late-loading author imagery', async () => {
  await settings({autoRemove:true,widgetMode:false});
  const page = await context.newPage();
  await page.goto(itemUrl);
  await settings({widgetMode:true});
  await page.evaluate(() => { document.querySelector('img.avatar').src='https://demo.example.org/widget-avatar.svg?updated=1'; });
  await expect.poll(() => worker.evaluate(async () => Object.entries(await chrome.storage.session.get(null)).some(([key,value]) => key.startsWith('envatoWidgetSource:') && value.avatarUrl?.endsWith('?updated=1')))).toBeTruthy();
  await page.goto('https://demo.example.org.other.test/');
  await expect.poll(() => worker.evaluate(async () => Object.keys(await chrome.storage.session.get(null)).filter(key => key.startsWith('envatoWidget')).length)).toBe(0);
  await page.close();
});
