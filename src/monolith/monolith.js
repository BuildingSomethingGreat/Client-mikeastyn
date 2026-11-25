import '@fontsource-variable/archivo/wdth.css';
import '@fontsource-variable/geist';
import '@fontsource-variable/geist-mono';
import '../shared/base.css';
import './monolith.css';

import {
  gsap,
  ScrollTrigger,
  reduced,
  initMode,
  initScroll,
  preload,
  finishLoading,
  initReveals,
  initFit,
  initNavSpy,
  initNavAutoHide,
  initPlayers,
  initCountdown,
  initForms,
  fadeIn,
  charsIn,
} from '../shared/core.js';
import { alphaVideo } from '../shared/alpha-video.js';

const $ = (s) => document.querySelector(s);
const $$ = (s) => [...document.querySelectorAll(s)];

initMode();
const lenis = initScroll();
lenis?.stop();
initPlayers();
initCountdown();
initForms();
initFit();

/* The cut-out film: a still shows until the first composited frame lands. */
const subject = $('[data-hero-subject]');
const video = $('[data-hero-video]');
const canvas = $('[data-hero-canvas]');
canvas.addEventListener('firstframe', () => subject.classList.add('is-live'), { once: true });
const live = alphaVideo(canvas, video);

/* Release rows: one open at a time. */
const rows = $$('.row');
rows.forEach((row) => {
  row.querySelector('[data-row]').addEventListener('click', () => {
    const open = !row.classList.contains('is-open');
    rows.forEach((r) => {
      r.classList.remove('is-open');
      r.querySelector('[data-row]').setAttribute('aria-expanded', 'false');
    });
    if (open) {
      row.classList.add('is-open');
      row.querySelector('[data-row]').setAttribute('aria-expanded', 'true');
    }
    setTimeout(() => ScrollTrigger.refresh(), 950);
  });
});

/* Loader */
const loader = $('[data-loader]');
const count = $('[data-loader-count]');
const bar = $('[data-loader-bar]');

preload({
  videos: live ? [video] : [],
  images: ['/media/cutout-still.webp'],
  onProgress(p) {
    count.textContent = String(Math.round(p * 100)).padStart(3, '0');
    bar.style.transform = `scaleX(${p})`;
  },
}).then(open);

function open() {
  if (live) video.play().catch(() => {});
  initReveals();
  initNavSpy();
  initNavAutoHide();

  if (reduced) {
    gsap.set('[data-intro]', { autoAlpha: 1 });
    finishLoading(lenis);
    return;
  }

  gsap.set(loader, { clipPath: 'inset(0% 0% 0% 0%)' });
  const tl = gsap.timeline({ defaults: { ease: 'lux' } });

  tl.to(count, { yPercent: -105, duration: 0.9, ease: 'cut' })
    .to('.loader__top span', { autoAlpha: 0, y: -8, duration: 0.5, stagger: 0.05, ease: 'power2.in' }, '<')
    .to(bar.parentElement, { autoAlpha: 0, duration: 0.4 }, '<0.2')
    .to(loader, { clipPath: 'inset(0% 0% 100% 0%)', duration: 1.2, ease: 'cut' }, '-=0.35')
    .add(() => finishLoading(lenis))
    // Light first, then the word, then the man.
    .fromTo(
      '[data-hero-glow]',
      { opacity: 0, scale: 0.55 },
      { opacity: 1, scale: 1, duration: 2.6, ease: 'power3.out' },
      '-=1.1',
    )
    .add(charsIn('[data-hero-word]', { duration: 1.5, stagger: 0.07 }), '-=2.3')
    .fromTo(
      subject,
      { autoAlpha: 0, yPercent: 7, scale: 1.05, filter: 'blur(16px)' },
      { autoAlpha: 1, yPercent: 0, scale: 1, filter: 'blur(0px)', duration: 2, clearProps: 'filter' },
      '-=1.7',
    )
    .add(fadeIn('[data-intro="nav"]', { y: -10, duration: 1, stagger: 0.06 }), '-=1.5')
    .add(fadeIn('[data-intro="meta"]', { duration: 1.1, stagger: 0.1 }), '-=1.2')
    .add(fadeIn('[data-intro="cta"]', { duration: 1.1 }), '-=0.9');
}

/* Depth on scroll: the word lifts away behind him while the light swells. */
if (!reduced) {
  const st = { trigger: '.hero', start: 'top top', end: 'bottom top', scrub: true };
  gsap.to('.hero__word', { yPercent: -38, ease: 'none', scrollTrigger: st });
  gsap.to('.hero__subject', { yPercent: 6, ease: 'none', scrollTrigger: st });
  gsap.to('.hero__left, .hero__right, .hero__index', { opacity: 0, ease: 'none', scrollTrigger: { ...st, end: '40% top' } });

  gsap.from('.foot__word span', {
    yPercent: 60,
    ease: 'none',
    scrollTrigger: { trigger: '.foot', start: 'top bottom', end: 'bottom bottom', scrub: 0.4 },
  });
  gsap.from('.foot__glow', {
    opacity: 0,
    scale: 0.6,
    ease: 'none',
    scrollTrigger: { trigger: '.foot', start: 'top bottom', end: 'bottom bottom', scrub: 0.4 },
  });
}

if (live) {
  ScrollTrigger.create({
    trigger: '.hero',
    start: 'top bottom',
    end: 'bottom top',
    onToggle: (self) => {
      if (self.isActive) video.play().catch(() => {});
      else video.pause();
    },
  });
}

$$('a[href^="#"]').forEach((a) => {
  a.addEventListener('click', (e) => {
    const target = document.querySelector(a.getAttribute('href'));
    if (!target || !lenis) return;
    e.preventDefault();
    lenis.scrollTo(target, { duration: 1.5 });
  });
});
