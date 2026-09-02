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
  function chartBadges(song) {
    const bits = [];
    if (hasChords(song)) bits.push('<span class="badge chords">chords</span>');
    if (hasTab(song)) bits.push('<span class="badge tab">tab</span>');
    return bits.join("");
  }
  function songHref(song) { return "#/s/" + encodeURIComponent(song.id); }
  function artistHref(a) { return "#/a/" + encodeURIComponent(a.id); }
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
      if (state.filter === "chords" && !hasChords(s)) return false;
      if (state.filter === "tab" && !hasTab(s)) return false;
      return true;
    });
  }
  function sortTitle(a, b) {
    return a.title.replace(/^(the|a|an)\s+/i, "").localeCompare(b.title.replace(/^(the|a|an)\s+/i, ""), undefined, { sensitivity: "base", numeric: true });
  }
  function letterOf(title) {
    const ch = fold(title.replace(/^(the|a|an)\s+/i, "").trim()).charAt(0).toUpperCase();
    return /[A-Z]/.test(ch) ? ch : "#";
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
    return '<div class="filters" role="group" aria-label="Chart type filters">' + btn("all", "All") + btn("chords", "Has chords") + btn("tab", "Has tab") + "</div>";
  }
  function searchBox(autofocus) {
    return '<div class="search-wrap"><label class="search-label" for="q">Search titles, artists, aliases</label><input class="search" id="q" type="search" spellcheck="false" autocomplete="off" placeholder="bunii, niccolò terre, amazing grace…" value="' + esc(state.q) + '"' + (autofocus ? " autofocus" : "") + ">" + "</div>" + filtersBar();
  }
  function songLine(song) {
    const a = artistOf(song);
    return '<a class="hit" href="' + songHref(song) + '"><div class="hit-title">' + esc(song.title) + chartBadges(song) + '</div><div class="hit-sub">' + esc(a.name) + (song.year ? " · " + song.year : "") + (song.key ? " · " + esc(song.key) : "") + "</div></a>";
  }
  function renderHome() {
    const q = state.q.trim();
    let songs = filterSongs(catalog.songs);
    let matchedArtists = [];
    if (q) {
      songs = songs.filter((s) => matchesQuery(s, artistOf(s), q));
      matchedArtists = catalog.artists.filter((a) => artistMatches(a, q));
      songs = songs.slice().sort((a, b) => (scoreSong(b, artistOf(b), q) - scoreSong(a, artistOf(a), q)) || sortTitle(a, b));
    } else songs = songs.slice().sort(sortTitle);
    let body = "";
    if (matchedArtists.length) {
      body += '<div class="status">Artists</div>';
      for (const a of matchedArtists) {
        const n = catalog.songs.filter((s) => s.artistId === a.id).length;
        const aliases = (a.aliases || []).slice(0, 4).join(" · ");
        body += '<div class="artist-block"><a class="hit" href="' + artistHref(a) + '"><div class="hit-title">' + esc(a.name) + '</div><div class="hit-sub">' + esc(aliases || n + " songs") + (aliases ? " · " + n + " songs" : "") + "</div></a></div>";
      }
    }
    if (!songs.length) body += '<p class="status">No matches.</p>';
    else if (!q) {
      const groups = new Map();
      for (const s of songs) { const L = letterOf(s.title); if (!groups.has(L)) groups.set(L, []); groups.get(L).push(s); }
      body += '<div class="status">' + songs.length + ' songs · A–Z</div><div class="az">';
      for (const [L, list] of groups) body += '<section><h2 class="az-letter">' + L + '</h2><div class="list">' + list.map(songLine).join("") + "</div></section>";
      body += "</div>";
    } else body += '<div class="status">' + songs.length + " song" + (songs.length === 1 ? "" : "s") + '</div><div class="list">' + songs.map(songLine).join("") + "</div>";
    app.replaceChildren($("<div>" + searchBox(true) + body + "</div>"));
    bindHome();
  }
  function bindHome() {
    const input = document.getElementById("q");
    if (input) input.addEventListener("input", () => {
      state.q = input.value; render();
      const again = document.getElementById("q");
      if (again) { again.focus(); try { again.setSelectionRange(again.value.length, again.value.length); } catch (e) {} }
    });
    app.querySelectorAll("[data-filter]").forEach((btn) => btn.addEventListener("click", () => { state.filter = btn.getAttribute("data-filter") || "all"; render(); }));
  }
  function renderArtist(id) {
    const a = artistsById.get(id);
    if (!a) return renderNotFound();
    const songs = catalog.songs.filter((s) => s.artistId === a.id).slice().sort(sortTitle);
    const alias = (a.aliases || []).length ? '<p class="aliases">Also known as ' + esc(a.aliases.join(", ")) + "</p>" : "";
    const extra = a.mbid ? '<p class="meta"><a href="https://musicbrainz.org/artist/' + esc(a.mbid) + '">MusicBrainz</a></p>' : "";
    app.replaceChildren($('<div><p class="crumbs"><a href="#/">Catalog</a> / artist</p><h1>' + esc(a.name) + "</h1>" + alias + extra + '<div class="status">' + songs.length + " song" + (songs.length === 1 ? "" : "s") + '</div><div class="list">' + songs.map(songLine).join("") + "</div></div>"));
    document.title = a.name + " · song-charts";
  }
  function renderSong(id) {
    const song = songsById.get(id);
    if (!song) return renderNotFound();
    const a = artistOf(song);
    const bits = [];
    if (song.year) bits.push(String(song.year));
    if (song.album) bits.push(esc(song.album));
    if (song.key) bits.push("Key " + esc(song.key));
    if (song.capo) bits.push("Capo " + esc(song.capo));
    if (song.tuning) bits.push("Tuning " + esc(song.tuning));
    let chart = "";
    if (song.chartType === "chords" || song.chartType === "both") chart += '<div class="chart-label">Chords over lyrics</div>' + renderBody(song.body);
    if (song.chartType === "tab" || song.chartType === "both") chart += '<div class="chart-label">Tab</div>' + renderTab(song.tab || (song.chartType === "tab" ? song.body : ""));
    if (song.chartType === "none" || !song.chartType) chart = '<div class="notice"><strong>No licensed chart yet.</strong> Metadata only — no lyrics, and no guessed chord sheet.</div>';
    app.replaceChildren($('<article><p class="crumbs"><a href="#/">Catalog</a> / <a href="' + artistHref(a) + '">' + esc(a.name) + '</a></p><h1>' + esc(song.title) + '</h1><p class="meta"><a href="' + artistHref(a) + '">' + esc(a.name) + "</a>" + (bits.length ? " · " + bits.join(" · ") : "") + "</p>" + chart + '<p class="source">Source: ' + esc(song.source || "Not recorded") + (song.license ? " · License: " + esc(song.license) : "") + "</p></article>"));
    document.title = song.title + " · " + a.name + " · song-charts";
  }
  function renderNotFound() {
    app.replaceChildren($('<div class="notfound"><h1>Not found</h1><p class="meta">Unknown route. That artist or song is not in this catalog.</p><p><a href="#/">Back to search</a></p></div>'));
    document.title = "Not found · song-charts";
  }
  function render() {
    const route = parseHash();
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
  async function boot() {
    const url = catalogUrl();
    const res = await fetch(url);
    if (!res.ok) { app.textContent = "Could not load catalog.json (" + res.status + ")."; return; }
    catalog = await res.json();
    const extras = ["meta.json", "charts.json"];
    for (let i = 0; i < extras.length; i++) {
      try {
        const mres = await fetch(url.replace(/catalog\.json(?:\?.*)?$/, extras[i]));
        if (mres.ok) {
          const extra = await mres.json();
          const more = extra.songs || extra;
          if (Array.isArray(more) && more.length) catalog.songs = catalog.songs.concat(more);
        }
      } catch (err) {}
    }
    artistsById = new Map(catalog.artists.map((a) => [a.id, a]));
    songsById = new Map(catalog.songs.map((s) => [s.id, s]));
    if (countEl) { countEl.hidden = false; countEl.textContent = catalog.songs.length + " songs"; }
    render();
  }
  boot();
})();
