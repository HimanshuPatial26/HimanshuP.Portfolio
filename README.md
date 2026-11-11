# Himanshu Patial · Portfolio

Personal portfolio of Himanshu Patial, AI & Growth Product Manager.
A single-page site with case-study pages, built around a full-page 3D scene of liquid glass.

**Stack:** Next.js 16 (App Router) · React 19 · Tailwind CSS 4 · three.js · GSAP · Lenis

## Run locally

```bash
npm install
npm run dev
```

Then open http://localhost:3000.

```bash
npm run build   # production build
npm run lint    # eslint
```

## Where things are

| Path | What it holds |
| --- | --- |
| `src/data/resume.ts` | All the content: profile, metrics, case studies, journey |
| `src/data/projects.ts` | Projects: the two built products (chapters, film timings, links) and the two Master's projects |
| `src/app` | Pages (`/`, `/work/[slug]` and `/projects/[slug]`), share image, sitemap, global styles |
| `src/components` | Sections (Hero, About, Metrics, Work, Projects, Journey, Contact) and UI pieces |
| `src/components/projects` | The project pages: film hero, scroll-scrubbed chapters, interactive bits |
| `src/components/scene` | The 3D scene shared by every page (`ChromeScene.tsx`) |
| `blender/` | Blender scripts that build the 3D shapes and the offline renders |
| `public/` | The 3D model, rendered tiles and poster, fonts, Draco decoder |
| `public/projects/<slug>/` | Each built project's films, card loop and posters |

## Resume PDF

The "Download resume" buttons point to `public/Himanshu-Patial-Resume.pdf`.
Add the PDF at that path.

## Regenerating the 3D assets

The shapes and renders are made with Blender (5.x), run headless from the project root:

```bash
blender --background --factory-startup --python blender/build_chrome_shapes.py -- public/models/chrome-shapes.glb
blender --background --factory-startup --python blender/render_glass_orb.py -- public/posters/orb.png
blender --background --factory-startup --python blender/render_case_tiles.py -- public/models/chrome-shapes.glb public/tiles
```

## Project films

Each built project has four kinds of video in `public/projects/<slug>/`:

- `film.mp4`: the launch film with sound, for "Play the film".
- `scrub.mp4` (and `log.mp4` for CallEvals): no audio, with a keyframe every 6 frames, so scrolling can seek through it smoothly.
- `thumb.mp4` / `thumb.jpg`: the muted 16:10 thumbnail loop on the Projects list (and the next-project card).
- Posters (`*.jpg`).

The chapter timings (`at: [start, end]` in seconds) live in `src/data/projects.ts`. Encode a new scrub file with:

```bash
ffmpeg -i source.mp4 -an -vf scale=1600:-2 -c:v libx264 -preset slow -crf 26 -g 6 -keyint_min 6 -sc_threshold 0 -pix_fmt yuv420p -movflags +faststart scrub.mp4
```

## Deployment

Hosted on Vercel. The site URL used for metadata and the sitemap comes from
Vercel's `VERCEL_PROJECT_PRODUCTION_URL`, so no configuration is needed.

## Credits

- Components adapted from [React Bits](https://reactbits.dev) and [Uiverse](https://uiverse.io) (MIT)
- Contact background: Bead Cloth Lift from Originkit
- Display type: [Syne](https://fonts.google.com/specimen/Syne) (SIL Open Font License)
- 3D: [three.js](https://threejs.org), with Draco mesh compression
