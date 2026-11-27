// Supabase / Postgres adapter. It is inactive until VITE_SUPABASE_URL and
// VITE_SUPABASE_ANON_KEY are set, and it has not been run against a live
// project yet; treat it as the wiring diagram for supabase/schema.sql.
//
// Visitors may only INSERT into `events` (row-level security). The dashboard
// reads the two daily summary views, never the raw table, and every read
// names its columns and carries a hard `limit`.

import { LIMITS, clamp } from './config.js';

const URL = import.meta.env.VITE_SUPABASE_URL;
const KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabaseConfigured = Boolean(URL && KEY);

// Set by the admin sign-in once auth exists; reads need a signed-in user.
let accessToken = null;
export const setAccessToken = (token) => {
  accessToken = token;
};

const headers = (extra = {}) => ({
  apikey: KEY,
  Authorization: `Bearer ${accessToken || KEY}`,
  'Content-Type': 'application/json',
  ...extra,
});

async function get(table, query) {
  const res = await fetch(`${URL}/rest/v1/${table}?${query}`, { headers: headers() });
  if (!res.ok) throw new Error(`${table}: ${res.status}`);
  return res.json();
}

export const supabaseStore = {
  id: 'supabase',
  label: 'All visitors',

  async insertEvents(rows) {
    if (!rows.length) return;
    await fetch(`${URL}/rest/v1/events`, {
      method: 'POST',
      headers: headers({ Prefer: 'return=minimal' }),
      body: JSON.stringify(rows),
      keepalive: true, // lets the last batch go out while the tab is closing
    });
  },

  getTrackDaily({ from, to, limit = LIMITS.MAX_ROLLUP_ROWS }) {
    const n = clamp(limit, 1, LIMITS.MAX_ROLLUP_ROWS);
    return get(
      'daily_track_stats',
      `select=day,track_id,plays,listeners,completes,listen_seconds,skips,buy_clicks,lyrics_opens` +
        `&day=gte.${from}&day=lte.${to}&order=day.asc&limit=${n}`,
    );
  },

  getSiteDaily({ from, to, limit = LIMITS.MAX_DAYS * 2 }) {
    const n = clamp(limit, 1, LIMITS.MAX_DAYS * 2);
    return get(
      'daily_site_stats',
      `select=day,visitors,sessions,page_views&day=gte.${from}&day=lte.${to}&order=day.asc&limit=${n}`,
    );
  },

  getRecentEvents({ limit = LIMITS.MAX_RECENT_EVENTS } = {}) {
    const n = clamp(limit, 1, LIMITS.MAX_RECENT_EVENTS);
    return get('events', `select=ts,name,track_id,value,device&order=ts.desc&limit=${n}`);
  },
};
