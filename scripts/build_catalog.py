#!/usr/bin/env python3
"""Validate song-charts data files and print catalog stats.

Artists live in data/catalog.json. Extra JSON song lists next to it are merged
the same way js/app.js does at runtime (songs only). This script does not
fetch or scrape charts.
"""
from __future__ import annotations

import json
import sys
from collections import Counter
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "data"
EXTRAS = [
    "meta.json",
    "more.json",
    "charts.json",
    "charts2.json",
    "charts3.json",
    "charts4.json",
    "charts5.json",
    "indie1.json",
    "indie2.json",
    "indie3.json",
    "indie4.json",
]


def load_songs(path: Path):
    payload = json.loads(path.read_text(encoding="utf-8"))
    if isinstance(payload, dict) and isinstance(payload.get("songs"), list):
        return payload["songs"]
    if isinstance(payload, list):
        return payload
    raise SystemExit(f"{path} has no songs array")


def main() -> int:
    catalog_path = DATA / "catalog.json"
    catalog = json.loads(catalog_path.read_text(encoding="utf-8"))
    artists = catalog.get("artists") or []
    songs = list(catalog.get("songs") or [])
    errors = []
    seen = {}
    for s in songs:
        sid = s.get("id")
        if not sid:
            errors.append(f"catalog.json song missing id: {s.get('title')}")
            continue
        seen[sid] = ("catalog.json", s)

    for name in EXTRAS:
        path = DATA / name
        if not path.exists():
            errors.append(f"missing extra file {name}")
            continue
        for s in load_songs(path):
            sid = s.get("id")
            if not sid:
                errors.append(f"{name} song missing id: {s.get('title')}")
                continue
            if sid in seen:
                continue
            seen[sid] = (name, s)
            songs.append(s)

    artist_ids = {a.get("id") for a in artists}
    by_artist = Counter()
    playable = 0
    stubs = 0
    for _sid, (_src, s) in seen.items():
        by_artist[s.get("artistId")] += 1
        if s.get("chartType") in ("chords", "tab", "both"):
            playable += 1
            body = s.get("body") or s.get("tab") or ""
            lines = [ln for ln in str(body).splitlines() if ln.strip()]
            if s.get("chartType") in ("chords", "both") and len(lines) < 8:
                stubs += 1
        if s.get("artistId") not in artist_ids:
            errors.append(f"unknown artistId {s.get('artistId')} on {s.get('id')}")

    empty = [a for a in artists if by_artist[a.get("id")] == 0]
    print(f"artists: {len(artists)}")
    print(f"songs:   {len(seen)}")
    print(f"playable charts: {playable}")
    print(f"listed only:     {len(seen) - playable}")
    print(f"empty artists:   {len(empty)}")
    for a in empty:
        print(f"  - {a.get('name')} ({a.get('id')})")
    if stubs:
        print(f"short chord charts (<8 lines): {stubs}")
        errors.append(f"{stubs} public-domain chord charts still look like stubs")
    print("\nBy artist:")
    for a in artists:
        print(f"  {by_artist[a.get('id')]:4}  {a.get('name')}")

    if errors:
        print("\nValidation issues:")
        for e in errors:
            print("  -", e)
        return 1
    print("\nOK")
    return 0


if __name__ == "__main__":
    sys.exit(main())
