import '@fontsource-variable/geist';
import '@fontsource-variable/geist-mono';
import '@fontsource/instrument-serif/400.css';
import '@fontsource/instrument-serif/400-italic.css';
import '../shared/base.css';
import './noir.css';

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
} from '../shared/core.js';

const $ = (s) => document.querySelector(s);
const $$ = (s) => [...document.querySelectorAll(s)];

initMode();
const lenis = initScroll();
lenis?.stop();
initPlayers();
initCountdown();
initForms();
initFit();

const video = $('[data-hero-video]');
const loader = $('[data-loader]');
const count = $('[data-loader-count]');
const bar = $('[data-loader-bar]');
const mark = $('[data-loader-mark]');

// Loader: the mark breathes in while the counter tracks real asset loading.
if (!reduced) {
  gsap.fromTo(
    mark,
    { opacity: 0, scale: 0.86, filter: 'blur(10px)' },
    { opacity: 1, scale: 1, filter: 'blur(0px)', duration: 1.6, ease: 'lux' },
  );
} else {
  gsap.set(mark, { opacity: 1 });
}

preload({
  videos: [video],
  images: ['/media/opener-noir-poster.webp'],
  onProgress(p) {
    count.textContent = String(Math.round(p * 100)).padStart(3, '0');
    bar.style.transform = `scaleX(${p})`;
  },
}).then(open);

function open() {
  video.play().catch(() => {});
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

  tl.to('.loader__foot > *', { autoAlpha: 0, y: -10, duration: 0.5, stagger: 0.05, ease: 'power2.in' })
    .to(mark, { scale: 1.12, opacity: 0, filter: 'blur(8px)', duration: 0.7, ease: 'power2.in' }, '<')
    // Curtain lifts; the film settles from a slight push-in.
    .to(loader, { clipPath: 'inset(0% 0% 100% 0%)', duration: 1.25, ease: 'cut' }, '-=0.15')
    .fromTo(video, { scale: 1.14 }, { scale: 1, duration: 2.6 }, '<')
    .add(() => finishLoading(lenis), '>-1.3')
    .add(fadeIn('[data-intro="lockup"]', { duration: 1.6 }), '-=1.9')
    .add(fadeIn('[data-intro="tag"]', { duration: 1.3 }), '-=1.3')
    .add(fadeIn('[data-intro="cta"]', { duration: 1.2 }), '-=1.05')
    .add(fadeIn('[data-intro="nav"]', { y: -10, duration: 1, stagger: 0.07 }), '-=1.3')
    .add(fadeIn('[data-intro="foot"]', { duration: 1, stagger: 0.1 }), '-=0.8');
}

// Hero drifts and dims as the page scrolls on; the film pauses once it is off-screen.
if (!reduced) {
  gsap.to('[data-hero-media]', {
    yPercent: 10,
    ease: 'none',
    scrollTrigger: { trigger: '.hero', start: 'top top', end: 'bottom top', scrub: true },
  });
  gsap.to('.hero__content', {
    yPercent: -14,
    opacity: 0.2,
    ease: 'none',
    scrollTrigger: { trigger: '.hero', start: 'top top', end: 'bottom top', scrub: true },
  });
  gsap.from('.foot__word span', {
    yPercent: 55,
    ease: 'none',
    scrollTrigger: { trigger: '.foot', start: 'top bottom', end: 'bottom bottom', scrub: 0.4 },
  });
}

ScrollTrigger.create({
  trigger: '.hero',
  start: 'top bottom',
  end: 'bottom top',
  onToggle: (self) => {
    if (self.isActive) video.play().catch(() => {});
    else video.pause();
  },
});

// Keep the mode flip from leaving stale trigger positions (the hero changes shape).
window.addEventListener('modechange', () => requestAnimationFrame(() => ScrollTrigger.refresh()));

// Anchor links ride the smooth scroller.
$$('a[href^="#"]').forEach((a) => {
  a.addEventListener('click', (e) => {
    const target = document.querySelector(a.getAttribute('href'));
    if (!target || !lenis) return;
    e.preventDefault();
    lenis.scrollTo(target, { duration: 1.5 });
  });
});
