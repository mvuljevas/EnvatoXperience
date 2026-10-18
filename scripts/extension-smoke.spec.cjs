const path = require("path");
const { test, expect, chromium } = require("@playwright/test");

const rootDir = process.cwd();
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
