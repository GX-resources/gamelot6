// Reassembles the ROM from the part files (fetched, then run from a blob script),
// then starts EmulatorJS exactly like the codehelper-generated pages do.
(function () {
  var G = window.GAME, status = document.getElementById("status");
  function say(t) { status.textContent = t; }

  // fetch + blob, not <script src>: the page's fetch hook retries jsDelivr 403s on
  // raw.githubusercontent.com, but raw sends text/plain + nosniff so a plain script tag
  // pointed at it gets blocked.
  function loadScript(src) {
    return fetch(src).then(function (r) {
      if (!r.ok) throw new Error("Could not load " + src + " (HTTP " + r.status + ")");
      return r.blob();
    }).then(function (b) {
      var url = URL.createObjectURL(new Blob([b], { type: "text/javascript" }));
      return new Promise(function (res, rej) {
        var s = document.createElement("script");
        s.src = url;
        s.onload = function () { URL.revokeObjectURL(url); res(); };
        s.onerror = function () { rej(new Error("Could not run " + src)); };
        document.head.appendChild(s);
      });
    });
  }

  // chunks: array of base64 strings, each decodes independently (length multiple of 4)
  function decodeChunks(chunks) {
    var total = 0, i, j, sizes = [];
    for (i = 0; i < chunks.length; i++) {
      var c = chunks[i], pad = c.endsWith("==") ? 2 : c.endsWith("=") ? 1 : 0;
      sizes.push(c.length / 4 * 3 - pad); total += sizes[i];
    }
    var out = new Uint8Array(total), pos = 0;
    for (i = 0; i < chunks.length; i++) {
      var bin = atob(chunks[i]);
      for (j = 0; j < bin.length; j++) out[pos++] = bin.charCodeAt(j);
      chunks[i] = null;
    }
    return out;
  }

  (async function () {
    try {
      var pieces = [];
      for (var k = 1; k <= G.parts; k++) {
        say("Loading part " + k + " of " + G.parts + "...");
        await loadScript(G.name + ".part" + k + ".js");
        say("Decoding part " + k + " of " + G.parts + "...");
        await new Promise(function (r) { setTimeout(r, 30); });
        var u8 = decodeChunks(window.__parts[G.name][k - 1]);
        window.__parts[G.name][k - 1] = null;
        pieces.push(u8);
      }
      say("Starting emulator...");
      window.EJS_player = "#game";
      window.EJS_core = G.core;
      window.EJS_color = "#0064ff";
      window.EJS_startOnLoaded = true;
      window.EJS_gameID = G.name;
      window.EJS_disableDatabases = true; // IndexedDB is blocked in srcdoc/data-uri frames
      window.EJS_pathtodata = "https://cdn.emulatorjs.org/stable/data/";
      window.EJS_gameUrl = new Blob(pieces);
      var s = document.createElement("script");
      s.src = "https://cdn.emulatorjs.org/stable/data/loader.js";
      s.onload = function () { status.style.display = "none"; };
      s.onerror = function () { say("Could not load EmulatorJS from the CDN. Check your internet connection."); };
      document.body.appendChild(s);
    } catch (e) { say("Error: " + e.message); }
  })();
})();
