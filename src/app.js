// Entry for the public site (home and music). One bundle, one audio engine:
// moving between pages swaps only <main>, so whatever is playing keeps playing.

import '@fontsource-variable/archivo/wdth.css';
import '@fontsource-variable/geist';
import '@fontsource-variable/geist-mono';
import './shared/base.css';
import './site/site.css';
import './site/gallery.css';
import './site/music.css';
import './player/player.css';

import {
  gsap,
  ScrollTrigger,
  reduced,
  initMode,
  initScroll,
  preload,
  finishLoading,
  initNavSpy,
  initNavAutoHide,
} from './shared/core.js';
import { initAnalytics, pageView } from './analytics/track.js';
import { mountShell } from './player/shell.js';
import { home } from './pages/home.js';
import { music } from './pages/music.js';

const PAGES = { home, music };
const ROUTES = new Set(['/', '/music/']);
const norm = (p) => (p === '/music' ? '/music/' : p.replace(/index\.html$/, ''));

const root = document.documentElement;
const $ = (s) => document.querySelector(s);

initMode();
initAnalytics();
const lenis = initScroll();
lenis?.stop();
const shell = mountShell({ lenis });

document.body.insertAdjacentHTML('beforeend', '<div class="wipe" data-wipe aria-hidden="true"></div>');
const wipe = $('[data-wipe]');

/* ───────── Page lifecycle ───────── */

let current = null; // { ctx, page }

function scrollToHash(hash, immediate = false) {
  const target = hash && document.querySelector(hash);
  if (!target) return;
  if (lenis) lenis.scrollTo(target, immediate ? { immediate: true, force: true } : { duration: 1.5 });
  else target.scrollIntoView();
}

function enter(name) {
  const main = $('main');
  root.dataset.page = name;
  let page;
  // Everything a page animates is created inside one context, so leaving reverts it in one call.
  const ctx = gsap.context(() => {
    page = (PAGES[name] || PAGES.home)(main, { lenis });
  });
  current = { ctx, page };
  shell.refresh();
  initNavSpy(name);
  initNavAutoHide();
  pageView();
  return page;
}

function leave() {
  shell.closeOverlays();
  current?.page?.dispose?.();
  current?.ctx?.revert();
  ScrollTrigger.getAll().forEach((t) => t.kill());
  current = null;
}

/* ───────── First load: counted loader, then the page's own entrance ───────── */

const first = enter($('main').dataset.page);
const count = $('[data-loader-count]');
const bar = $('[data-loader-bar]');
const loader = $('[data-loader]');

preload({
  ...first.assets,
  onProgress(p) {
    count.textContent = String(Math.round(p * 100)).padStart(3, '0');
    bar.style.transform = `scaleX(${p})`;
  },
}).then(() => {
  if (reduced) {
    gsap.set('[data-intro]', { autoAlpha: 1 });
    finishLoading(lenis);
    first.start({ first: true });
    if (location.hash) scrollToHash(location.hash, true);
    return;
  }
  gsap.set(loader, { clipPath: 'inset(0% 0% 0% 0%)' });
  gsap
    .timeline()
    .to(count, { yPercent: -105, duration: 0.9, ease: 'cut' })
    .to('.loader__top span', { autoAlpha: 0, y: -8, duration: 0.5, stagger: 0.05, ease: 'power2.in' }, '<')
    .to(bar.parentElement, { autoAlpha: 0, duration: 0.4 }, '<0.2')
    .to(loader, { clipPath: 'inset(0% 0% 100% 0%)', duration: 1.2, ease: 'cut' }, '-=0.35')
    .add(() => {
      finishLoading(lenis);
      if (location.hash) scrollToHash(location.hash, true);
    })
    .add(() => current?.ctx.add(() => first.start({ first: true })), '-=1.1')
    .add(
      gsap.fromTo(
        '[data-intro="nav"]',
        { autoAlpha: 0, y: -10 },
        { autoAlpha: 1, y: 0, duration: 1, ease: 'lux', stagger: 0.06, clearProps: 'transform' },
      ),
      '-=0.5',
    );
});

