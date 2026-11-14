/*!
 * Walk With Me: drop-in help widget.
 * Install: <script src="https://HOST/widget/walk-with-me.js" data-api="https://HOST" data-lang="am" defer></script>
 * Attributes: data-api, data-lang (en|am), data-mode (normal|simple), data-offline-only (true skips the API).
 * Plain JavaScript, no build step. Works on http(s) and file://. Renders inside a Shadow DOM.
 */
(function () {
  "use strict";
  if (window.__WWM_LOADED) return;
  window.__WWM_LOADED = true;

  // ───────── Config ─────────
  var script = document.currentScript || (function () {
    var s = document.querySelectorAll("script[src*='walk-with-me']");
    return s[s.length - 1];
  })();
  var ds = (script && script.dataset) || {};
  var BASE = script && script.src ? script.src.replace(/[^/]*$/, "") : "";
  var API = (ds.api || (/^https?:/.test(location.protocol) ? location.origin : "")).replace(/\/$/, "");
  var OFFLINE_ONLY = ds.offlineOnly === "true" || !API;
  var MIN_SCORE = 0.35;

  // ───────── Storage (wrapped: may throw in private mode) ─────────
  function sget(k, d) { try { var v = localStorage.getItem("wwm." + k); return v === null ? d : v; } catch (e) { return d; } }
  function sset(k, v) { try { localStorage.setItem("wwm." + k, v); } catch (e) { /* ignore */ } }

  var prefs = {
    lang: sget("lang", ds.lang === "am" ? "am" : "en"),
    mode: sget("mode", ds.mode === "simple" ? "simple" : "normal"),
    chosen: sget("chosen", "0") === "1",
    large: sget("large", "0") === "1",
    contrast: sget("contrast", "0") === "1",
    motionOff: sget("motion", "on") === "off",
    readAloud: sget("readAloud", "0") === "1"
  };

  // ───────── Strings ─────────
  // Amharic: ONLY the starter strings from the UI/UX document. Every one is unverified until a
  // native speaker checks it; the panel says so. Anything without Amharic falls back to English.
  var I18N = {
    en: {
      title: "Walk With Me", help: "Help", talk_person: "Talk to a person", send: "Send", close: "Close help",
      ask_placeholder: "Type your question", ask_label: "Your question", simple_mode: "Simple mode",
      show_me: "Show me where", share_place: "Share my place", jobs: "Jobs", mic: "Speak your question",
      mic_stop: "Stop listening", larger: "Larger text", contrast: "High contrast", motion: "Stop motion",
      read_aloud: "Read aloud", display: "Display options",
      not_in_course: "That is not in this course. I can ask a person, or look at jobs.",
      stop_sharing: "Stop sharing", sharing_now: "Sharing now.", update_view: "Update view",
      greet: "Hi. I answer from this course, show you where things are on the page, and bring in a person when I cannot help.",
      pick_lang: "Which language do you want?", pick_mode: "Normal answers or simple answers?",
      normal: "Normal", simple: "Simple", looking: "Looking in the course.",
      offline_note: "Answered without internet", offline_msg: "No internet. I can still answer from the course. Help from a person and alerts need internet.",
      am_missing: "Amharic answer not ready yet. Here it is in English.", am_unverified: "Amharic text not yet checked by a native speaker.",
      from: "From:", take_me: "Take me there", go_there: "Go there", next: "Next",
      show_ask: "What are you looking for? For example: where do I finish this lesson?",
      found: "Found it: {x}. Press Enter to use it.", elsewhere: "That is on the {x} page.",
      not_found: "I could not find that on this page. I can ask a person.",
      how_help: "How do you want help?", chat: "Chat", voice_cb: "Voice call-back", phone_cb: "Phone call-back", cancel: "Cancel",
      phone_label: "Your phone number (required)", phone_hint: "09… or 07… or +251…", phone_err: "Problem: that number is not in a format we can call. Use 09…, 07… or +251….",
      continue: "Continue", err_summary: "There is a problem", place_title: "Check what will be sent",
      place_hint: "A person sees this. Change anything you do not want to share. Nothing is sent before you press Send.",
      send_person: "Send to a person", change: "Change", needs_net: "Help from a person needs internet. Try again when you are connected.",
      waiting: "Waiting", connected: "Connected", ended: "Ended", connected_msg: "Connected to a person.",
      sent_msg: "Your request was sent. A person will join soon. You can keep typing here.",
      busy: "Everyone is busy. You are number {n} in line. Keep this open, or close it and ask for a call-back.",
      typing: "The person is typing.", end_chat: "End chat", person: "Person", you: "You", helper_name: "Helper",
      share_req: "A helper would like to see your page.", share_view: "Share page view", share_screen: "Share screen", no_thanks: "No thanks",
      chat_ended: "Chat ended. Was this helpful?", yes: "Yes", no: "No", thanks: "Thank you.",
      no_am_voice: "This phone has no Amharic voice. I will show text.",
      mic_blocked: "The microphone is blocked. Type your question, or allow the microphone in browser settings.",
      mic_lang: "Voice input does not work for this language in this browser. Type your question.",
      screen_failed: "Screen sharing did not start. Page view sharing still works.",
      sharing_started: "Sharing started. Press Stop sharing at any time.", sharing_stopped: "Sharing stopped.",
      error: "Something went wrong.", callback_sent: "Your call-back request was sent. Your number is deleted when the request is closed.",
      place_sent_msg: "Your place was sent to the person.", talking_person: "You are talking to a person.",
      rate: "Too many messages. Wait {n} seconds."
    },
    am: {
      help: "እርዳታ", talk_person: "ሰው ያናግሩ", send: "ላክ", ask_placeholder: "ጥያቄዎን ይጻፉ", simple_mode: "ቀላል ሁነታ",
      show_me: "አሳዩኝ", not_in_course: "ይህ በኮርሱ ውስጥ የለም። ሰው ልጠይቅልዎ እችላለሁ።", stop_sharing: "ማጋራት አቁም"
    }
  };
  function t(k, vars) {
    var s = (prefs.lang === "am" && I18N.am[k]) || I18N.en[k] || k;
    if (vars) Object.keys(vars).forEach(function (v) { s = s.replace("{" + v + "}", vars[v]); });
    return s;
  }
  function tlang(k) { return prefs.lang === "am" && I18N.am[k] ? "am" : "en"; }

  // ───────── Normalisation (mirror of api/app/normalise_am.py) ─────────
  var FAMILIES = [[0x1210, 0x1200], [0x1280, 0x1200], [0x1220, 0x1230], [0x12D0, 0x12A0], [0x1340, 0x1338]];
  var STOP = {};
  ("a an the and or of to in on for with by from at as is are was were be it its this that i me my you your we our do does did " +
   "can could will would should how what where which who why when there here please tell about into than then so if not no yes")
    .split(" ").forEach(function (w) { STOP[w] = 1; });
  function fold(s) {
    var out = "";
    for (var i = 0; i < s.length; i++) {
      var c = s.charCodeAt(i), m = c;
      for (var f = 0; f < FAMILIES.length; f++) {
        if (c >= FAMILIES[f][0] && c < FAMILIES[f][0] + 8) { m = FAMILIES[f][1] + (c - FAMILIES[f][0]); break; }
      }
      out += String.fromCharCode(m);
    }
    return out;
  }
  var ETH = /[ሀ-፿]/;
  function stem(t0) {
    if (ETH.test(t0) || t0.length < 5) return t0;
    var sufs = ["ing", "ed", "es", "s"];
    for (var i = 0; i < sufs.length; i++) {
      var sf = sufs[i];
      if (t0.slice(-sf.length) === sf && t0.length - sf.length >= 3) return t0.slice(0, -sf.length);
    }
    return t0;
  }
  var NONWORD;
  try { NONWORD = new RegExp("[^\\p{L}\\p{N}\\p{M}_\\u1200-\\u137F]+", "gu"); } catch (e) { NONWORD = /[^A-Za-z0-9_ሀ-፿]+/g; }
  function tokens(text) {
    var out = [];
    fold(String(text || "")).toLowerCase().split(/[\s፡-፨]+/).forEach(function (raw) {
      var tok = raw.replace(NONWORD, "").replace(/_/g, "");
      if (!tok || STOP[tok]) return;
      out.push(stem(tok));
    });
    return out;
  }

  // ───────── Offline FAQ (widget/faq-bundle.js) ─────────
  var offlineIndex = null;
  function loadScript(src) {
    return new Promise(function (res, rej) {
      var s = document.createElement("script");
      s.src = src; s.async = true; s.onload = res; s.onerror = rej;
      document.head.appendChild(s);
    });
  }
  function ensureBundles() {
    var jobs = [];
    if (!window.WWM_FAQ) jobs.push(loadScript(BASE + "faq-bundle.js").catch(function () {}));
    if (!window.WWM_ACTIONS) jobs.push(loadScript(BASE + "actions.js").catch(function () {}));
    return Promise.all(jobs);
  }
  function buildOffline() {
    var B = window.WWM_FAQ;
    if (!B) return null;
    var docs = [];
    function rep(arr, n) { var o = []; for (var i = 0; i < n; i++) o = o.concat(arr || []); return o.join(" "); }
    (B.entries || []).forEach(function (f) {
      docs.push({ type: "faq", f: f, toks: tokens([f.question_en, f.question_am || "", f.answer_en, rep(f.keywords_en, 2), rep(f.keywords_am, 2)].join(" ")) });
    });
    Object.keys(B.sections || {}).forEach(function (id) {
      var s = B.sections[id];
      docs.push({ type: "section", id: id, s: s, toks: tokens([s.title_en, s.title_en, s.body_en, (s.keywords_en || []).join(" "), (s.keywords_am || []).join(" ")].join(" ")) });
    });
    var df = {}, total = 0;
    docs.forEach(function (d) {
      total += d.toks.length;
      d.tf = {};
      d.toks.forEach(function (x) { d.tf[x] = (d.tf[x] || 0) + 1; });
      Object.keys(d.tf).forEach(function (x) { df[x] = (df[x] || 0) + 1; });
    });
    return { docs: docs, df: df, N: docs.length || 1, avgdl: docs.length ? total / docs.length : 1, B: B };
  }
  function offlineSearch(text) {
    offlineIndex = offlineIndex || buildOffline();
    var I = offlineIndex;
    if (!I) return null;
    var q = [];
    tokens(text).forEach(function (x) { if (q.indexOf(x) < 0) q.push(x); });
    if (!q.length) return null;
    function idf(x) { var n = I.df[x] || 0; return Math.log(1 + (I.N - n + 0.5) / (n + 0.5)); }
    var totalIdf = q.reduce(function (a, x) { return a + idf(x); }, 0) || 1, best = null;
    I.docs.forEach(function (d) {
      var s = 0, cov = 0, dl = d.toks.length || 1;
      q.forEach(function (x) {
        var f = d.tf[x];
        if (!f) return;
        var w = idf(x); cov += w;
        s += w * f * 2.4 / (f + 1.4 * (0.25 + 0.75 * dl / I.avgdl));
      });
      if (d.type === "faq") s *= 1.15; // mirror api/app/retrieval.py: FAQ entries win ties against section text
      if (s > 0 && (!best || s > best.s)) best = { d: d, s: s, cov: cov / totalIdf };
    });
    return best;
  }
  function sectionCitation(id) {
    var s = window.WWM_FAQ && window.WWM_FAQ.sections[id];
    if (!s) return null;
    return { type: "section", id: id, title: s.title_en, url: s.page_url + "#" + s.anchor, anchor: s.anchor, page_url: s.page_url };
  }
  function offlineAnswer(text, lang) {
    var best = offlineSearch(text);
    var base = { lang: "en", citations: [], course_terms: [], action: null, provider: "offline", answered_offline: true, not_in_course: false, am_unavailable: false };
    if (!best || best.cov < MIN_SCORE) return Object.assign(base, { answer: I18N.en.not_in_course, not_in_course: true, handoff_suggested: true });
    var d = best.d;
    if (d.type === "faq") {
      var f = d.f, useAm = lang === "am" && f.answer_am;
      var cit = f.section_id ? sectionCitation(f.section_id) : null;
      return Object.assign(base, { answer: useAm ? f.answer_am : f.answer_en, lang: useAm ? "am" : "en", am_unavailable: lang === "am" && !useAm,
        citations: cit ? [cit] : [{ type: "faq", id: f.id, title: f.question_en, url: "" }], action: f.action_id ? { id: f.action_id } : null });
    }
    var sentences = d.s.body_en.split(/(?<=[.!?])\s+/).slice(0, 3).join(" ");
    return Object.assign(base, { answer: sentences, am_unavailable: lang === "am", citations: [sectionCitation(d.id)] });
  }

  // ───────── Network ─────────
  var online = !OFFLINE_ONLY, offlineNoticeShown = false;
  function apiFetch(path, opts, timeoutMs) {
    if (OFFLINE_ONLY) return Promise.reject(new Error("offline-only"));
    opts = opts || {};
    var ctrl = window.AbortController ? new AbortController() : null;
    var timer = setTimeout(function () { if (ctrl) ctrl.abort(); }, timeoutMs || 10000);
    var init = { method: opts.method || "GET", headers: { "Content-Type": "application/json" }, signal: ctrl && ctrl.signal };
    if (opts.body) init.body = JSON.stringify(opts.body);
    return fetch(API + path, init).then(function (r) {
      clearTimeout(timer);
      online = true;
      return r.json().catch(function () { return {}; }).then(function (data) {
        if (!r.ok) { var e = new Error((data.error && data.error.message) || t("error")); e.status = r.status; e.api = data.error; throw e; }
        return data;
      });
    }, function (err) { clearTimeout(timer); online = false; err.network = true; throw err; });
  }
  function randomHex(bytes) {
    var a = new Uint8Array(bytes);
    (window.crypto || window.msCrypto).getRandomValues(a);
    return Array.prototype.map.call(a, function (b) { return ("0" + b.toString(16)).slice(-2); }).join("");
  }
  var sessionId = sget("session", "");
  if (!sessionId) { sessionId = randomHex(16); sset("session", sessionId); }
  var sessionReady = null;
  function ensureSession() {
    if (!sessionReady) {
      sessionReady = apiFetch("/v1/sessions", { method: "POST", body: { session_id: sessionId, channel: "web", lang: prefs.lang, mode: prefs.mode } })
        .catch(function (e) { sessionReady = null; throw e; });
    }
    return sessionReady;
  }

  // ───────── Page context (for the place message) ─────────
  var lastFocused = null, lastError = null, recent = [];
  document.addEventListener("focusin", function (e) { if (host && !host.contains(e.target) && e.target !== host) lastFocused = e.target; }, true);
  window.addEventListener("error", function (e) { lastError = (e && e.message) ? String(e.message).slice(0, 200) : lastError; });
  function describe(el) {
    if (!el || el === document.body) return null;
    var tag = el.tagName.toLowerCase();
    var role = el.getAttribute("role") || ({ a: "link", button: "button", input: "text field", textarea: "text field", select: "list" })[tag] || tag;
    var name = el.getAttribute("aria-label") || (tag === "input" || tag === "textarea" ? (el.labels && el.labels[0] && el.labels[0].textContent) || el.placeholder : el.textContent) || "";
    name = name.replace(/\s+/g, " ").trim().slice(0, 80);
    return role + (name ? ' "' + name + '"' : "");
  }
  function currentSection() {
    var hs = document.querySelectorAll("main h1, main h2, main h3, h1, h2, h3"), cur = null;
    for (var i = 0; i < hs.length; i++) {
      if (host && host.contains(hs[i])) continue;
      if (hs[i].getBoundingClientRect().top < window.innerHeight / 2) cur = hs[i]; else if (!cur) cur = hs[i];
    }
    return cur;
  }
  function visibleError() {
    if (lastError) return lastError;
    var a = document.querySelector("[role=alert]:not(:empty), .error:not(:empty), [aria-invalid=true]");
    return a && !(host && host.contains(a)) ? (a.textContent || describe(a) || "").trim().slice(0, 200) || null : null;
  }
  function placeText() {
    var sec = currentSection();
    return [
      "Page: " + (document.title || location.pathname),
      "Section: " + (sec ? sec.textContent.trim() : "unknown"),
      "Focused: " + (describe(lastFocused) || "nothing"),
      "Last error: " + (visibleError() || "none"),
      "Last 3 messages: " + (recent.length ? recent.slice(-3).join(" | ") : "none")
    ].join("\n");
  }
  function parsePlace(text) {
    var place = { page_title: null, page_url: location.href.slice(0, 500), section: null, focused: null, last_error: null, recent_messages: [], note: null };
    var extra = [];
    text.split(/\n/).forEach(function (line) {
      var m = line.match(/^\s*(Page|Section|Focused|Last error|Last 3 messages):\s*(.*)$/i);
      if (!m) { if (line.trim()) extra.push(line.trim()); return; }
      var k = m[1].toLowerCase(), v = m[2].trim();
      if (!v || /^(none|unknown|nothing)$/i.test(v)) return;
      if (k === "page") place.page_title = v.slice(0, 300);
      else if (k === "section") place.section = v.slice(0, 300);
      else if (k === "focused") place.focused = v.slice(0, 300);
      else if (k === "last error") place.last_error = v.slice(0, 500);
      else place.recent_messages = v.split(" | ").slice(-3).map(function (x) { return x.slice(0, 300); });
    });
    if (extra.length) place.note = extra.join("\n").slice(0, 1000);
    return place;
  }

  // ───────── DOM helpers ─────────
  function h(tag, attrs, kids) {
    var el = document.createElement(tag);
    if (attrs) Object.keys(attrs).forEach(function (k) {
      var v = attrs[k];
      if (v === null || v === undefined || v === false) return;
      if (k === "text") el.textContent = v;
      else if (k.slice(0, 2) === "on") el.addEventListener(k.slice(2), v);
      else el.setAttribute(k, v === true ? "" : v);
    });
    (kids || []).forEach(function (c) { if (c) el.appendChild(typeof c === "string" ? document.createTextNode(c) : c); });
    return el;
  }
  function btn(label, cls, onclick, extra) {
    return h("button", Object.assign({ type: "button", class: cls || "btn", text: label, onclick: onclick, lang: null }, extra || {}));
  }

  // ───────── Styles (tokens from 03-UI-UX-DESIGN §2, injected into the shadow root) ─────────
  var CSS = [
    ":host{all:initial;--indigo:#352E72;--purple:#755F96;--mist:#D5D8DF;--blue:#0599E5;--slate:#7D779C;--teal:#48B3D1;--lime:#C8F135;--white:#FFFFFF;",
    "--bg:var(--white);--text:var(--indigo);--border-c:var(--indigo);--focus:var(--blue);--primary-fill:var(--lime);--primary-text:var(--indigo);--card-dark:var(--indigo);--card-dark-text:var(--white);",
    "--font-head:'Space Grotesk','Noto Sans Ethiopic',system-ui,sans-serif;--font-body:'Atkinson Hyperlegible','Noto Sans Ethiopic',system-ui,sans-serif;--font-mono:'Space Mono',ui-monospace,monospace;",
    "--radius-control:12px;--radius-card:20px;--radius-pill:999px;--bw:2px;--edge:0 4px 0 var(--border-c);--edge-pressed:0 1px 0 var(--border-c);--fs:18px;--t:150ms}",
    ":host([data-contrast=high]){--bg:#FFFFFF;--text:#000000;--border-c:#000000;--focus:#0000FF;--primary-fill:#000000;--primary-text:#FFFFFF;--card-dark:#000000;--card-dark-text:#FFFFFF;--lime:#000000;--teal:#FFFFFF;--mist:#FFFFFF;--indigo:#000000;--bw:3px}",
    ":host([data-large=true]){--fs:22px}",
    ":host([data-motion=off]){--t:0ms}",
    "@media (prefers-reduced-motion:reduce){:host{--t:0ms}}",
    "*{box-sizing:border-box}",
    ".root{font-family:var(--font-body);font-size:var(--fs);line-height:1.5;color:var(--text)}",
    ".sr{position:absolute!important;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap}",
    "button,input,textarea{font:inherit;color:inherit}",
    "button{cursor:pointer}",
    ":focus-visible{outline:3px solid var(--focus);outline-offset:3px}",
    ".launcher{position:fixed;inset-inline-end:16px;bottom:calc(16px + var(--wwm-bottom-offset,0px));z-index:2147483000;min-height:56px;min-width:56px;padding:0 20px;display:flex;align-items:center;gap:8px;",
    "background:var(--primary-fill);color:var(--primary-text);border:var(--bw) solid var(--border-c);box-shadow:var(--edge);border-radius:var(--radius-pill);font-weight:700;font-size:18px;font-family:var(--font-body)}",
    ".launcher:active{box-shadow:var(--edge-pressed);transform:translateY(3px)}",
    ".launcher svg{width:24px;height:24px;flex:none}",
    ".panel{position:fixed;inset-inline-end:16px;bottom:calc(16px + var(--wwm-bottom-offset,0px));z-index:2147483001;width:400px;max-width:calc(100vw - 32px);height:600px;max-height:calc(100vh - 32px);",
    "display:flex;flex-direction:column;background:var(--bg);border:var(--bw) solid var(--border-c);border-radius:var(--radius-card);box-shadow:var(--edge);overflow:hidden;transition:opacity var(--t) ease-out,transform var(--t) ease-out}",
    ".panel[hidden]{display:none}",
    "@media (max-width:480px){.panel{inset-inline:0;bottom:0;width:100%;max-width:100%;height:85vh;border-radius:var(--radius-card) var(--radius-card) 0 0}}",
    "@media (max-width:360px),(max-height:520px){.panel{inset:0;width:100%;height:100%;max-height:100%;border-radius:0}}",
    ".share-strip{display:flex;flex-wrap:wrap;align-items:center;gap:8px;padding:8px 12px;background:var(--teal);color:var(--indigo);font-weight:700;border-bottom:var(--bw) solid var(--border-c)}",
    ".share-strip[hidden]{display:none}",
    ".hdr{background:var(--card-dark);color:var(--card-dark-text);padding:10px 12px;display:flex;flex-direction:column;gap:8px}",
    ".hdr-row{display:flex;align-items:center;gap:6px;flex-wrap:wrap}",
    ".hdr h2{font-family:var(--font-head);font-size:20px;margin:0;margin-inline-end:auto;font-weight:700}",
    ".hdr button{min-height:44px;min-width:44px;padding:0 10px;background:transparent;color:var(--card-dark-text);border:2px solid var(--card-dark-text);border-radius:var(--radius-control)}",
    ".hdr button[aria-pressed=true]{background:var(--card-dark-text);color:var(--card-dark)}",
    ".hdr :focus-visible{outline:3px solid #fff;outline-offset:2px;box-shadow:0 0 0 6px var(--blue)}",
    ".hdr .btn-primary{width:100%;background:var(--primary-fill);color:var(--primary-text);border:var(--bw) solid var(--card-dark-text);font-weight:700;min-height:48px}",
    ".unverified{font-size:16px;margin:0}",
    ".body{flex:1;overflow-y:auto;padding:12px;display:flex;flex-direction:column;gap:8px;overscroll-behavior:contain}",
    ".card{border:var(--bw) solid var(--border-c);border-radius:var(--radius-card);padding:14px;box-shadow:var(--edge);background:var(--bg);margin-bottom:8px}",
    ".card h3{font-family:var(--font-head);font-size:20px;margin:0 0 8px}",
    ".card p{margin:0 0 8px}",
    ".row{display:flex;flex-wrap:wrap;gap:8px}",
    ".btn{min-height:44px;padding:0 16px;background:var(--bg);color:var(--text);border:var(--bw) solid var(--border-c);border-radius:var(--radius-control);box-shadow:var(--edge);font-weight:700}",
    ".btn:active{box-shadow:var(--edge-pressed);transform:translateY(3px)}",
    ".btn-primary{background:var(--primary-fill);color:var(--primary-text)}",
    ".btn-quiet{background:transparent;border:0;box-shadow:none;text-decoration:underline;min-height:44px;padding:0 8px}",
    ".log{display:flex;flex-direction:column;gap:8px;margin:0;padding:0;list-style:none}",
    ".msg{max-width:85%;padding:12px 14px;border-radius:12px;font-size:var(--fs);white-space:pre-wrap;overflow-wrap:anywhere}",
    ".msg[lang=am]{line-height:1.7}",
    ".msg.learner{align-self:flex-end;background:var(--indigo);color:var(--white)}",
    ":host([data-contrast=high]) .msg.learner{background:#000;color:#fff}",
    ".msg.helper,.msg.system{align-self:flex-start;background:var(--bg);border:var(--bw) solid var(--border-c)}",
    ".msg.person{align-self:flex-start;background:var(--mist);border:var(--bw) solid var(--border-c)}",
    ".msg .who{display:block;font-size:16px;font-weight:700;margin-bottom:4px}",
    ".badge{display:inline-block;background:var(--teal);color:var(--indigo);border-radius:var(--radius-pill);padding:2px 10px;font-size:16px;font-weight:700;border:2px solid var(--border-c)}",
    ".extras{display:flex;flex-wrap:wrap;gap:6px;margin-top:8px;white-space:normal}",
    ".chip{display:inline-flex;align-items:center;min-height:44px;padding:0 14px;border:2px solid var(--border-c);border-radius:var(--radius-pill);background:var(--bg);color:var(--text);font-size:16px;text-decoration:underline;font-weight:700}",
    ".msg.learner .chip{color:var(--text)}",
    ".term{font-size:16px}",
    ".quick{display:flex;flex-wrap:wrap;gap:6px;padding:8px 12px 0;border-top:var(--bw) solid var(--mist)}",
    ".quick .chip{text-decoration:none}",
    ".composer{display:flex;gap:6px;padding:8px 12px;align-items:flex-end}",
    ".composer textarea{flex:1;min-height:52px;max-height:140px;resize:none;padding:12px;background:var(--mist);border:var(--bw) solid var(--border-c);border-radius:var(--radius-control);font-size:var(--fs)}",
    ":host([data-contrast=high]) .composer textarea{background:#fff}",
    ".composer .btn{min-height:52px}",
    ".icon-btn{min-width:52px;padding:0 10px}",
    ".icon-btn[aria-pressed=true]{background:var(--indigo);color:var(--white)}",
    ".footer{display:flex;flex-wrap:wrap;gap:4px 10px;padding:4px 12px 10px;font-size:16px}",
    ".footer button{min-height:32px;min-width:24px;padding:4px 6px;background:transparent;border:2px solid transparent;border-radius:8px;text-decoration:underline;font-size:16px}",
    ".footer button[aria-pressed=true]{border-color:var(--border-c);text-decoration:none;font-weight:700}",
    ".footer button[aria-pressed=true]::before{content:'✓ '}",
    "label{display:block;font-weight:700;margin-bottom:4px}",
    ".hint{display:block;font-size:16px;margin-bottom:6px}",
    "input[type=tel],.card textarea{width:100%;min-height:52px;padding:12px;background:var(--mist);border:var(--bw) solid var(--border-c);border-radius:var(--radius-control);font-size:var(--fs)}",
    ".card textarea{min-height:170px;font-family:var(--font-mono);font-size:16px}",
    "input[aria-invalid=true]{border-width:4px}",
    ".err{display:block;font-weight:700;margin-top:6px}",
    ".err::before{content:'⚠ ';color:#B3261E}",
    ".summary{border:4px solid var(--border-c);border-radius:var(--radius-control);padding:10px;margin-bottom:10px}",
    ".summary a{color:var(--text)}",
    ".status-line{display:flex;align-items:center;gap:8px;flex-wrap:wrap}",
    ":host([data-simple=true]) .adv{display:none!important}",
    ":host([data-simple=true]){--fs:20px}",
    ":host([data-simple=true][data-large=true]){--fs:24px}"
  ].join("\n");

  // ───────── Build UI ─────────
  var host, root, el = {};
  function buildUI() {
    host = h("div", { id: "wwm-host" });
    host.setAttribute("data-wwm", "host");
    root = host.attachShadow ? host.attachShadow({ mode: "open" }) : host;
    var style = h("style");
    style.textContent = CSS;
    root.appendChild(style);
    var wrap = h("div", { class: "root" });
    root.appendChild(wrap);

    el.status = h("div", { class: "sr", role: "status", "aria-live": "polite", "aria-atomic": "true" });
    el.launcher = h("button", { type: "button", class: "launcher", "aria-expanded": "false", "aria-controls": "wwm-panel", onclick: openPanel });
    el.launcher.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" stroke-width="2.5"/><path d="M9.2 9.2a2.9 2.9 0 1 1 4 2.7c-.8.4-1.2 1-1.2 1.8v.6" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"/><circle cx="12" cy="17.6" r="1.4" fill="currentColor"/></svg>';
    el.launcherLabel = h("span");
    el.launcher.appendChild(el.launcherLabel);

    el.stopShare = btn("", "btn btn-primary", function () { stopSharing(true); });
    el.updateView = btn("", "btn", function () { sendSnapshot(true); });
    el.shareLabel = h("span");
    el.shareStrip = h("div", { class: "share-strip", hidden: true }, [el.stopShare, el.shareLabel, el.updateView]);

    el.title = h("h2", { id: "wwm-title" });
    el.langBtn = btn("", "", toggleLang, { "aria-label": "Language: switch between Amharic and English" });
    el.simpleBtn = btn("", "", function () { setMode(prefs.mode === "simple" ? "normal" : "simple"); });
    el.closeBtn = btn("×", "", closePanel);
    el.talkBtn = btn("", "btn-primary", function () { startHandoff(); });
    el.unverified = h("p", { class: "unverified", lang: "en" });
    var hdr = h("div", { class: "hdr" }, [h("div", { class: "hdr-row" }, [el.title, el.langBtn, el.simpleBtn, el.closeBtn]), el.talkBtn, el.unverified]);

    el.flow = h("div", { class: "flow" });
    el.log = h("div", { class: "log", role: "log", "aria-live": "polite", "aria-relevant": "additions", "aria-labelledby": "wwm-log-label" });
    el.logLabel = h("h3", { id: "wwm-log-label", class: "sr", text: "Conversation" });
    el.body = h("div", { class: "body" }, [el.flow, el.logLabel, el.log]);

    el.qShow = btn("", "chip", startShowMe);
    el.qShare = btn("", "chip adv", function () { startHandoff({ shareOnly: true }); });
    el.qJobs = h("a", { class: "chip adv", href: API ? API + "/site/jobs.html" : new URL("../site/jobs.html", BASE).href });
    el.quick = h("div", { class: "quick", role: "group", "aria-label": "Quick actions" }, [el.qShow, el.qShare, el.qJobs]);

    el.input = h("textarea", { id: "wwm-input", rows: "1", dir: "auto", maxlength: "1000", onkeydown: function (e) {
      if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); submit(); }
    } });
    el.inputLabel = h("label", { for: "wwm-input", class: "sr" });
    el.mic = btn("🎤", "btn icon-btn", toggleMic, { "aria-pressed": "false" });
    el.send = btn("", "btn btn-primary", submit);
    var form = h("div", { class: "composer" }, [el.inputLabel, el.input, el.mic, el.send]);
    if (!SR) el.mic.hidden = true;

    el.fLarge = btn("", "", function () { setPref("large"); });
    el.fContrast = btn("", "", function () { setPref("contrast"); });
    el.fMotion = btn("", "", function () { setPref("motionOff"); });
    el.fRead = btn("", "adv", function () { setPref("readAloud"); });
    el.footer = h("div", { class: "footer", role: "group", "aria-label": "Display options" }, [el.fLarge, el.fContrast, el.fMotion, el.fRead]);

    el.panel = h("div", { id: "wwm-panel", class: "panel", role: "dialog", "aria-modal": "false", "aria-labelledby": "wwm-title", hidden: true,
      onkeydown: function (e) { if (e.key === "Escape") { e.stopPropagation(); closePanel(); } } },
      [el.shareStrip, hdr, el.body, el.quick, form, el.footer]);

    wrap.appendChild(el.status);
    wrap.appendChild(el.launcher);
    wrap.appendChild(el.panel);
    document.body.appendChild(host);
    applyPrefs();
  }

  function applyPrefs() {
    host.setAttribute("data-large", String(prefs.large));
    host.setAttribute("data-simple", String(prefs.mode === "simple"));
    if (prefs.contrast) host.setAttribute("data-contrast", "high"); else host.removeAttribute("data-contrast");
    host.setAttribute("data-motion", prefs.motionOff ? "off" : "on");
    function lbl(node, key) { node.textContent = t(key); node.setAttribute("lang", tlang(key)); }
    lbl(el.launcherLabel, "help");
    el.launcher.setAttribute("aria-label", t("help") + " (" + I18N.en.title + ")");
    el.title.textContent = I18N.en.title;
    el.title.setAttribute("lang", "en");
    el.langBtn.textContent = prefs.lang === "am" ? "EN" : "አማ";
    el.langBtn.setAttribute("aria-label", prefs.lang === "am" ? "Switch to English" : "Switch to Amharic (አማርኛ)");
    lbl(el.simpleBtn, "simple_mode");
    el.simpleBtn.setAttribute("aria-pressed", String(prefs.mode === "simple"));
    el.closeBtn.setAttribute("aria-label", t("close"));
    lbl(el.talkBtn, "talk_person");
    el.unverified.textContent = prefs.lang === "am" ? I18N.en.am_unverified : "";
    el.unverified.hidden = prefs.lang !== "am";
    lbl(el.qShow, "show_me"); lbl(el.qShare, "share_place"); lbl(el.qJobs, "jobs");
    el.input.setAttribute("placeholder", t("ask_placeholder"));
    el.input.setAttribute("lang", prefs.lang);
    lbl(el.inputLabel, "ask_label");
    lbl(el.send, "send");
    el.mic.setAttribute("aria-label", listening ? t("mic_stop") : t("mic"));
    lbl(el.stopShare, "stop_sharing"); lbl(el.shareLabel, "sharing_now"); lbl(el.updateView, "update_view");
    [["fLarge", "large", "larger"], ["fContrast", "contrast", "contrast"], ["fMotion", "motionOff", "motion"], ["fRead", "readAloud", "read_aloud"]].forEach(function (x) {
      el[x[0]].textContent = t(x[2]);
      el[x[0]].setAttribute("aria-pressed", String(!!prefs[x[1]]));
    });
  }
  function setPref(k) {
    prefs[k] = !prefs[k];
    sset(k === "motionOff" ? "motion" : k, k === "motionOff" ? (prefs[k] ? "off" : "on") : (prefs[k] ? "1" : "0"));
    applyPrefs();
  }
  function toggleLang() {
    prefs.lang = prefs.lang === "am" ? "en" : "am";
    sset("lang", prefs.lang);
    sessionReady = null;
    applyPrefs();
    announce(prefs.lang === "am" ? "አማርኛ" : "English");
  }
  function setMode(m) {
    prefs.mode = m;
    sset("mode", m);
    sessionReady = null;
    if (m === "simple" && !prefs.readAloud) { prefs.readAloud = true; sset("readAloud", "1"); }
    applyPrefs();
  }
  function announce(text) {
    el.status.textContent = "";
    setTimeout(function () { el.status.textContent = text; }, 60);
  }

  // ───────── Panel open / close ─────────
  var greeted = false;
  function openPanel() {
    el.panel.hidden = false;
    el.launcher.setAttribute("aria-expanded", "true");
    el.launcher.hidden = true;
    ensureBundles();
    if (!prefs.chosen) { askFirstChoices(); return; }
    if (!greeted) greet();
    el.input.focus();
  }
  function closePanel() {
    el.panel.hidden = true;
    el.launcher.hidden = false;
    el.launcher.setAttribute("aria-expanded", "false");
    el.launcher.focus();
  }
  function greet() {
    greeted = true;
    addMsg("helper", t("greet"), tlang("greet"));
    if (OFFLINE_ONLY) noteOffline();
  }
  function askFirstChoices() {
    showCard(t("pick_lang"), [h("div", { class: "row" }, [
      btn("አማርኛ", "btn", function () { prefs.lang = "am"; sset("lang", "am"); applyPrefs(); askMode(); }, { lang: "am" }),
      btn("English", "btn", function () { prefs.lang = "en"; sset("lang", "en"); applyPrefs(); askMode(); }, { lang: "en" })
    ])]);
  }
  function askMode() {
    showCard(t("pick_mode"), [h("div", { class: "row" }, [
      btn(t("normal"), "btn", function () { finishChoices("normal"); }),
      btn(t("simple"), "btn", function () { finishChoices("simple"); })
    ])]);
  }
  function finishChoices(m) {
    setMode(m);
    prefs.chosen = true;
    sset("chosen", "1");
    clearCard();
    greet();
    el.input.focus();
  }

  // ───────── Cards (one step of a flow, heading receives focus) ─────────
  function showCard(title, kids) {
    el.flow.innerHTML = "";
    var hd = h("h3", { tabindex: "-1", text: title });
    var card = h("div", { class: "card", role: "region", "aria-label": title }, [hd].concat(kids));
    el.flow.appendChild(card);
    el.body.scrollTop = 0;
    hd.focus();
    return card;
  }
  function clearCard() { el.flow.innerHTML = ""; }

  // ───────── Messages ─────────
  function addMsg(role, text, lang, extras) {
    var who = { learner: t("you"), helper: t("helper_name"), person: t("person"), system: I18N.en.title }[role];
    var m = h("div", { class: "msg " + role, dir: "auto", lang: lang || "en" }, [
      h("span", { class: "who", lang: "en" }, [role === "person" ? h("span", { class: "badge", text: who }) : who]),
      h("span", { class: "txt", text: text })
    ]);
    if (extras && extras.length) m.appendChild(h("div", { class: "extras" }, extras));
    el.log.appendChild(m);
    if (role === "learner" || role === "helper" || role === "person") recent.push(String(text).replace(/\s+/g, " ").slice(0, 140));
    if (recent.length > 6) recent.shift();
    requestAnimationFrame(function () { el.body.scrollTop = el.body.scrollHeight; });
    return m;
  }
  function noteOffline() {
    if (offlineNoticeShown) return;
    offlineNoticeShown = true;
    addMsg("system", t("offline_msg"), tlang("offline_msg"));
  }

  // ───────── Asking ─────────
  var busy = false, showMeMode = false, rateUntil = 0;
  function submit() {
    var text = el.input.value.trim();
    if (!text || busy) return;
    if (Date.now() < rateUntil) return;
    el.input.value = "";
    if (handoff && (handoff.status === "open" || handoff.status === "claimed")) { sendToPerson(text); return; }
    addMsg("learner", text, ETH.test(text) ? "am" : prefs.lang);
    if (showMeMode) {
      showMeMode = false;
      el.input.setAttribute("placeholder", t("ask_placeholder"));
      var act = matchAction(text);
      if (act) { runShowMe(act.id); return; }
    }
    ask(text);
  }
  function ask(text) {
    busy = true;
    announce(t("looking"));
    var sec = currentSection();
    var body = { session_id: sessionId, text: text, lang: prefs.lang, mode: prefs.mode,
      page: { url: location.pathname.slice(0, 500), title: document.title.slice(0, 300), section_anchor: sec && sec.id ? sec.id.slice(0, 100) : null } };
    var p = OFFLINE_ONLY ? Promise.reject(new Error("offline")) :
      ensureSession().catch(function () {}).then(function () { return apiFetch("/v1/chat", { method: "POST", body: body }, 12000); });
    p.then(renderAnswer, function (err) {
      if (err && err.status === 429) { rateLimited(err.message); return; }
      if (err && err.status && !err.network) { addMsg("system", err.message + (err.api && err.api.fix ? " " + err.api.fix : ""), "en"); return; }
      noteOffline();
      return ensureBundles().then(function () { renderAnswer(offlineAnswer(text, prefs.lang)); });
    }).then(function () { busy = false; }, function () { busy = false; });
  }
  function rateLimited(msg) {
    var m = String(msg).match(/(\d+)/), n = m ? parseInt(m[1], 10) : 30;
    rateUntil = Date.now() + n * 1000;
    var node = addMsg("system", t("rate", { n: n }), "en");
    var txt = node.querySelector(".txt");
    el.send.disabled = true;
    var iv = setInterval(function () {
      var left = Math.ceil((rateUntil - Date.now()) / 1000);
      if (left <= 0) { clearInterval(iv); el.send.disabled = false; txt.textContent = t("rate", { n: 0 }); return; }
      txt.textContent = t("rate", { n: left });
    }, 1000);
  }
  function samePage(pageUrl) {
    if (!pageUrl) return false;
    var tail = pageUrl.split("/").slice(-2).join("/");
    return location.pathname.slice(-tail.length) === tail;
  }
  function resolveUrl(u) {
    if (!u) return "#";
    if (/^https?:/.test(u)) return u;
    return API ? API + u : new URL(".." + u, BASE).href;
  }
  function citationNodes(res) {
    var nodes = [];
    (res.citations || []).forEach(function (c) {
      var label = t("from") + " " + c.title;
      if (c.type === "section" && c.anchor && samePage(c.page_url)) {
        nodes.push(h("span", { class: "chip", lang: "en", text: label, style: "text-decoration:none" }));
        nodes.push(btn(t("take_me"), "chip", function () { takeMeThere(c.anchor); }));
      } else if (c.url) {
        nodes.push(h("a", { class: "chip", href: resolveUrl(c.url), lang: "en", text: label }));
      } else {
        nodes.push(h("span", { class: "chip", lang: "en", text: label, style: "text-decoration:none" }));
      }
    });
    (res.course_terms || []).forEach(function (term) {
      if (term && term.en) nodes.push(h("span", { class: "term" }, [h("span", { lang: "en", text: "Course term: " + term.en }), term.am ? h("span", { lang: "am", text: " · " + term.am }) : null]));
    });
    if (res.answered_offline && !res.not_in_course) nodes.push(h("span", { class: "badge", text: t("offline_note") }));
    return nodes;
  }
  function renderAnswer(res) {
    if (res.not_in_course) {
      addMsg("helper", t("not_in_course"), tlang("not_in_course"), [
        btn(t("talk_person"), "chip", function () { startHandoff(); }, { lang: tlang("talk_person") }),
        h("a", { class: "chip", href: el.qJobs.href, text: t("jobs") })
      ]);
      speak(t("not_in_course"), tlang("not_in_course"));
      return;
    }
    if (res.am_unavailable) addMsg("system", t("am_missing"), "en");
    var text = res.answer || "";
    if (prefs.mode === "simple") {
      var steps = text.split(/\n+|(?<=[.!?።])\s+/).map(function (s) { return s.trim(); }).filter(Boolean);
      showSteps(steps, res);
    } else {
      addMsg("helper", text, res.lang || "en", citationNodes(res));
      speak(text, res.lang);
    }
    if (res.action && res.action.id) runShowMe(res.action.id, true);
  }
  function showSteps(steps, res) {
    var i = 0;
    function next() {
      var last = i === steps.length - 1;
      var extras = last ? citationNodes(res) : [btn(t("next"), "btn btn-primary", function (e) { e.currentTarget.remove(); i++; next(); })];
      var m = addMsg("helper", steps[i] || "", res.lang || "en", extras);
      speak(steps[i], res.lang);
      if (!last) { var b = m.querySelector(".btn"); if (b) b.focus(); }
    }
    next();
  }
  function takeMeThere(anchor) {
    var target = document.getElementById(anchor);
    if (!target) return;
    if (!target.hasAttribute("tabindex") && !/^(A|BUTTON|INPUT|SELECT|TEXTAREA)$/.test(target.tagName)) target.setAttribute("tabindex", "-1");
    target.scrollIntoView({ block: "start", behavior: reducedMotion() ? "auto" : "smooth" });
    if (window.innerWidth < 720) closePanelQuiet();
    setTimeout(function () { target.focus({ preventScroll: true }); }, reducedMotion() ? 0 : 300);
  }
  function closePanelQuiet() {
    el.panel.hidden = true;
    el.launcher.hidden = false;
    el.launcher.setAttribute("aria-expanded", "false");
  }
  function reducedMotion() {
    return prefs.motionOff || (window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  }

  // ───────── Show me (guided focus) ─────────
  function startShowMe() {
    showMeMode = true;
    addMsg("helper", t("show_ask"), "en");
    el.input.setAttribute("placeholder", t("show_ask"));
    el.input.focus();
  }
  function matchAction(text) {
    var acts = window.WWM_ACTIONS || [], q = tokens(text), best = null, bestN = 0;
    acts.forEach(function (a) {
      var kws = tokens((a.keywords.en || []).join(" ") + " " + (a.keywords.am || []).join(" ") + " " + (a.label.en || ""));
      var n = q.filter(function (x) { return kws.indexOf(x) >= 0; }).length;
      if (n > bestN) { best = a; bestN = n; }
    });
    return best;
  }
  function findAction(id) { return (window.WWM_ACTIONS || []).filter(function (a) { return a.id === id; })[0]; }
  function actionLabel(a) { return (prefs.lang === "am" && a.label.am) || a.label.en; }
  var ring = null, ringTimer = null, ringTarget = null;
  function clearRing() {
    if (ring) { ring.remove(); ring = null; }
    if (ringTarget) { ringTarget.removeEventListener("blur", clearRing); ringTarget = null; }
    clearTimeout(ringTimer);
    window.removeEventListener("scroll", placeRing, true);
    window.removeEventListener("resize", placeRing);
  }
  function placeRing() {
    if (!ring || !ringTarget) return;
    var r = ringTarget.getBoundingClientRect();
    ring.style.top = (r.top - 8) + "px";
    ring.style.left = (r.left - 8) + "px";
    ring.style.width = (r.width + 16) + "px";
    ring.style.height = (r.height + 16) + "px";
  }
  function runShowMe(id, fromAnswer) {
    ensureBundles().then(function () {
      var a = findAction(id);
      if (!a) { if (!fromAnswer) notFound(); return; }
      if (a.special === "widget_help") {
        el.talkBtn.focus();
        announce(t("found", { x: actionLabel(a) }));
        return;
      }
      var sel = null;
      Object.keys(a.targets || {}).forEach(function (k) {
        if (!sel && (location.pathname.slice(-k.length) === k || (k.slice(-1) === "/" && location.pathname.slice(-k.length) === k))) sel = a.targets[k];
      });
      var target = sel ? document.querySelector(sel) : null;
      if (!target) {
        if (fromAnswer) return; // the answer text already explains it
        if (a.fallback_page) {
          var name = (prefs.lang === "am" && a.fallback_page.name.am) || a.fallback_page.name.en;
          addMsg("helper", t("elsewhere", { x: name }), "en", [h("a", { class: "chip", href: resolveUrl(a.fallback_page.url), text: t("go_there") })]);
        } else notFound();
        return;
      }
      clearRing();
      if (target.tabIndex < 0 && !target.hasAttribute("tabindex")) target.setAttribute("tabindex", "-1");
      target.scrollIntoView({ block: "center", behavior: reducedMotion() ? "auto" : "smooth" });
      if (window.innerWidth < 720) closePanelQuiet();
      ringTarget = target;
      ring = document.createElement("div");
      ring.setAttribute("data-wwm", "ring");
      ring.setAttribute("aria-hidden", "true");
      ring.style.cssText = "position:fixed;z-index:2147482999;pointer-events:none;border:4px solid #0599E5;border-radius:10px;box-shadow:inset 0 0 0 2px #fff,0 0 0 2px #fff;";
      var badge = document.createElement("span");
      badge.textContent = "➜ " + actionLabel(a);
      badge.style.cssText = "position:absolute;bottom:100%;left:-4px;margin-bottom:4px;background:#C8F135;color:#352E72;border:2px solid #352E72;border-radius:999px;padding:2px 10px;font:700 16px/1.4 system-ui,sans-serif;white-space:nowrap;";
      ring.appendChild(badge);
      document.body.appendChild(ring);
      placeRing();
      window.addEventListener("scroll", placeRing, true);
      window.addEventListener("resize", placeRing);
      setTimeout(function () {
        target.focus({ preventScroll: true });
        placeRing();
        target.addEventListener("blur", clearRing);
      }, reducedMotion() ? 0 : 350);
      ringTimer = setTimeout(clearRing, 10000);
      var msg = t("found", { x: actionLabel(a) });
      if (!fromAnswer) addMsg("helper", msg, "en");
      announce(msg);
    });
  }
  function notFound() {
    addMsg("helper", t("not_found"), "en", [btn(t("talk_person"), "chip", function () { startHandoff(); }, { lang: tlang("talk_person") })]);
  }

  // ───────── Voice ─────────
  var SR = window.SpeechRecognition || window.webkitSpeechRecognition, rec = null, listening = false, amVoiceNoticed = sget("amVoiceNotice", "0") === "1";
  function toggleMic() {
    if (!SR) return;
    if (listening && rec) { rec.stop(); return; }
    rec = new SR();
    rec.lang = prefs.lang === "am" ? "am-ET" : "en-US";
    rec.interimResults = false;
    rec.maxAlternatives = 1;
    rec.onresult = function (e) { el.input.value = e.results[0][0].transcript; submit(); };
    rec.onerror = function (e) {
      if (e.error === "not-allowed" || e.error === "service-not-allowed") addMsg("system", t("mic_blocked"), "en");
      else if (e.error === "language-not-supported") addMsg("system", t("mic_lang"), "en");
    };
    rec.onend = function () { listening = false; el.mic.setAttribute("aria-pressed", "false"); el.mic.setAttribute("aria-label", t("mic")); };
    try { rec.start(); listening = true; el.mic.setAttribute("aria-pressed", "true"); el.mic.setAttribute("aria-label", t("mic_stop")); } catch (e) { listening = false; }
  }
  function speak(text, lang) {
    if (!prefs.readAloud || !text || !window.speechSynthesis) return;
    var voices = speechSynthesis.getVoices(), want = lang === "am" ? "am" : "en";
    var v = voices.filter(function (x) { return x.lang && x.lang.toLowerCase().indexOf(want) === 0; })[0];
    if (want === "am" && !v) {
      if (!amVoiceNoticed) { amVoiceNoticed = true; sset("amVoiceNotice", "1"); addMsg("system", t("no_am_voice"), "en"); }
      return;
    }
    try {
      speechSynthesis.cancel();
      var u = new SpeechSynthesisUtterance(text);
      u.lang = want === "am" ? "am-ET" : "en-US";
      if (v) u.voice = v;
      speechSynthesis.speak(u);
    } catch (e) { /* text is always shown */ }
  }
  if (window.speechSynthesis) try { speechSynthesis.getVoices(); } catch (e) { /* warm voice list */ }

  // ───────── Talk to a person ─────────
  var handoff = null;
  function startHandoff(opts) {
    opts = opts || {};
    if (el.panel.hidden) { el.panel.hidden = false; el.launcher.hidden = true; el.launcher.setAttribute("aria-expanded", "true"); }
    if (handoff && (handoff.status === "open" || handoff.status === "claimed")) {
      if (opts.shareOnly) previewPlace({ pref: "chat", existing: true });
      else { addMsg("system", t("talking_person"), "en"); el.input.focus(); }
      return;
    }
    if (OFFLINE_ONLY || !online && !navigator.onLine) { addMsg("system", t("needs_net"), "en"); return; }
    if (opts.shareOnly) { previewPlace({ pref: "chat" }); return; }
    showCard(t("how_help"), [h("div", { class: "row" }, [
      btn(t("chat"), "btn", function () { previewPlace({ pref: "chat" }); }),
      btn(t("voice_cb"), "btn", function () { askPhone("voice_callback"); }),
      btn(t("phone_cb"), "btn", function () { askPhone("phone_callback"); }),
      btn(t("cancel"), "btn-quiet", function () { clearCard(); el.input.focus(); })
    ])]);
  }
  var PHONE_RE = /^(?:\+251|251|0)([79]\d{8})$/;
  function askPhone(pref, value, error) {
    var input = h("input", { type: "tel", id: "wwm-phone", autocomplete: "tel", inputmode: "tel", "aria-describedby": "wwm-phone-hint" + (error ? " wwm-phone-err" : ""), "aria-invalid": error ? "true" : null });
    input.value = value || "";
    var kids = [];
    if (error) kids.push(h("div", { class: "summary", tabindex: "-1", role: "group", "aria-labelledby": "wwm-sum-title" }, [
      h("p", { id: "wwm-sum-title", text: t("err_summary"), style: "font-weight:700;margin:0 0 4px" }),
      h("a", { href: "#", text: t("phone_err"), onclick: function (e) { e.preventDefault(); input.focus(); } })
    ]));
    kids.push(h("label", { for: "wwm-phone", text: t("phone_label") }), h("span", { class: "hint", id: "wwm-phone-hint", text: t("phone_hint") }), input);
    if (error) kids.push(h("span", { class: "err", id: "wwm-phone-err", text: t("phone_err") }));
    function go() {
      var digits = input.value.replace(/[\s\-()]/g, "");
      var m = digits.match(PHONE_RE);
      if (!m) { askPhone(pref, input.value, true); return; }
      previewPlace({ pref: pref, phone: "+251" + m[1] });
    }
    input.addEventListener("keydown", function (e) { if (e.key === "Enter") { e.preventDefault(); go(); } });
    input.addEventListener("blur", function () { if (input.value && !PHONE_RE.test(input.value.replace(/[\s\-()]/g, "")) && !error) { /* validated on Continue */ } });
    kids.push(h("div", { class: "row", style: "margin-top:10px" }, [btn(t("continue"), "btn btn-primary", go), btn(t("cancel"), "btn-quiet", function () { clearCard(); el.input.focus(); })]));
    var card = showCard(t(pref === "voice_callback" ? "voice_cb" : "phone_cb"), kids);
    if (error) card.querySelector(".summary").focus();
  }
  function previewPlace(o) {
    var ta = h("textarea", { id: "wwm-place", dir: "auto", "aria-describedby": "wwm-place-hint", spellcheck: "false" });
    ta.value = placeText();
    var card = showCard(t("place_title"), [
      h("p", { id: "wwm-place-hint", text: t("place_hint") }),
      h("label", { for: "wwm-place", class: "sr", text: t("place_title") }),
      ta,
      h("div", { class: "row", style: "margin-top:10px" }, [
        btn(t("send_person"), "btn btn-primary", function (e) { e.currentTarget.disabled = true; sendHandoff(o, ta.value); }),
        btn(t("change"), "btn", function () { ta.focus(); ta.setSelectionRange(ta.value.length, ta.value.length); }),
        btn(t("cancel"), "btn-quiet", function () { clearCard(); el.input.focus(); })
      ])
    ]);
    return card;
  }
  function sendHandoff(o, text) {
    if (o.existing) {
      apiFetch("/v1/handoff/" + handoff.id + "/messages", { method: "POST", body: { session_id: sessionId, text: text.slice(0, 2000) } })
        .then(function (msg) { clearCard(); gotMessage(msg); addMsg("system", t("place_sent_msg"), "en"); el.input.focus(); }, showError);
      return;
    }
    ensureSession().then(function () {
      return apiFetch("/v1/handoff", { method: "POST", body: { session_id: sessionId, contact_pref: o.pref, place: parsePlace(text), callback_phone: o.phone || null } });
    }).then(function (res) {
      clearCard();
      handoff = { id: res.id, status: res.status, position: res.position, lastId: 0, seen: {}, announced: false, pref: o.pref };
      addMsg("system", o.pref === "chat" ? t("sent_msg") : t("callback_sent"), "en");
      renderHandoffStatus();
      connectHandoff();
      el.input.focus();
    }, function (err) { if (err.network) { clearCard(); addMsg("system", t("needs_net"), "en"); } else showError(err); });
  }
  function showError(err) {
    addMsg("system", (err && err.message ? err.message : t("error")) + (err && err.api && err.api.fix ? " " + err.api.fix : ""), "en");
  }
  function renderHandoffStatus() {
    if (!handoff) return;
    var label = { open: t("waiting"), claimed: t("connected") }[handoff.status] || t("ended");
    if (!el.hstatus) {
      el.hstatus = h("div", { class: "card status-line" });
      el.body.insertBefore(el.hstatus, el.log);
    }
    el.hstatus.innerHTML = "";
    el.hstatus.appendChild(h("span", { class: "badge", text: label }));
    el.hstatus.appendChild(h("span", { text: handoff.status === "open" && handoff.position ? "#" + handoff.position : "" }));
    if (handoff.status === "open" || handoff.status === "claimed") el.hstatus.appendChild(btn(t("end_chat"), "btn", endHandoff));
  }
  function connectHandoff() {
    var h0 = handoff;
    try {
      var ws = new WebSocket(API.replace(/^http/, "ws") + "/v1/handoff/" + encodeURIComponent(h0.id) + "/ws?session_id=" + encodeURIComponent(sessionId));
      h0.ws = ws;
      ws.onmessage = function (e) { var d; try { d = JSON.parse(e.data); } catch (x) { return; } onEvent(d); };
      ws.onclose = function () { h0.ws = null; };
    } catch (e) { h0.ws = null; }
    // REST polling: always on, slower when the socket is open (also refreshes queue position).
    function poll() {
      if (handoff !== h0 || h0.status === "resolved" || h0.status === "abandoned") return;
      apiFetch("/v1/handoff/" + h0.id + "?session_id=" + encodeURIComponent(sessionId) + "&after=" + h0.lastId).then(function (res) {
        (res.messages || []).forEach(gotMessage);
        h0.position = res.position;
        if (res.status !== h0.status) setStatus(res.status);
        else renderHandoffStatus();
        if (res.share_requested && !h0.shareAsked && !sharing) { h0.shareAsked = true; askShare(); }
      }).catch(function () {}).then(function () { h0.pollTimer = setTimeout(poll, h0.ws && h0.ws.readyState === 1 ? 10000 : 3000); });
    }
    h0.pollTimer = setTimeout(poll, 3000);
    h0.busyTimer = setTimeout(function () {
      if (handoff === h0 && h0.status === "open") addMsg("system", t("busy", { n: h0.position || 1 }), "en");
    }, 60000);
  }
  function onEvent(d) {
    if (!handoff) return;
    if (d.type === "message" && d.message) gotMessage(d.message);
    else if (d.type === "status") setStatus(d.status);
    else if (d.type === "share_request") { handoff.shareAsked = true; askShare(); }
    else if (d.type === "typing" && !handoff.typingAnnounced) { handoff.typingAnnounced = true; announce(t("typing")); }
    else if (d.type === "signal") onSignal(d.data);
  }
  function gotMessage(m) {
    if (!handoff || !m || handoff.seen[m.id]) return;
    handoff.seen[m.id] = 1;
    handoff.lastId = Math.max(handoff.lastId, m.id);
    if (m.sender === "learner") return; // already shown when typed
    if (m.sender === "system" && /^Request sent/.test(m.text)) return;
    if (m.sender === "system" && /^Chat ended/.test(m.text)) return; // shown by setStatus
    addMsg(m.sender === "staff" ? "person" : "system", m.text, "en");
  }
  function setStatus(s) {
    if (!handoff || handoff.status === s) return;
    handoff.status = s;
    renderHandoffStatus();
    if (s === "claimed" && !handoff.announced) { handoff.announced = true; announce(t("connected_msg")); addMsg("system", t("connected_msg"), "en"); }
    if (s === "resolved" || s === "abandoned") finishHandoff(s === "resolved");
  }
  function sendToPerson(text) {
    addMsg("learner", text, ETH.test(text) ? "am" : prefs.lang);
    apiFetch("/v1/handoff/" + handoff.id + "/messages", { method: "POST", body: { session_id: sessionId, text: text } })
      .then(gotMessage, showError);
  }
  function endHandoff() {
    if (!handoff) return;
    apiFetch("/v1/handoff/" + handoff.id + "/end", { method: "POST", body: { session_id: sessionId } }).catch(function () {});
    setStatus(handoff.status === "claimed" ? "resolved" : "abandoned");
  }
  function finishHandoff(askHelpful) {
    var h0 = handoff;
    stopSharing(false);
    clearTimeout(h0.pollTimer); clearTimeout(h0.busyTimer);
    if (h0.ws) try { h0.ws.close(); } catch (e) { /* ignore */ }
    if (askHelpful) {
      var node = addMsg("system", t("chat_ended"), "en", [
        btn(t("yes"), "btn", function () { helpful(true); }), btn(t("no"), "btn", function () { helpful(false); })
      ]);
      function helpful(v) {
        apiFetch("/v1/handoff/" + h0.id + "/helpful", { method: "POST", body: { session_id: sessionId, helpful: v } }).catch(function () {});
        var ex = node.querySelector(".extras"); if (ex) ex.remove();
        addMsg("system", t("thanks"), "en");
      }
    }
    if (el.hstatus) { el.hstatus.remove(); el.hstatus = null; }
  }

  // ───────── Sharing (page snapshot, optional screen) ─────────
  var sharing = null; // {kind:'snapshot'|'screen', stream, pc}
  function canScreen() { return !!(navigator.mediaDevices && navigator.mediaDevices.getDisplayMedia && window.RTCPeerConnection); }
  function shareEvent(kind, action) {
    if (!handoff) return;
    apiFetch("/v1/handoff/" + handoff.id + "/share-events", { method: "POST", body: { session_id: sessionId, kind: kind, action: action } }).catch(function () {});
  }
  function askShare() {
    if (el.panel.hidden) { el.panel.hidden = false; el.launcher.hidden = true; el.launcher.setAttribute("aria-expanded", "true"); }
    var row = [btn(t("share_view"), "btn btn-primary", function () { clearCard(); shareEvent("snapshot", "accepted"); startSnapshot(); })];
    if (canScreen()) row.push(btn(t("share_screen"), "btn", function () { clearCard(); shareEvent("screen", "accepted"); startScreen(); }));
    row.push(btn(t("no_thanks"), "btn-quiet", function () { clearCard(); shareEvent("snapshot", "declined"); el.input.focus(); }));
    showCard(t("share_req"), [h("div", { class: "row" }, row)]);
    announce(t("share_req"));
  }
  function showStrip(on, kind) {
    el.shareStrip.hidden = !on;
    el.updateView.hidden = kind !== "snapshot";
    if (on) el.stopShare.focus();
  }
  function startSnapshot() {
    sharing = { kind: "snapshot" };
    shareEvent("snapshot", "started");
    sendSnapshot(false);
    showStrip(true, "snapshot");
    announce(t("sharing_started"));
  }
  function buildSnapshot() {
    var clone = document.body.cloneNode(true);
    clone.querySelectorAll("script,noscript,iframe,object,embed,template,link,meta,base,[data-wwm],#wwm-host,video,audio,canvas").forEach(function (n) { n.remove(); });
    clone.querySelectorAll("input,textarea,select,[contenteditable]").forEach(function (n) {
      var tag = n.tagName;
      if (tag === "INPUT" && /^(button|submit|reset)$/i.test(n.type)) return;
      var mask = document.createElement("span");
      mask.textContent = "[" + (n.getAttribute("aria-label") || n.getAttribute("placeholder") || n.name || "field") + ": •••]";
      mask.setAttribute("style", "display:inline-block;border:2px dashed #352E72;padding:2px 6px");
      n.replaceWith(mask);
    });
    clone.querySelectorAll("img,svg,picture").forEach(function (n) {
      var alt = n.getAttribute("alt") || n.getAttribute("aria-label");
      var s = document.createElement("span");
      s.textContent = alt ? "[Image: " + alt + "]" : "";
      n.replaceWith(s);
    });
    clone.querySelectorAll("*").forEach(function (n) {
      Array.prototype.slice.call(n.attributes).forEach(function (a) {
        if (/^on/i.test(a.name) || a.name === "value" || a.name === "srcdoc" || /^data-(?!wwm)/.test(a.name)) n.removeAttribute(a.name);
        if ((a.name === "href" || a.name === "src" || a.name === "action") && /^\s*javascript:/i.test(a.value)) n.setAttribute(a.name, "#");
      });
    });
    var styles = Array.prototype.map.call(document.querySelectorAll("style"), function (s) { return s.textContent; }).join("\n").replace(/<\/style/gi, "");
    var sec = currentSection();
    var head = "<p style=\"background:#C8F135;color:#352E72;padding:6px;font-weight:700\">Learner page view (read-only). Looking at: " +
      escapeHtml(sec ? sec.textContent.trim() : "top of page") + "</p>";
    var html = "<style>" + styles + "</style>" + head + clone.innerHTML;
    return html.length > 390000 ? html.slice(0, 390000) : html;
  }
  function escapeHtml(s) { return String(s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  function sendSnapshot(isUpdate) {
    if (!handoff || !sharing) return;
    apiFetch("/v1/share/snapshot", { method: "POST", body: { session_id: sessionId, handoff_id: handoff.id, html: buildSnapshot(), title: document.title.slice(0, 300) } }, 15000)
      .then(function () { if (isUpdate) announce(t("update_view") + ": OK"); }, showError);
  }
  function startScreen() {
    navigator.mediaDevices.getDisplayMedia({ video: true, audio: false }).then(function (stream) {
      var pc = new RTCPeerConnection({ iceServers: [{ urls: "stun:stun.l.google.com:19302" }] });
      sharing = { kind: "screen", stream: stream, pc: pc };
      stream.getTracks().forEach(function (tr) { pc.addTrack(tr, stream); tr.addEventListener("ended", function () { stopSharing(true); }); });
      pc.onicecandidate = function (e) { if (e.candidate) signal({ candidate: e.candidate }); };
      return pc.createOffer().then(function (o) { return pc.setLocalDescription(o); }).then(function () {
        signal({ sdp: pc.localDescription });
        shareEvent("screen", "started");
        showStrip(true, "screen");
        announce(t("sharing_started"));
      });
    }).catch(function () { addMsg("system", t("screen_failed"), "en"); shareEvent("screen", "declined"); });
  }
  function signal(data) { if (handoff && handoff.ws && handoff.ws.readyState === 1) handoff.ws.send(JSON.stringify({ type: "signal", data: JSON.parse(JSON.stringify(data)) })); }
  function onSignal(data) {
    if (!sharing || sharing.kind !== "screen" || !data) return;
    if (data.sdp) sharing.pc.setRemoteDescription(data.sdp).catch(function () {});
    else if (data.candidate) sharing.pc.addIceCandidate(data.candidate).catch(function () {});
  }
  function stopSharing(byLearner) {
    if (!sharing) { showStrip(false); return; }
    var kind = sharing.kind;
    if (sharing.stream) sharing.stream.getTracks().forEach(function (tr) { tr.stop(); });
    if (sharing.pc) try { sharing.pc.close(); } catch (e) { /* ignore */ }
    sharing = null;
    shareEvent(kind, "stopped");
    el.shareStrip.hidden = true;
    announce(t("sharing_stopped"));
    if (byLearner) el.input.focus();
  }

  // ───────── Start ─────────
  window.addEventListener("online", function () { online = true; });
  window.addEventListener("offline", function () { online = false; });
  function init() {
    buildUI();
    if (prefs.mode === "simple" && sget("readAloud", null) === null) { prefs.readAloud = true; applyPrefs(); }
    ensureBundles();
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init); else init();
  window.WalkWithMe = { open: openPanel, close: closePanel, showMe: runShowMe, _tokens: tokens, _offlineAnswer: offlineAnswer };
})();
