// The player page: a now-playing panel with full transport, and the catalogue.
// All playback goes through the shared engine; this file only draws the list and
// decides when the mini player should step aside.

import { gsap, reduced, charsIn, fadeIn, initFit } from '../shared/core.js';
import { tracks, byline, fmtTime } from '../data/tracks.js';
import * as engine from '../player/engine.js';
import { ICONS } from '../player/shell.js';

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const root = document.documentElement;

function rowHTML(t, i) {
  return `
  <li class="tl__row" data-track="${t.id}">
    <button class="tl__play" type="button" data-play aria-label="Play ${esc(t.title)}">
      <span class="tl__n">${String(i + 1).padStart(2, '0')}</span>
      <span class="tl__eq" aria-hidden="true"><i></i><i></i><i></i></span>
      ${ICONS.play}${ICONS.pause}
    </button>
    <img class="tl__art" src="${t.art}" alt="" width="56" height="56" loading="lazy" />
    <div class="tl__name"><strong>${esc(t.title)}</strong><span>${esc(byline(t))}</span></div>
    <span class="tl__kind">${esc(t.credit)}</span>
    <span class="tl__year">${t.year}</span>
    <span class="tl__len">${fmtTime(t.previewLength || t.fullLength)}</span>
    <div class="tl__act">
      ${t.buy?.available ? `<button class="cta cta--sm" type="button" data-buy="${t.id}"><span>Buy now</span><i class="ico ico--ne" aria-hidden="true"></i></button>` : ''}
      <a class="tl__out" href="${t.apple}" target="_blank" rel="noopener" data-track="${t.id}" aria-label="Open ${esc(t.title)} in Apple Music"><i class="ico ico--ne" aria-hidden="true"></i></a>
    </div>
  </li>`;
}

export function music(main) {
  const list = main.querySelector('[data-tracklist]');
  list.innerHTML = tracks.map(rowHTML).join('');

  // Something is always on deck, so the big play button works on first press.
  engine.cue(tracks[0].id);

  // A row is one big play target (its buttons and links keep their own jobs).
  const onRow = (e) => {
    const row = e.target.closest('.tl__row');
    if (!row || e.target.closest('button, a')) return;
    engine.toggle(row.dataset.track);
  };
  list.addEventListener('click', onRow);

  // While the full transport is on screen the mini player would only repeat it.
  const transport = main.querySelector('[data-transport]');
  const io = new IntersectionObserver(([entry]) => root.classList.toggle('transport-visible', entry.isIntersecting), {
    threshold: 0.3,
  });
  io.observe(transport);

  const unfit = initFit(main);

  return {
    assets: { images: tracks.map((t) => t.art), minTime: 1600 },

    start({ first }) {
      if (reduced) return;
      const lead = first ? 0 : 0.15;
      gsap
        .timeline({ defaults: { ease: 'lux' }, delay: lead })
        .fromTo('.mp__glow', { opacity: 0, scale: 0.6 }, { opacity: 1, scale: 1, duration: 2.4, ease: 'power3.out' }, 0)
        .add(fadeIn('[data-intro="meta"]', { duration: 1 }), 0.1)
        .add(charsIn('[data-intro="title"]', { duration: 1.3, stagger: 0.05 }), 0.1)
        .add(fadeIn('[data-intro="panel"]', { duration: 1.4, y: 28 }), 0.35)
        .fromTo(
          '.tl__row',
          { autoAlpha: 0, y: 18 },
          { autoAlpha: 1, y: 0, duration: 0.9, stagger: 0.07, clearProps: 'transform,opacity,visibility' },
          0.55,
        )
        .add(fadeIn('[data-intro="foot"]', { duration: 1 }), 0.9);
    },

    dispose() {
      io.disconnect();
      unfit();
      root.classList.remove('transport-visible');
    },
  };
}
