/**
 * Envato XPerience - Sidepanel Script
 * Handles user interactions and communicates with the host page via messaging.
 */

document.addEventListener("DOMContentLoaded", function () {
  const shared = window.EnvatoXperienceShared;
  const svgNs = "http://www.w3.org/2000/svg";
  const storageKeys = shared
    ? shared.STORAGE_KEYS
    : {
        autoRemove: "autoRemove",
        widgetMode: "widgetMode",
        hideAds: "hideAds",
        legacyHideAds: "hidePromoBar",
        hideAdsMirror: "envatoXperienceHideAds",
        hideDeprecated: "hideDeprecated",
        hideDeprecatedMirror: "envatoXperienceHideDeprecated",
      };
  const defaultSettings = Object.freeze({
    autoRemove: true,
    widgetMode: false,
    hideAds: false,
    hideDeprecated: false,
  });

  let contextRevision = 0;
  let currentImageObjectUrl = null;
  let settingsState = { ...defaultSettings };

  const tabButtons = document.querySelectorAll(".tab-btn");
  const tabPanels = document.querySelectorAll(".tab-panel");
  const tabsContainer = document.querySelector(".tabs");

  const envatoControls = document.getElementById("envatoControls");
  const notEnvatoMessage = document.getElementById("notEnvatoMessage");
  const removeNowBtn = document.getElementById("removeNow");
  const closeBtn = document.getElementById("closePanel");
  const contentArea = document.querySelector(".content-area");
  const adminMainView = document.getElementById("adminMainView");
  const adminSettingsView = document.getElementById("adminSettingsView");
  const openAdminSettingsBtn = document.getElementById("openAdminSettings");
  const closeAdminSettingsBtn = document.getElementById("closeAdminSettings");

  const envatoDomainPrefix = document.getElementById("envatoDomainPrefix");
  const envatoDomainSite = document.getElementById("envatoDomainSite");
  const statusEmptyState = document.getElementById("statusEmptyState");
  const statusStateEyebrow = document.getElementById("statusStateEyebrow");
  const statusStateTitle = document.getElementById("statusStateTitle");
  const statusStateBody = document.getElementById("statusStateBody");
  const statusStateHelper = document.getElementById("statusStateHelper");

  const autoRemoveStatus = document.getElementById("autoRemoveStatus");
  const widgetStatus = document.getElementById("widgetStatus");
  const hideAdsStatus = document.getElementById("hideAdsStatus");
  const hideDeprecatedStatus = document.getElementById("hideDeprecatedStatus");

  const itemDetailsContainer = document.getElementById("itemDetailsContainer");
  const itemDetailsImage = document.getElementById("itemDetailsImage");
  const itemImageWrapper = document.querySelector(".image-wrapper");
  const productTitleText = document.getElementById("productTitleText");
  const productMetaText = document.getElementById("productMetaText");
  const itemDetailsPreview = document.getElementById("itemDetailsPreview");

  const settingInputs = Array.from(document.querySelectorAll("input[data-setting]"));
  const settingInputMap = settingInputs.reduce((map, input) => {
    const key = input.dataset.setting;
    if (!map.has(key)) {
      map.set(key, []);
    }
    map.get(key).push(input);
    return map;
  }, new Map());

  function clearChildren(element) {
    if (element) {
      element.replaceChildren();
    }
  }

  function clearImageObjectUrl() {
    if (currentImageObjectUrl) {
      URL.revokeObjectURL(currentImageObjectUrl);
      currentImageObjectUrl = null;
    }
  }

  function setStatusPill(element, label, enabled) {
    if (!element) return;
    element.textContent = `${label} ${enabled ? "On" : "Off"}`;
    element.classList.toggle("is-on", enabled);
    element.classList.toggle("is-off", !enabled);
  }

  function applySettingState(nextState) {
    settingsState = { ...settingsState, ...nextState };

    settingInputMap.forEach((inputs, key) => {
      const checked = settingsState[key] === true;
      inputs.forEach((input) => {
        input.checked = checked;
      });
    });

    refreshStatusPills();
  }

  function refreshStatusPills() {
    setStatusPill(autoRemoveStatus, "Auto Remove", settingsState.autoRemove);
    setStatusPill(widgetStatus, "Floating Widget", settingsState.widgetMode);
    setStatusPill(hideAdsStatus, "Hide Ads", settingsState.hideAds);
    setStatusPill(
      hideDeprecatedStatus,
      "Hide Removed",
      settingsState.hideDeprecated,
    );
  }

  function showAdminSettings() {
    if (adminMainView) adminMainView.classList.add("hidden");
    if (adminSettingsView) adminSettingsView.classList.remove("hidden");
    if (contentArea) contentArea.scrollTop = 0;
  }

  function hideAdminSettings() {
    if (adminSettingsView) adminSettingsView.classList.add("hidden");
    if (adminMainView) adminMainView.classList.remove("hidden");
  }

  function renderDomainHeading(prefix, siteName) {
    if (envatoDomainPrefix) envatoDomainPrefix.textContent = prefix;
    if (envatoDomainSite) envatoDomainSite.textContent = siteName || "";
  }

  function setImageSource(imageEl, source) {
    if (!imageEl) return;

    if (!source) {
      clearImageObjectUrl();
      imageEl.removeAttribute("src");
      imageEl.style.display = "none";
      if (itemImageWrapper) itemImageWrapper.style.display = "none";
      return;
    }

    if (source instanceof Blob) {
      clearImageObjectUrl();
      currentImageObjectUrl = URL.createObjectURL(source);
      imageEl.src = currentImageObjectUrl;
      imageEl.style.display = "block";
      if (itemImageWrapper) itemImageWrapper.style.display = "block";
      return;
    }

    clearImageObjectUrl();
    imageEl.src = source;
    imageEl.style.display = "block";
    if (itemImageWrapper) itemImageWrapper.style.display = "block";
  }

  function resetProductCard() {
    if (itemDetailsContainer) itemDetailsContainer.classList.add("hidden");
    if (productTitleText) productTitleText.textContent = "";
    if (productMetaText) {
      productMetaText.textContent = "";
      productMetaText.classList.add("hidden");
    }
    if (itemDetailsPreview) {
      itemDetailsPreview.removeAttribute("href");
      itemDetailsPreview.classList.add("hidden");
    }
    setImageSource(itemDetailsImage, null);
  }

  function renderContextState({ eyebrow, title, body, helper, tone = "neutral" }) {
    resetProductCard();
    refreshStatusPills();

    if (statusEmptyState) {
      statusEmptyState.dataset.tone = tone;
      statusEmptyState.classList.remove("hidden");
    }
    if (statusStateEyebrow) statusStateEyebrow.textContent = eyebrow;
    if (statusStateTitle) statusStateTitle.textContent = title;
    if (statusStateBody) statusStateBody.textContent = body;
    if (statusStateHelper) statusStateHelper.textContent = helper;
  }

  function hideContextState() {
    if (statusEmptyState) {
      statusEmptyState.classList.add("hidden");
    }
  }

  async function resolveProductImage(itemId, details) {
    if (!details) return null;

    if (!itemId || !window.EnvatoImageCache) {
      return details.imageUrl || null;
    }

    try {
      if (details.isHighResImage && details.imageUrl) {
        const cached = await window.EnvatoImageCache.cacheImage(
          itemId,
          details.imageUrl,
        );
        if (cached && cached.blob) return cached.blob;
      }

      const existing = await window.EnvatoImageCache.getImage(itemId);
      if (existing && existing.blob) {
        return existing.blob;
      }
    } catch (error) {
      console.warn(
        "[Envato XPerience] Image cache unavailable, falling back to source URL.",
        error,
      );
    }

    return details.imageUrl || null;
  }

  function createSvgElement(tagName, attributes = {}) {
    const element = document.createElementNS(svgNs, tagName);
    Object.entries(attributes).forEach(([name, value]) => {
      element.setAttribute(name, value);
    });
    return element;
  }

  function createStarSvg(fill, gradientId) {
    const svg = createSvgElement("svg", {
      width: "14",
      height: "14",
      viewBox: "0 0 24 24",
    });
    const pathD =
      "M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z";

    if (gradientId && typeof fill === "number" && fill > 0 && fill < 100) {
      const defs = createSvgElement("defs");
      const gradient = createSvgElement("linearGradient", { id: gradientId });
      gradient.appendChild(
        createSvgElement("stop", {
          offset: `${fill}%`,
          "stop-color": "#f5a623",
        }),
      );
      gradient.appendChild(
        createSvgElement("stop", {
          offset: `${fill}%`,
          "stop-color": "#e9ecef",
        }),
      );
      defs.appendChild(gradient);
      svg.appendChild(defs);
      svg.appendChild(createSvgElement("path", { d: pathD, fill: `url(#${gradientId})` }));
      return svg;
    }

    svg.setAttribute("fill", fill);
    svg.appendChild(createSvgElement("path", { d: pathD }));
    return svg;
  }

  function renderMeta(metaEl, response) {
    if (!metaEl) return;

    clearChildren(metaEl);

    const author = response.author || "";
    const category = response.category || "";

    if (!author && !category) {
      metaEl.classList.add("hidden");
      return;
    }

    metaEl.classList.remove("hidden");

    if (author) {
      metaEl.appendChild(document.createTextNode("by "));
      const authorName = document.createElement("strong");
      authorName.textContent = author;
      metaEl.appendChild(authorName);
    }

    if (author && category) {
      metaEl.appendChild(document.createTextNode(" in "));
    }

    if (category) {
      const categoryName = document.createElement("strong");
      categoryName.textContent = category;
      metaEl.appendChild(categoryName);
    }
  }

  function renderPrice(priceEl, response) {
    if (!priceEl) return;

    clearChildren(priceEl);

    if (response.oldPrice) {
      const oldPrice = document.createElement("span");
      oldPrice.className = "product-price-old";
      oldPrice.textContent = response.oldPrice;
      priceEl.appendChild(oldPrice);
    }

    const currentPrice = document.createElement("span");
    currentPrice.className = response.oldPrice
      ? "product-price-current"
      : "product-price-current is-regular";
    currentPrice.textContent = response.price || "--";
    priceEl.appendChild(currentPrice);
  }

  function renderSales(salesEl, response) {
    if (!salesEl) return;

    clearChildren(salesEl);

    const cartSvg = createSvgElement("svg", {
      width: "14",
      height: "14",
      viewBox: "0 0 24 24",
      fill: "none",
      stroke: "currentColor",
      "stroke-width": "2",
      "stroke-linecap": "round",
      "stroke-linejoin": "round",
      style: "color:#6c757d;",
    });
    cartSvg.appendChild(createSvgElement("circle", { cx: "9", cy: "21", r: "1" }));
    cartSvg.appendChild(createSvgElement("circle", { cx: "20", cy: "21", r: "1" }));
    cartSvg.appendChild(
      createSvgElement("path", {
        d: "M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6",
      }),
    );

    const textWrapper = document.createElement("div");
    textWrapper.className = "product-sales-copy";

    const salesValue = document.createElement("span");
    salesValue.className = "product-sales-value";
    salesValue.textContent = response.sales || "--";

    const salesLabel = document.createElement("span");
    salesLabel.className = "product-sales-label";
    salesLabel.textContent = "Sales";

    textWrapper.appendChild(salesValue);
    textWrapper.appendChild(salesLabel);

    salesEl.appendChild(cartSvg);
    salesEl.appendChild(textWrapper);
  }

  function renderPreviewButton(previewEl, response) {
    if (!previewEl) return;

    if (response.livePreviewUrl) {
      previewEl.href = response.livePreviewUrl;
      previewEl.classList.remove("hidden");
      return;
    }

    previewEl.removeAttribute("href");
    previewEl.classList.add("hidden");
  }

  function parseCompactNumber(value) {
    if (typeof value === "number" && Number.isFinite(value)) {
      return value;
    }

    if (!value || typeof value !== "string") {
      return null;
    }

    const normalized = value.trim().replace(/,/g, "").toUpperCase();
    const match = normalized.match(/^(\d+(?:\.\d+)?)([KM])?$/);
    if (!match) {
      return null;
    }

    const numeric = parseFloat(match[1]);
    if (!Number.isFinite(numeric)) {
      return null;
    }

    if (match[2] === "K") return numeric * 1000;
    if (match[2] === "M") return numeric * 1000000;

    return numeric;
  }

  function formatEnvatoCompactCount(value) {
    const numericValue = parseCompactNumber(value);
    if (!Number.isFinite(numericValue)) {
      return value || "";
    }

    if (numericValue < 1000) {
      return Math.round(numericValue).toString();
    }

    return new Intl.NumberFormat("en-US", {
      notation: "compact",
      compactDisplay: "short",
      maximumFractionDigits: 1,
    })
      .format(numericValue)
      .replace("k", "K")
      .replace("m", "M");
  }

  function renderRating(ratingEl, response, itemId) {
    if (!ratingEl) return;

    clearChildren(ratingEl);

    const starsRow = document.createElement("div");
    starsRow.className = "product-rating-stars";

    if (response.rating || response.ratingCount) {
      const score = response.rating ? parseFloat(response.rating) : 5;

      for (let i = 1; i <= 5; i += 1) {
        const fillPercentage = Math.max(
          0,
          Math.min(100, (score - i + 1) * 100),
        );
        const gradientId = `grad-${itemId || "default"}-${i}`;

        if (fillPercentage === 100) {
          starsRow.appendChild(createStarSvg("#f5a623"));
        } else if (fillPercentage === 0) {
          starsRow.appendChild(createStarSvg("#e9ecef"));
        } else {
          starsRow.appendChild(createStarSvg(fillPercentage, gradientId));
        }
      }

      ratingEl.appendChild(starsRow);

      if (response.rating) {
        const exactScore = document.createElement("span");
        exactScore.className = "product-rating-score";
        exactScore.textContent = score.toFixed(2);
        ratingEl.appendChild(document.createTextNode(" "));
        ratingEl.appendChild(exactScore);
      }

      if (response.ratingCount) {
        const ratingCount = document.createElement("span");
        ratingCount.className = "product-rating-count";
        ratingCount.textContent = formatEnvatoCompactCount(response.ratingCount);
        ratingEl.appendChild(document.createTextNode(" "));
        ratingEl.appendChild(ratingCount);
      }

      return;
    }

    for (let i = 1; i <= 5; i += 1) {
      starsRow.appendChild(createStarSvg("#dee2e6"));
    }

    const noRatings = document.createElement("span");
    noRatings.className = "product-rating-empty";
    noRatings.textContent = "(No ratings)";

    ratingEl.appendChild(starsRow);
    ratingEl.appendChild(document.createTextNode(" "));
    ratingEl.appendChild(noRatings);
  }

  function bindTabs() {
    tabButtons.forEach((button, index) => {
      button.addEventListener("click", () => {
        const tabId = button.getAttribute("data-tab");

        tabButtons.forEach((candidate) => candidate.classList.remove("active"));
        button.classList.add("active");

        if (tabsContainer) {
          tabsContainer.classList.toggle("on-second-tab", index === 1);
        }

        tabPanels.forEach((panel) => {
          panel.classList.toggle("active", panel.id === `${tabId}Tab`);
        });

        if (tabId !== "admin") {
          hideAdminSettings();
        }

        if (contentArea) {
          contentArea.scrollTop = 0;
        }
      });
    });
  }

  function renderProductDetails(activeTab, details, revision) {
    hideContextState();

    if (productTitleText) productTitleText.textContent = details.title;
    if (itemDetailsContainer) itemDetailsContainer.classList.remove("hidden");

    const itemId =
      details.itemId || (shared ? shared.extractItemIdFromUrl(activeTab.url) : null);

    const renderUI = (finalImageUrl) => {
      if (revision !== contextRevision) return;
      const priceEl = document.getElementById("itemDetailsPrice");
      const salesEl = document.getElementById("itemDetailsSales");
      const ratingEl = document.getElementById("itemDetailsRating");
      const updateEl = document.getElementById("itemDetailsUpdate");

      setImageSource(itemDetailsImage, finalImageUrl);
      renderMeta(productMetaText, details);
      renderPrice(priceEl, details);
      renderSales(salesEl, details);
      renderRating(ratingEl, details, itemId);
      renderPreviewButton(itemDetailsPreview, details);

      if (updateEl) {
        if (details.lastUpdate) {
          updateEl.textContent = `Last updated: ${details.lastUpdate}`;
          updateEl.style.display = "block";
        } else {
          updateEl.style.display = "none";
        }
      }
    };

    Promise.resolve(resolveProductImage(itemId, details))
      .then(renderUI)
      .catch((error) => {
        console.warn(
          "[Envato XPerience] Failed to resolve cached product image.",
          error,
        );
        renderUI(details.imageUrl);
      });
  }

  function checkDomain() {
    const revision = ++contextRevision;
    chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
      if (revision !== contextRevision || !tabs || tabs.length === 0) return;

      const activeTab = tabs[0];
      const isEnvatoPreview =
        activeTab.url && shared && shared.isEnvatoPreviewSite(activeTab.url);
      const isEnvatoSite =
        activeTab.url && shared && shared.isEnvatoMarketplaceSite(activeTab.url);

      if (!isEnvatoSite) {
        resetProductCard();
        hideContextState();
        if (envatoControls) envatoControls.classList.add("hidden");
        if (notEnvatoMessage) notEnvatoMessage.classList.remove("hidden");
        return;
      }

      if (envatoControls) envatoControls.classList.remove("hidden");
      if (notEnvatoMessage) notEnvatoMessage.classList.add("hidden");

      const siteName = shared ? shared.getSiteName(activeTab.url) : "Envato";

      if (isEnvatoPreview) {
        renderDomainHeading("Viewing Preview on", siteName);
        if (removeNowBtn) removeNowBtn.classList.remove("hidden");

        renderContextState({
          eyebrow: "Preview detected",
          title: "Ready to open the live preview",
          body: "Jump directly into the hosted demo while keeping the product context available in the background.",
          helper: settingsState.widgetMode
            ? "Floating Widget is enabled and will preserve product actions after redirect."
            : "Enable Floating Widget in Admin if you want product actions preserved after redirect.",
          tone: "preview",
        });

        chrome.tabs.sendMessage(
          activeTab.id,
          { action: "get_product_info" },
          function (response) {
            const messageError = chrome.runtime.lastError;
            if (revision !== contextRevision || messageError) return;

            if (response && response.title) {
              renderContextState({
                eyebrow: "Preview detected",
                title: response.title,
                body: "Open the live preview directly and skip the older Envato preview chrome.",
                helper: settingsState.widgetMode
                  ? "Floating Widget will keep the Details and Buy Now actions available on the destination site."
                  : "Auto Remove is ready. Enable Floating Widget in Admin if you want purchase actions preserved after redirect.",
                tone: "preview",
              });
            }
          },
        );
        return;
      }

      if (activeTab.url.includes("/item/")) {
        renderDomainHeading("Viewing Product on", siteName);
        if (removeNowBtn) removeNowBtn.classList.add("hidden");

        renderContextState({
          eyebrow: "Loading product context",
          title: "Fetching live product details",
          body: "Pulling pricing, rating, sales, artwork, and update metadata from the current item page.",
          helper: "This should only take a moment.",
          tone: "loading",
        });

        chrome.tabs.sendMessage(
          activeTab.id,
          { action: "get_item_details" },
          function (response) {
            const messageError = chrome.runtime.lastError;
            if (revision !== contextRevision) return;
            if (messageError) {
              renderContextState({
                eyebrow: "Product context unavailable",
                title: "We could not load this item",
                body: "The page did not expose the expected product metadata to the panel.",
                helper: "Try reloading the tab or opening the main item page again.",
                tone: "neutral",
              });
              return;
            }

            try {
              const details =
                response && typeof response === "object" ? response : null;

              if (details && details.title) {
                renderProductDetails(activeTab, details, revision);
              } else {
                renderContextState({
                  eyebrow: "Product context available",
                  title: "Some details are limited here",
                  body: "Open the main item page to refresh artwork, pricing, and marketplace metadata for this product.",
                  helper:
                    "Core product context is still preserved while you browse reviews, comments, or support.",
                  tone: "neutral",
                });
              }
            } catch (error) {
              console.error(
                "[Envato XPerience] Failed to render item details:",
                error,
                response,
              );
              renderContextState({
                eyebrow: "Render fallback",
                title: "Product details could not be rendered",
                body: "The panel could not assemble the premium product card for this page state.",
                helper: "Try refreshing the tab to request the data again.",
                tone: "neutral",
              });
            }
          },
        );
        return;
      }

      renderDomainHeading("Browsing", siteName);
      if (removeNowBtn) removeNowBtn.classList.add("hidden");
      renderContextState({
        eyebrow: `Browsing ${siteName}`,
        title: "XPerience Ready",
        body: "Open any item page to load live product details, or switch to Admin to adjust how Envato XPerience behaves.",
        helper: "",
        tone: "neutral",
      });
    });
  }

  function readSettingsFromStorage(result) {
    const hideAdsEnabled = shared
      ? shared.readHideAdsPreference(result)
      : result[storageKeys.hideAds] === true ||
        result[storageKeys.legacyHideAds] === true;
    const hideDeprecatedEnabled = shared
      ? shared.readHideDeprecatedPreference(result)
      : result[storageKeys.hideDeprecated] === true;

    return {
      autoRemove: result[storageKeys.autoRemove] !== false,
      widgetMode: result[storageKeys.widgetMode] === true,
      hideAds: hideAdsEnabled,
      hideDeprecated: hideDeprecatedEnabled,
    };
  }

  function loadSettings() {
    chrome.storage.sync.get(
      [
        storageKeys.autoRemove,
        storageKeys.widgetMode,
        storageKeys.hideAds,
        storageKeys.legacyHideAds,
        storageKeys.hideDeprecated,
      ],
      function (result) {
        const nextState = readSettingsFromStorage(result);

        if (shared && shared.hasLegacyHideAdsPreference(result)) {
          const patch = {};
          if (nextState.hideAds && result[storageKeys.hideAds] !== true) {
            patch[storageKeys.hideAds] = true;
          }

          chrome.storage.sync.remove(storageKeys.legacyHideAds, function () {
            if (Object.keys(patch).length > 0) {
              chrome.storage.sync.set(patch);
            }
          });
        }

        applySettingState(nextState);
        checkDomain();
      },
    );
  }

  function persistSettings() {
    const syncPatch = {
      [storageKeys.autoRemove]: settingsState.autoRemove,
      [storageKeys.widgetMode]: settingsState.widgetMode,
      [storageKeys.hideAds]: settingsState.hideAds,
      [storageKeys.hideDeprecated]: settingsState.hideDeprecated,
    };

    const localPatch = {
      [storageKeys.hideAdsMirror]: settingsState.hideAds,
      [storageKeys.hideDeprecatedMirror]: settingsState.hideDeprecated,
    };

    chrome.storage.sync.set(syncPatch);
    chrome.storage.local.set(localPatch);
  }

  function bindSettingsInputs() {
    settingInputs.forEach((input) => {
      input.addEventListener("change", () => {
        const settingKey = input.dataset.setting;
        if (!settingKey || !(settingKey in settingsState)) return;

        applySettingState({ [settingKey]: input.checked });
        persistSettings();
        checkDomain();
      });
    });
  }

  function triggerPreviewAction() {
    chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
      if (!tabs || tabs.length === 0) return;
      chrome.tabs.sendMessage(tabs[0].id, { action: "remove_frame" });
    });
  }

  function triggerClose() {
    chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
      if (!tabs || tabs.length === 0) return;
      chrome.tabs.sendMessage(tabs[0].id, { action: "close_panel" });
    });
  }

  bindTabs();
  bindSettingsInputs();
  if (openAdminSettingsBtn) {
    openAdminSettingsBtn.addEventListener("click", showAdminSettings);
  }
  if (closeAdminSettingsBtn) {
    closeAdminSettingsBtn.addEventListener("click", hideAdminSettings);
  }
  if (removeNowBtn) removeNowBtn.addEventListener("click", triggerPreviewAction);
  if (closeBtn) closeBtn.addEventListener("click", triggerClose);
  window.addEventListener("beforeunload", clearImageObjectUrl);

  loadSettings();

  chrome.tabs.onActivated.addListener(checkDomain);
  chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
    if (changeInfo.status === "complete") {
      checkDomain();
    }
  });
});
