// Gallery: a pinned, sideways-travelling strip on desktop, a native swipe strip on
// touch screens, and a full-screen viewer for either. Returns a disposer.

import { gsap, reduced } from '../shared/core.js';
import { ICONS } from '../player/shell.js';

const pad = (n) => String(n).padStart(2, '0');

export function initGallery(main, { lenis } = {}) {
  const section = main.querySelector('[data-gallery]');
  if (!section) return () => {};
  const track = section.querySelector('[data-gallery-track]');
  const bar = section.querySelector('[data-gallery-progress]');
  const shots = [...track.querySelectorAll('[data-shot]')];
  const setBar = (p) => bar && (bar.style.transform = `scaleX(${Math.min(1, Math.max(0, p)).toFixed(4)})`);

  /* Desktop: vertical scroll drives the strip sideways while the section stays pinned. */
  const mm = gsap.matchMedia();
  mm.add('(min-width: 901px) and (prefers-reduced-motion: no-preference)', () => {
    const distance = () => Math.max(0, track.scrollWidth - section.clientWidth);
    const travel = gsap.to(track, {
      x: () => -distance(),
      ease: 'none',
      scrollTrigger: {
        trigger: section,
        start: 'top top',
        end: () => `+=${distance()}`,
        pin: true,
        scrub: 0.8,
        anticipatePin: 1,
        invalidateOnRefresh: true,
        onUpdate: (self) => setBar(self.progress),
      },
    });
    // Each picture drifts a little inside its frame as it crosses the screen.
    shots.forEach((shot) => {
      gsap.fromTo(
        shot.querySelector('img'),
        { xPercent: -5 },
        {
          xPercent: 5,
          ease: 'none',
          scrollTrigger: { trigger: shot, containerAnimation: travel, start: 'left right', end: 'right left', scrub: true },
        },
      );
    });
  });

  /* Touch / small screens: the strip scrolls natively; just mirror progress. */
  const onScroll = () => {
    const max = track.scrollWidth - track.clientWidth;
    if (max > 4) setBar(track.scrollLeft / max);
  };
  track.addEventListener('scroll', onScroll, { passive: true });

  /* Full-screen viewer */
  const items = shots.map((s) => {
    const img = s.querySelector('img');
    return { src: s.dataset.full, alt: img.alt, w: img.naturalWidth, el: s };
  });

  const lb = document.createElement('div');
  lb.className = 'lb';
  lb.hidden = true;
  lb.setAttribute('role', 'dialog');
  lb.setAttribute('aria-modal', 'true');
  lb.setAttribute('aria-label', 'Photo viewer');
  lb.innerHTML = `
    <button type="button" class="lb__close" data-lb="close">Close ${ICONS.close}</button>
    <figure class="lb__fig"><img class="lb__img" alt="" /></figure>
    <button type="button" class="lb__nav lb__nav--prev" data-lb="prev" aria-label="Previous photo">←</button>
    <button type="button" class="lb__nav lb__nav--next" data-lb="next" aria-label="Next photo">→</button>
    <p class="lb__count" aria-live="polite"><span data-lb-n>01</span> / ${pad(items.length)}</p>`;
  document.body.append(lb);
  const lbImg = lb.querySelector('.lb__img');
  const lbN = lb.querySelector('[data-lb-n]');
  let index = 0;
  let opener = null;

  function showAt(i, dir = 0) {
    index = (i + items.length) % items.length;
    const it = items[index];
    lbN.textContent = pad(index + 1);
    const swap = () => {
      lbImg.src = it.src;
      lbImg.alt = it.alt;
    };
    if (reduced || !dir) {
      swap();
      return;
    }
    gsap
      .timeline()
      .to(lbImg, { autoAlpha: 0, x: -24 * dir, duration: 0.22, ease: 'power2.in' })
      .add(swap)
      .fromTo(lbImg, { autoAlpha: 0, x: 24 * dir }, { autoAlpha: 1, x: 0, duration: 0.55, ease: 'lux' });
  }

  function open(i, from) {
    opener = from;
    lb.hidden = false;
    showAt(i);
    lenis?.stop();
    document.documentElement.classList.add('overlay-open');
    requestAnimationFrame(() => lb.classList.add('is-open'));
    lb.querySelector('.lb__close').focus({ preventScroll: true });
  }

  function close() {
    if (lb.hidden) return;
    lb.classList.remove('is-open');
    document.documentElement.classList.remove('overlay-open');
    lenis?.start();
    setTimeout(() => (lb.hidden = true), 450);
    opener?.focus?.({ preventScroll: true });
  }

  shots.forEach((s, i) => s.addEventListener('click', () => open(i, s)));

  lb.addEventListener('click', (e) => {
    const act = e.target.closest('[data-lb]')?.dataset.lb;
    if (act === 'prev') showAt(index - 1, -1);
    else if (act === 'next') showAt(index + 1, 1);
    else if (act === 'close' || e.target === lb || e.target.classList.contains('lb__fig')) close();
  });

  const onKey = (e) => {
    if (lb.hidden) return;
    if (e.key === 'Escape') close();
    else if (e.key === 'ArrowRight') showAt(index + 1, 1);
    else if (e.key === 'ArrowLeft') showAt(index - 1, -1);
    else if (e.key === 'Tab') {
      const f = [...lb.querySelectorAll('button')];
      const at = f.indexOf(document.activeElement);
      e.preventDefault();
      f[(at + (e.shiftKey ? -1 : 1) + f.length) % f.length].focus();
    }
  };
  document.addEventListener('keydown', onKey);

  // Swipe between photos on touch screens.
  let startX = null;
  lb.addEventListener('touchstart', (e) => (startX = e.touches[0].clientX), { passive: true });
  lb.addEventListener(
    'touchend',
    (e) => {
      if (startX === null) return;
      const dx = e.changedTouches[0].clientX - startX;
      startX = null;
      if (Math.abs(dx) > 48) showAt(index + (dx < 0 ? 1 : -1), dx < 0 ? 1 : -1);
    },
    { passive: true },
  );

  return () => {
    close();
    document.removeEventListener('keydown', onKey);
    lb.remove();
  };
}
