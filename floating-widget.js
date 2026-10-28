/** Isolated, accessible product drawer. No host markup or remote code is injected. */
(function () {
  const INTRO_KEY = 'envatoWidgetIntroSeen';
  const INTRO_DELAY = 4000;
  let host;
  let disposeWidget;
  let generation = 0;
  const safeUrl = (value) => {
    try { return value && ['http:', 'https:'].includes(new URL(value).protocol) ? value : ''; }
    catch (_) { return ''; }
  };
  function element(tag, className, content) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (content) node.textContent = content;
    return node;
  }
  function image(source, className, alt) {
    if (!safeUrl(source)) return null;
    const node = element('img', className);
    node.src = source;
    node.alt = alt;
    node.referrerPolicy = 'no-referrer';
    node.addEventListener('error', () => node.remove(), {once:true});
    return node;
  }
  async function mount(info) {
    if (host) return;
    const mountGeneration = generation;
    const settings = await chrome.storage.sync.get('widgetMode').catch(() => ({}));
    if (settings.widgetMode !== true || mountGeneration !== generation || host) return;
    const widgetHost = element('div');
    host = widgetHost;
    widgetHost.id = 'envato-custom-widget-root';
    widgetHost.style.visibility = 'hidden';
    let timer;
    let active = true;
    const listeners = [];
    const listen = (target, type, handler, options) => {
      target.addEventListener(type, handler, options);
      listeners.push([target, type, handler, options]);
    };
    const cleanup = () => {
      if (!active) return;
      active = false;
      clearTimeout(timer);
      for (const [target, type, handler, options] of listeners) {
        target.removeEventListener(type, handler, options);
      }
      widgetHost.remove();
      if (host === widgetHost) host = undefined;
      if (disposeWidget === cleanup) disposeWidget = undefined;
    };
    disposeWidget = cleanup;
    const displayFont = new FontFace('Envato Widget Display', `url("${chrome.runtime.getURL('assets/fonts/Oswald-SemiBold.ttf')}")`, {weight:'600', display:'swap'});
    displayFont.load().then(font => document.fonts.add(font)).catch(() => {});
    const shadow = host.attachShadow({mode:'open'});
    const style = element('link');
    style.rel = 'stylesheet';
    style.href = chrome.runtime.getURL('floating-widget.css');
    listen(style, 'load', () => { if (active) widgetHost.style.visibility = 'visible'; }, {once:true});
    listen(style, 'error', cleanup, {once:true});
    const drawer = element('div', 'widget');
    const card = element('section', 'card');
    card.id = 'envato-widget-card';
    card.setAttribute('aria-label', 'Envato product');
    const toggle = element('button', 'toggle');
    toggle.type = 'button';
    toggle.setAttribute('aria-controls', card.id);
    const icon = element('img');
    icon.alt = '';
    toggle.append(icon);
    const featured = image(info.imageUrl, 'featured', info.title || 'Product preview');
    if (featured) card.append(featured);
    const body = element('div', 'body');
    const heading = element('div', 'heading');
    const titles = element('div', 'titles');
    titles.append(element('h2', 'title', info.title || 'Envato product'));
    if (info.description) titles.append(element('p', 'description', info.description));
    heading.append(titles);
    const avatar = image(info.avatarUrl, 'avatar', info.author ? `${info.author} avatar` : 'Author avatar');
    if (avatar) {
      if (safeUrl(info.authorUrl)) {
        const author = element('a', 'author');
        author.href = info.authorUrl;
        author.target = '_blank'; author.rel = 'noopener noreferrer';
        author.setAttribute('aria-label', `View ${info.author || 'author'} profile`);
        author.append(avatar); heading.append(author);
      } else heading.append(avatar);
    }
    body.append(heading);
    if (info.author) body.append(element('p', 'byline', `By ${info.author}`));
    const rating = Number.parseFloat(info.rating);
    if (Number.isFinite(rating) && rating >= 0 && rating <= 5) {
      const row = element('div', 'rating');
      const stars = element('span', 'stars');
      stars.setAttribute('aria-hidden', 'true');
      const fill = element('span'); fill.style.width = `${rating / 5 * 100}%`;
      stars.append(fill);
      row.append(stars, element('span', 'rating-value', `${rating.toFixed(1)}${info.ratingCount ? ` · ${info.ratingCount} ratings` : ' out of 5'}`));
      body.append(row);
    }
    if (info.createdAt || info.lastUpdate) {
      const dates = element('dl', 'dates');
      for (const [label, value] of [['Created', info.createdAt], ['Last update', info.lastUpdate]]) {
        if (!value) continue;
        dates.append(element('dt', '', label), element('dd', '', value));
      }
      body.append(dates);
    }
    const actions = element('div', 'actions');
    for (const [value, label, className] of [[info.buyUrl, 'Buy now', 'buy'], [info.itemUrl, 'Back to item', 'back']]) {
      if (!safeUrl(value)) continue;
      const link = element('a', className, label); link.href = value;
      if (className === 'buy') { link.target = '_blank'; link.rel = 'noopener noreferrer'; }
      actions.append(link);
    }
    body.append(actions); card.append(body); drawer.append(card, toggle); shadow.append(style, drawer);
    document.body.append(widgetHost);
    let introductory = false;
    let engaged = false;
    const markSeen = () => { chrome.storage.local.set({[INTRO_KEY]:true}).catch(() => {}); };
    const setExpanded = (expanded) => {
      drawer.classList.toggle('is-expanded', expanded);
      toggle.setAttribute('aria-expanded', String(expanded));
      toggle.setAttribute('aria-label', expanded ? 'Collapse product details' : 'Show product details');
      icon.src = chrome.runtime.getURL(`assets/icons/widget-${expanded ? 'collapse' : 'menu'}.svg`);
      card.inert = !expanded;
      card.setAttribute('aria-hidden', String(!expanded));
    };
    const pause = () => clearTimeout(timer);
    const schedule = () => {
      pause();
      if (introductory && !engaged && !drawer.matches(':hover') && !drawer.contains(shadow.activeElement)) {
        timer = setTimeout(() => { introductory = false; setExpanded(false); markSeen(); }, INTRO_DELAY);
      }
    };
    listen(toggle, 'click', () => {
      engaged = true; introductory = false; pause(); markSeen();
      setExpanded(toggle.getAttribute('aria-expanded') !== 'true');
    });
    listen(card, 'click', () => { introductory = false; engaged = true; pause(); markSeen(); });
    listen(drawer, 'pointerenter', pause);
    listen(drawer, 'pointerleave', schedule);
    listen(drawer, 'focusin', pause);
    listen(drawer, 'focusout', () => queueMicrotask(schedule));
    listen(drawer, 'keydown', event => {
      if (event.key === 'Escape' && toggle.getAttribute('aria-expanded') === 'true') {
        introductory = false; engaged = true; pause(); setExpanded(false); toggle.focus(); markSeen();
      }
    });
    listen(window, 'pagehide', pause, {once:true});
    setExpanded(false);
    try {
      const result = await chrome.storage.local.get(INTRO_KEY);
      if (active && !result[INTRO_KEY] && !engaged) { introductory = true; setExpanded(true); schedule(); }
    } catch (_) { /* A storage error leaves the manually usable tab available. */ }
  }
  function unmount() {
    generation += 1;
    disposeWidget?.();
  }
  window.EnvatoFloatingWidget = {mount, unmount};
})();
