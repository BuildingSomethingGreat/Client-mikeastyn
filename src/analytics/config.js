// Every number that bounds how much analytics data is written or read lives here.
// The store adapters clamp to these, so no caller can ask for more.

export const LIMITS = Object.freeze({
  // Reads (admin dashboard)
  DEFAULT_DAYS: 30, // window shown on first load
  MAX_DAYS: 90, // longest window the dashboard can show
  MAX_ROLLUP_ROWS: 800, // daily summary rows per load (current + previous period, all songs)
  MAX_RECENT_EVENTS: 25, // raw events per load, for the activity feed only
  CACHE_TTL_MS: 5 * 60_000, // a dashboard load is reused for five minutes
  REFRESH_COOLDOWN_MS: 30_000, // minimum gap between manual refreshes

  // Writes (visitor side)
  FLUSH_BATCH: 20, // events sent per request
  FLUSH_INTERVAL_MS: 10_000,
  MAX_EVENTS_PER_SESSION: 400, // a runaway tab cannot flood the table
  MAX_LOCAL_EVENTS: 1000, // ring buffer size while there is no database
});

// The complete event vocabulary. Anything not listed here is dropped.
export const EVENTS = Object.freeze({
  PAGE_VIEW: 'page_view',
  PLAY_START: 'play_start',
  PLAY_PROGRESS: 'play_progress', // value: 25 | 50 | 75
  PLAY_COMPLETE: 'play_complete',
  LISTEN: 'listen', // value: seconds listened in this stretch
  SKIP: 'skip',
  BUY_CLICK: 'buy_click',
  LYRICS_OPEN: 'lyrics_open',
  OUTBOUND: 'outbound_click', // meta.to: 'apple' | 'youtube'
});

export const clamp = (n, lo, hi) => Math.min(hi, Math.max(lo, n));

export const dayKey = (d = new Date()) => {
  const x = new Date(d);
  return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`;
};

export const daysAgo = (n, from = new Date()) => {
  const x = new Date(from);
  x.setDate(x.getDate() - n);
  return x;
};
