# Mike Astyn — official site

Static Vite site.

| Path | What it is |
| --- | --- |
| `/` | Home: hero film, manifesto, releases, about, gallery, 01.01.27 countdown, booking form |
| `/music/` | Player: now-playing transport, catalogue, full-screen lyrics, Buy now |
| `/admin/` | Dashboard for listening analytics (not linked, `noindex`, no sign-in yet) |

`/` and `/music/` share one bundle (`src/app.js`). Moving between them swaps only `<main>`, so audio keeps playing and the mini player stays put.

## Run

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # outputs dist/
```

Set `VITE_SITE_URL` (or rely on Netlify's `URL`) at build time. It fills the canonical links, share-image URLs, `sitemap.xml` and `robots.txt`.

## Where things live

- `src/data/tracks.js` — the catalogue. One entry per song drives the home rows, the player, lyrics, Buy buttons and analytics.
- `src/player/` — `engine.js` (the single audio engine), `shell.js` (mini player, lyrics view, Buy modal), `player.css`
- `src/pages/` — `home.js`, `gallery.js`, `music.js`; each returns `{ assets, start, dispose }`
- `src/analytics/` — `track.js` (visitor-side events), `config.js` (every read/write limit), `store-local.js`, `store-supabase.js`, `kpis.js`, `sample.js`
- `src/admin/` — the dashboard
- `supabase/schema.sql` — tables, views and policies for the analytics database (not applied anywhere yet)
- `src/shared/` — colour mode, loader, scroll reveals, WebGL compositor for the transparent hero film

## Common edits

**Add or change a song:** edit `src/data/tracks.js`. For full-length audio set `src` to the file and `previewLength` to `null`.

**Turn on a Buy button:** set that track's `buy.url` to the product link. Until then the button opens the "Music coming soon" modal. `buy.available: false` hides the button.

**Add lyrics:** fill the track's `lyrics`:

```js
lyrics: {
  synced: true,
  lines: [
    { t: 0.0, text: 'First line' },   // t = seconds into the audio being played
    { t: 4.2, text: 'Second line' },
  ],
}
```

With `synced: false` (or no `t` values) the view paces the lines evenly. With `lyrics: null` it shows "Lyrics coming soon".

**Connect the database:** apply `supabase/schema.sql`, then set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`. The site then writes events to Supabase and the admin page reads the daily summary views. The Supabase adapter has not been run against a live project yet, and the admin page needs sign-in before it is exposed.

## Media

The gallery, about portrait and countdown photo are the client's own photographs. The hero film (`opener-cutout-stacked.mp4`) and its still are AI-generated from those photos. The film file holds the picture on its left half and the alpha matte on its right half; `alpha-video.js` recombines them, so a replacement must keep that layout.

Audio is Apple's 30-second previews, streamed from Apple.
