// Everything about the player that outlives a page: the mini player, the full-screen
// lyrics view and the Buy modal. Mounted once; it survives navigation between pages.
//
// Pages opt in with data attributes, and this file wires them up by delegation:
//   data-track="id"            a row that reflects that song's state (is-current / is-playing, --p)
//   data-play[="id"]           play / pause that song (or the row's song)
//   data-pl-action="…"         toggle | next | prev | shuffle | repeat | mute | close
//   data-pl-seek               a bar you can click or drag to scrub
//   data-pl-title|artist|credit|time|left|art|progress|volume   live slots
//   data-buy[="id"]            Buy Now (opens the store link, or the coming-soon modal)
//   data-lyrics                open the lyrics view

import * as engine from './engine.js';
import { tracks, trackById, byline, fmtTime } from '../data/tracks.js';
import { track as log, EVENTS } from '../analytics/track.js';

const icon = (d, extra = '') => `<svg viewBox="0 0 24 24" aria-hidden="true" ${extra}>${d}</svg>`;

export const ICONS = {
  play: icon('<path d="M7 4.5v15l12.5-7.5z"/>', 'class="i-play"'),
  pause: icon('<path d="M6.5 4.5h4v15h-4zM13.500 4.500h4v15h-4z"/>', 'class="i-pause"'),
  prev: icon('<path d="M6 5h2.200v14H6zM19 5.300v13.400L9.200 12z"/>'),
  next: icon('<path d="M15.800 5H18v14h-2.200zM5 5.300v13.400L14.800 12z"/>'),
  shuffle: icon(
    '<path d="M3 7h3.600c2 0 3.300.9 4.400 2.600l2 3c.800 1.200 1.600 1.900 3 1.900h2.300l-1.700-1.700 1.300-1.300L21.800 15.400l-3.900 3.900-1.300-1.300 1.700-1.700H16c-2.200 0-3.500-1-4.600-2.700l-2-3C8.700 9.500 8 8.800 6.600 8.800H3zm0 8.200h3.600c.900 0 1.500-.3 2-.9l1.100 1.600c-.800.700-1.800 1.100-3.100 1.100H3zm13-8.200h2.300l-1.700-1.700 1.300-1.300 3.900 3.900-3.900 3.900-1.300-1.300 1.700-1.700H16c-.900 0-1.500.300-2 .900l-1.100-1.600C13.700 7.400 14.700 7 16 7z"/>',
  ),
  repeat: icon(
    '<path d="M7 6h10.200l-1.700-1.700L16.800 3l3.900 3.900-3.900 3.900-1.300-1.300 1.700-1.700H7a2.200 2.200 0 0 0-2.200 2.200V12H3V10A4 4 0 0 1 7 6zm10 12H6.800l1.700 1.700L7.200 21l-3.900-3.900 3.900-3.900 1.300 1.300-1.700 1.700H17a2.200 2.200 0 0 0 2.200-2.200V12H21v2a4 4 0 0 1-4 4z"/>',
  ),
  volume: icon(
    '<path d="M4 9.500h3.500L12 5.500v13l-4.500-4H4zM15 8.600a4.500 4.500 0 0 1 0 6.800l-1.100-1.300a2.800 2.800 0 0 0 0-4.200zm2.200-2.500a8 8 0 0 1 0 11.800l-1.100-1.300a6.300 6.300 0 0 0 0-9.200z"/>',
    'class="i-vol"',
  ),
  muted: icon(
    '<path d="M4 9.500h3.500L12 5.500v13l-4.500-4H4zm11.200.100 1.900 1.900 1.900-1.900 1.200 1.200-1.900 1.900 1.900 1.900-1.200 1.200-1.900-1.900-1.900 1.900-1.200-1.200 1.900-1.900-1.900-1.900z"/>',
    'class="i-muted"',
  ),
  close: icon('<path d="M6.300 5 12 10.700 17.700 5 19 6.300 13.300 12l5.700 5.700-1.300 1.300L12 13.300 6.300 19 5 17.700 10.700 12 5 6.300z"/>'),
  lyrics: icon('<path d="M4 6h16v1.800H4zm0 5.100h11v1.800H4zm0 5.100h14V18H4z"/>'),
};

