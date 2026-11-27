// Admin dashboard. Reads daily summaries (never raw events, apart from a short
// activity feed), within the limits in analytics/config.js, and caches each load.

import '@fontsource-variable/archivo/wdth.css';
import '@fontsource-variable/geist';
import '@fontsource-variable/geist-mono';
import '../shared/base.css';
import './admin.css';

import { LIMITS, clamp, dayKey, daysAgo } from '../analytics/config.js';
import { store } from '../analytics/track.js';
import { buildDashboard } from '../analytics/kpis.js';
import { sampleData } from '../analytics/sample.js';
import { tracks, trackById } from '../data/tracks.js';

const $ = (s) => document.querySelector(s);
const root = document.documentElement;
const el = (tag, cls, text) => {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (text !== undefined) n.textContent = text;
  return n;
};

/* ───────── Colour mode (same switch as the site) ───────── */

function syncMode() {
  const light = root.dataset.mode === 'light';
  document.querySelectorAll('[data-mode-label]').forEach((n) => (n.textContent = light ? 'Dark' : 'Light'));
}
$('[data-mode-toggle]').addEventListener('click', () => {
  root.dataset.mode = root.dataset.mode === 'light' ? 'dark' : 'light';
  try {
    localStorage.setItem('astyn-mode', root.dataset.mode);
  } catch {
    /* not persisted */
  }
  syncMode();
});
syncMode();

/* ───────── Formatting ───────── */

const num = (n) =>
  n >= 10_000 ? `${(n / 1000).toFixed(n >= 100_000 ? 0 : 1).replace(/\.0$/, '')}K` : Math.round(n).toLocaleString();
const pct = (r) => `${Math.round(r * 100)}%`;
const secs = (s) => (s >= 60 ? `${Math.floor(s / 60)}m ${Math.round(s % 60)}s` : `${Math.round(s)}s`);
const shortDate = (d) => d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
const ago = (iso) => {
  const m = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  if (m < 1) return 'Just now';
  if (m < 60) return `${m} min ago`;
  if (m < 1440) return `${Math.round(m / 60)} hr ago`;
  return `${Math.round(m / 1440)} d ago`;
};

/* ───────── Loading, with hard limits and a cache ───────── */

const state = { days: LIMITS.DEFAULT_DAYS, sample: false, lastRefresh: 0 };

async function load({ force = false } = {}) {
  const days = clamp(state.days, 1, LIMITS.MAX_DAYS);
  const key = `astyn.admin.${store.id}.${days}.${state.sample ? 'sample' : 'live'}`;

  if (!force) {
    try {
      const hit = JSON.parse(sessionStorage.getItem(key));
      if (hit && Date.now() - hit.at < LIMITS.CACHE_TTL_MS) return { ...hit, cached: true };
    } catch {
      /* no cache */
    }
  }

  // Twice the window, so each number can be compared with the period before it.
  const span = days * 2;
  let rows;
  if (state.sample) {
    rows = sampleData({ days: span, tracks });
  } else {
    const from = dayKey(daysAgo(span - 1));
    const to = dayKey();
    const [trackDaily, siteDaily, recent] = await Promise.all([
      store.getTrackDaily({ from, to, limit: LIMITS.MAX_ROLLUP_ROWS }),
      store.getSiteDaily({ from, to, limit: LIMITS.MAX_DAYS * 2 }),
      store.getRecentEvents({ limit: LIMITS.MAX_RECENT_EVENTS }),
    ]);
    rows = { trackDaily, siteDaily, recent };
  }

  const out = {
    at: Date.now(),
    days,
    rows,
    reads: { summaries: rows.trackDaily.length + rows.siteDaily.length, events: rows.recent.length },
  };
  try {
    sessionStorage.setItem(key, JSON.stringify(out));
  } catch {
    /* cache is optional */
  }
  return out;
}

/* ───────── Rendering ───────── */

const dash = $('[data-dash]');

const TILES = [
  { key: 'plays', label: 'Plays', help: 'Times someone pressed play', fmt: num, hero: true },
  { key: 'listeners', label: 'Listeners', help: 'People who played a song, counted per song per day', fmt: num },
  { key: 'avgListen', label: 'Average listen', help: 'How long a play lasts', fmt: secs },
  { key: 'finishRate', label: 'Finished the preview', help: 'Plays that ran to the end', fmt: pct },
  { key: 'buyClicks', label: 'Buy clicks', help: 'Taps on a Buy now button', fmt: num },
  { key: 'lyricsOpens', label: 'Lyrics opened', help: 'Times the lyrics view was opened', fmt: num },
];

