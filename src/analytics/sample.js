// Made-up numbers for previewing the admin page before real traffic exists.
// Deterministic (seeded) so the preview doesn't jump around between loads.
// Shown only when the "Sample data" switch is on, and labelled as such.

import { dayKey, daysAgo } from './config.js';

function rng(seed) {
  let s = seed;
  return () => {
    s = (s * 16807) % 2147483647;
    return s / 2147483647;
  };
}

// Relative pull of each song, by catalogue position.
const WEIGHT = [1, 0.34, 0.22, 0.46];

export function sampleData({ days, tracks, today = new Date() }) {
  const rand = rng(20270101);
  const trackDaily = [];
  const siteDaily = [];

  for (let i = days - 1; i >= 0; i -= 1) {
    const d = daysAgo(i, today);
    const day = dayKey(d);
    const weekend = d.getDay() === 0 || d.getDay() === 6 ? 1.35 : 1;
    const growth = 0.55 + 0.45 * (1 - i / days); // a gentle climb toward today
    const base = 38 * weekend * growth * (0.75 + rand() * 0.5);

    let visitors = 0;
    tracks.forEach((t, n) => {
      const plays = Math.round(base * (WEIGHT[n] ?? 0.2) * (0.8 + rand() * 0.4));
      const listeners = Math.round(plays * (0.68 + rand() * 0.12));
      const completes = Math.round(plays * (0.48 + rand() * 0.2));
      visitors += listeners;
      trackDaily.push({
        day,
        track_id: t.id,
        plays,
        listeners,
        completes,
        listen_seconds: Math.round(plays * (17 + rand() * 7)),
        skips: Math.round(plays * (0.12 + rand() * 0.08)),
        buy_clicks: t.buy?.available ? Math.round(listeners * (0.05 + rand() * 0.05)) : 0,
        lyrics_opens: Math.round(plays * (0.1 + rand() * 0.08)),
      });
    });
    siteDaily.push({
      day,
      visitors: Math.round(visitors * 1.6),
      sessions: Math.round(visitors * 1.9),
      page_views: Math.round(visitors * 3.4),
    });
  }

  const names = ['play_start', 'play_complete', 'buy_click', 'lyrics_open', 'play_start', 'skip', 'play_start'];
  const recent = Array.from({ length: 12 }, (_, i) => ({
    ts: new Date(today.getTime() - (i * 9 + Math.round(rand() * 6)) * 60_000).toISOString(),
    name: names[i % names.length],
    track_id: tracks[Math.floor(rand() * rand() * tracks.length)].id,
    device: rand() > 0.38 ? 'mobile' : 'desktop',
  })).filter((e) => e.name !== 'buy_click' || tracks.find((t) => t.id === e.track_id)?.buy?.available);

  return { trackDaily, siteDaily, recent };
}
