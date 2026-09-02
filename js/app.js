(function () {
  "use strict";
  const app = document.getElementById("app");
  const countEl = document.getElementById("count");
  let catalog = null;
  let artistsById = new Map();
  let songsById = new Map();
  const state = { q: "", filter: "all" };
  const CHORD_TOKEN = /^[A-G][#b]?(?:maj7|maj9|maj|min7|min|m7b5|m7|m9|m11|m13|madd9|dim7|dim|aug|sus2|sus4|sus|add9|add11|add2|add4|7sus4|9sus4|7|9|11|13|6|2|4|m)?(?:\/[A-G][#b]?)?$/i;
  const SECTION_NAME = /^(verse|chorus|bridge|intro|outro|tag|instrumental|pre-?chorus|prechorus|solo|interlude|refrain|coda|ending|break|hook|inst|ending)(\s*\d+)?(\s*[A-Z])?$/i;
  const SINGLES = "Singles / other";
  const TRADITIONAL_IDS = new Set([
    "traditional", "spiritual", "christmas-traditional", "sea-shanty",
    "nursery", "irish-traditional", "hymn", "classical-pd"
  ]);
  function isTraditionalArtist(a) {
    const id = String(a && a.id || "");
    if (TRADITIONAL_IDS.has(id)) return true;
    return /(^|-)(traditional|spiritual|shanty|nursery|hymn|classical-pd)(-|$)/.test(id);
  }
  function trackNum(song) {
    const raw = song.track != null ? song.track : song.position;
    if (raw == null || raw === "") return null;
    const n = Number(raw);
    return Number.isFinite(n) ? n : null;
  }
  function sortAlbumTracks(a, b) {
    const ta = trackNum(a), tb = trackNum(b);
    if (ta != null && tb != null && ta !== tb) return ta - tb;
    if (ta != null && tb == null) return -1;
    if (ta == null && tb != null) return 1;
    const ia = a._i != null ? a._i : 0, ib = b._i != null ? b._i : 0;
    return ia - ib;
  }
  function $(html) { const t = document.createElement("template"); t.innerHTML = html.trim(); return t.content; }
  function esc(s) { return String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;"); }
  function fold(s) { return String(s || "").normalize("NFD").replace(/\p{M}/gu, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim(); }
  function catalogUrl() {
    const path = location.pathname || "/";
    const marker = "/song-charts/";
    const i = path.indexOf(marker);
    if (i >= 0) return path.slice(0, i + marker.length) + "data/catalog.json";
    if (/\/song-charts\/?$/.test(path)) return path.replace(/\/?$/, "/") + "data/catalog.json";
    try { return new URL("data/catalog.json", location.href).href; } catch (e) { return "data/catalog.json"; }
  }
  function parseHash() {
    const raw = (location.hash || "#/").replace(/^#/, "");
    const parts = raw.split("/").filter(Boolean);
    if (!parts.length) return { name: "home" };
    if (parts[0] === "a" && parts[1]) return { name: "artist", id: decodeURIComponent(parts[1]) };
    if (parts[0] === "s" && parts[1]) return { name: "song", id: decodeURIComponent(parts[1]) };
    return { name: "notfound" };
  }
  function artistOf(song) { return artistsById.get(song.artistId) || { id: song.artistId, name: song.artistId, aliases: [] }; }
  function hasChords(song) { return song.chartType === "chords" || song.chartType === "both"; }
  function hasTab(song) { return song.chartType === "tab" || song.chartType === "both"; }
  function isPlayable(song) { return hasChords(song) || hasTab(song); }
  function chartBadges(song) {
    const bits = [];
    if (hasChords(song)) bits.push('<span class="badge chords">chords</span>');
    if (hasTab(song)) bits.push('<span class="badge tab">tab</span>');
    if (!bits.length) bits.push('<span class="badge listed">listed</span>');
    return bits.join("");
  }
  function songHref(song) { return "#/s/" + encodeURIComponent(song.id); }
  function artistHref(a) { return "#/a/" + encodeURIComponent(a.id); }
  function artistHasSongs(a) { return catalog.songs.some((s) => s.artistId === a.id); }
  function artistAnchor(a) {
    if (artistHasSongs(a)) return '<a href="' + artistHref(a) + '">' + esc(a.name) + "</a>";
    return esc(a.name);
  }
  function songFacts(song) {
    const rows = [];
    if (song.album) rows.push(["Album", song.album]);
    if (song.year) rows.push(["Year", String(song.year)]);
    const key = song.key == null ? "" : String(song.key).trim();
    if (key) rows.push(["Key", key]);
    if (song.capo) rows.push(["Capo", String(song.capo)]);
    if (song.tuning) rows.push(["Tuning", song.tuning]);
    if (!rows.length) return "";
    return '<dl class="song-facts">' + rows.map((r) => "<div><dt>" + esc(r[0]) + "</dt><dd>" + esc(r[1]) + "</dd></div>").join("") + "</dl>";
  }
  function matchesQuery(song, artist, q) {
    if (!q) return true;
    const hay = [song.title, artist.name, ...(artist.aliases || []), song.album || "", song.year ? String(song.year) : ""].map(fold).join(" ");
    return fold(q).split(" ").filter(Boolean).every((t) => hay.includes(t));
  }
  function scoreSong(song, artist, q) {
    if (!q) return 0;
    const fq = fold(q), title = fold(song.title), album = fold(song.album || ""), an = fold(artist.name);
    const aliases = (artist.aliases || []).map(fold).join(" ");
    let n = 0;
    if (title === fq) n += 200; else if (title.startsWith(fq)) n += 120; else if (title.includes(fq)) n += 80;
    if (album && (album === fq || album.includes(fq))) n += 50;
    if (an === fq) n += 25;
    if (aliases.includes(fq) || an.includes(fq)) n += 8;
    return n;
  }
  function artistMatches(artist, q) {
    if (!q) return false;
    return fold(q).split(" ").filter(Boolean).every((t) => fold([artist.name, ...(artist.aliases || [])].join(" ")).includes(t));
  }
  function filterSongs(songs) {
    return songs.filter((s) => {
      if (state.filter === "playable" && !isPlayable(s)) return false;
      if (state.filter === "listed" && isPlayable(s)) return false;
      return true;
    });
  }
  function sortTitle(a, b) {
    return a.title.replace(/^(the|a|an)\s+/i, "").localeCompare(b.title.replace(/^(the|a|an)\s+/i, ""), undefined, { sensitivity: "base", numeric: true });
  }
  function sortArtistName(a, b) {
    return a.name.replace(/^(the|a|an)\s+/i, "").localeCompare(b.name.replace(/^(the|a|an)\s+/i, ""), undefined, { sensitivity: "base" });
  }
  function songsOf(artistId) { return catalog.songs.filter((s) => s.artistId === artistId); }
  function artistCounts(a) {
    const songs = songsOf(a.id);
    let playable = 0;
    for (let i = 0; i < songs.length; i++) if (isPlayable(songs[i])) playable++;
    return { total: songs.length, playable: playable, listed: songs.length - playable };
  }
  function countLabel(c) {
    if (c.playable && c.listed) return c.playable + " playable · " + c.listed + " listed";
    if (c.playable) return c.playable + " playable";
    if (c.listed) return c.listed + " listed";
    return "0 songs";
  }
  function isSectionLine(trimmed) {
    const one = trimmed.match(/^\[([^\]]+)\]$/);
    if (!one) return null;
    const inner = one[1].trim();
    if (SECTION_NAME.test(inner)) return inner;
    if (!CHORD_TOKEN.test(inner) && /[a-zA-Z]{3,}/.test(inner)) return inner;
    return null;
  }
  function renderChordProLine(line) {
    const trimmed = line.trim();
    if (!trimmed.includes("[")) return '<div class="chart-line"><div class="lyric-row">' + esc(line) + "</div></div>";
    let chords = "", lyrics = "", last = 0, m;
    const re = /\[([^\]]+)\]/g;
    while ((m = re.exec(trimmed))) {
      lyrics += trimmed.slice(last, m.index);
      if (chords.length < lyrics.length) chords += " ".repeat(lyrics.length - chords.length);
      else if (chords.length > lyrics.length) lyrics += " ".repeat(chords.length - lyrics.length);
      chords += m[1] + " ";
      last = m.index + m[0].length;
    }
    lyrics += trimmed.slice(last);
    let html = '<div class="chart-line"><div class="chord-row">' + esc(chords.replace(/\s+$/, "")) + "</div>";
    if (lyrics.replace(/\s/g, "")) html += '<div class="lyric-row">' + esc(lyrics) + "</div>";
    return html + "</div>";
  }
  function renderChordPro(body) {
    if (!body) return "";
    let html = '<div class="chart" role="region" aria-label="Chord chart">';
    for (const line of String(body).replace(/\r\n/g, "\n").split("\n")) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      const dir = trimmed.match(/^\{([^:}]+)(?::\s*([^}]*))?\}/);
      if (dir) {
        const key = dir[1].toLowerCase(), val = (dir[2] || "").trim();
        if (key === "s" || key === "comment" || key === "c" || key === "soc" || key === "sov" || key === "sob" || key.indexOf("start_of_") === 0) {
          html += '<div class="section-label">' + esc(val || key.replace(/^start_of_/, "").replace(/^so/, "")) + "</div>";
        }
        continue;
      }
      const section = isSectionLine(trimmed);
      if (section) { html += '<div class="section-label">' + esc(section) + "</div>"; continue; }
      html += renderChordProLine(line);
    }
    return html + "</div>";
  }
  function renderBody(body) { return body ? renderChordPro(body) : ""; }
  function renderTab(tab) { return tab ? '<pre class="tab" role="region" aria-label="Guitar tab">' + esc(String(tab).trimEnd()) + "</pre>" : ""; }
  function filtersBar() {
    const btn = (id, label) => '<button type="button" class="filter" data-filter="' + id + '" aria-pressed="' + (state.filter === id) + '">' + label + "</button>";
    return '<div class="filters" role="group" aria-label="Chart type filters">' + btn("all", "All") + btn("playable", "Playable") + btn("listed", "Listed") + "</div>";
  }
  function searchBox(autofocus) {
    return '<div class="search-wrap"><label class="search-label" for="q">Search titles, artists, aliases</label><input class="search" id="q" type="search" spellcheck="false" autocomplete="off" placeholder="bunii, niccolò terre, amazing grace…" value="' + esc(state.q) + '"' + (autofocus ? " autofocus" : "") + ">" + "</div>" + (autofocus ? filtersBar() : "");
  }
  function songLine(song) {
    const a = artistOf(song);
    return '<a class="hit" href="' + songHref(song) + '"><div class="hit-title">' + esc(song.title) + chartBadges(song) + '</div><div class="hit-sub">' + esc(a.name) + (song.year ? " · " + song.year : "") + (song.key ? " · " + esc(song.key) : "") + "</div></a>";
  }
  function renderArtistIndex(artists) {
    const acts = [], trad = [];
    for (let i = 0; i < artists.length; i++) {
      if (isTraditionalArtist(artists[i])) trad.push(artists[i]);
      else acts.push(artists[i]);
    }
    let html = "";
    if (acts.length) {
      html += '<section class="home-section"><h2 class="home-section-title">Artists</h2>';
      html += '<div class="status">' + acts.length + " artist" + (acts.length === 1 ? "" : "s") + "</div>";
      for (let i = 0; i < acts.length; i++) html += artistRow(acts[i]);
      html += "</section>";
    }
    if (trad.length) {
      html += '<section class="home-section"><h2 class="home-section-title">Traditional / public domain</h2>';
      html += '<div class="status">' + trad.length + " artist" + (trad.length === 1 ? "" : "s") + "</div>";
      for (let i = 0; i < trad.length; i++) html += artistRow(trad[i]);
      html += "</section>";
    }
    return html;
  }
  function artistRow(a) {
    const c = artistCounts(a);
    if (!c.total) return "";
    const aliases = (a.aliases || []).slice(0, 4).join(" · ");
    const counts = countLabel(c);
    return '<div class="artist-block"><a class="hit" href="' + artistHref(a) + '"><div class="hit-title">' + esc(a.name) + '</div><div class="hit-sub">' + esc(aliases ? aliases + " · " + counts : counts) + "</div></a></div>";
  }
  function artistsWithSongs() {
    return catalog.artists.filter((a) => songsOf(a.id).length > 0).slice().sort(sortArtistName);
  }
  function renderHome() {
    const q = state.q.trim();
    let body = "";
    if (!q) {
      let artists = artistsWithSongs();
      if (state.filter === "playable") artists = artists.filter((a) => artistCounts(a).playable > 0);
      else if (state.filter === "listed") artists = artists.filter((a) => artistCounts(a).listed > 0);
      body += renderArtistIndex(artists);
    } else {
      let songs = filterSongs(catalog.songs).filter((s) => matchesQuery(s, artistOf(s), q));
      songs = songs.slice().sort((a, b) => (scoreSong(b, artistOf(b), q) - scoreSong(a, artistOf(a), q)) || sortTitle(a, b));
      let matchedArtists = catalog.artists.filter((a) => artistMatches(a, q) && songsOf(a.id).length > 0).slice().sort(sortArtistName);
      if (matchedArtists.length) body += renderArtistIndex(matchedArtists);
      if (!songs.length) body += '<p class="status">No matches.</p>';
      else body += '<div class="status">' + songs.length + " song" + (songs.length === 1 ? "" : "s") + '</div><div class="list">' + songs.map(songLine).join("") + "</div>";
    }
    app.replaceChildren($("<div>" + searchBox(true) + body + "</div>"));
    bindHome();
  }
  function bindHome() {
    const input = document.getElementById("q");
    if (input) input.addEventListener("input", () => {
      state.q = input.value; render();
      const again = document.getElementById("q");
      if (again) { again.focus(); try { again.setSelectionRange(again.value.length, again.value.length); } catch (e) {}
      }
    });
    app.querySelectorAll("[data-filter]").forEach((btn) => btn.addEventListener("click", () => { state.filter = btn.getAttribute("data-filter") || "all"; render(); }));
  }
  function albumKey(song) {
    const alb = (song.album || "").trim();
    return alb || SINGLES;
  }
  function groupByAlbum(songs) {
    const groups = new Map();
    const years = new Map();
    for (const s of songs) {
      const k = albumKey(s);
      if (!groups.has(k)) groups.set(k, []);
      groups.get(k).push(s);
      if (s.year && (!years.has(k) || s.year > years.get(k))) years.set(k, s.year);
    }
    for (const list of groups.values()) list.sort(sortAlbumTracks);
    const keys = Array.from(groups.keys());
    keys.sort((a, b) => {
      if (a === SINGLES) return 1;
      if (b === SINGLES) return -1;
      const ya = years.get(a) || 0, yb = years.get(b) || 0;
      if (ya !== yb) return yb - ya;
      return a.localeCompare(b, undefined, { sensitivity: "base" });
    });
    return keys.map((k) => ({ album: k, year: years.get(k), songs: groups.get(k) }));
  }
  function renderArtist(id) {
    const a = artistsById.get(id);
    if (!a) return renderNotFound();
    const songs = catalog.songs.filter((s) => s.artistId === a.id);
    const alias = (a.aliases || []).length ? '<p class="aliases">Also known as ' + esc(a.aliases.join(", ")) + "</p>" : "";
    const extra = a.mbid ? '<p class="meta"><a href="https://musicbrainz.org/artist/' + esc(a.mbid) + '">MusicBrainz</a></p>' : "";
    const c = artistCounts(a);
    let list = "";
    const grouped = groupByAlbum(songs);
    for (const g of grouped) {
      const yr = g.year ? " · " + g.year : "";
      list += '<section class="album-group"><h2 class="album-heading">' + esc(g.album) + esc(yr) + '</h2><div class="list">' + g.songs.map(songLine).join("") + "</div></section>";
    }
    if (!songs.length) list = '<p class="status">No songs listed for this artist. <a href="#/">Back to catalog</a></p>';
    app.replaceChildren($('<div><p class="crumbs"><a href="#/">Catalog</a> / artist</p><h1>' + esc(a.name) + "</h1>" + alias + extra + '<div class="status">' + countLabel(c) + "</div>" + list + "</div>"));
    document.title = a.name + " · song-charts";
  }
  function renderSong(id) {
    const song = songsById.get(id);
    if (!song) return renderNotFound();
    const a = artistOf(song);
    let chart = "";
    const playable = isPlayable(song);
    if (hasChords(song)) chart += '<div class="chart-label">Chords over lyrics</div>' + renderBody(song.body);
    if (hasTab(song)) chart += '<div class="chart-label">Tab</div>' + renderTab(song.tab || (song.chartType === "tab" ? song.body : ""));
    if (!playable) chart = '<div class="notice"><strong>No licensed chart yet.</strong> Metadata only — no lyrics, and no guessed chord sheet.</div>';
    const artistHtml = artistAnchor(a);
    app.replaceChildren($('<article><p class="crumbs"><a href="#/">Catalog</a> / ' + artistHtml + '</p><h1>' + esc(song.title) + '</h1><p class="meta">' + artistHtml + "</p>" + songFacts(song) + chart + '<p class="source">Source: ' + esc(song.source || "Not recorded") + (song.license ? " · License: " + esc(song.license) : "") + "</p></article>"));
    document.title = song.title + " · " + a.name + " · song-charts";
  }
  function renderNotFound() {
    app.replaceChildren($('<div class="notfound"><h1>Not found</h1><p class="meta">Unknown route. That artist or song is not in this catalog.</p><p><a href="#/">Back to search</a></p></div>'));
    document.title = "Not found · song-charts";
  }
  function render() {
    const route = parseHash();
    if (route.name !== "home") state.filter = "all";
    document.title = "song-charts";
    if (route.name === "home") renderHome();
    else if (route.name === "artist") renderArtist(route.id);
    else if (route.name === "song") renderSong(route.id);
    else renderNotFound();
  }
  document.addEventListener("keydown", (e) => {
    if (e.key === "/" && document.activeElement && document.activeElement.id !== "q" && parseHash().name === "home") {
      e.preventDefault();
      const q = document.getElementById("q");
      if (q) q.focus();
    }
  });
  window.addEventListener("hashchange", render);
  function mergeExtra(extra) {
    if (!extra) return;
    if (Array.isArray(extra.artists) && extra.artists.length) {
      const seenA = new Set(catalog.artists.map((a) => a.id));
      for (let i = 0; i < extra.artists.length; i++) {
        const a = extra.artists[i];
        if (a && a.id && !seenA.has(a.id)) { seenA.add(a.id); catalog.artists.push(a); }
      }
    }
    const more = extra.songs || (Array.isArray(extra) ? extra : null);
    if (Array.isArray(more) && more.length) {
      const seenS = new Set(catalog.songs.map((s) => s && s.id).filter(Boolean));
      for (let i = 0; i < more.length; i++) {
        const s = more[i];
        if (s && s.id && !seenS.has(s.id)) { seenS.add(s.id); catalog.songs.push(s); }
      }
    }
  }
  async function boot() {
    const url = catalogUrl();
    const res = await fetch(url);
    if (!res.ok) { app.textContent = "Could not load catalog.json (" + res.status + ")."; return; }
    catalog = await res.json();
    if (!Array.isArray(catalog.artists)) catalog.artists = [];
    if (!Array.isArray(catalog.songs)) catalog.songs = [];
    const extras = ["meta.json", "more.json", "charts.json", "charts2.json", "charts3.json", "charts4.json", "charts5.json", "charts6.json", "indie1.json", "indie2.json", "indie3.json", "indie4.json"];
    for (let i = 0; i < extras.length; i++) {
      try {
        const mres = await fetch(url.replace(/catalog\.json(?:\?.*)?$/, extras[i]));
        if (mres.ok) mergeExtra(await mres.json());
      } catch (err) {}
    }
    const seenA = new Map();
    for (let i = 0; i < catalog.artists.length; i++) {
      const a = catalog.artists[i];
      if (a && a.id && !seenA.has(a.id)) seenA.set(a.id, a);
    }
    catalog.artists = Array.from(seenA.values());
    artistsById = seenA;
    const seen = new Map();
    for (let i = 0; i < catalog.songs.length; i++) {
      const s = catalog.songs[i];
      if (s && s.id && !seen.has(s.id)) seen.set(s.id, s);
    }
    catalog.songs = Array.from(seen.values());
    for (let i = 0; i < catalog.songs.length; i++) catalog.songs[i]._i = i;
    songsById = seen;
    if (countEl) { countEl.hidden = false; countEl.textContent = catalog.songs.length + " songs"; }
    render();
  }
  boot();
})();
