/* Walk With Me site helpers: display options, copy buttons, form validation, API calls.
   Display settings share localStorage keys and values with the widget:
   wwm.large "1"/"0", wwm.contrast "1"/"0", wwm.motion "off"/"on", wwm.lang "am"/"en". */
(function () {
  "use strict";

  var store = {
    get: function (k) { try { return window.localStorage.getItem(k); } catch (e) { return null; } },
    set: function (k, v) { try { window.localStorage.setItem(k, v); } catch (e) { /* storage blocked: setting lasts for this page */ } }
  };

  var root = document.documentElement;
  function applySettings() {
    var large = store.get("wwm.large"), contrast = store.get("wwm.contrast"), motion = store.get("wwm.motion");
    if (large === "1") root.setAttribute("data-text", "large"); else root.removeAttribute("data-text");
    if (contrast === "1") root.setAttribute("data-contrast", "high"); else root.removeAttribute("data-contrast");
    if (motion === "off") root.setAttribute("data-motion", "off"); else root.removeAttribute("data-motion");
  }
  applySettings();
  /* Another tab changed a setting, or the widget announced a change */
  window.addEventListener("storage", function (e) { if (e.key && e.key.indexOf("wwm.") === 0) applySettings(); });
  window.addEventListener("wwm:settings", applySettings);

  /* Live region for short announcements (copy done, filters changed, etc.) */
  var live;
  function announce(msg) {
    if (!live) {
      live = document.createElement("div");
      live.className = "visually-hidden";
      live.setAttribute("role", "status");
      live.setAttribute("aria-live", "polite");
      document.body.appendChild(live);
    }
    live.textContent = "";
    window.setTimeout(function () { live.textContent = msg; }, 50);
  }

  function buildDisplayOptions() {
    var host = document.querySelector("[data-display-options]");
    if (!host) return;
    var opts = [
      { key: "wwm.large", on: "1", off: "0", label: "Larger text" },
      { key: "wwm.contrast", on: "1", off: "0", label: "High contrast" },
      { key: "wwm.motion", on: "off", off: "on", label: "Stop motion" }
    ];
    var group = document.createElement("div");
    group.className = "wrap";
    group.setAttribute("role", "group");
    group.setAttribute("aria-label", "Display options");
    opts.forEach(function (o) {
      var b = document.createElement("button");
      b.type = "button";
      b.className = "toggle";
      b.textContent = o.label;
      b.setAttribute("aria-pressed", String(store.get(o.key) === o.on));
      b.addEventListener("click", function () {
        var nowOn = b.getAttribute("aria-pressed") !== "true";
        store.set(o.key, nowOn ? o.on : o.off);
        b.setAttribute("aria-pressed", String(nowOn));
        applySettings();
        window.dispatchEvent(new CustomEvent("wwm:settings"));
      });
      group.appendChild(b);
    });
    var lang = document.createElement("button");
    lang.type = "button";
    lang.className = "toggle";
    function langLabel() {
      var am = store.get("wwm.lang") === "am";
      lang.innerHTML = "";
      var span = document.createElement("span");
      span.textContent = "Helper language: ";
      var cur = document.createElement("span");
      cur.textContent = am ? "አማርኛ" : "English";
      cur.lang = am ? "am" : "en";
      lang.appendChild(span);
      lang.appendChild(cur);
      lang.setAttribute("aria-label", "Helper language: " + (am ? "Amharic" : "English") + ". Press to switch to " + (am ? "English" : "Amharic"));
    }
    langLabel();
    lang.addEventListener("click", function () {
      store.set("wwm.lang", store.get("wwm.lang") === "am" ? "en" : "am");
      langLabel();
      window.dispatchEvent(new CustomEvent("wwm:settings"));
      announce("Helper language changed.");
    });
    group.appendChild(lang);
    host.appendChild(group);
  }

  /* Copy buttons: <button data-copy="#id-of-code">Copy</button> */
  function initCopy() {
    document.addEventListener("click", function (e) {
      var b = e.target.closest ? e.target.closest("[data-copy]") : null;
      if (!b) return;
      var src = document.querySelector(b.getAttribute("data-copy"));
      if (!src) return;
      var text = src.value !== undefined && src.tagName !== "PRE" ? src.value : src.textContent;
      copyText(text).then(function () { announce("Copied."); flash(b, "Copied"); },
                          function () { announce("Copy did not work. Select the text and copy it."); });
    });
  }
  function flash(b, msg) {
    var old = b.getAttribute("data-label") || b.textContent;
    b.setAttribute("data-label", old);
    b.textContent = msg;
    window.setTimeout(function () { b.textContent = old; }, 2000);
  }
  function copyText(text) {
    if (navigator.clipboard && window.isSecureContext) return navigator.clipboard.writeText(text);
    return new Promise(function (resolve, reject) {
      var ta = document.createElement("textarea");
      ta.value = text; ta.setAttribute("readonly", ""); ta.style.position = "fixed"; ta.style.opacity = "0";
      document.body.appendChild(ta); ta.select();
      try { document.execCommand("copy") ? resolve() : reject(); } catch (err) { reject(err); }
      document.body.removeChild(ta);
    });
  }

  /* Form validation.
     WWM.validate(form, rules) where rules = { fieldId: function(value, el) { return "message" | null } }.
     Errors go under the field (linked with aria-describedby) and into a summary that gets focus. Input is never cleared. */
  function fieldWrap(el) { return el.closest(".field") || el.parentNode; }
  function setError(el, msg) {
    var wrap = fieldWrap(el);
    var id = (el.id || el.name) + "-error";
    var err = document.getElementById(id);
    var described = (el.getAttribute("aria-describedby") || "").split(" ").filter(function (x) { return x && x !== id; });
    if (msg) {
      if (!err) {
        err = document.createElement("p");
        err.id = id;
        err.className = "error-text";
        wrap.appendChild(err);
      }
      err.textContent = "Problem: " + msg;
      described.push(id);
      el.setAttribute("aria-invalid", "true");
      wrap.classList.add("has-error");
    } else {
      if (err) err.remove();
      el.removeAttribute("aria-invalid");
      wrap.classList.remove("has-error");
    }
    if (described.length) el.setAttribute("aria-describedby", described.join(" ")); else el.removeAttribute("aria-describedby");
  }
  function summary(form, problems) {
    var box = form.querySelector(".error-summary");
    if (!problems.length) { if (box) box.remove(); return; }
    if (!box) {
      box = document.createElement("div");
      box.className = "error-summary";
      box.setAttribute("tabindex", "-1");
      box.setAttribute("role", "alert");
      form.insertBefore(box, form.firstChild);
    }
    box.innerHTML = "";
    var h = document.createElement("h2");
    h.textContent = problems.length === 1 ? "There is 1 problem" : "There are " + problems.length + " problems";
    box.appendChild(h);
    var ul = document.createElement("ul");
    problems.forEach(function (p) {
      var li = document.createElement("li");
      var a = document.createElement("a");
      a.href = "#" + p.el.id;
      a.textContent = p.msg;
      a.addEventListener("click", function (e) { e.preventDefault(); p.el.focus(); });
      li.appendChild(a);
      ul.appendChild(li);
    });
    box.appendChild(ul);
    box.focus();
  }
  function validate(form, rules) {
    var problems = [];
    Object.keys(rules).forEach(function (id) {
      var el = document.getElementById(id);
      if (!el || el.closest("[hidden]")) return;
      var msg = rules[id](el.value.trim(), el);
      setError(el, msg);
      if (msg) problems.push({ el: el, msg: msg });
    });
    summary(form, problems);
    return problems.length === 0;
  }
  function bindBlur(rules) {
    Object.keys(rules).forEach(function (id) {
      var el = document.getElementById(id);
      if (!el) return;
      el.addEventListener("blur", function () {
        if (el.value.trim() === "" && !el.hasAttribute("aria-invalid")) return; /* do not nag on first pass */
        setError(el, rules[id](el.value.trim(), el));
      });
    });
  }

  /* API: same origin. Errors come as {"error":{"code","message","fix"}}. */
  function api(path, opts) {
    opts = opts || {};
    var headers = opts.headers || {};
    if (opts.body && typeof opts.body !== "string") { headers["Content-Type"] = "application/json"; opts.body = JSON.stringify(opts.body); }
    opts.headers = headers;
    return fetch(path, opts).then(function (r) {
      var ct = r.headers.get("content-type") || "";
      var p = ct.indexOf("application/json") >= 0 ? r.json() : r.text();
      return p.then(function (data) {
        if (!r.ok) {
          var e = (data && data.error) || { code: "http_" + r.status, message: "The server could not do that.", fix: "Try again in a minute." };
          var err = new Error(e.message); err.api = e; err.status = r.status; throw err;
        }
        return data;
      });
    }, function () {
      var err = new Error("No connection to the server.");
      err.api = { code: "network", message: "No connection to the server.", fix: "Check your internet connection and try again." };
      throw err;
    });
  }
  function showError(box, err) {
    var e = (err && err.api) || { message: String(err && err.message || err), fix: "" };
    box.textContent = "";
    var p1 = document.createElement("p"); p1.textContent = "Problem: " + e.message; p1.style.fontWeight = "700";
    box.appendChild(p1);
    if (e.fix) { var p2 = document.createElement("p"); p2.textContent = e.fix; box.appendChild(p2); }
  }

  function phoneOk(v) {
    var d = v.replace(/[\s\-()]/g, "");
    return /^(?:\+251|251|0)[79]\d{8}$/.test(d);
  }

  window.WWM = { store: store, announce: announce, validate: validate, bindBlur: bindBlur, setError: setError,
                 api: api, showError: showError, copyText: copyText, phoneOk: phoneOk,
                 phoneFix: "Use a number like 0911 234567, 0711 234567 or +251 911 234567." };

  document.addEventListener("DOMContentLoaded", function () { buildDisplayOptions(); initCopy(); });
})();
