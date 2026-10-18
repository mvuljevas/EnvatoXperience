const fs = require("fs");
const path = require("path");
const { test, expect, chromium } = require("@playwright/test");

const rootDir = process.cwd();
const localEnv = loadLocalEnv(path.join(rootDir, ".env.local"));
const resolvedChromeProfile = resolveChromeProfile(
  process.env.PLAYWRIGHT_EXTENSION_PROFILE_DIR ||
    path.join(rootDir, ".playwright/chrome-extension-dev"),
);

const smokeConfig = {
  extensionPath: path.resolve(
    process.env.PLAYWRIGHT_EXTENSION_PATH || rootDir,
  ),
  userDataDir: resolvedChromeProfile.userDataDir,
  profileDirectory: resolvedChromeProfile.profileDirectory,
  browserChannel: process.env.PLAYWRIGHT_EXTENSION_CHANNEL || "chromium",
  headless: process.env.PLAYWRIGHT_EXTENSION_HEADLESS === "true",
  viewport: { width: 1440, height: 1280 },
  itemUrl:
    process.env.SMOKE_ITEM_URL ||
    "https://themeforest.net/item/woodmart-woocommerce-wordpress-theme/20264492",
  topSellersUrl:
    process.env.SMOKE_TOP_SELLERS_URL || "https://themeforest.net/top-sellers",
  accountUrl:
    process.env.ENVATO_ACCOUNT_URL ||
    localEnv.ENVATO_ACCOUNT_URL ||
    "https://themeforest.net/downloads",
  username:
    process.env.ENVATO_TEST_USERNAME ||
    localEnv.ENVATO_TEST_USERNAME ||
    process.env.ENVATO_TEST_EMAIL ||
    localEnv.ENVATO_TEST_EMAIL ||
    "",
  password:
    process.env.ENVATO_TEST_PASSWORD || localEnv.ENVATO_TEST_PASSWORD || "",
};

const testBridgeEventName = "envato-xperience:test";

let context;
let extensionId;
let serviceWorker;

test.beforeAll(async () => {
  context = await chromium.launchPersistentContext(smokeConfig.userDataDir, {
    channel: smokeConfig.browserChannel,
    ...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE
      ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE }
      : {}),
    headless: smokeConfig.headless,
    viewport: smokeConfig.viewport,
    args: [
      `--disable-extensions-except=${smokeConfig.extensionPath}`,
      `--load-extension=${smokeConfig.extensionPath}`,
      ...(smokeConfig.profileDirectory
        ? [`--profile-directory=${smokeConfig.profileDirectory}`]
        : []),
    ],
  });

  serviceWorker = context.serviceWorkers()[0];
  if (!serviceWorker) {
    serviceWorker = await context.waitForEvent("serviceworker");
  }

  extensionId = new URL(serviceWorker.url()).host;
});

test.afterAll(async () => {
  if (context) {
    await context.close();
  }
});

