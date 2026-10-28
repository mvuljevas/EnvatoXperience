/** Product context for live demos. Public metadata only; keyed by canonical item ID. */
(function () {
  const text = (element) => element?.textContent?.replace(/\s+/g, ' ').trim() || '';
  function safeUrl(value, base) {
    try {
      const url = new URL(value, base);
      return value && ['http:', 'https:'].includes(url.protocol) ? url.href : '';
    } catch (_) { return ''; }
  }
  function read(doc, base) {
    const itemId = window.EnvatoXperienceShared.extractItemIdFromUrl(base);
    const meta = (name) => doc.querySelector(`meta[property="${name}"], meta[name="${name}"]`)?.content || '';
    const authorLink = doc.querySelector('.author-header a[href*="/user/"], .item-header__author a, .item-header a[href*="/user/"]');
    const image = doc.querySelector('.js-item-preview img, .item-preview img, .item-preview-image__img, #preview-image');
    const avatar = doc.querySelector('.avatar img, img.avatar, .avatar__image, .author-header img, [itemprop="author"] img') || authorLink?.querySelector?.('img');
    const imageSource = image => image?.getAttribute('data-preview-url') || image?.getAttribute('data-src') || image?.getAttribute('data-lazy-src') || image?.getAttribute('data-original') || image?.currentSrc || image?.getAttribute('src');
    const attribute = (pattern) => {
      const label = Array.from(doc.querySelectorAll('td, th, dt')).find(el => pattern.test(text(el)));
      return text(label?.nextElementSibling);
    };
    return {
      itemId,
      title: (text(doc.querySelector('h1')) || meta('og:title')).replace(/^(Reviews for|Discussion on|Support for)\s+/i, '').replace(/\s*[|–-]\s*(ThemeForest|CodeCanyon).*$/i, ''),
      description: (meta('description') || meta('og:description') || text(doc.querySelector('.item-description p'))).slice(0, 240),
      imageUrl: safeUrl(imageSource(image) || meta('og:image'), base),
      author: text(authorLink).replace(/^by\s+/i, ''),
      authorUrl: safeUrl(authorLink?.getAttribute('href'), base),
      avatarUrl: safeUrl(imageSource(avatar), base),
      rating: doc.querySelector('[itemprop="ratingValue"]')?.getAttribute('content') || text(doc.querySelector('[itemprop="ratingValue"], .rating-score strong, .rating-score')),
      ratingCount: doc.querySelector('[itemprop="reviewCount"]')?.getAttribute('content') || text(doc.querySelector('[itemprop="reviewCount"], .rating-count, .item-navigation-reviews-comments')),
      createdAt: text(doc.querySelector('time[itemprop="dateCreated"], [itemprop="datePublished"]')) || attribute(/^created\s*:?$/i),
      lastUpdate: text(doc.querySelector('time.updated, time[itemprop="dateModified"], .last-update-date')) || attribute(/^last update\s*:?$/i),
    };
  }
  async function remember(product) {
    if (!product.itemId) return;
    return chrome.runtime.sendMessage({action:'remember_widget_product', product});
  }
  async function resolve(info) {
    if (!info.itemId || !info.itemUrl) return info;
    let product = await chrome.runtime.sendMessage({action:'get_widget_product', itemId:info.itemId});
    if (!product?.imageUrl || !product?.avatarUrl) {
      try {
        const response = await chrome.runtime.sendMessage({action:'get_widget_item_page', url:info.itemUrl});
        if (response?.html) {
          const doc = new DOMParser().parseFromString(response.html, 'text/html');
          const canonical = doc.querySelector('link[rel="canonical"]')?.getAttribute('href');
          if (window.EnvatoXperienceShared.getCanonicalItemUrl(canonical) === info.itemUrl) {
            const fetched = read(doc, info.itemUrl);
            product = {...fetched, ...Object.fromEntries(Object.entries(product || {}).filter(([,value]) => value !== '' && value != null))};
          }
        }
      } catch (_) { /* Retain the source-page metadata if public fetching is blocked. */ }
    }
    if (!product || product.itemId !== info.itemId) return info;
    return {...product, ...info, title:product.title || info.title};
  }
  window.EnvatoWidgetProduct = {read, remember, resolve};
})();
