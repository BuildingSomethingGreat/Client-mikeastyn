// The one audio engine for the whole site. It owns the <audio> element, the queue
// and playback state, and reports listening behaviour to analytics. UI never touches
// the audio element directly: it calls these actions and subscribes to state.

import { tracks, trackById, byline } from '../data/tracks.js';
import { track as log, EVENTS } from '../analytics/track.js';

const audio = new Audio();
audio.preload = 'none';

const listeners = new Set();

const saved = (() => {
  try {
    return JSON.parse(localStorage.getItem('astyn.player')) || {};
  } catch {
    return {};
  }
})();

export const state = {
  track: null, // current track object
  playing: false,
  loading: false,
  time: 0,
  duration: 0,
  volume: typeof saved.volume === 'number' ? saved.volume : 0.9,
  muted: false,
  shuffle: false,
  repeat: 'off', // 'off' | 'all' | 'one'
  active: false, // true once the visitor has started anything; reveals the mini player
};

audio.volume = state.volume;

const emit = () => listeners.forEach((fn) => fn(state));

export function subscribe(fn) {
  listeners.add(fn);
  fn(state);
  return () => listeners.delete(fn);
}

const persist = () => {
  try {
    localStorage.setItem('astyn.player', JSON.stringify({ volume: state.volume }));
  } catch {
    /* ignore */
  }
};

/* ───────── Listening analytics ───────── */

let heard = 0; // seconds listened since the last flush
let lastTick = 0;
let milestones = new Set();
let started = false; // has play_start been logged for this run of the track

function flushListen() {
  if (state.track && heard >= 1) {
    log(EVENTS.LISTEN, { trackId: state.track.id, value: Math.round(heard * 10) / 10 });
  }
  heard = 0;
}

function resetRun() {
  flushListen();
  milestones = new Set();
  started = false;
}

function tick() {
  const now = performance.now();
  if (state.playing && lastTick) {
    const dt = (now - lastTick) / 1000;
    if (dt > 0 && dt < 1.5) heard += dt;
  }
  lastTick = now;

  state.time = audio.currentTime || 0;
  state.duration = Number.isFinite(audio.duration) && audio.duration > 0 ? audio.duration : state.track?.previewLength || 0;

  if (state.playing && state.duration) {
    const pct = (state.time / state.duration) * 100;
    [25, 50, 75].forEach((m) => {
      if (pct >= m && !milestones.has(m)) {
        milestones.add(m);
        log(EVENTS.PLAY_PROGRESS, { trackId: state.track.id, value: m });
      }
    });
  }
  emit();
}

let raf;
const loop = () => {
  tick();
  raf = requestAnimationFrame(loop);
};

/* ───────── Actions ───────── */

function setTrack(t) {
  if (state.track?.id === t.id) return;
  resetRun();
  state.track = t;
  state.time = 0;
  state.duration = t.previewLength || t.fullLength || 0;
  audio.src = t.src;
  mediaSession(t);
}

/** Put a track on deck without playing it (used to pre-fill the player page). */
export function cue(id) {
  const t = trackById(id);
  if (!t || state.track) return;
  setTrack(t);
  emit();
}

export async function play(id) {
  const t = id ? trackById(id) : state.track || tracks[0];
  if (!t) return;
  setTrack(t);
  state.active = true;
  state.loading = true;
  emit();
  try {
    await audio.play();
  } catch {
    // The preview could not start (blocked or unavailable): hand off to the full song.
    state.loading = false;
    emit();
    if (t.apple) window.open(t.apple, '_blank', 'noopener');
  }
}

export const pause = () => audio.pause();

export function toggle(id) {
  if (id && state.track?.id !== id) return play(id);
  if (!state.track) return play(id);
  return audio.paused ? play() : pause();
}

