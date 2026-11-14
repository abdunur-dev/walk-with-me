/* Savanna demo stand-in behaviour. Replace with the real Savanna starter scripts. */
(function () {
  function toggle(btnId, targetId) {
    var b = document.getElementById(btnId), t = document.getElementById(targetId);
    if (!b || !t) return;
    b.addEventListener("click", function () {
      var open = t.hidden;
      t.hidden = !open;
      b.setAttribute("aria-expanded", String(open));
    });
  }
  toggle("sidebar-toggle", "sidebar");
  toggle("courses-dropdown", "courses-list");

  document.addEventListener("keydown", function (e) {
    if (e.key !== "Escape") return;
    var list = document.getElementById("courses-list");
    if (list && !list.hidden) { list.hidden = true; var b = document.getElementById("courses-dropdown"); b.setAttribute("aria-expanded", "false"); b.focus(); }
  });

  function dialog(btnId, dlgId) {
    var b = document.getElementById(btnId), d = document.getElementById(dlgId);
    if (!b || !d) return;
    b.addEventListener("click", function () { d.showModal(); });
    d.querySelectorAll("[data-close]").forEach(function (c) { c.addEventListener("click", function () { d.close(); b.focus(); }); });
  }
  dialog("score-details", "score-dialog");
  dialog("programme-details", "programme-dialog");

  var strip = document.getElementById("week-strip");
  if (strip) {
    strip.addEventListener("click", function (e) {
      var btn = e.target.closest("button");
      if (!btn) return;
      strip.querySelectorAll("button").forEach(function (x) { x.removeAttribute("aria-current"); });
      btn.setAttribute("aria-current", "true");
      var out = document.getElementById("week-title");
      if (out) out.textContent = "Week " + btn.textContent.trim() + " work";
    });
  }

  var mc = document.getElementById("mark-complete");
  if (mc) {
    mc.addEventListener("click", function () {
      var done = mc.getAttribute("aria-pressed") !== "true";
      mc.setAttribute("aria-pressed", String(done));
      mc.textContent = done ? "Completed" : "Mark as complete";
      document.getElementById("complete-status").textContent = done ? "Lesson marked as complete. Progress saved." : "Lesson marked as not complete.";
    });
  }
})();