function renderTiles(model) {
  const wrap = $('[data-tiles]');
  wrap.textContent = '';
  TILES.forEach((t) => {
    const tile = el('div', `tile${t.hero ? ' tile--hero' : ''}`);
    tile.append(el('p', 'tile__label', t.label));
    tile.append(el('p', 'tile__value', t.fmt(model.totals[t.key])));

    const d = model.deltas[t.key];
    const delta = el('p', 'tile__delta');
    if (d === null || !Number.isFinite(d)) {
      delta.textContent = 'No earlier period to compare';
      delta.classList.add('is-flat');
    } else {
      const up = d >= 0;
      delta.classList.add(Math.abs(d) < 0.005 ? 'is-flat' : up ? 'is-up' : 'is-down');
      const arrow = el('span', 'tile__arrow', Math.abs(d) < 0.005 ? '→' : up ? '↑' : '↓');
      arrow.setAttribute('aria-hidden', 'true');
      delta.append(arrow, `${up ? '+' : '−'}${Math.abs(Math.round(d * 100))}% vs previous ${model.days} days`);
    }
    tile.append(delta, el('p', 'tile__help', t.help));
    wrap.append(tile);
  });
}

/* Column chart: one bar per day, one neutral series, values in a tooltip and a table. */
const tip = $('[data-tip]');
let lastModel = null;

function niceMax(v) {
  if (v <= 4) return 4;
  const pow = 10 ** Math.floor(Math.log10(v));
  const n = v / pow;
  const step = n <= 1 ? 1 : n <= 2 ? 2 : n <= 4 ? 4 : n <= 5 ? 5 : n <= 8 ? 8 : 10;
  return step * pow;
}

function renderChart(model) {
  const box = $('[data-chart]');
  box.classList.remove('is-skeleton');
  box.textContent = '';
  const series = model.series;
  const total = series.reduce((n, d) => n + d.plays, 0);
  $('[data-chart-sub]').textContent = total ? `${num(total)} plays in ${model.days} days` : '';

  if (!total) {
    box.append(el('p', 'empty', 'No plays in this period yet. They will appear here as soon as someone listens.'));
    $('[data-chart-table]').textContent = '';
    return;
  }

  const W = Math.max(320, box.clientWidth);
  const H = 260;
  const m = { l: 40, r: 8, t: 14, b: 28 };
  const iw = W - m.l - m.r;
  const ih = H - m.t - m.b;
  const max = niceMax(Math.max(...series.map((d) => d.plays)));
  const band = iw / series.length;
  const bw = Math.max(2, Math.min(24, band - 2));
  const y = (v) => m.t + ih - (v / max) * ih;
  const NS = 'http://www.w3.org/2000/svg';
  const s = (tag, attrs) => {
    const n = document.createElementNS(NS, tag);
    Object.entries(attrs).forEach(([k, v]) => n.setAttribute(k, v));
    return n;
  };

  const svg = s('svg', { viewBox: `0 0 ${W} ${H}`, width: W, height: H, role: 'img', 'aria-label': `Plays per day over the last ${model.days} days` });

  // Recessive grid with clean ticks.
  for (let i = 0; i <= 4; i += 1) {
    const v = (max / 4) * i;
    svg.append(s('line', { x1: m.l, x2: W - m.r, y1: y(v), y2: y(v), class: 'grid' }));
    const label = s('text', { x: m.l - 8, y: y(v) + 4, class: 'tick', 'text-anchor': 'end' });
    label.textContent = num(v);
    svg.append(label);
  }

  // As many date labels as fit without touching: one per ~56px, on a tidy step.
  const every = [1, 2, 5, 7, 10, 15, 30, 45].find((n) => n * band >= 56) || 45;
  series.forEach((d, i) => {
    const cx = m.l + band * i + band / 2;
    const h = (d.plays / max) * ih;
    const r = Math.min(4, bw / 2, h);
    const x0 = cx - bw / 2;
    const top = y(d.plays);
    const base = m.t + ih;
    // Rounded at the data end, square on the baseline.
    const bar = s('path', {
      class: 'bar',
      d: h > 0 ? `M${x0},${base}V${top + r}Q${x0},${top} ${x0 + r},${top}H${x0 + bw - r}Q${x0 + bw},${top} ${x0 + bw},${top + r}V${base}Z` : '',
    });
    svg.append(bar);

    if (i % every === 0) {
      const t = s('text', { x: cx, y: H - 8, class: 'tick', 'text-anchor': 'middle' });
      t.textContent = shortDate(d.date);
      svg.append(t);
    }

    // The whole band is the hover and focus target, not just the painted bar.
    const hit = s('rect', { x: m.l + band * i, y: m.t, width: band, height: ih, class: 'hit', tabindex: 0 });
    hit.setAttribute('aria-label', `${shortDate(d.date)}: ${d.plays} plays`);
    const show = () => {
      bar.classList.add('is-on');
      tip.textContent = '';
      tip.append(el('strong', '', `${d.plays.toLocaleString()} plays`), el('span', '', shortDate(d.date)));
      tip.hidden = false;
      const br = box.getBoundingClientRect();
      const tx = Math.min(br.right - 150, Math.max(br.left + 4, br.left + cx - 60));
      tip.style.left = `${tx + window.scrollX}px`;
      tip.style.top = `${br.top + window.scrollY + Math.max(0, top - 58)}px`;
    };
    const hide = () => {
      bar.classList.remove('is-on');
      tip.hidden = true;
    };
    hit.addEventListener('pointerenter', show);
    hit.addEventListener('pointerleave', hide);
    hit.addEventListener('focus', show);
    hit.addEventListener('blur', hide);
    svg.append(hit);
  });

  box.append(svg);

  // Same numbers without hovering.
  const table = el('table');
  const head = el('tr');
  head.append(el('th', '', 'Day'), el('th', 'n', 'Plays'));
  table.append(head);
  [...series].reverse().forEach((d) => {
    const tr = el('tr');
    tr.append(el('td', '', d.date.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })), el('td', 'n', d.plays.toLocaleString()));
    table.append(tr);
  });
  const holder = $('[data-chart-table]');
  holder.textContent = '';
  holder.append(table);
}

