if (window === window.top && window.EnvatoXperienceShared?.isEnvatoMarketplaceSite()) {
  const shared = window.EnvatoXperienceShared;
  if (!shared) {
    console.warn("[Envato XPerience] Shared helpers unavailable in marketplace-init.");
  }

  const root = document.documentElement;
  const localKey = shared ? shared.STORAGE_KEYS.hideAdsMirror : "envatoXperienceHideAds";
  const hideAdsKey = shared ? shared.STORAGE_KEYS.hideAds : "hideAds";
  const legacyHideAdsKey = shared ? shared.STORAGE_KEYS.legacyHideAds : "hidePromoBar";
  const hostMirrorKey = `${localKey}:host`;

  const localDepKey = shared ? shared.STORAGE_KEYS.hideDeprecatedMirror : "envatoXperienceHideDeprecated";
  const hideDepKey = shared ? shared.STORAGE_KEYS.hideDeprecated : "hideDeprecated";
  const hostDepMirrorKey = `${localDepKey}:host`;

  function applyHideAdsState(enabled) {
    root.dataset.envatoHideAds = enabled ? "true" : "false";
  }
  function applyHideDeprecatedState(enabled) {
    root.dataset.envatoHideDeprecated = enabled ? "true" : "false";
  }

  function readHostMirror(key) {
    try {
      const value = window.localStorage.getItem(key);
      if (value === "true") return true;
      if (value === "false") return false;
    } catch (error) {}
    return null;
  }

  function writeHostMirror(key, enabled) {
    try {
      window.localStorage.setItem(key, enabled ? "true" : "false");
    } catch (error) {}
  }

  const mirroredHideAds = readHostMirror(hostMirrorKey);
  if (typeof mirroredHideAds === "boolean") applyHideAdsState(mirroredHideAds);

  const mirroredHideDep = readHostMirror(hostDepMirrorKey);
  if (typeof mirroredHideDep === "boolean") applyHideDeprecatedState(mirroredHideDep);

  chrome.storage.local.get([localKey, localDepKey], function (localResult) {
    if (typeof localResult[localKey] === "boolean") {
      applyHideAdsState(localResult[localKey]);
      writeHostMirror(hostMirrorKey, localResult[localKey]);
    }
    if (typeof localResult[localDepKey] === "boolean") {
      applyHideDeprecatedState(localResult[localDepKey]);
      writeHostMirror(hostDepMirrorKey, localResult[localDepKey]);
    }
  });

  chrome.storage.sync.get([hideAdsKey, legacyHideAdsKey, hideDepKey], function (syncResult) {
    const hideAdsEnabled = shared
      ? shared.readHideAdsPreference(syncResult)
      : syncResult.hideAds === true || syncResult.hidePromoBar === true;

    applyHideAdsState(hideAdsEnabled);
    writeHostMirror(hostMirrorKey, hideAdsEnabled);
    chrome.storage.local.set({ [localKey]: hideAdsEnabled });

    const hideDepEnabled = shared ? shared.readHideDeprecatedPreference(syncResult) : syncResult.hideDeprecated === true;
    applyHideDeprecatedState(hideDepEnabled);
    writeHostMirror(hostDepMirrorKey, hideDepEnabled);
    chrome.storage.local.set({ [localDepKey]: hideDepEnabled });

    if (shared && shared.hasLegacyHideAdsPreference(syncResult)) {
      const patch = {};
      if (hideAdsEnabled && syncResult[hideAdsKey] !== true) patch[hideAdsKey] = true;
      chrome.storage.sync.remove(legacyHideAdsKey, function () {
        if (Object.keys(patch).length > 0) chrome.storage.sync.set(patch);
      });
    }
  });

  chrome.storage.onChanged.addListener(function (changes, areaName) {
    if (areaName === "local") {
      if (changes[localKey]) {
        const nextValue = changes[localKey].newValue === true;
        applyHideAdsState(nextValue);
        writeHostMirror(hostMirrorKey, nextValue);
      }
      if (changes[localDepKey]) {
        const nextValue = changes[localDepKey].newValue === true;
        applyHideDeprecatedState(nextValue);
        writeHostMirror(hostDepMirrorKey, nextValue);
      }
      return;
    }

    if (areaName === "sync") {
      if (changes[hideAdsKey]) {
        const nextValue = changes[hideAdsKey].newValue === true;
        applyHideAdsState(nextValue);
        writeHostMirror(hostMirrorKey, nextValue);
        chrome.storage.local.set({ [localKey]: nextValue });
      }
      if (changes[hideDepKey]) {
        const nextValue = changes[hideDepKey].newValue === true;
        applyHideDeprecatedState(nextValue);
        writeHostMirror(hostDepMirrorKey, nextValue);
        chrome.storage.local.set({ [localDepKey]: nextValue });
      }
    }
  });
}
