// Visitor-side tracking. `track()` is the only function the rest of the site calls.
// Events are queued and written in small batches; the store decides where they go.

import { LIMITS, EVENTS, dayKey } from './config.js';
import { localStore } from './store-local.js';
import { supabaseStore, supabaseConfigured } from './store-supabase.js';

export const store = supabaseConfigured ? supabaseStore : localStore;

const KNOWN = new Set(Object.values(EVENTS));
const uid = () =>
  crypto.randomUUID ? crypto.randomUUID() : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;

// A random id per browser (no name, email or IP), and one per tab session.
function persistentId(storage, key) {
  try {
    let v = storage.getItem(key);
    if (!v) {
      v = uid();
      storage.setItem(key, v);
    }
    return v;
  } catch {
    return uid();
  }
}

// Honour the browser's Do Not Track signal: those visitors are simply not counted.
const optedOut = navigator.doNotTrack === '1' || window.doNotTrack === '1';

let visitorId;
let sessionId;
let queue = [];
let sent = 0;
let timer;

function flush() {
  clearTimeout(timer);
  timer = null;
  if (!queue.length) return;
  const batch = queue.splice(0, LIMITS.FLUSH_BATCH);
  store.insertEvents(batch).catch(() => {
    /* best-effort: a failed batch is dropped rather than retried forever */
  });
  if (queue.length) flush();
}

/**
 * @param {string} name     one of EVENTS
 * @param {object} [detail] { trackId, value, meta }
 */
export function track(name, { trackId = null, value = null, meta = null } = {}) {
  if (optedOut || !KNOWN.has(name) || sent >= LIMITS.MAX_EVENTS_PER_SESSION) return;
  visitorId ||= persistentId(localStorage, 'astyn.vid');
  sessionId ||= persistentId(sessionStorage, 'astyn.sid');
  sent += 1;

  const now = new Date();
  queue.push({
    id: uid(),
    ts: now.toISOString(),
    day: dayKey(now),
    name,
    track_id: trackId,
    value,
    meta,
    visitor_id: visitorId,
    session_id: sessionId,
    path: location.pathname,
    device: window.matchMedia('(max-width: 900px)').matches ? 'mobile' : 'desktop',
  });

  if (queue.length >= LIMITS.FLUSH_BATCH) flush();
  else timer ||= setTimeout(flush, LIMITS.FLUSH_INTERVAL_MS);
}

export function initAnalytics() {
  // Don't lose the tail of a session when the tab is hidden or closed.
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') flush();
  });
  window.addEventListener('pagehide', flush);

  // Outbound listening links are a KPI of their own.
  document.addEventListener('click', (e) => {
    const a = e.target.closest?.('a[href]');
    if (!a) return;
    const to = a.href.includes('music.apple.com') ? 'apple' : a.href.includes('youtube.com') ? 'youtube' : null;
    if (to) track(EVENTS.OUTBOUND, { trackId: a.dataset.track || null, meta: { to } });
  });
}

export const pageView = () => track(EVENTS.PAGE_VIEW);
export { EVENTS, flush };