function renderSongs(model) {
  const wrap = $('[data-songs]');
  wrap.classList.remove('is-skeleton');
  wrap.textContent = '';
  const top = Math.max(1, ...model.songs.map((s) => s.plays));

  const table = el('table', 'songs__table');
  const head = el('tr');
  ['Song', 'Plays', 'Listeners', 'Finished', 'Avg. listen', 'Buy clicks'].forEach((h, i) => head.append(el('th', i ? 'n' : '', h)));
  table.append(head);

  model.songs.forEach((sg) => {
    const tr = el('tr');
    const name = el('td', 'songs__name');
    const img = el('img');
    img.src = sg.art;
    img.alt = '';
    img.width = 40;
    img.height = 40;
    img.loading = 'lazy';
    const text = el('div');
    text.append(el('strong', '', sg.title), el('span', '', sg.credit));
    name.append(img, text);

    const plays = el('td', 'n songs__plays');
    plays.append(el('span', '', num(sg.plays)));
    const meter = el('i', 'songs__meter');
    meter.style.setProperty('--w', `${(sg.plays / top) * 100}%`);
    plays.append(meter);

    tr.append(
      name,
      plays,
      el('td', 'n', num(sg.listeners)),
      el('td', 'n', sg.plays ? pct(sg.finishRate) : '–'),
      el('td', 'n', sg.plays ? secs(sg.avgListen) : '–'),
      el('td', 'n', sg.canBuy ? num(sg.buyClicks) : 'Not for sale'),
    );
    table.append(tr);
  });
  wrap.append(table);
}

function renderInsights(model) {
  const list = $('[data-insights]');
  list.classList.remove('is-skeleton');
  list.textContent = '';
  const items = model.insights.length ? model.insights : ['Nothing to read into yet. Once people start listening, the story of each song shows up here.'];
  items.forEach((t) => list.append(el('li', '', t)));
}

const PHRASE = {
  page_view: 'Visited a page',
  play_start: 'Started playing',
  play_progress: 'Kept listening to',
  play_complete: 'Finished',
  listen: 'Listened to',
  skip: 'Skipped',
  buy_click: 'Tapped Buy on',
  lyrics_open: 'Opened lyrics for',
  outbound_click: 'Left for a streaming app from',
};

