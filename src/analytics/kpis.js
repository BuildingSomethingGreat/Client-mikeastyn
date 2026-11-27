// Turns daily summary rows into the numbers the admin page shows.
// Pure functions: no storage, no DOM.

import { dayKey, daysAgo } from './config.js';

const sum = (rows, key) => rows.reduce((n, r) => n + (Number(r[key]) || 0), 0);

function totals(trackRows, siteRows) {
  const plays = sum(trackRows, 'plays');
  const completes = sum(trackRows, 'completes');
  const listenSeconds = sum(trackRows, 'listen_seconds');
  const buyClicks = sum(trackRows, 'buy_clicks');
  // Listeners are counted per song per day and summed, so one person who comes back
  // tomorrow, or plays two songs, counts twice. The admin page words it that way.
  const listeners = sum(trackRows, 'listeners');
  return {
    plays,
    listeners,
    completes,
    listenSeconds,
    buyClicks,
    lyricsOpens: sum(trackRows, 'lyrics_opens'),
    skips: sum(trackRows, 'skips'),
    visitors: sum(siteRows, 'visitors'),
    pageViews: sum(siteRows, 'page_views'),
    avgListen: plays ? listenSeconds / plays : 0,
    finishRate: plays ? completes / plays : 0,
    buyRate: listeners ? buyClicks / listeners : 0,
  };
}

const change = (now, before) => (before ? (now - before) / before : null);

/**
 * @param {object} input
 * @param {Array}  input.trackDaily  rows of daily_track_stats covering 2 × days
 * @param {Array}  input.siteDaily   rows of daily_site_stats covering 2 × days
 * @param {number} input.days        window length
 * @param {Array}  input.tracks      catalogue (for names and artwork)
 */
export function buildDashboard({ trackDaily, siteDaily, days, tracks, today = new Date() }) {
  const start = dayKey(daysAgo(days - 1, today));
  const inWindow = (r) => r.day >= start;

  const cur = totals(trackDaily.filter(inWindow), siteDaily.filter(inWindow));
  const prev = totals(
    trackDaily.filter((r) => !inWindow(r)),
    siteDaily.filter((r) => !inWindow(r)),
  );

  const deltas = Object.fromEntries(
    ['plays', 'listeners', 'avgListen', 'finishRate', 'buyClicks', 'buyRate', 'lyricsOpens'].map((k) => [
      k,
      change(cur[k], prev[k]),
    ]),
  );

  // One point per calendar day, zero-filled so quiet days still show.
  const byDay = new Map();
  trackDaily.filter(inWindow).forEach((r) => byDay.set(r.day, (byDay.get(r.day) || 0) + (Number(r.plays) || 0)));
  const series = Array.from({ length: days }, (_, i) => {
    const d = daysAgo(days - 1 - i, today);
    const key = dayKey(d);
    return { day: key, date: d, plays: byDay.get(key) || 0 };
  });

  const songs = tracks
    .map((t) => {
      const rows = trackDaily.filter((r) => inWindow(r) && r.track_id === t.id);
      const s = totals(rows, []);
      return { id: t.id, title: t.title, art: t.art, credit: t.credit, canBuy: t.buy?.available, ...s };
    })
    .sort((a, b) => b.plays - a.plays);

  return { days, totals: cur, previous: prev, deltas, series, songs, insights: insights(cur, songs, days) };
}

function insights(t, songs, days) {
  if (!t.plays) return [];
  const out = [];
  const top = songs[0];
  if (top?.plays) {
    const share = Math.round((top.plays / t.plays) * 100);
    out.push(`“${top.title}” is your most-played song: ${top.plays.toLocaleString()} plays, ${share}% of all listening.`);
  }
  out.push(
    `${Math.round(t.finishRate * 100)}% of plays ran to the end of the preview, and people listened for ${Math.round(
      t.avgListen,
    )} seconds on average.`,
  );
  const wanted = songs.filter((s) => s.canBuy && s.buyClicks).sort((a, b) => b.buyClicks - a.buyClicks)[0];
  if (wanted) {
    out.push(
      `“${wanted.title}” drew ${wanted.buyClicks.toLocaleString()} Buy clicks in the last ${days} days. That is the clearest signal of what to sell first.`,
    );
  } else if (t.buyClicks === 0) {
    out.push('Nobody has tapped Buy yet. Once the store link is live this is the number to watch.');
  }
  return out;
}
