/**
 * Envato XPerience - Content Script
 * 1. Handles preview-to-live navigation on Envato pages
 * 2. Injects the floating in-page sidepanel using Shadow DOM for style isolation
 */

let panelContainer = null;
let panelWrapperRef = null;
let panelVisible = false;
const shared = window.EnvatoXperienceShared;
const testBridgeEventName = "envato-xperience:test";
let testBridgeInstalled = false;

/**
 * Creates and injects the floating panel iframe using Shadow DOM
 * This ensures host page styles don't bleed into our panel and vice versa.
 */
function createPanel() {
  if (panelContainer) return;

  // Create the host for the Shadow DOM
  panelContainer = document.createElement("div");
  panelContainer.id = "envato-xperience-root";
  // Styles handled by content.css (:host)

  // Attach Shadow DOM
  const shadow = panelContainer.attachShadow({ mode: "open" }); // 'open' allows easier debugging/access if needed

  // Create the wrapper that will slide in/out
  const wrapper = document.createElement("div");
  wrapper.id = "panel-wrapper";

  // Define styles for the shadow DOM content
  // Link to the external CSS file
  const link = document.createElement("link");
  link.setAttribute("rel", "stylesheet");
  link.setAttribute("href", chrome.runtime.getURL("content.css"));

  // Create the iframe
  const iframe = document.createElement("iframe");
  iframe.src = chrome.runtime.getURL("sidepanel.html");
  iframe.allow = "clipboard-read; clipboard-write";

  // Assemble the DOM
  wrapper.appendChild(iframe);
  shadow.appendChild(link);
  shadow.appendChild(wrapper);
  document.body.appendChild(panelContainer);

  // Store reference to the wrapper for toggling
  panelWrapperRef = wrapper;

  // Force reflow to ensure transitions work
  wrapper.offsetHeight;
}

/**
 * Toggles the visibility of the floating panel
 */
function showPanel() {
  if (!panelContainer) {
    createPanel();
  }

  panelVisible = true;
  if (panelWrapperRef) {
    panelWrapperRef.classList.add("visible");
  }
}

function hidePanel() {
  panelVisible = false;
  if (panelWrapperRef) {
    panelWrapperRef.classList.remove("visible");
  }
}

function togglePanel() {
  if (panelVisible) {
    hidePanel();
  } else {
    showPanel();
  }
}

function dispatchTestBridgeState(requestId) {
  document.dispatchEvent(
    new CustomEvent(`${testBridgeEventName}:result`, {
      detail: {
        requestId: requestId || null,
        panelVisible,
        hasPanel: Boolean(panelContainer),
        hideAdsEnabled: document.documentElement.dataset.envatoHideAds === "true",
      },
    }),
  );
}

function installTestBridge() {
  if (window !== window.top || testBridgeInstalled) return;

  testBridgeInstalled = true;
  document.addEventListener(testBridgeEventName, function (event) {
    const detail = event.detail || {};

    switch (detail.action) {
      case "openPanel":
        showPanel();
        break;
      case "closePanel":
        hidePanel();
        break;
      case "togglePanel":
        togglePanel();
        break;
      case "getState":
        break;
      default:
        return;
    }

    dispatchTestBridgeState(detail.requestId);
  });
}

/**
 * Validates if a URL is safe to redirect to
 */
function isValidUrl(url) {
  if (!url || typeof url !== "string") return false;
  try {
    const urlObj = new URL(url);
    return urlObj.protocol === "http:" || urlObj.protocol === "https:";
  } catch (e) {
    return false;
  }
}

function extractFirstNumericValue(text) {
  if (!text) return "";
  const match = text.match(/[\d]+(?:\.\d+)?/);
  return match ? match[0] : "";
}

function normalizeItemTitle(title) {
  if (!title) return "";

  return title
    .replace(/^Reviews for\s+/i, "")
    .replace(/^Discussion on\s+/i, "")
    .replace(/^Support for\s+/i, "")
    .replace(/\s+-\s+ThemeForest$/i, "")
    .replace(/\s+-\s+CodeCanyon$/i, "")
    .trim();
}