const SHELL = `
<aside class="mini" data-mini aria-label="Now playing">
  <div class="mini__bar" data-pl-seek aria-hidden="true"><i data-pl-progress></i></div>
  <a class="mini__now" href="/music/" aria-label="Open the player">
    <img data-pl-art alt="" width="52" height="52" />
    <span class="mini__text"><strong data-pl-title></strong><span data-pl-artist></span></span>
  </a>
  <div class="mini__ctrl">
    <button type="button" data-pl-action="prev" aria-label="Previous song">${ICONS.prev}</button>
    <button type="button" class="mini__play" data-pl-action="toggle" data-pl-toggle>${ICONS.play}${ICONS.pause}</button>
    <button type="button" data-pl-action="next" aria-label="Next song">${ICONS.next}</button>
  </div>
  <span class="mini__time" data-pl-time>0:00 / 0:30</span>
  <div class="mini__side">
    <button type="button" class="mini__chip" data-lyrics>Lyrics</button>
    <button type="button" class="mini__chip mini__chip--buy" data-buy data-pl-buy>Buy</button>
    <button type="button" class="mini__x" data-pl-action="close" aria-label="Stop and close the player">${ICONS.close}</button>
  </div>
</aside>

<section class="lyr" data-lyr role="dialog" aria-modal="true" aria-label="Lyrics" hidden>
  <div class="lyr__bg" aria-hidden="true"><img data-pl-art alt="" /></div>
  <header class="lyr__top">
    <p class="lyr__meta"><span class="tag">[ Lyrics ]</span><strong data-pl-title></strong><span data-pl-artist></span></p>
    <button type="button" class="lyr__close" data-close>Close ${ICONS.close}</button>
  </header>
  <div class="lyr__stage" data-lyr-stage data-lenis-prevent>
    <ol class="lyr__lines" data-lyr-lines></ol>
    <div class="lyr__empty" data-lyr-empty hidden>
      <p class="lyr__soon">Lyrics<br />coming soon.</p>
      <p class="lyr__soon-note">The words to “<span data-pl-title></span>” are on their way.</p>
    </div>
  </div>
  <p class="lyr__note tag" data-lyr-note hidden></p>
  <footer class="lyr__foot">
    <div class="lyr__seek" data-pl-seek><i data-pl-progress></i></div>
    <span class="lyr__time" data-pl-clock>0:00</span>
    <div class="lyr__ctrl">
      <button type="button" data-pl-action="prev" aria-label="Previous song">${ICONS.prev}</button>
      <button type="button" class="lyr__play" data-pl-action="toggle" data-pl-toggle>${ICONS.play}${ICONS.pause}</button>
      <button type="button" data-pl-action="next" aria-label="Next song">${ICONS.next}</button>
    </div>
    <span class="lyr__time lyr__time--end" data-pl-left>0:30</span>
  </footer>
</section>

<div class="modal" data-modal role="dialog" aria-modal="true" aria-labelledby="gum-title" hidden>
  <div class="modal__scrim" data-close></div>
  <div class="gum" data-modal-card>
    <button type="button" class="gum__x" data-close aria-label="Close">${ICONS.close}</button>
    <p class="gum__brand"><span>Sold through</span><b>gumroad</b></p>
    <div class="gum__body">
      <img class="gum__art" data-buy-art alt="" width="120" height="120" />
      <div>
        <h2 class="gum__title" id="gum-title">Music coming soon.</h2>
        <p class="gum__text">“<span data-buy-title></span>” will be available to buy and download here shortly. Until then, you can stream it in full.</p>
      </div>
    </div>
    <div class="gum__row">
      <a class="gum__btn" data-buy-apple target="_blank" rel="noopener">Listen on Apple Music <i class="ico ico--ne" aria-hidden="true"></i></a>
      <button type="button" class="gum__btn gum__btn--ghost" data-close>Got it</button>
    </div>
  </div>
</div>`;

const root = document.documentElement;
const FOCUSABLE = 'a[href], button:not([disabled]), input, textarea, select, [tabindex]:not([tabindex="-1"])';

