// Stand-in store used until a database is connected: everything stays in this
// browser's localStorage. It keeps the same shape as the Postgres tables in
// supabase/schema.sql, so swapping the adapter changes nothing upstream.
//
//   events             raw rows, ring-buffered
//   daily_track_stats  one row per day per song
//   daily_site_stats   one row per day

import { LIMITS, EVENTS, clamp } from './config.js';

const K = { events: 'astyn.an.events', track: 'astyn.an.trackDaily', site: 'astyn.an.siteDaily' };

const read = (key, fallback) => {
  try {
    return JSON.parse(localStorage.getItem(key)) ?? fallback;
  } catch {
    return fallback;
  }
};

const write = (key, value) => {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* storage full or blocked: analytics is best-effort */
  }
};

const blankTrack = (day, track_id) => ({
  day,
  track_id,
  plays: 0,
  listeners: 0,
  completes: 0,
  listen_seconds: 0,
  skips: 0,
  buy_clicks: 0,
  lyrics_opens: 0,
  _v: [], // visitor ids seen that day (local only; Postgres counts distinct)
});

const blankSite = (day) => ({ day, visitors: 0, sessions: 0, page_views: 0, _v: [], _s: [] });

function rollUp(e, track, site) {
  const s = (site[e.day] ||= blankSite(e.day));
  if (!s._v.includes(e.visitor_id)) {
    s._v.push(e.visitor_id);
    s.visitors = s._v.length;
  }
  if (!s._s.includes(e.session_id)) {
    s._s.push(e.session_id);
    s.sessions = s._s.length;
  }
  if (e.name === EVENTS.PAGE_VIEW) s.page_views += 1;

  if (!e.track_id) return;
  const key = `${e.day}|${e.track_id}`;
  const t = (track[key] ||= blankTrack(e.day, e.track_id));
  switch (e.name) {
    case EVENTS.PLAY_START:
      t.plays += 1;
      if (!t._v.includes(e.visitor_id)) {
        t._v.push(e.visitor_id);
        t.listeners = t._v.length;
      }
      break;
    case EVENTS.PLAY_COMPLETE:
      t.completes += 1;
      break;
    case EVENTS.LISTEN:
      t.listen_seconds = Math.round((t.listen_seconds + (e.value || 0)) * 10) / 10;
      break;
    case EVENTS.SKIP:
      t.skips += 1;
      break;
    case EVENTS.BUY_CLICK:
      t.buy_clicks += 1;
      break;
    case EVENTS.LYRICS_OPEN:
      t.lyrics_opens += 1;
      break;
    default:
  }
}

const strip = ({ _v, _s, ...row }) => row;

export const localStore = {
  id: 'local',
  label: 'This device only',

  async insertEvents(rows) {
    if (!rows.length) return;
    const events = read(K.events, []);
    const track = read(K.track, {});
    const site = read(K.site, {});
    rows.forEach((e) => {
      events.push(e);
      rollUp(e, track, site);
    });
    write(K.events, events.slice(-LIMITS.MAX_LOCAL_EVENTS));
    write(K.track, track);
    write(K.site, site);
  },

  async getTrackDaily({ from, to, limit = LIMITS.MAX_ROLLUP_ROWS }) {
    const n = clamp(limit, 1, LIMITS.MAX_ROLLUP_ROWS);
    return Object.values(read(K.track, {}))
      .filter((r) => r.day >= from && r.day <= to)
      .sort((a, b) => (a.day < b.day ? -1 : 1))
      .slice(-n)
      .map(strip);
  },

  async getSiteDaily({ from, to, limit = LIMITS.MAX_DAYS * 2 }) {
    const n = clamp(limit, 1, LIMITS.MAX_DAYS * 2);
    return Object.values(read(K.site, {}))
      .filter((r) => r.day >= from && r.day <= to)
      .sort((a, b) => (a.day < b.day ? -1 : 1))
      .slice(-n)
      .map(strip);
  },

  async getRecentEvents({ limit = LIMITS.MAX_RECENT_EVENTS } = {}) {
    const n = clamp(limit, 1, LIMITS.MAX_RECENT_EVENTS);
    return read(K.events, []).slice(-n).reverse();
  },

  async clear() {
    Object.values(K).forEach((k) => {
      try {
        localStorage.removeItem(k);
      } catch {
        /* ignore */
      }
    });
  },
};