function isEnvatoMarketplaceLogo(url) {
  return typeof url === "string" && /public-assets\.envato-static\.com\/assets\/logos\/marketplaces\//i.test(url);
}

/**
 * Opens the live preview destination, optionally preserving product context
 */
let previewObserver = null;
let previewObserverTimeout = null;

function stopPreviewObserver() {
  previewObserver?.disconnect();
  previewObserver = null;
  clearTimeout(previewObserverTimeout);
}

function openLivePreview(useWidgetMode = false) {
  try {
    const previewIframe = document.querySelector(
      "iframe.full-screen-preview__frame",
    );
    if (!previewIframe || !previewIframe.getAttribute("src")) {
      if (!previewObserver) {
        previewObserver = new MutationObserver(() => openLivePreview(useWidgetMode));
        previewObserver.observe(document.documentElement, {
          childList: true, subtree: true, attributes: true, attributeFilter: ["src"],
        });
        previewObserverTimeout = setTimeout(stopPreviewObserver, 30000);
        window.addEventListener("pagehide", stopPreviewObserver, { once: true });
      }
      return;
    }
    stopPreviewObserver();

    if (previewIframe.src) {
      const targetUrl = previewIframe.src;
      if (isValidUrl(targetUrl)) {
        if (useWidgetMode) {
          const info = extractProductInfo();
          info.targetDomain = new URL(targetUrl).hostname;
          info.timestamp = Date.now();

          chrome.storage.local.set({ activeEnvatoPreview: info }, () => {
            window.location.href = targetUrl;
          });
        } else {
          window.location.href = targetUrl;
        }
      } else {
        previewIframe.remove();
      }
    } else {
      // Fallback if src is missing
      previewIframe.remove();
      if (document.body.style.marginTop) document.body.style.marginTop = "0px";
    }
  } catch (error) {
    console.error("[Envato XPerience] Error opening live preview:", error);
  }
}

/**
 * Extracts metadata from the Envato item details page
 */
