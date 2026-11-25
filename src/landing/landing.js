import '@fontsource-variable/geist';
import '@fontsource-variable/geist-mono';
import '@fontsource/instrument-serif/400.css';
import '@fontsource/instrument-serif/400-italic.css';
import '../shared/base.css';
import './landing.css';

import {
  gsap,
  reduced,
  initMode,
  initScroll,
  preload,
  finishLoading,
  initReveals,
  fadeIn,
  linesIn,
} from '../shared/core.js';

initMode();
const lenis = initScroll();
lenis?.stop();

const loader = document.querySelector('[data-loader]');
const count = document.querySelector('[data-loader-count]');
const mark = document.querySelector('[data-loader-mark]');

if (reduced) gsap.set(mark, { opacity: 1 });
else gsap.fromTo(mark, { opacity: 0, scale: 0.86 }, { opacity: 1, scale: 1, duration: 1.1, ease: 'lux' });

preload({
  images: ['/shots/noir-dark.webp', '/shots/monolith-dark.webp'],
  minTime: 1300,
  onProgress(p) {
    count.textContent = String(Math.round(p * 100)).padStart(3, '0');
  },
}).then(() => {
  initReveals();

  if (reduced) {
    gsap.set('[data-intro]', { autoAlpha: 1 });
    finishLoading(lenis);
    return;
  }

  gsap.set(loader, { clipPath: 'inset(0% 0% 0% 0%)' });
  gsap
    .timeline({ defaults: { ease: 'lux' } })
    .to([mark, count], { opacity: 0, duration: 0.45, ease: 'power2.in' })
    .to(loader, { clipPath: 'inset(0% 0% 100% 0%)', duration: 1.1, ease: 'cut' }, '-=0.1')
    .add(() => finishLoading(lenis))
    .add(fadeIn('[data-intro="nav"]', { y: -10, duration: 1, stagger: 0.07 }), '-=0.6')
    .add(fadeIn('[data-intro="eyebrow"]', { duration: 1 }), '<')
    .add(linesIn('[data-intro="title"]', { duration: 1.5 }), '<0.1')
    .add(fadeIn('[data-intro="copy"]', { duration: 1.2, stagger: 0.12 }), '-=1');
});
