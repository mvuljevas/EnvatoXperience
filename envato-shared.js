(function (global) {
  const STORAGE_KEYS = Object.freeze({
    autoRemove: "autoRemove",
    widgetMode: "widgetMode",
    hideAds: "hideAds",
    hideDeprecated: "hideDeprecated",
    legacyHideAds: "hidePromoBar",
    hideAdsMirror: "envatoXperienceHideAds",
    hideDeprecatedMirror: "envatoXperienceHideDeprecated",
  });

  const MARKETPLACE_HOSTS = Object.freeze([
    "themeforest.net",
    "codecanyon.net",
    "videohive.net",
    "audiojungle.net",
    "graphicriver.net",
    "photodune.net",
    "3docean.net",
    "envato.com",
    "envatomarket.com",
  ]);

  const PREVIEW_HOSTS = Object.freeze([
    "preview.themeforest.net",
    "preview.codecanyon.net",
    "preview.videohive.net",
    "preview.audiojungle.net",
    "preview.graphicriver.net",
    "preview.photodune.net",
    "preview.3docean.net",
  ]);

  function includesKnownHost(input, hosts) {
    if (typeof input !== "string" || !input) return false;
    try {
      const parsed = new URL(input.includes("://") ? input : `https://${input}`);
      if (!["http:", "https:"].includes(parsed.protocol)) return false;
      const hostname = parsed.hostname.toLowerCase().replace(/\.$/, "");
      return hosts.some((host) => hostname === host || hostname.endsWith(`.${host}`));
    } catch (error) {
      return false;
    }
  }

  function extractItemIdFromUrl(url = global.location?.href || "") {
    if (!url || typeof url !== "string") {
      return "";
    }

    const match = url.match(/\/item\/[^/]+\/(?:(?:reviews|comments|support)\/)?(\d+)(?:[/?#]|$)/i);
    return match ? match[1] : "";
  }

  function getSiteName(url = "") {
    if (!url) return "Envato";
    if (url.includes("themeforest")) return "ThemeForest";
    if (url.includes("codecanyon")) return "CodeCanyon";
    if (url.includes("videohive")) return "VideoHive";
    if (url.includes("audiojungle")) return "AudioJungle";
    if (url.includes("graphicriver")) return "GraphicRiver";
    if (url.includes("photodune")) return "PhotoDune";
    if (url.includes("3docean")) return "3DOcean";
    return "Envato";
  }

  function isEnvatoMarketplaceSite(input = global.location?.hostname || "") {
    return includesKnownHost(input, MARKETPLACE_HOSTS);
  }

  function isEnvatoPreviewSite(input = global.location?.hostname || "") {
    return includesKnownHost(input, PREVIEW_HOSTS);
  }

  function readHideAdsPreference(settings = {}) {
    return settings[STORAGE_KEYS.hideAds] === true || settings[STORAGE_KEYS.legacyHideAds] === true;
  }

  function readHideDeprecatedPreference(settings = {}) {
    return settings[STORAGE_KEYS.hideDeprecated] === true;
  }

  function hasLegacyHideAdsPreference(settings = {}) {
    return typeof settings[STORAGE_KEYS.legacyHideAds] === "boolean";
  }

  global.EnvatoXperienceShared = Object.freeze({
    STORAGE_KEYS,
    MARKETPLACE_HOSTS,
    PREVIEW_HOSTS,
    extractItemIdFromUrl,
    getSiteName,
    isEnvatoMarketplaceSite,
    isEnvatoPreviewSite,
    readHideAdsPreference,
    readHideDeprecatedPreference,
    hasLegacyHideAdsPreference,
  });
})(window);