function extractItemDetails() {
  const itemId = shared ? shared.extractItemIdFromUrl() : "";
  let title = normalizeItemTitle(document.querySelector('h1')?.textContent.trim() || document.title);

  let imageUrl = '';
  let isHighResImage = false;
  // Prioritize the actual high-res rectangular preview image in the DOM
  const imgEl = document.querySelector('.js-item-preview img, .item-preview img, .item-preview-image__img, .preview-image, #preview-image');
  if (imgEl) {
      // Manage lazy-loaded formats common in ThemeForest
      imageUrl = imgEl.getAttribute('data-preview-url') || imgEl.getAttribute('data-src') || imgEl.src;
      isHighResImage = true;
  } else {
      // Fallback to og:image if native preview container is completely missing
      const ogImage = document.querySelector('meta[property="og:image"]');
      if (ogImage && !isEnvatoMarketplaceLogo(ogImage.content)) imageUrl = ogImage.content;
  }

  let price = '';
  let oldPrice = '';
  const priceEl = document.querySelector('.js-purchase-price, .item-price, .purchase-form__price');
  if (priceEl) {
      const strikeEl = priceEl.querySelector('s, del, strike, .price-strikethrough, .js-purchase-price--old');
      
      if (strikeEl) {
          oldPrice = strikeEl.textContent.trim();
          price = priceEl.textContent.replace(oldPrice, '').trim();
      } else {
          // Fallback: If Envato collapses both prices into raw text "$49 $34", we can extract them mathematically
          const rawText = priceEl.textContent.trim().replace(/\s+/g, ' ');
          let priceMatch = rawText.match(/([\$\€\£]\s*\d+(?:[\.,]\d+)?)\s+([\$\€\£]\s*\d+(?:[\.,]\d+)?)/);
          if (priceMatch && priceMatch.length >= 3) {
              oldPrice = priceMatch[1];
              price = priceMatch[2];
          } else {
              price = rawText;
          }
      }
  }

  let sales = '';
  const salesEl = document.querySelector('.item-header__sales-count, .item-sales-count, .item-header__sales');
  if (salesEl) {
      const sMatch = salesEl.textContent.match(/[\d.,]+[kKmM]?/);
      if (sMatch) sales = sMatch[0];
  }
  if (!sales) {
      const bodySalesMatch = document.body.innerText.match(/([\d.,]+[kKmM]?)\s*Sales/i);
      if (bodySalesMatch) sales = bodySalesMatch[1];
  }

  let author = '';
  const authorEl = document.querySelector('main a[href^="/user/"], main a[href*="themeforest.net/user/"], main a[href*="codecanyon.net/user/"]');
  if (authorEl) {
      author = authorEl.textContent.trim().replace(/^By\s+/i, '');
  }
  if (!author) {
      const titleAuthorMatch = document.title.match(/\sby\s(.+?)\s\|\s(?:ThemeForest|CodeCanyon)/i);
      if (titleAuthorMatch) {
          author = titleAuthorMatch[1].trim();
      }
  }

  let category = '';
  const titleHeading = document.querySelector('h1');
  const categoryLinks = Array.from(document.querySelectorAll('a[href*="/category/"]'))
      .filter((el) => titleHeading
          ? (el.compareDocumentPosition(titleHeading) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0
          : true)
      .map((el) => el.textContent.trim())
      .filter((text) => text && !/^home$/i.test(text) && !/^files$/i.test(text) && !/^all items$/i.test(text));
  if (categoryLinks.length > 0) {
      category = categoryLinks[categoryLinks.length - 1];
  }

  let livePreviewUrl = '';
  const livePreviewEl = document.querySelector('a[href*="/full_screen_preview/"]');
  if (livePreviewEl && livePreviewEl.href) {
      livePreviewUrl = livePreviewEl.href;
  }

  let rating = '';
  let ratingCount = '';

  const reviewNavLink = document.querySelector('a.js-item-navigation-reviews, a[href*="/reviews/"]');
  if (reviewNavLink) {
      const reviewStarsEl = reviewNavLink.querySelector('.rating-detailed-small__stars');
      const reviewCountEl = reviewNavLink.querySelector('.item-navigation-reviews-comments');

      if (reviewStarsEl && !rating) {
          rating = extractFirstNumericValue(reviewStarsEl.textContent);
      }

      if (reviewCountEl && !ratingCount) {
          ratingCount = reviewCountEl.textContent.trim();
      }
  }

  if (!ratingCount) {
      const reviewSummaryCount = Array.from(document.querySelectorAll('p strong, strong'))
          .map((el) => el.textContent.trim())
          .find((text) => /^\d[\d,]*(?:\.\d+)?[kKmM]?\s+Reviews$/i.test(text));

      if (reviewSummaryCount) {
          ratingCount = reviewSummaryCount.replace(/\s+reviews$/i, '');
      }
  }

  const rMeta = document.querySelector('[itemprop="ratingValue"]');
  if (rMeta) rating = rMeta.getAttribute('content') || rMeta.textContent;
  const cMeta = document.querySelector('[itemprop="reviewCount"]');
  if (cMeta) ratingCount = cMeta.getAttribute('content') || cMeta.textContent;

  if (!rating) {
      const rEl = document.querySelector('.rating-score strong, .rating-score, .stars-rating__score, .js-item-rating-score');
      if (rEl) rating = rEl.getAttribute('data-score') || rEl.textContent;
  }
  if (!ratingCount) {
      const cEl = document.querySelector('.rating-count, .item-rating__count, .js-item-rating-count');
      if (cEl) ratingCount = cEl.textContent;
  }

  // Hardcore Fallbacks scanning the raw text of the site
  const bodyText = document.body.innerText;
  
  if (!rating || !ratingCount) {
      // Look for the modern ThemeForest menu pattern: "Reviews ★★★★★ 4.84 [1K]" or similar
      const tfMatch = bodyText.match(/Reviews[\s\n★☆\-\*]*([\d.]+)[\s\n]*([\[\(]?[\d.,]+[kKmM]?[\]\)]?)/i);
      if (tfMatch) {
          if (!rating) rating = tfMatch[1];
          if (!ratingCount) ratingCount = tfMatch[2];
      }
  }

  if (!rating) {
      const outOfMatch = bodyText.match(/(?:Rated\s+)?([\d.]+)\s*(?:out of|\/)\s*5/i);
      if (outOfMatch) rating = outOfMatch[1];
  }
  if (!ratingCount) {
      // Match patterns like "1,033 Reviews"
      const numRevMatch = bodyText.match(/([\d.,]+[kKmM]?)\s*(?:Ratings|Reviews)/i);
      if (numRevMatch) ratingCount = numRevMatch[1];
  }

  if (rating) rating = rating.replace(/[^\d.]/g, '').trim();
  if (ratingCount) ratingCount = ratingCount.replace(/[()\[\]]/g, '').replace(/reviews?/i, '').replace(/ratings?/i, '').trim();

  let lastUpdate = '';
  const timeEl = document.querySelector('time.updated, time[itemprop="dateModified"], .last-update-date');
  if (timeEl) lastUpdate = timeEl.textContent.trim();

  return {
    itemId,
    title,
    author,
    category,
    imageUrl,
    isHighResImage,
    price,
    oldPrice,
    sales,
    rating,
    ratingCount,
    lastUpdate,
    livePreviewUrl,
    isItemPage: true
  };
}

/**
 * Extracts product metadata from the native Envato header
 */
function extractProductInfo() {
  const resolvedCurrentItemId = shared ? shared.extractItemIdFromUrl() : "";
  let title = document.title;
  if (title.includes(' - ThemeForest')) title = title.replace(' - ThemeForest', '');
  if (title.includes(' - CodeCanyon')) title = title.replace(' - CodeCanyon', '');
  title = title.trim();

  const titleEl = document.querySelector('.t-link--hidden-reversed');
  if (titleEl && titleEl.textContent) title = titleEl.textContent.trim();

  let buyUrl = '';
  const buyBtn = document.querySelector('a.buy-btn, a[href*="/checkout/"], a.header-buy-btn, .js-buy-btn');
  if (buyBtn) buyUrl = buyBtn.href;

  let itemUrl = '';
  if (titleEl && titleEl.href) itemUrl = titleEl.href;

  const itemId = resolvedCurrentItemId || (shared ? shared.extractItemIdFromUrl(itemUrl) : "");

  return { itemId, title, buyUrl, itemUrl };
}

let widgetContainer = null;

/**
 * Checks if we are on a post-redirect target site and injects the widget
 */
function checkAndInjectWidget() {
  chrome.storage.local.get(['activeEnvatoPreview'], function(result) {
    if (result.activeEnvatoPreview) {
      const info = result.activeEnvatoPreview;
      
      // Check if context is fresh (e.g. within 2 hours)
      const age = Date.now() - info.timestamp;
      const isFresh = Number.isFinite(info.timestamp) && age >= 0 && age < (2 * 60 * 60 * 1000);
      
      if (isFresh && window.location.hostname === info.targetDomain) {
        injectWidget(info);
      }
    }
  });
}

/**
 * Injects our own Premium floating widget using Shadow DOM
 */
function injectWidget(info) {
  if (widgetContainer) return;
  
  widgetContainer = document.createElement("div");
  widgetContainer.id = "envato-custom-widget-root";
  const shadow = widgetContainer.attachShadow({ mode: "open" });

  const wrapper = document.createElement("div");
  const style = document.createElement("style");
  style.textContent = `
      :host {
          position: fixed;
          bottom: 24px;
          right: 24px;
          z-index: 2147483647;
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      }
      .widget-box {
          background: rgba(255, 255, 255, 0.85);
          backdrop-filter: blur(12px);
          -webkit-backdrop-filter: blur(12px);
          border-radius: 12px;
          padding: 16px 20px;
          box-shadow: 0 10px 40px rgba(0, 0, 0, 0.15);
          border: 1px solid rgba(255, 255, 255, 0.5);
          display: flex;
          flex-direction: column;
          gap: 12px;
          transition: transform 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);
          animation: slideIn 0.5s ease-out forwards;
      }
      @keyframes slideIn {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
      }
      .widget-box:hover {
          transform: translateY(-4px);
          box-shadow: 0 14px 45px rgba(0, 0, 0, 0.2);
      }
      .w-title {
          font-size: 14px;
          font-weight: 600;
          color: #262626;
          margin: 0;
          max-width: 250px;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
      }
      .w-actions {
          display: flex;
          gap: 8px;
      }
      .w-btn {
          text-decoration: none;
          font-size: 13px;
          font-weight: 600;
          padding: 10px 14px;
          border-radius: 8px;
          cursor: pointer;
          text-align: center;
          transition: all 0.2s;
          flex: 1;
          box-sizing: border-box;
      }
      .w-btn-buy {
          background: #82b641;
          color: white;
          box-shadow: 0 4px 10px rgba(130, 182, 65, 0.3);
      }
      .w-btn-buy:hover {
          background: #6fab35;
          transform: translateY(-1px);
          box-shadow: 0 6px 15px rgba(130, 182, 65, 0.4);
      }
      .w-btn-back {
          background: rgba(0,0,0,0.06);
          color: #495057;
      }
      .w-btn-back:hover {
          background: rgba(0,0,0,0.1);
          color: #262626;
      }
  `;

  const widgetBox = document.createElement("div");
  widgetBox.className = "widget-box";

  const title = document.createElement("p");
  title.className = "w-title";
  title.textContent = info.title || "Envato Product";
  title.title = info.title || "Envato Product";
  widgetBox.appendChild(title);

  const actions = document.createElement("div");
  actions.className = "w-actions";

  if (isValidUrl(info.itemUrl)) {
    const detailsLink = document.createElement("a");
    detailsLink.className = "w-btn w-btn-back";
    detailsLink.href = info.itemUrl;
    detailsLink.textContent = "Details";
    actions.appendChild(detailsLink);
  }

  if (isValidUrl(info.buyUrl)) {
    const buyLink = document.createElement("a");
    buyLink.className = "w-btn w-btn-buy";
    buyLink.href = info.buyUrl;
    buyLink.target = "_blank";
    buyLink.rel = "noopener noreferrer";
    buyLink.textContent = "Buy Now";
    actions.appendChild(buyLink);
  }

  if (actions.childElementCount > 0) {
    widgetBox.appendChild(actions);
  }

  wrapper.appendChild(style);
  wrapper.appendChild(widgetBox);

  shadow.appendChild(wrapper);
  document.body.appendChild(widgetContainer);
}

/**
 * Initialize the script
 */
function initialize() {
  if (window !== window.top) return; // Prevent execution inside iframes

  installTestBridge();

  chrome.storage.sync.get(["autoRemove", "widgetMode"], function (result) {
    const autoRemoveEnabled = result.autoRemove !== false; // Default to true if undefined
    const widgetModeEnabled = result.widgetMode === true; // Default to false
    const isEnvatoPreviewSite = shared
      ? shared.isEnvatoPreviewSite(window.location.hostname)
      : false;

    if (autoRemoveEnabled && isEnvatoPreviewSite) {
      openLivePreview(widgetModeEnabled);
    } else if (!isEnvatoPreviewSite && widgetModeEnabled) {
      // Check if we are on a theme's site after being redirected
      checkAndInjectWidget();
    }

    window.EnvatoRemovedItems?.initialize?.();
  });
}

// Listen for messages from background script or sidepanel
chrome.runtime.onMessage.addListener(function (request, sender, sendResponse) {
  if (window !== window.top) return; // Only process messages on the top level window
  
  switch (request.action) {
    case "toggle_floating_panel":
      togglePanel();
      sendResponse({ success: true });
      break;
    case "close_panel":
      if (panelVisible) hidePanel();
      sendResponse({ success: true });
      break;
    case "remove_frame":
      chrome.storage.sync.get(["widgetMode"], function(result) {
          openLivePreview(result.widgetMode === true);
      });
      sendResponse({ success: true });
      break;
    case "get_product_info":
      const info = extractProductInfo();
      sendResponse(info);
      break;
    case "get_item_details":
      const details = extractItemDetails();
      sendResponse(details);
      break;
  }
  return true; // Keep message channel open for async response
});

initialize();
