# Mike Astyn — website design directions

Static Vite site with three pages:

| Path | What it is |
| --- | --- |
| `/` | Presentation page linking to both directions |
| `/noir/` | Direction 01, "Noir": the client's reference refined (full-frame film, serif + tracked caps) |
| `/monolith/` | Direction 02, "Monolith": giant ASTYN wordmark with a transparent cut-out film in front |

Both directions have a loader, a hero film, light and dark modes, Apple Music previews, a countdown to 01.01.27 and a booking form (Netlify Forms, with a mail fallback).

## Run

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # outputs dist/
```

## Where things live

- `src/shared/` — colour mode, loader/preload, scroll reveals, audio player, countdown, form, and the WebGL compositor for the transparent video (`alpha-video.js`)
- `src/noir/`, `src/monolith/`, `src/landing/` — per-page styles and intro timelines
- `public/media/` — hero films, stills; `public/brand/` — vector logo; `public/art/` — release artwork; `public/shots/` — screenshots used on the presentation page

## Placeholder media

The photography was rebuilt from the low-resolution mockup in the client's email, and the hero films were generated from those stills. Swap the files in `public/media/` for the client's original photos before launch.

`opener-cutout-stacked.mp4` holds the picture on its left half and the alpha matte on its right half; `alpha-video.js` recombines them, so any replacement must keep that layout.