function renderFeed(rows) {
  const list = $('[data-feed]');
  list.classList.remove('is-skeleton');
  list.textContent = '';
  const shown = rows.filter((e) => e.name !== 'listen' && e.name !== 'play_progress').slice(0, 12);
  $('[data-recent-sub]').textContent = shown.length ? `Last ${shown.length} things people did` : '';
  if (!shown.length) {
    list.append(el('li', 'empty', 'No activity yet.'));
    return;
  }
  shown.forEach((e) => {
    const li = el('li');
    const song = e.track_id ? trackById(e.track_id)?.title : null;
    const what = el('span', 'feed__what');
    what.append(PHRASE[e.name] || e.name);
    if (song) what.append(' ', el('strong', '', song));
    li.append(el('span', `feed__dot feed__dot--${e.name === 'buy_click' ? 'buy' : 'std'}`), what, el('span', 'feed__meta', `${e.device === 'mobile' ? 'Phone' : 'Computer'} · ${ago(e.ts)}`));
    list.append(li);
  });
}

function render(result) {
  const model = buildDashboard({ ...result.rows, days: result.days, tracks });
  lastModel = model;

  const local = store.id === 'local';
  $('[data-sub]').textContent = `Last ${model.days} days · ${state.sample ? 'Sample data' : store.label}`;
  const notice = $('[data-notice]');
  if (state.sample) {
    notice.hidden = false;
    notice.textContent = 'Sample data. These numbers are made up, to show how this page reads once people are listening. Switch it off to see real activity.';
  } else if (local) {
    notice.hidden = false;
    notice.textContent = 'Preview mode. The database is not connected yet, so this page only counts listening on this device. Switch on Sample data to see how it will look with real traffic.';
  } else {
    notice.hidden = true;
  }
  $('[data-clear]').hidden = !local || state.sample;

  renderTiles(model);
  renderChart(model);
  renderInsights(model);
  renderSongs(model);
  renderFeed(result.rows.recent);

  $('[data-budget]').textContent =
    `This view used ${result.reads.summaries} of ${LIMITS.MAX_ROLLUP_ROWS + LIMITS.MAX_DAYS * 2} allowed summary rows and ` +
    `${result.reads.events} of ${LIMITS.MAX_RECENT_EVENTS} recent events` +
    `${result.cached ? ', reused from the last few minutes' : ''}. Results are kept for ${LIMITS.CACHE_TTL_MS / 60000} minutes.`;
  $('[data-status]').textContent = `Updated ${ago(new Date(result.at).toISOString()).toLowerCase()}`;
}

async function refresh(opts) {
  dash.setAttribute('aria-busy', 'true');
  dash.classList.add('is-refetching'); // keep the frame, dim it; no layout jump
  try {
    // A short floor keeps the skeleton from flashing on fast loads.
    const [result] = await Promise.all([load(opts), new Promise((r) => setTimeout(r, lastModel ? 180 : 550))]);
    render(result);
  } catch {
    $('[data-status]').textContent = 'Could not load. Try Refresh in a moment.';
  } finally {
    dash.setAttribute('aria-busy', 'false');
    dash.classList.remove('is-refetching');
  }
}

/* ───────── Controls ───────── */

document.querySelectorAll('[data-range]').forEach((b) =>
  b.addEventListener('click', () => {
    state.days = clamp(Number(b.dataset.range), 1, LIMITS.MAX_DAYS);
    document.querySelectorAll('[data-range]').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
    refresh();
  }),
);

$('[data-sample]').addEventListener('change', (e) => {
  state.sample = e.target.checked;
  refresh();
});

const refreshBtn = $('[data-refresh]');
refreshBtn.addEventListener('click', () => {
  const wait = LIMITS.REFRESH_COOLDOWN_MS - (Date.now() - state.lastRefresh);
  if (wait > 0) {
    $('[data-status]').textContent = `Already fresh. You can refresh again in ${Math.ceil(wait / 1000)}s.`;
    return;
  }
  state.lastRefresh = Date.now();
  refresh({ force: true });
});

$('[data-clear]').addEventListener('click', async () => {
  if (!window.confirm('Clear the listening activity stored on this device? This cannot be undone.')) return;
  await store.clear?.();
  Object.keys(sessionStorage)
    .filter((k) => k.startsWith('astyn.admin.'))
    .forEach((k) => sessionStorage.removeItem(k));
  refresh({ force: true });
});

let resizeRaf;
window.addEventListener('resize', () => {
  cancelAnimationFrame(resizeRaf);
  resizeRaf = requestAnimationFrame(() => lastModel && renderChart(lastModel));
});

refresh();
