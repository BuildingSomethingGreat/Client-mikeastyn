// Shared behaviour for every page: colour mode, smooth scroll, preloading,
// scroll-driven reveals, waveforms, countdown and booking form.

import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { SplitText } from 'gsap/SplitText';
import { CustomEase } from 'gsap/CustomEase';
import Lenis from 'lenis';

gsap.registerPlugin(ScrollTrigger, SplitText, CustomEase);

// Two house curves: a long, soft settle for reveals and a hard editorial cut for wipes.
CustomEase.create('lux', '0.22,1,0.36,1');
CustomEase.create('cut', '0.68,0,0.05,0.99');

window.__astynBoot = true;

export { gsap, ScrollTrigger, SplitText };

export const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const root = document.documentElement;

/* ───────────────────────── Colour mode ───────────────────────── */

export function initMode() {
  const sync = () => {
    const light = root.dataset.mode === 'light';
    document.querySelectorAll('[data-mode-label]').forEach((n) => {
      n.textContent = light ? 'Dark' : 'Light';
    });
    document.querySelectorAll('[data-mode-toggle]').forEach((b) => {
      b.setAttribute('aria-label', `Switch to ${light ? 'dark' : 'light'} mode`);
    });
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.content = getComputedStyle(root).getPropertyValue('--bg').trim() || '#0a0a0a';
  };

  const flip = () => {
    const next = root.dataset.mode === 'light' ? 'dark' : 'light';
    const apply = () => {
      root.dataset.mode = next;
      try {
        localStorage.setItem('astyn-mode', next);
      } catch {
        /* private mode: the choice simply won't persist */
      }
      sync();
      window.dispatchEvent(new CustomEvent('modechange', { detail: next }));
    };
    if (document.startViewTransition && !reduced) document.startViewTransition(apply);
    else apply();
  };

  document.querySelectorAll('[data-mode-toggle]').forEach((b) => b.addEventListener('click', flip));
  sync();
}

/* ───────────────────────── Smooth scroll ───────────────────────── */

export function initScroll() {
  if (reduced) return null;
  const lenis = new Lenis({ lerp: 0.085 });
  lenis.on('scroll', ScrollTrigger.update);
  gsap.ticker.add((t) => lenis.raf(t * 1000));
  gsap.ticker.lagSmoothing(0);
  return lenis;
}

/* ───────────────────────── Preloading ───────────────────────── */

function videoReady(video, timeout) {
  return new Promise((resolve) => {
    if (!video || video.readyState >= 3) return resolve();
    const done = () => resolve();
    video.addEventListener('canplay', done, { once: true });
    video.addEventListener('error', done, { once: true });
    setTimeout(done, timeout);
    try {
      video.load();
    } catch {
      done();
    }
  });
}

function imageReady(src) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = img.onerror = () => resolve();
    img.src = src;
  });
}

/**
 * Waits for fonts, hero media and key images, reporting an eased 0..1 value.
 * The displayed value never outruns `minTime`, so the loader always reads as intentional.
 */
