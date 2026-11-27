// Home page. Called each time the page is entered; everything it animates is
// created inside the caller's gsap context, and `dispose` undoes the rest.

import {
  gsap,
  ScrollTrigger,
  reduced,
  initReveals,
  initFit,
  buildWaves,
  initCountdown,
  initForms,
  fadeIn,
  charsIn,
} from '../shared/core.js';
import { alphaVideo } from '../shared/alpha-video.js';
import { tracks } from '../data/tracks.js';
import { initGallery } from './gallery.js';

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

function rowHTML(t, i) {
  const n = String(i + 1).padStart(2, '0');
  const kind = t.feat ? `Feature, ${esc(t.artist)}` : esc(t.credit);
  return `
  <li class="row${i === 0 ? ' is-open' : ''}" data-track="${t.id}">
    <button class="row__head" type="button" data-row aria-expanded="${i === 0}">
      <span class="row__n">[${n}]</span>
      <span class="row__t">${esc(t.title)}</span>
      <span class="row__k">${kind}</span>
      <span class="row__y">${t.year}</span>
      <span class="row__x" aria-hidden="true"></span>
    </button>
    <div class="row__panel">
      <div class="row__inner">
        <img class="row__art" src="${t.art}" alt="${esc(t.title)} artwork" width="900" height="900" loading="lazy" />
        <div class="row__player">
          <button class="play" type="button" data-play aria-label="Play ${esc(t.title)}"><i aria-hidden="true"></i><span>Preview</span></button>
          <div class="row__wave" data-pl-seek><span class="wave" data-wave="84" data-wave-seed="${t.id}"></span></div>
        </div>
        <div class="row__links">
          ${t.buy?.available ? `<button class="cta cta--sm" type="button" data-buy="${t.id}"><span>Buy now</span><i class="ico ico--ne" aria-hidden="true"></i></button>` : ''}
          <a class="ulink" href="${t.apple}" target="_blank" rel="noopener" data-track="${t.id}">Apple Music <i class="ico ico--ne" aria-hidden="true"></i></a>
        </div>
      </div>
    </div>
  </li>`;
}

export function home(main, { lenis }) {
  const $ = (s) => main.querySelector(s);
  const disposers = [];

  /* Releases: rendered from the catalogue so the player and this list never disagree. */
  const list = $('[data-rows]');
  if (list) list.innerHTML = tracks.map(rowHTML).join('');
  const rows = [...main.querySelectorAll('.row')];
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
  buildWaves(main);

  /* The cut-out film: a still shows until the first composited frame lands. */
  const subject = $('[data-hero-subject]');
  const video = $('[data-hero-video]');
  const canvas = $('[data-hero-canvas]');
  canvas.addEventListener('firstframe', () => subject.classList.add('is-live'), { once: true });
  const live = alphaVideo(canvas, video);

  disposers.push(initFit(main), initCountdown(main), initGallery(main, { lenis }));
  initForms(main);
  initReveals(main);

  /* Depth on scroll: the word lifts away behind him while the light swells. */
  if (!reduced) {
    const st = { trigger: '.hero', start: 'top top', end: 'bottom top', scrub: true };
    gsap.to('.hero__word', { yPercent: -38, ease: 'none', scrollTrigger: st });
    gsap.to('.hero__subject', { yPercent: 6, ease: 'none', scrollTrigger: st });
    gsap.to('.hero__left, .hero__right, .hero__index', {
      opacity: 0,
      ease: 'none',
      scrollTrigger: { ...st, end: '40% top' },
    });
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
    disposers.push(() => video.pause());
  }

  return {
    assets: { videos: live ? [video] : [], images: ['/media/cutout-still.webp'] },

    /** Light first, then the word, then the man. */
    start({ first }) {
      if (live) video.play().catch(() => {});
      if (reduced) return;
      const lead = first ? 0 : 0.15;
      gsap
        .timeline({ defaults: { ease: 'lux' }, delay: lead })
        .fromTo(
          '[data-hero-glow]',
          { opacity: 0, scale: 0.55 },
          { opacity: 1, scale: 1, duration: 2.6, ease: 'power3.out' },
          0,
        )
        .add(charsIn('[data-hero-word]', { duration: 1.5, stagger: 0.07 }), 0.1)
        .fromTo(
          subject,
          { autoAlpha: 0, yPercent: 7, scale: 1.05, filter: 'blur(16px)' },
          { autoAlpha: 1, yPercent: 0, scale: 1, filter: 'blur(0px)', duration: 2, clearProps: 'filter' },
          0.5,
        )
        .add(fadeIn('[data-intro="meta"]', { duration: 1.1, stagger: 0.1 }), 1.1)
        .add(fadeIn('[data-intro="cta"]', { duration: 1.1 }), 1.4);
    },

    dispose() {
      disposers.forEach((fn) => fn?.());
    },
  };
}

