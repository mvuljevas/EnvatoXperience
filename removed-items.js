(function () {
  const ICONS = Object.freeze({
    info:
      '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>',
    expand:
      '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M15 3h6v6"></path><path d="M10 14L21 3"></path><path d="M9 21H3v-6"></path><path d="M14 10L3 21"></path></svg>',
    collapse:
      '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="4 14 10 14 10 20"></polyline><polyline points="20 10 14 10 14 4"></polyline><line x1="14" y1="10" x2="21" y2="3"></line><line x1="3" y1="21" x2="10" y2="14"></line></svg>',
    trash:
      '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>',
    placeholder:
      '<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#b0b8c0" stroke-width="1.5"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><circle cx="8.5" cy="8.5" r="1.5"></circle><polyline points="21 15 16 10 5 21"></polyline></svg>',
    download:
      '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>',
  });

  let downloadsObserver = null;
  let rootObserver = null;
  let downloadsListObserver = null;

  function isSafeUrl(url) {
    if (!url || typeof url !== "string") return false;

    try {
      const parsed = new URL(url, window.location.href);
      return parsed.protocol === "http:" || parsed.protocol === "https:";
    } catch (error) {
      return false;
    }
  }

  function parseSvg(markup) {
    const template = document.createElement("template");
    template.innerHTML = markup.trim();
    return template.content.firstElementChild.cloneNode(true);
  }

  function createElement(tagName, options = {}) {
    const element = document.createElement(tagName);

    if (options.className) {
      element.className = options.className;
    }

    if (options.text) {
      element.textContent = options.text;
    }

    if (options.attributes) {
      Object.entries(options.attributes).forEach(([name, value]) => {
        if (value !== null && value !== undefined) {
          element.setAttribute(name, value);
        }
      });
    }

    return element;
  }

  function createIconButton(className, iconName, options = {}) {
    const tagName = options.href ? "a" : "button";
    const button = createElement(tagName, {
      className: `ex-btn ${className}${options.disabled ? " ex-disabled" : ""}`,
      attributes: options.href
        ? {
            href: options.href,
            target: options.target || "_blank",
            rel: options.rel || "noopener noreferrer",
          }
        : {
            type: "button",
            disabled: options.disabled ? "disabled" : null,
          },
    });

    button.appendChild(parseSvg(ICONS[iconName]));
    return button;
  }

  function createTextTooltip(text) {
    return createElement("div", { className: "ex-text-tooltip", text });
  }

  function findBestImageSource(itemElement, itemId) {
    const images = Array.from(itemElement.querySelectorAll("img"));
    for (const image of images) {
      const candidate =
        image.getAttribute("data-src") ||
        image.getAttribute("src") ||
        image.src;

      if (
        candidate &&
        !candidate.startsWith("data:image") &&
        !candidate.includes("placeholder")
      ) {
        return candidate;
      }
    }

    const previewElement = itemElement.querySelector("[data-preview-url]");
    if (previewElement) {
      const previewUrl = previewElement.getAttribute("data-preview-url");
      if (previewUrl) return previewUrl;
    }

    if (itemId) {
      const globalImage = document.querySelector(`img[data-item-id="${itemId}"]`);
      if (globalImage) {
        return (
          globalImage.getAttribute("data-src") ||
          globalImage.getAttribute("src") ||
          globalImage.src ||
          null
        );
      }
    }

    return null;
  }

  function findLicenseUrl(itemElement) {
    const links = Array.from(itemElement.querySelectorAll("a"));
    for (const link of links) {
      if (
        link.href &&
        isSafeUrl(link.href) &&
        link.textContent &&
        link.textContent.toLowerCase().includes("license certificate")
      ) {
        return link.href;
      }
    }

    return null;
  }

  function setTooltipImage(bar, source) {
    if (!source) return;

    const imageWrapper = bar.querySelector(".ex-tooltip-img-wrapper");
    const placeholder = bar.querySelector(".ex-placeholder");
    if (!imageWrapper || !placeholder || imageWrapper.querySelector("img")) return;

    const image = createElement("img", {
      attributes: {
        src: source,
        alt: "",
      },
    });

    image.style.width = "100%";
    image.style.height = "100%";
    image.style.objectFit = "cover";
    image.style.display = "block";

    image.addEventListener("error", () => {
      image.style.display = "none";
      placeholder.style.display = "flex";
    });

    placeholder.style.display = "none";
    imageWrapper.insertBefore(image, placeholder);
  }

  function cacheImage(itemId, sourceUrl) {
    if (!itemId || !sourceUrl || !window.EnvatoImageCache) return;
    window.EnvatoImageCache.cacheImage(itemId, sourceUrl).catch(() => {});
  }

  function hydrateImageFromCache(itemId, bar) {
    if (!itemId || !window.EnvatoImageCache) return;

    window.EnvatoImageCache
      .getImage(itemId)
      .then((cached) => {
        if (!cached || !cached.blob) return;
        const imageUrl = URL.createObjectURL(cached.blob);
        setTooltipImage(bar, imageUrl);
      })
      .catch(() => {});
  }

  function buildRemovedBar(itemTitle, licenseUrl) {
    const bar = createElement("div", {
      className: "envato-xperience-removed-bar",
    });

    const leftLine = createElement("div", { className: "ex-removed-line" });
    const rightLine = createElement("div", { className: "ex-removed-line" });
    const removedText = createElement("div", {
      className: "ex-removed-text",
      text: "ITEM REMOVED",
    });
    const actions = createElement("div", { className: "ex-removed-actions" });

    const tooltipWrapper = createElement("div", { className: "ex-tooltip-wrapper" });
    const infoButton = createIconButton("ex-btn-info", "info");
    const tooltip = createElement("div", { className: "ex-tooltip" });
    const tooltipImageWrapper = createElement("div", {
      className: "ex-tooltip-img-wrapper",
    });
    const placeholder = createElement("div", { className: "ex-placeholder" });
    placeholder.appendChild(parseSvg(ICONS.placeholder));
    tooltipImageWrapper.appendChild(placeholder);
    const tooltipTitle = createElement("div", {
      className: "ex-tooltip-title",
      text: itemTitle,
    });
    tooltip.appendChild(tooltipImageWrapper);
    tooltip.appendChild(tooltipTitle);
    tooltipWrapper.appendChild(infoButton);
    tooltipWrapper.appendChild(tooltip);

    const downloadWrapper = createElement("div", { className: "ex-action-wrapper" });
    const downloadButton = licenseUrl
      ? createIconButton("ex-btn-download", "download", { href: licenseUrl })
      : createIconButton("ex-btn-download", "download", { disabled: true });
    downloadWrapper.appendChild(downloadButton);
    downloadWrapper.appendChild(
      createTextTooltip(licenseUrl ? "Download License TXT" : "Download Not Available"),
    );

    const expandWrapper = createElement("div", { className: "ex-action-wrapper" });
    const expandButton = createIconButton("ex-btn-expand", "expand");
    expandWrapper.appendChild(expandButton);
    expandWrapper.appendChild(createTextTooltip("Toggle Original Item"));

    const deleteWrapper = createElement("div", { className: "ex-action-wrapper" });
    const deleteButton = createIconButton("ex-btn-delete", "trash");
    deleteWrapper.appendChild(deleteButton);
    deleteWrapper.appendChild(createTextTooltip("Remove/Hide From Library"));

    actions.appendChild(tooltipWrapper);
    actions.appendChild(downloadWrapper);
    actions.appendChild(expandWrapper);
    actions.appendChild(deleteWrapper);

    bar.appendChild(leftLine);
    bar.appendChild(removedText);
    bar.appendChild(rightLine);
    bar.appendChild(actions);

    return { bar, tooltipWrapper, expandButton, deleteButton };
  }

  function injectRemovedBars() {
    if (document.documentElement.dataset.envatoHideDeprecated !== "true") return;
    const deprecatedItems = document.querySelectorAll(
      "li.download:has(.download__unavailable)",
    );

    deprecatedItems.forEach((itemElement) => {
      if (itemElement.dataset.exProcessed === "true") return;
      itemElement.dataset.exProcessed = "true";

      const itemId = itemElement.id.replace("item-", "");
      const titleElement =
        itemElement.querySelector("h3 a") ||
        itemElement.querySelector("h3") ||
        itemElement.querySelector(".t-heading") ||
        itemElement.querySelector('[class*="title"]');
      const itemTitle = titleElement
        ? titleElement.textContent.trim()
        : "Unknown Item";
      const licenseUrl = findLicenseUrl(itemElement);
      const immediateImageSource = findBestImageSource(itemElement, itemId);

      const {
        bar,
        tooltipWrapper,
        expandButton,
        deleteButton,
      } = buildRemovedBar(itemTitle, licenseUrl);

      if (immediateImageSource) {
        setTooltipImage(bar, immediateImageSource);
        cacheImage(itemId, immediateImageSource);
      } else {
        hydrateImageFromCache(itemId, bar);
      }

      tooltipWrapper.addEventListener("mouseenter", () => {
        if (bar.querySelector(".ex-tooltip-img-wrapper img")) return;

        const lazySource = findBestImageSource(itemElement, itemId);
        if (!lazySource) return;

        setTooltipImage(bar, lazySource);
        cacheImage(itemId, lazySource);
      });

      expandButton.addEventListener("click", () => {
        const isExpanded = itemElement.classList.toggle("ex-expanded");
        expandButton.classList.toggle("ex-active", isExpanded);
        expandButton.replaceChildren(
          parseSvg(isExpanded ? ICONS.collapse : ICONS.expand),
        );
      });

      deleteButton.addEventListener("click", () => {
        itemElement.remove();
      });

      const originalContainer = createElement("div", {
        className: "ex-original-content",
      });

      while (itemElement.firstChild) {
        originalContainer.appendChild(itemElement.firstChild);
      }

      itemElement.appendChild(originalContainer);
      itemElement.prepend(bar);
    });
  }

  function findDownloadsList() {
    return (
      document.querySelector(".list--downloads") ||
      document.querySelector('.list-downloads[data-view="downloads"]')
    );
  }

  function isDownloadsContext() {
    return (
      window.location.pathname.includes("/downloads") || Boolean(findDownloadsList())
    );
  }

  function connectDownloadsObserver() {
    if (downloadsObserver || !isDownloadsContext()) return;

    const downloadsList = findDownloadsList();
    if (!downloadsList) {
      waitForDownloadsList();
      return;
    }

    downloadsObserver = new MutationObserver(() => injectRemovedBars());
    downloadsObserver.observe(downloadsList, { childList: true, subtree: true });
    injectRemovedBars();
  }

  function waitForDownloadsList() {
    if (downloadsListObserver) return;

    downloadsListObserver = new MutationObserver(() => {
      const downloadsList = findDownloadsList();
      if (!downloadsList) return;

      downloadsListObserver.disconnect();
      downloadsListObserver = null;
      connectDownloadsObserver();
    });

    downloadsListObserver.observe(document.body, {
      childList: true,
      subtree: true,
    });
  }

  function handleDocumentState() {
    const enabled =
      document.documentElement.dataset.envatoHideDeprecated === "true";

    if (enabled) {
      connectDownloadsObserver();
      injectRemovedBars();
    } else {
      downloadsObserver?.disconnect();
      downloadsObserver = null;
      downloadsListObserver?.disconnect();
      downloadsListObserver = null;
    }
  }

  function initialize() {
    if (window !== window.top || !isDownloadsContext()) return;

    handleDocumentState();

    if (!rootObserver) {
      rootObserver = new MutationObserver(() => handleDocumentState());
      rootObserver.observe(document.documentElement, {
        attributes: true,
        attributeFilter: ["data-envato-hide-deprecated"],
      });
    }
  }

  window.EnvatoRemovedItems = {
    initialize,
  };
})();
