# song-charts

Search-first catalog of guitar chords and tabs. No featured rows, no marketing homepage: open the site and search.

**Live:** [https://andrewpateu.github.io/song-charts/](https://andrewpateu.github.io/song-charts/)

If that URL 404s, enable Pages: GitHub repo **Settings → Pages → Build and deployment → Source: Deploy from a branch → Branch: `main` → folder: `/ (root)` → Save**.

## What this is

- Client-side catalog (static `index.html` + CSS + JS + `data/catalog.json`)
- Hash routes: `#/` · `#/a/bunii` · `#/s/house-of-the-rising-sun`
- Search matches **titles, artist names, aliases, and albums** (so `bunii`, `niccolo terre`, `niccolò terre`, and `6yari` all hit)
- Empty search: A–Z list of every song
- Filters: has chords / has tab
- Unknown routes: in-app 404 (`404.html` also bounces path URLs back into the SPA)

Contemporary / copyrighted songs (including bunii) are **metadata only** unless a licensed original chart exists. Public-domain songs have original conventional chord-over-lyrics (or a labeled tab). Charts are **not** copied from Ultimate Guitar, Songsterr, Genius, Chordify, or any other sheet site.

## Add a song

Edit [`data/catalog.json`](data/catalog.json).

1. Ensure the artist exists in `artists` (`id`, `name`, optional `aliases`, `mbid`).
2. Append a song object:

```json
{
  "id": "my-song-slug",
  "title": "My Song",
  "artistId": "traditional",
  "year": 1890,
  "album": null,
  "key": "G",
  "capo": 2,
  "tuning": "EADGBE",
  "chartType": "chords",
  "source": "Where this chart and the words came from",
  "license": "pd",
  "body": "{s:Verse}\n[G]Hello [C]world\n"
}
```

Field notes:

| Field | Notes |
| --- | --- |
| `id` | URL slug; unique; used as `#/s/{id}` |
| `chartType` | `chords` · `tab` · `both` · `none` |
| `license` | `pd` · `cc` · `original` · `none` |
| `body` | ChordPro (`[Am]lyric`) for chords; leave empty for `none` |
| `tab` | Monospace tab (required for `tab` / `both`) |
| `source` | **Required.** Say where lyrics/harmony/metadata came from |

Rebuild from MusicBrainz dumps + the bundled PD charts (optional):

```bash
python3 scripts/build_catalog.py
```

## Contributing rules

- **Original or licensed charts only.** You must have the right to publish the words and the arrangement.
- **Source is required** on every song.
- **Do not scrape or republish** Ultimate Guitar, Songsterr, Genius, Chordify, or any other site’s lyric/tab sheets. Do not reconstruct those charts from memory of a particular transcription.
- **Copyrighted songs:** metadata (title, artist, year, album) is fine. No copyrighted lyrics. Chord-progression outlines (Verse/Chorus + chord symbols, no lyrics) only if they are your own confident original harmonic outline — otherwise set `chartType` to `none` and the site will show “No licensed chart yet.”
- **Do not invent fake chords.**
- Keep public-domain lyrics accurate; skip anything copyright-uncertain.

## Local preview

From this directory:

```bash
python3 -m http.server 8080
```

Open http://localhost:8080/ — asset paths are relative, so the same files work on GitHub Pages at `/song-charts/` and locally.

## License of this repo

Site code is for this project. Public-domain song texts remain public domain. bunii and other contemporary titles are listed as MusicBrainz metadata only; the recordings remain with their rights holders.
