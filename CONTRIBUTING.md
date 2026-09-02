# Contributing

## Hard rules

- **Original or clearly licensed charts only.**
- Do **not** copy, scrape, or reconstruct sheets from Ultimate Guitar, Songsterr, Genius, Chordify, or similar.
- Every song needs a `source` string that a reader can trust.
- Do not invent chords for copyrighted songs. If there is no licensed chart, use `chartType: "none"` and leave `body` empty. A notice on the song page is enough.

## Song record

```json
{
  "id": "slug",
  "title": "Title",
  "artistId": "artist-id",
  "year": 1892,
  "album": null,
  "key": "G",
  "chartType": "chords",
  "source": "Traditional / public domain; original chart",
  "license": "pd",
  "body": "[Verse]\n[G]Example [C]line\n"
}
```

- `chartType`: `chords` | `tab` | `both` | `none`
- `license`: `pd` | `cc` | `original` | `none`
- `body`: ChordPro-style text (`[Verse]` section labels; `[Am]lyric` chords). Empty when `none`.

Add public-domain charts or metadata records to `data/*.json` (register any new extra file in the extras list in `js/app.js`).

## Pull requests

Open a PR against `main`. Keep one concern per PR (a handful of songs, or a renderer fix, not both).
