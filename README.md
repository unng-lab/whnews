# Nuxt Minimal Starter

The public whnews frontend uses Nuxt and can be cloned and built independently.
It is also included as the `whnews/` submodule of the private
`unng-lab/whnews-backend` repository. Backend/MCP work and internal Spec Kit
artifacts belong to that private repository; run Spec Kit from its root.

Look at the [Nuxt documentation](https://nuxt.com/docs/getting-started/introduction) to learn more.

## Setup

Make sure to install dependencies:

```bash
# npm
npm install

# pnpm
pnpm install

# yarn
yarn install

# bun
bun install
```

## Development Server

Start the development server on `http://localhost:3000`:

```bash
# npm
npm run dev

# pnpm
pnpm dev

# yarn
yarn dev

# bun
bun run dev
```

## Production

Build the application for production:

```bash
# npm
npm run build

# pnpm
pnpm build

# yarn
yarn build

# bun
bun run build
```

Locally preview production build:

```bash
# npm
npm run preview

# pnpm
pnpm preview

# yarn
yarn preview

# bun
bun run preview
```

Check out the [deployment documentation](https://nuxt.com/docs/getting-started/deployment) for more information.

## Automatic chronicle updates

The generated `chronicles.json` contains the same public catalog as the pages.
Open tabs check it once per minute while visible, on returning to the tab and
when the network reconnects. A valid new edition updates the shared catalog,
feed, pagination and linked profiles without reloading the document or stopping
radio playback. Failed requests retain the previous edition and retry on the
next check. No application server is required; `npm run generate` prerenders
the JSON snapshot together with the pages.

## Static radio

The header's WHNEWS radio runs entirely in the browser. `content/radio.json`
defines one fixed edition: 103 AI-generated fan songs, their measured MP3
durations, immutable audio paths, UTC epoch and shuffle seed. Web audio is stored
in `public/radio/tracks/` (160 kbit/s MP3); generation tools, model weights,
private catalogs and FLAC masters are not part of the public repository.

`utils/radio-schedule.mjs` sorts tracks by a stable seeded hash and maps
`(Date.now() - epoch) mod totalDuration` onto half-open track intervals. All
listeners with accurate device clocks therefore share the same approximate
track and position, including before the epoch and after the full loop repeats.
Keep the manifest and seed unchanged for this edition; a changed playlist is a
new station edition. No time service, random shuffle, stream server or backend
request is involved.

Audio downloads start only after clicking Listen. The player rechecks UTC every
second, on track end, metadata arrival, page restore and tab activation. It
corrects drift above 1.5 seconds, reconnects at the live position after Stop,
and exposes an explicit retry after a media/playback error. Volume alone is
remembered locally when storage is available. Playback remains in the shared
layout during client-side navigation. Browsers may suspend hidden tabs; exact
sample synchronization and operation with incorrect device clocks are not
guaranteed.

Run `node --test tests/*.test.mjs`, `npm run build`, `npm run generate`, then
`node tools/validate-static.mjs`. Unit tests use a fake audio element and clock;
they do not establish live-browser decoding or actual Pages delivery. Publish
the validated `.output/public` through `tools/sync-static.mjs` into `docs/`,
preserving `CNAME`, `.nojekyll` and the tracked ownership manifest.

The MP3 edition is approximately 334 MB. GitHub Pages limits the published site
to 1 GB and applies a soft bandwidth limit to branch-based publishing; see
[GitHub Pages limits](https://docs.github.com/en/pages/getting-started-with-github-pages/github-pages-limits).
Commit audio as ordinary Git files, not LFS pointers. A large audience may
eventually require separate audio hosting.