function neighbour(step) {
  const i = tracks.findIndex((t) => t.id === state.track?.id);
  if (state.shuffle && tracks.length > 1) {
    let n = i;
    while (n === i) n = Math.floor(Math.random() * tracks.length);
    return tracks[n];
  }
  return tracks[(i + step + tracks.length) % tracks.length];
}

function skipLog() {
  if (state.playing && state.duration && state.time / state.duration < 0.9) {
    log(EVENTS.SKIP, { trackId: state.track.id, value: Math.round(state.time) });
  }
}

export function next() {
  if (!state.track) return play();
  skipLog();
  return play(neighbour(1).id);
}

export function prev() {
  if (!state.track) return play();
  // Like every player: a second in, "previous" restarts the song instead.
  if (audio.currentTime > 3) return seek(0);
  skipLog();
  return play(neighbour(-1).id);
}

export function seek(seconds) {
  if (!state.track) return;
  const d = state.duration || 0;
  audio.currentTime = Math.min(Math.max(0, seconds), d ? d - 0.05 : seconds);
  tick();
}

export const seekRatio = (r) => seek(r * (state.duration || 0));

export function setVolume(v) {
  state.volume = Math.min(1, Math.max(0, v));
  state.muted = state.volume === 0;
  audio.volume = state.volume;
  audio.muted = false;
  persist();
  emit();
}

export function toggleMute() {
  state.muted = !state.muted;
  audio.muted = state.muted;
  emit();
}

export function toggleShuffle() {
  state.shuffle = !state.shuffle;
  emit();
}

export function cycleRepeat() {
  state.repeat = { off: 'all', all: 'one', one: 'off' }[state.repeat];
  emit();
}

/** Stop and put the mini player away. */
export function close() {
  audio.pause();
  resetRun();
  state.active = false;
  emit();
}

/* ───────── Audio element events ───────── */

audio.addEventListener('playing', () => {
  state.playing = true;
  state.loading = false;
  lastTick = performance.now();
  if (!started) {
    started = true;
    log(EVENTS.PLAY_START, { trackId: state.track.id });
  }
  cancelAnimationFrame(raf);
  loop();
  if ('mediaSession' in navigator) navigator.mediaSession.playbackState = 'playing';
});

audio.addEventListener('waiting', () => {
  state.loading = true;
  emit();
});

audio.addEventListener('pause', () => {
  state.playing = false;
  state.loading = false;
  cancelAnimationFrame(raf);
  flushListen();
  tick();
  if ('mediaSession' in navigator) navigator.mediaSession.playbackState = 'paused';
});

audio.addEventListener('ended', () => {
  log(EVENTS.PLAY_COMPLETE, { trackId: state.track.id });
  resetRun();
  if (state.repeat === 'one') {
    audio.currentTime = 0;
    play();
    return;
  }
  const last = tracks.findIndex((t) => t.id === state.track.id) === tracks.length - 1;
  if (state.repeat === 'off' && last && !state.shuffle) {
    audio.currentTime = 0;
    tick();
    return;
  }
  play(neighbour(1).id);
});

audio.addEventListener('error', () => {
  state.loading = false;
  state.playing = false;
  emit();
});

window.addEventListener('pagehide', flushListen);

/* ───────── Lock-screen / hardware controls ───────── */

function mediaSession(t) {
  if (!('mediaSession' in navigator) || !window.MediaMetadata) return;
  navigator.mediaSession.metadata = new MediaMetadata({
    title: t.title,
    artist: byline(t),
    album: t.credit === 'Single' ? `${t.title} (Single)` : t.title,
    artwork: [{ src: new URL(t.art, location.origin).href, sizes: '900x900', type: 'image/webp' }],
  });
  const set = (action, fn) => {
    try {
      navigator.mediaSession.setActionHandler(action, fn);
    } catch {
      /* unsupported action */
    }
  };
  set('play', () => play());
  set('pause', pause);
  set('nexttrack', next);
  set('previoustrack', prev);
  set('seekto', (e) => seek(e.seekTime));
}