test("opens the floating panel on an item page", async ({}, testInfo) => {
  await setExtensionSettings({
    autoRemove: false,
    widgetMode: false,
    hideAds: false,
  });

  const page = await context.newPage();
  await page.goto(smokeConfig.itemUrl, { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => document.readyState === "complete");

  await dispatchContentTestEvent(page, "openPanel");
  await page.waitForFunction(() => {
    const host = document.querySelector("#envato-xperience-root");
    const wrapper = host?.shadowRoot?.querySelector("#panel-wrapper");
    return Boolean(wrapper?.classList.contains("visible"));
  });

  const panelFrame = await waitForPanelFrame(page, extensionId);
  await expect(panelFrame.locator(".tab-btn.active")).toHaveText(/status/i);
  await expect(panelFrame.locator("#itemDetailsContainer")).toBeVisible();

  await page.screenshot({
    path: testInfo.outputPath("item-panel.png"),
    fullPage: false,
  });

  await page.close();
});

test("hides supported ads on top sellers", async ({}, testInfo) => {
  await setExtensionSettings({
    autoRemove: false,
    widgetMode: false,
    hideAds: true,
  });

  const page = await context.newPage();
  await page.goto(smokeConfig.topSellersUrl, { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => {
    return document.documentElement.dataset.envatoHideAds === "true";
  });

  await page.waitForFunction(() => {
    const sidebar = document.querySelector(
      ".shared-items_grid_with_sidebar_component__sidebar",
    );
    return !sidebar || getComputedStyle(sidebar).display === "none";
  });

  await page.screenshot({
    path: testInfo.outputPath("top-sellers-hide-ads.png"),
    fullPage: false,
  });

  await page.close();
});

test("collapses downloads promos when authenticated", async ({}, testInfo) => {
  test.skip(
    !smokeConfig.accountUrl,
    "Set ENVATO_ACCOUNT_URL in .env.local to validate downloads/account views.",
  );

  await setExtensionSettings({
    autoRemove: false,
    widgetMode: false,
    hideAds: true,
  });

  const page = await context.newPage();
  const authenticated = await ensureLoggedIn(page);
  if (!authenticated && (!smokeConfig.username || !smokeConfig.password)) {
    test.skip(
      true,
      "Provide ENVATO_TEST_USERNAME and ENVATO_TEST_PASSWORD or reuse an existing logged-in profile via PLAYWRIGHT_EXTENSION_PROFILE_DIR.",
    );
  }

  expect(authenticated).toBeTruthy();

  await navigateToDownloads(page);
  await page.waitForFunction(() => {
    return document.documentElement.dataset.envatoHideAds === "true";
  });

  await page.waitForFunction(() => {
    const sidebar = document.querySelector(
      "#content > .grid-container.h-mb3 > div > .sidebar-s.sidebar-right",
    );
    return !sidebar || getComputedStyle(sidebar).display === "none";
  });

  const metrics = await page.evaluate(() => {
    const content = document.querySelector(
      "#content > .grid-container.h-mb3 > div > .content-l",
    );
    const sidebar = document.querySelector(
      "#content > .grid-container.h-mb3 > div > .sidebar-s.sidebar-right",
    );
    return {
      contentWidth: content ? getComputedStyle(content).width : null,
      sidebarDisplay: sidebar ? getComputedStyle(sidebar).display : "missing",
    };
  });

  expect(["none", "missing"]).toContain(metrics.sidebarDisplay);
  expect(parseFloat(metrics.contentWidth || "0")).toBeGreaterThan(900);

  await page.screenshot({
    path: testInfo.outputPath("downloads-hide-ads.png"),
    fullPage: false,
  });

  await page.close();
});

async function setExtensionSettings(patch) {
  const settingsPage = await context.newPage();
  await settingsPage.goto(`chrome-extension://${extensionId}/sidepanel.html`, {
    waitUntil: "domcontentloaded",
  });
  await settingsPage.evaluate(async (nextSettings) => {
    await chrome.storage.sync.set(nextSettings);

    if (Object.prototype.hasOwnProperty.call(nextSettings, "hideAds")) {
      await chrome.storage.local.set({
        envatoXperienceHideAds: nextSettings.hideAds === true,
      });
    }
  }, patch);
  await settingsPage.close();
}

async function dispatchContentTestEvent(page, action) {
  await page.evaluate(
    ({ eventName, nextAction }) => {
      document.dispatchEvent(
        new CustomEvent(eventName, {
          detail: {
            action: nextAction,
            requestId: `${nextAction}-${Date.now()}`,
          },
        }),
      );
    },
    { eventName: testBridgeEventName, nextAction: action },
  );
}

async function waitForPanelFrame(page, currentExtensionId) {
  await page.waitForFunction(() => {
    const host = document.querySelector("#envato-xperience-root");
    return Boolean(host?.shadowRoot?.querySelector("iframe"));
  });

  const findFrame = () => page.frames().find((candidate) =>
    candidate.url().startsWith(`chrome-extension://${currentExtensionId}/sidepanel.html`),
  );
  await expect.poll(() => Boolean(findFrame())).toBeTruthy();
  return findFrame();
}

async function ensureLoggedIn(page) {
  await page.goto(smokeConfig.accountUrl, { waitUntil: "domcontentloaded" });

  if (await hasDownloadsLayout(page)) {
    return true;
  }

  if (!smokeConfig.username || !smokeConfig.password) {
    return false;
  }

  await page.goto("https://themeforest.net/sign_in", {
    waitUntil: "domcontentloaded",
  });

  const usernameField = page.locator(
    'input[name="username"], input[name="email"], input[type="email"]',
  );
  const passwordField = page.locator('input[name="password"], input[type="password"]');
  const submitButton = page.getByRole("button", { name: /^sign in$/i });

  await usernameField.first().fill(smokeConfig.username);
  await passwordField.first().fill(smokeConfig.password);
  await submitButton.first().click();
  await page.waitForURL((url) => !url.pathname.includes("/sign_in"), {
    timeout: 30 * 1000,
  });

  return navigateToDownloads(page);
}

async function hasDownloadsLayout(page) {
  return page.evaluate(() => {
    return Boolean(
      document.querySelector("#content > .grid-container.h-mb3 > div > .content-l"),
    );
  });
}

async function navigateToDownloads(page) {
  await page.goto(smokeConfig.accountUrl, { waitUntil: "domcontentloaded" });
  if (await hasDownloadsLayout(page)) {
    return true;
  }

  const accountHomeUrl = new URL(smokeConfig.accountUrl);
  await page.goto(`${accountHomeUrl.origin}/`, { waitUntil: "domcontentloaded" });

  const userMenuTrigger = page.locator("a").filter({
    hasText: new RegExp(smokeConfig.username, "i"),
  }).first();

  if (await userMenuTrigger.count()) {
    await userMenuTrigger.hover({ force: true });
  }

  const downloadsLink = page.getByRole("link", { name: /^downloads$/i }).first();
  await downloadsLink.waitFor({ state: "visible", timeout: 15 * 1000 });
  await downloadsLink.click();
  await page.waitForLoadState("domcontentloaded");

  return hasDownloadsLayout(page);
}

function loadLocalEnv(envFilePath) {
  if (!fs.existsSync(envFilePath)) {
    return {};
  }

  const result = {};
  const lines = fs.readFileSync(envFilePath, "utf8").split(/\r?\n/);

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;

    const separatorIndex = line.indexOf("=");
    if (separatorIndex === -1) continue;

    const key = line.slice(0, separatorIndex).trim();
    let value = line.slice(separatorIndex + 1).trim();

    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    result[key] = value;
  }

  return result;
}

function resolveChromeProfile(inputPath) {
  const resolvedPath = path.resolve(inputPath);
  const baseName = path.basename(resolvedPath);

  if (/^(Default|Profile \d+)$/i.test(baseName)) {
    return {
      userDataDir: path.dirname(resolvedPath),
      profileDirectory: baseName,
    };
  }

  return {
    userDataDir: resolvedPath,
    profileDirectory: "",
  };
}