/* ───────── Navigation without reloading ───────── */

let busy = false;

const cover = () =>
  reduced
    ? Promise.resolve()
    : gsap.fromTo(
        wipe,
        { clipPath: 'inset(100% 0% 0% 0%)', visibility: 'visible' },
        { clipPath: 'inset(0% 0% 0% 0%)', duration: 0.7, ease: 'cut' },
      );

const uncover = () =>
  reduced
    ? Promise.resolve()
    : gsap.to(wipe, {
        clipPath: 'inset(0% 0% 100% 0%)',
        duration: 0.8,
        ease: 'cut',
        onComplete: () => gsap.set(wipe, { visibility: 'hidden' }),
      });

async function go(url, push) {
  if (busy) return;
  busy = true;
  const pending = fetch(url.pathname, { headers: { Accept: 'text/html' } }).then((r) => {
    if (!r.ok) throw new Error(String(r.status));
    return r.text();
  });
  lenis?.stop();

  let next;
  let doc;
  try {
    const [html] = await Promise.all([pending, cover()]);
    doc = new DOMParser().parseFromString(html, 'text/html');
    next = doc.querySelector('main');
    if (!next) throw new Error('no main');
  } catch {
    // Anything unexpected: fall back to an ordinary page load.
    location.href = url.href;
    return;
  }

  leave();
  $('main').replaceWith(document.importNode(next, true));
  document.title = doc.title;
  ['meta[name="description"]', 'link[rel="canonical"]'].forEach((sel) => {
    const from = doc.querySelector(sel);
    const to = document.querySelector(sel);
    if (from && to) [...from.attributes].forEach((a) => to.setAttribute(a.name, a.value));
  });
  if (push) history.pushState({}, '', url.pathname + url.hash);

  window.scrollTo(0, 0);
  lenis?.scrollTo(0, { immediate: true, force: true });
  const page = enter(next.dataset.page);
  if (reduced) gsap.set('main [data-intro]', { autoAlpha: 1 });
  ScrollTrigger.refresh();
  if (url.hash) scrollToHash(url.hash, true);
  lenis?.start();
  current.ctx.add(() => page.start({ first: false }));
  await uncover();
  busy = false;
}

document.addEventListener('click', (e) => {
  if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
  const a = e.target.closest('a[href]');
  if (!a || a.target === '_blank' || a.hasAttribute('download')) return;
  const url = new URL(a.href, location.href);
  if (url.origin !== location.origin) return;
  const path = norm(url.pathname);
  if (!ROUTES.has(path)) return; // e.g. /admin/ is a separate app

  e.preventDefault();
  if (path === norm(location.pathname)) {
    if (url.hash) scrollToHash(url.hash);
    else if (lenis) lenis.scrollTo(0, { duration: 1.4 });
    else window.scrollTo(0, 0);
    return;
  }
  go(new URL(path + url.hash, location.origin), true);
});

window.addEventListener('popstate', () => {
  if (norm(location.pathname) !== (root.dataset.page === 'music' ? '/music/' : '/')) go(new URL(location.href), false);
});

// Warm the other page the moment a link to it is hovered or touched.
const warmed = new Set();
const warm = (e) => {
  const a = e.target.closest?.('a[href]');
  if (!a) return;
  const url = new URL(a.href, location.href);
  const path = norm(url.pathname);
  if (url.origin !== location.origin || !ROUTES.has(path) || path === norm(location.pathname) || warmed.has(path)) return;
  warmed.add(path);
  fetch(path, { headers: { Accept: 'text/html' } }).catch(() => warmed.delete(path));
};
document.addEventListener('pointerenter', warm, true);
document.addEventListener('touchstart', warm, { passive: true, capture: true });