export function preload({ videos = [], images = [], minTime = 2400, maxTime = 7000, onProgress } = {}) {
  const jobs = [
    document.fonts ? document.fonts.ready : Promise.resolve(),
    ...videos.map((v) => videoReady(v, maxTime)),
    ...images.map(imageReady),
  ];
  let done = 0;
  jobs.forEach((j) => Promise.resolve(j).then(() => (done += 1)));

  return new Promise((resolve) => {
    if (reduced) {
      onProgress?.(1);
      Promise.race([Promise.all(jobs), new Promise((r) => setTimeout(r, 2500))]).then(resolve);
      return;
    }
    const start = performance.now();
    let shown = 0;
    const tick = (now) => {
      const elapsed = now - start;
      const real = elapsed > maxTime ? 1 : done / jobs.length;
      const target = Math.min(real, elapsed / minTime);
      shown += (target - shown) * 0.12;
      if (target >= 1 && shown > 0.995) {
        onProgress?.(1);
        resolve();
        return;
      }
      onProgress?.(shown);
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
}

export function finishLoading(lenis) {
  root.classList.remove('is-loading');
  root.classList.add('is-loaded');
  lenis?.start();
  ScrollTrigger.refresh();
}

/* ───────────────────────── Text + media reveals ───────────────────────── */

/** Masked line reveal. Returns the tween so intro timelines can sequence it. */
export function linesIn(el, vars = {}) {
  gsap.set(el, { visibility: 'visible' });
  if (reduced) return gsap.to(el, { duration: 0 });
  let tween;
  SplitText.create(el, {
    type: 'lines',
    mask: 'lines',
    linesClass: 'ln',
    autoSplit: true,
    onSplit(self) {
      const next = gsap.from(self.lines, {
        yPercent: 112,
        duration: 1.3,
        ease: 'lux',
        stagger: 0.09,
        ...vars,
      });
      // On a re-split (resize / late font swap) jump straight to the end state.
      if (tween) next.progress(1);
      tween = next;
      return next;
    },
  });
  // If fonts were still pending, the split (and its tween) arrives later on its own.
  return tween || gsap.to({}, { duration: 0 });
}

/** Per-character rise, for wordmarks. */
export function charsIn(el, vars = {}) {
  gsap.set(el, { visibility: 'visible' });
  if (reduced) return gsap.to(el, { duration: 0 });
  const split = SplitText.create(el, { type: 'chars', mask: 'chars', charsClass: 'ch' });
  return gsap.from(split.chars, { yPercent: 110, duration: 1.4, ease: 'lux', stagger: 0.06, ...vars });
}

export function fadeIn(targets, vars = {}) {
  if (reduced) return gsap.set(targets, { autoAlpha: 1 });
  return gsap.fromTo(
    targets,
    { autoAlpha: 0, y: 18, filter: 'blur(8px)' },
    { autoAlpha: 1, y: 0, filter: 'blur(0px)', duration: 1.2, ease: 'lux', ...vars },
  );
}

export function initReveals(scope = document) {
  if (reduced) return;
  const st = (el) => ({ trigger: el, start: 'top 88%', once: true });
  const delay = (el) => parseFloat(el.dataset.delay || '0');

  scope.querySelectorAll('[data-reveal="lines"]').forEach((el) => {
    linesIn(el, { delay: delay(el), scrollTrigger: st(el) });
  });

  scope.querySelectorAll('[data-reveal="chars"]').forEach((el) => {
    charsIn(el, { delay: delay(el), scrollTrigger: st(el) });
  });

  scope.querySelectorAll('[data-reveal="fade"]').forEach((el) => {
    fadeIn(el, { delay: delay(el), scrollTrigger: st(el) });
  });

  // Staggered groups: children fade up one after another.
  scope.querySelectorAll('[data-reveal="stagger"]').forEach((el) => {
    gsap.set(el, { visibility: 'visible' });
    fadeIn(el.children, { stagger: 0.08, delay: delay(el), scrollTrigger: st(el) });
  });

  // Hairlines draw from the left.
  scope.querySelectorAll('[data-reveal="rule"]').forEach((el) => {
    gsap.fromTo(
      el,
      { autoAlpha: 1, scaleX: 0, transformOrigin: 'left center' },
      { scaleX: 1, duration: 1.6, ease: 'cut', delay: delay(el), scrollTrigger: st(el) },
    );
  });

  // Images wipe open while the picture settles from a slight push-in.
  scope.querySelectorAll('[data-reveal="img"]').forEach((el) => {
    const media = el.querySelector('img, video, canvas');
    const from = el.dataset.from === 'left' ? 'inset(0% 100% 0% 0%)' : 'inset(100% 0% 0% 0%)';
    const tl = gsap.timeline({ delay: delay(el), scrollTrigger: { trigger: el, start: 'top 85%', once: true } });
    tl.fromTo(
      el,
      { autoAlpha: 1, clipPath: from },
      { clipPath: 'inset(0% 0% 0% 0%)', duration: 1.6, ease: 'cut' },
    );
    if (media) tl.fromTo(media, { scale: 1.18 }, { scale: 1, duration: 2, ease: 'lux' }, 0);
  });

  // Gentle scrubbed drift on media inside a clipped frame.
  scope.querySelectorAll('[data-parallax]').forEach((el) => {
    const amt = parseFloat(el.dataset.parallax || '8');
    gsap.fromTo(
      el,
      { yPercent: -amt },
      {
        yPercent: amt,
        ease: 'none',
        scrollTrigger: { trigger: el.parentElement, start: 'top bottom', end: 'bottom top', scrub: true },
      },
    );
  });

  // Words light up as the block crosses the viewport.
  scope.querySelectorAll('[data-scrub-words]').forEach((el) => {
    gsap.set(el, { visibility: 'visible' });
    const split = SplitText.create(el, { type: 'words', wordsClass: 'wd' });
    gsap.fromTo(
      split.words,
      { opacity: 0.14 },
      {
        opacity: 1,
        ease: 'none',
        stagger: 0.4,
        scrollTrigger: { trigger: el, start: 'top 82%', end: 'bottom 55%', scrub: 0.6 },
      },
    );
  });
}

/* ───────────────────────── Fit-to-width wordmarks ───────────────────────── */

/** Scales each [data-fit] so its text spans its parent. Returns a disposer. */
export function initFit(scope = document) {
  const els = [...scope.querySelectorAll('[data-fit]')];
  if (!els.length) return () => {};
  const fit = () => {
    els.forEach((el) => {
      const box = el.parentElement.getBoundingClientRect().width;
      el.style.fontSize = '100px';
      const w = el.getBoundingClientRect().width;
      if (w > 0) el.style.fontSize = `${(100 * box) / w}px`;
    });
  };
  fit();
  document.fonts?.ready.then(fit);
  let raf;
  const onResize = () => {
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(fit);
  };
  window.addEventListener('resize', onResize);
  return () => window.removeEventListener('resize', onResize);
}

/* ───────────────────────── Section-aware nav ───────────────────────── */

/** Marks the nav link for the section in view (home) or for the page itself. */
export function initNavSpy(page) {
  const links = [...document.querySelectorAll('[data-nav] a')];
  links.forEach((l) => l.removeAttribute('aria-current'));
  const mark = (a) => {
    links.forEach((l) => l.removeAttribute('aria-current'));
    a?.setAttribute('aria-current', 'true');
  };
  const own = links.find((a) => a.dataset.navPage === page);
  if (own) mark(own);

  links.forEach((a) => {
    const url = new URL(a.href, location.href);
    if (url.pathname !== location.pathname || !url.hash) return;
    const target = document.querySelector(url.hash);
    if (!target) return;
    ScrollTrigger.create({
      trigger: target,
      start: 'top 55%',
      end: 'bottom 55%',
      onToggle: (self) => {
        if (self.isActive) mark(a);
        else if (a.getAttribute('aria-current')) mark(own);
      },
    });
  });
}

/** Tuck the fixed nav away while reading down the page; bring it back on the way up. */
export function initNavAutoHide() {
  root.classList.remove('nav-hidden');
  ScrollTrigger.create({
    start: 0,
    end: 'max',
    onUpdate: (self) => {
      const past = self.scroll() > window.innerHeight * 0.6;
      root.classList.toggle('nav-hidden', past && self.direction === 1);
    },
  });
}

/* ───────────────────────── Waveform bars ───────────────────────── */

/** Draws the decorative waveform into every [data-wave]; progress is the --p variable. */
export function buildWaves(scope = document) {
  scope.querySelectorAll('[data-wave]').forEach((el) => {
    const count = parseInt(el.dataset.wave || '56', 10);
    // Seeded from the element's own key so each song keeps a distinct, stable shape.
    let seed = [...(el.dataset.waveSeed || 'astyn')].reduce((n, c) => (n * 31 + c.charCodeAt(0)) % 2147483647, 7) || 7;
    const rand = () => {
      seed = (seed * 16807) % 2147483647;
      return seed / 2147483647;
    };
    const bars = Array.from({ length: count }, (_, i) => {
      const env = Math.sin((i / (count - 1)) * Math.PI) ** 0.7;
      return Math.max(0.08, env * (0.35 + rand() * 0.65));
    });
    const layer = (cls) =>
      `<span class="wave__layer ${cls}" aria-hidden="true">${bars
        .map((h) => `<i style="--h:${h.toFixed(3)}"></i>`)
        .join('')}</span>`;
    el.innerHTML = layer('wave__base') + layer('wave__fill');
  });
}

/* ───────────────────────── Countdown ───────────────────────── */

/** Returns a disposer that stops the clocks. */
export function initCountdown(scope = document) {
  const timers = [];
  scope.querySelectorAll('[data-countdown]').forEach((el) => {
    const target = new Date(el.dataset.countdown).getTime();
    const slot = (k) => el.querySelector(`[data-cd="${k}"]`);
    const put = (k, v) => {
      const n = slot(k);
      if (n) n.textContent = String(v).padStart(2, '0');
    };
    const tick = () => {
      const d = Math.max(0, target - Date.now());
      put('days', Math.floor(d / 864e5));
      put('hours', Math.floor(d / 36e5) % 24);
      put('mins', Math.floor(d / 6e4) % 60);
      put('secs', Math.floor(d / 1e3) % 60);
    };
    tick();
    timers.push(setInterval(tick, 1000));
  });
  return () => timers.forEach(clearInterval);
}

/* ───────────────────────── Booking form ───────────────────────── */

export function initForms(scope = document) {
  scope.querySelectorAll('form[data-booking]').forEach((form) => {
    const status = form.querySelector('[data-form-status]');
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const data = new FormData(form);
      form.classList.add('is-sending');
      status.textContent = 'Sending…';
      try {
        const res = await fetch('/', {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams(data).toString(),
        });
        if (!res.ok) throw new Error(String(res.status));
        form.reset();
        form.classList.add('is-sent');
        status.textContent = 'Inquiry received. Mike Astyn Exp. will be in touch shortly.';
      } catch {
        // No form backend reachable: hand the same details to their mail app.
        const subject = `Booking inquiry: ${data.get('name') || ''}`;
        const body = [
          `Name: ${data.get('name') || ''}`,
          `Email: ${data.get('email') || ''}`,
          `Event date: ${data.get('date') || ''}`,
          '',
          `${data.get('details') || ''}`,
        ].join('\n');
        const href = `mailto:${form.dataset.booking}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
        status.innerHTML = '';
        const a = document.createElement('a');
        a.href = href;
        a.textContent = 'Couldn’t send from here. Tap to send this inquiry by email instead.';
        status.append(a);
      } finally {
        form.classList.remove('is-sending');
      }
    });
  });
}
