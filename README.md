# song-charts

Search-first catalog of original and public-domain guitar chords and tabs.

**Live:** https://andrewpateu.github.io/song-charts/

## What this is

A static GitHub Pages site. The first screen is a large search and an artist index. Niche artists (including **bunii** / Niccolò Terre / 6yari) sit in the same index as everyone else — no featured rows.

- Public-domain / traditional songs include **original** chord-over-lyrics charts.
- Contemporary and other copyrighted songs are **metadata only** unless a licensed original chart is committed here. No guessed sheets.

Every song record has a source line.

## What this is not

We do **not** scrape or republish Ultimate Guitar, Songsterr, Genius, Chordify, or any other site’s lyric/tab sheets.

## Local

Serve the repo root (any static server) or open via GitHub Pages. Hash routes:

- `#/` search (empty query lists artists with at least one song)
- `#/a/{artistId}` artist (songs grouped by album)
- `#/s/{songId}` song

`js/app.js` prefixes `data/catalog.json` when the path includes `/song-charts/`, so the project Pages URL and a local/file server both work.

## Data

Song and artist records live in `data/*.json`.

- `data/catalog.json` — artists plus the bunii core index
- Extra files loaded by `js/app.js` (songs **and** artists, deduped by `id`): `meta.json`, `more.json`, `charts.json`–`charts5.json`, `indie1.json`–`indie4.json`

`chartType` is `chords`, `tab`, `both`, or `none`. Songs without a licensed chart stay `none` (listed, not playable).

## Enable Pages (if the live URL 404s)

Repo **Settings → Pages**:

- Source: **Deploy from a branch**
- Branch: **main** / **/** (root)

Or use GitHub Actions (workflow in `.github/workflows/pages.yml`) and set Pages source to **GitHub Actions**.

## License of charts

Traditional lyrics/melodies are public domain. Guitar charts in this repo are original. Do not assume you can copy third-party bunii (or other contemporary) charts into this catalog.