export function mountShell({ lenis } = {}) {
  document.body.insertAdjacentHTML('beforeend', SHELL);

  const lyr = document.querySelector('[data-lyr]');
  const lyrLines = lyr.querySelector('[data-lyr-lines]');
  const lyrStage = lyr.querySelector('[data-lyr-stage]');
  const lyrEmpty = lyr.querySelector('[data-lyr-empty]');
  const lyrNote = lyr.querySelector('[data-lyr-note]');
  const modal = document.querySelector('[data-modal]');

  /* ───────── Slots: re-collected after every page swap ───────── */

  let slots = {};
  const all = (sel) => [...document.querySelectorAll(sel)];
  function refresh() {
    slots = {
      title: all('[data-pl-title]'),
      artist: all('[data-pl-artist]'),
      credit: all('[data-pl-credit]'),
      time: all('[data-pl-time]'),
      clock: all('[data-pl-clock]'),
      left: all('[data-pl-left]'),
      art: all('[data-pl-art]'),
      progress: all('[data-pl-progress]'),
      toggle: all('[data-pl-toggle]'),
      buy: all('[data-pl-buy]'),
      apple: all('[data-pl-apple]'),
      volume: all('[data-pl-volume]'),
      rows: all('[data-track]'),
      shuffle: all('[data-pl-action="shuffle"]'),
      repeat: all('[data-pl-action="repeat"]'),
      mute: all('[data-pl-action="mute"]'),
    };
    last = {};
    render(engine.state);
  }

  /* ───────── Render ───────── */

  let last = {};
  let lines = []; // { el, t }
  let activeLine = -1;

  function paintTrack(t) {
    slots.title.forEach((n) => (n.textContent = t.title));
    slots.artist.forEach((n) => (n.textContent = byline(t)));
    slots.credit.forEach((n) => (n.textContent = `${t.credit} · ${t.year}`));
    slots.art.forEach((n) => {
      if (n.getAttribute('src') !== t.art) n.src = t.art;
    });
    slots.buy.forEach((n) => {
      n.hidden = !t.buy?.available;
      n.dataset.buy = t.id;
    });
    slots.apple.forEach((n) => {
      n.href = t.apple;
      n.dataset.track = t.id;
    });
    buildLyrics(t);
  }

  function render(s) {
    const t = s.track;
    root.classList.toggle('has-player', s.active);
    root.classList.toggle('is-audio-playing', s.playing);
    if (!t) return;

    if (last.id !== t.id) {
      last.id = t.id;
      paintTrack(t);
    }

    if (last.playing !== s.playing || last.loading !== s.loading || last.rowId !== t.id) {
      last.playing = s.playing;
      last.loading = s.loading;
      last.rowId = t.id;
      slots.toggle.forEach((n) => {
        n.classList.toggle('is-playing', s.playing);
        n.classList.toggle('is-loading', s.loading);
        n.setAttribute('aria-label', s.playing ? `Pause ${t.title}` : `Play ${t.title}`);
      });
      slots.rows.forEach((row) => {
        const mine = row.dataset.track === t.id;
        row.classList.toggle('is-current', mine);
        row.classList.toggle('is-playing', mine && s.playing);
        if (!mine) row.style.removeProperty('--p');
        const btn = row.querySelector('[data-play]');
        if (btn) {
          const title = trackById(row.dataset.track)?.title || '';
          btn.setAttribute('aria-label', mine && s.playing ? `Pause ${title}` : `Play ${title}`);
        }
      });
    }

    if (last.shuffle !== s.shuffle || last.repeat !== s.repeat || last.muted !== s.muted || last.volume !== s.volume) {
      last.shuffle = s.shuffle;
      last.repeat = s.repeat;
      last.muted = s.muted;
      last.volume = s.volume;
      slots.shuffle.forEach((n) => n.setAttribute('aria-pressed', String(s.shuffle)));
      slots.repeat.forEach((n) => {
        n.setAttribute('aria-pressed', String(s.repeat !== 'off'));
        n.dataset.mode = s.repeat;
        n.setAttribute('aria-label', { off: 'Repeat: off', all: 'Repeat: all songs', one: 'Repeat: this song' }[s.repeat]);
      });
      slots.mute.forEach((n) => {
        n.classList.toggle('is-muted', s.muted || s.volume === 0);
        n.setAttribute('aria-label', s.muted ? 'Unmute' : 'Mute');
      });
      slots.volume.forEach((n) => {
        n.value = String(Math.round((s.muted ? 0 : s.volume) * 100));
        n.style.setProperty('--v', n.value / 100);
      });
    }

    const d = s.duration || t.previewLength || 0;
    const p = d ? Math.min(1, s.time / d) : 0;
    const ps = p.toFixed(4);
    if (last.p !== ps) {
      last.p = ps;
      slots.progress.forEach((n) => n.style.setProperty('--p', ps));
      slots.rows.forEach((row) => {
        if (row.dataset.track === t.id) row.style.setProperty('--p', ps);
      });
    }
    const sec = Math.floor(s.time);
    if (last.sec !== sec || last.d !== d) {
      last.sec = sec;
      last.d = d;
      slots.time.forEach((n) => (n.textContent = `${fmtTime(s.time)} / ${fmtTime(d)}`));
      slots.clock.forEach((n) => (n.textContent = fmtTime(s.time)));
      slots.left.forEach((n) => (n.textContent = fmtTime(d)));
    }
    if (!lyr.hidden) followLyrics(s.time, d);
  }

  /* ───────── Lyrics ───────── */

  function buildLyrics(t) {
    lyrLines.textContent = '';
    lines = [];
    activeLine = -1;
    const ly = t.lyrics;
    const has = Boolean(ly?.lines?.length);
    lyrEmpty.hidden = has;
    lyrLines.hidden = !has;
    lyrNote.hidden = !(has && (ly.note || !ly.synced));
    lyr.classList.toggle('is-synced', Boolean(has && ly.synced));
    if (!has) return;

    lyrNote.textContent = [ly.note, ly.synced ? null : 'Not yet timed to this recording.'].filter(Boolean).join(' ');
    ly.lines.forEach((line, i) => {
      const li = document.createElement('li');
      li.textContent = line.text;
      li.dataset.i = String(i);
      lyrLines.append(li);
      lines.push({ el: li, t: typeof line.t === 'number' ? line.t : null });
    });
    lyrLines.style.transform = '';
  }

  function followLyrics(time, duration) {
    if (!lines.length) return;
    let i;
    if (lines[0].t !== null) {
      i = -1;
      for (let n = 0; n < lines.length; n += 1) if (lines[n].t <= time) i = n;
      i = Math.max(0, i);
    } else {
      // Untimed words are paced evenly across the audio.
      i = Math.min(lines.length - 1, Math.floor((time / (duration || 1)) * lines.length));
    }
    if (i === activeLine) return;
    activeLine = i;
    lines.forEach((l, n) => {
      l.el.classList.toggle('is-active', n === i);
      l.el.classList.toggle('is-past', n < i);
    });
    const el = lines[i].el;
    const y = lyrStage.clientHeight * 0.42 - (el.offsetTop + el.offsetHeight / 2);
    lyrLines.style.transform = `translate3d(0, ${Math.round(y)}px, 0)`;
  }

  /* ───────── Overlays (lyrics, buy) ───────── */

  let returnFocus = null;
  let openOverlay = null;

  function show(el) {
    if (openOverlay) hide(openOverlay, true);
    returnFocus = document.activeElement;
    openOverlay = el;
    el.hidden = false;
    // Next frame, so the entrance transition runs from the hidden state.
    requestAnimationFrame(() => el.classList.add('is-open'));
    root.classList.add('overlay-open');
    lenis?.stop();
    el.querySelector(FOCUSABLE)?.focus({ preventScroll: true });
  }

  function hide(el, swapping = false) {
    if (!el || el.hidden) return;
    el.classList.remove('is-open');
    openOverlay = null;
    // Wait out the exit transition, unless it has been reopened in the meantime.
    setTimeout(() => {
      if (!el.classList.contains('is-open')) el.hidden = true;
    }, 700);
    if (!swapping) {
      root.classList.remove('overlay-open');
      lenis?.start();
      returnFocus?.focus?.({ preventScroll: true });
    }
  }

  function openLyrics() {
    if (!engine.state.track) engine.cue(tracks[0].id);
    const t = engine.state.track;
    log(EVENTS.LYRICS_OPEN, { trackId: t.id });
    show(lyr);
    activeLine = -1;
    requestAnimationFrame(() => followLyrics(engine.state.time, engine.state.duration));
  }

  function openBuy(id) {
    const t = trackById(id) || engine.state.track;
    if (!t) return;
    log(EVENTS.BUY_CLICK, { trackId: t.id });
    if (t.buy?.url) {
      window.open(t.buy.url, '_blank', 'noopener');
      return;
    }
    modal.querySelector('[data-buy-title]').textContent = t.title;
    modal.querySelector('[data-buy-art]').src = t.art;
    const apple = modal.querySelector('[data-buy-apple]');
    apple.href = t.apple;
    apple.dataset.track = t.id;
    show(modal);
  }

  /* ───────── Input ───────── */

  document.addEventListener('click', (e) => {
    const el = e.target.closest('[data-play], [data-pl-action], [data-buy], [data-lyrics], [data-close], [data-lyr-lines] li');
    if (!el) return;

    if (el.matches('[data-close]')) {
      hide(openOverlay);
    } else if (el.matches('[data-buy]')) {
      e.preventDefault();
      e.stopPropagation();
      openBuy(el.dataset.buy || el.closest('[data-track]')?.dataset.track);
    } else if (el.matches('[data-lyrics]')) {
      openLyrics();
    } else if (el.matches('[data-play]')) {
      engine.toggle(el.dataset.play || el.closest('[data-track]')?.dataset.track);
    } else if (el.matches('[data-pl-action]')) {
      const a = el.dataset.plAction;
      if (a === 'toggle') engine.toggle();
      else if (a === 'next') engine.next();
      else if (a === 'prev') engine.prev();
      else if (a === 'shuffle') engine.toggleShuffle();
      else if (a === 'repeat') engine.cycleRepeat();
      else if (a === 'mute') engine.toggleMute();
      else if (a === 'close') engine.close();
    } else if (el.matches('li') && lines[el.dataset.i]?.t !== null && lines[el.dataset.i]) {
      engine.seek(lines[el.dataset.i].t);
    }
  });

  // Scrub bars: click or drag.
  let scrubbing = null;
  const scrubTo = (bar, x) => {
    const r = bar.getBoundingClientRect();
    engine.seekRatio(Math.min(1, Math.max(0, (x - r.left) / r.width)));
  };
  document.addEventListener('pointerdown', (e) => {
    const bar = e.target.closest('[data-pl-seek]');
    if (!bar) return;
    const rowId = bar.closest('[data-track]')?.dataset.track;
    if (rowId && engine.state.track?.id !== rowId) {
      engine.play(rowId);
      return;
    }
    if (!engine.state.track) return;
    scrubbing = bar;
    scrubTo(bar, e.clientX);
  });
  window.addEventListener('pointermove', (e) => scrubbing && scrubTo(scrubbing, e.clientX));
  window.addEventListener('pointerup', () => (scrubbing = null));
  window.addEventListener('pointercancel', () => (scrubbing = null));

  document.addEventListener('input', (e) => {
    if (e.target.matches('[data-pl-volume]')) engine.setVolume(Number(e.target.value) / 100);
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && openOverlay) {
      hide(openOverlay);
      return;
    }
    if (e.key === 'Tab' && openOverlay) {
      // Keep focus inside the open dialog.
      const f = [...openOverlay.querySelectorAll(FOCUSABLE)].filter((n) => n.offsetParent !== null);
      if (!f.length) return;
      const first = f[0];
      const lastEl = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        lastEl.focus();
      } else if (!e.shiftKey && document.activeElement === lastEl) {
        e.preventDefault();
        first.focus();
      }
      return;
    }
    if (e.target.closest('input, textarea, select, button, a, [contenteditable]')) return;
    if (!engine.state.track) return;
    if (e.code === 'Space') {
      e.preventDefault();
      engine.toggle();
    } else if (e.key === 'ArrowRight' && (openOverlay === lyr || root.dataset.page === 'music')) {
      engine.seek(engine.state.time + 5);
    } else if (e.key === 'ArrowLeft' && (openOverlay === lyr || root.dataset.page === 'music')) {
      engine.seek(engine.state.time - 5);
    }
  });

  window.addEventListener('resize', () => {
    activeLine = -1;
    if (!lyr.hidden) followLyrics(engine.state.time, engine.state.duration);
  });

  refresh();
  engine.subscribe(render);

  return {
    refresh,
    closeOverlays: () => hide(openOverlay),
  };
}
