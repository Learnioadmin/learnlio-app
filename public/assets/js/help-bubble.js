/* Support Bubble v2 - guided help + safe actions + search fallback */
/* Learnlio Help Bubble (retrieval-first). Additive, safe, no layout impact. */

(() => {
  "use strict";

  const LS_OPEN = "learnlio_help_open";
  const LS_LASTQ = "learnlio_help_lastq";
  const LS_INDEX = "learnlio_help_index_cache_v1";
  const LS_INDEX_AT = "learnlio_help_index_cache_at_v1";

  const dayMs = 24 * 60 * 60 * 1000;

  const DEBUG = new URLSearchParams(location.search).has("debug");
  function debugLog(...args){ if (DEBUG) console.log("[HelpBubble]", ...args); }

  function safeText(v, fallback = "") {
    if (v === null || v === undefined) return fallback;
    return String(v);
  }

  function escHtml(str) {
    return safeText(str).replace(/[&<>"']/g, (s) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#039;"
    }[s]));
  }

  function prefersReducedMotion() {
    try { return window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches; }
    catch { return false; }
  }

  function injectStyles() {
    const css = `
/* Learnlio Help Bubble (isolated) */
#ll-help-bubble{ position:fixed; right:16px; bottom:16px; z-index:9999; font-family:system-ui,-apple-system,Segoe UI,Roboto,Arial,sans-serif; }
#ll-help-bubble *{ box-sizing:border-box; }
.llhb-btn{
  display:inline-flex; align-items:center; gap:8px;
  border:1px solid rgba(232,234,242,.9);
  background:#fff;
  color:#0b1220;
  padding:10px 12px;
  border-radius:999px;
  box-shadow:0 12px 28px rgba(12,18,32,.14);
  cursor:pointer;
  font-weight:800;
  font-size:13px;
}
.llhb-dot{
  width:10px; height:10px; border-radius:999px;
  background: rgba(11,92,255,.9);
  box-shadow:0 0 0 4px rgba(11,92,255,.12);
}
.llhb-panel{
  width:min(360px, calc(100vw - 32px));
  margin-bottom:10px;
  border-radius:16px;
  border:1px solid rgba(232,234,242,.9);
  background:#fff;
  box-shadow:0 18px 44px rgba(12,18,32,.18);
  overflow:hidden;
}
.llhb-hd{
  display:flex; align-items:center; justify-content:space-between; gap:10px;
  padding:12px 12px;
  background: radial-gradient(520px 200px at 0% 0%, rgba(11,92,255,.10), transparent 60%), #fbfcff;
  border-bottom:1px solid rgba(232,234,242,.9);
}
.llhb-title{ font-weight:900; letter-spacing:-.2px; font-size:13px; color:#0b1220; }
.llhb-close{
  border:1px solid rgba(221,227,239,.9);
  background:#fff;
  border-radius:12px;
  padding:6px 8px;
  cursor:pointer;
  font-weight:900;
}
.llhb-bd{ padding:12px; display:grid; gap:10px; }
.llhb-muted{ color:#5b6475; font-size:12.5px; line-height:1.5; }
.llhb-grid{ display:grid; grid-template-columns:1fr; gap:8px; }
.llhb-qa{ display:flex; flex-wrap:wrap; gap:8px; }
.llhb-chip{
  border:1px solid rgba(11,92,255,.16);
  background: rgba(11,92,255,.08);
  color:#0b5cff;
  padding:8px 10px;
  border-radius:999px;
  cursor:pointer;
  font-weight:900;
  font-size:12px;
}
.llhb-input{
  width:100%;
  border:1px solid rgba(221,227,239,.95);
  border-radius:14px;
  padding:10px 12px;
  font-weight:800;
  font-size:13px;
  outline:none;
}
.llhb-input:focus{ box-shadow:0 0 0 4px rgba(11,92,255,.12); border-color: rgba(11,92,255,.35); }
.llhb-results{ display:grid; gap:8px; }
.llhb-item{
  border:1px solid rgba(232,234,242,.9);
  background:#fff;
  border-radius:14px;
  padding:10px 10px;
}
.llhb-item a{ text-decoration:none; color:#0b1220; font-weight:900; font-size:13px; }
.llhb-item p{ margin:6px 0 0; color:#5b6475; font-size:12.5px; line-height:1.45; }
.llhb-actions{ display:flex; gap:8px; flex-wrap:wrap; align-items:center; }
.llhb-link{
  text-decoration:none;
  border:1px solid rgba(221,227,239,.95);
  background:#fff;
  color:#0b1220;
  padding:8px 10px;
  border-radius:12px;
  font-weight:900;
  font-size:12px;
}
.llhb-primary{
  border:1px solid rgba(11,92,255,.35);
  background: linear-gradient(180deg, #0b5cff, #0846d8);
  color:#fff;
}
.llhb-answer{
  border:1px solid rgba(232,234,242,.9);
  background:#fbfcff;
  border-radius:14px;
  padding:10px;
  color:#0b1220;
  font-size:13px;
  line-height:1.55;
  white-space:pre-wrap;
}
.llhb-hide{ display:none !important; }
.llhb-fadein{ animation: llhbIn .16s ease-out; }
@keyframes llhbIn{ from{ transform: translateY(6px); opacity:.0; } to{ transform: translateY(0); opacity:1; } }
@media (prefers-reduced-motion: reduce){
  .llhb-fadein{ animation:none; }
}
    `.trim();

    const style = document.createElement("style");
    style.id = "ll-help-bubble-style";
    style.textContent = css;
    document.head.appendChild(style);
  }

  function getPageContext() {
    const h1 = document.querySelector("h1");
    return {
      path: location.pathname,
      title: document.title || "",
      h1: h1 ? safeText(h1.textContent).trim() : ""
    };
  }

  function loadCachedIndex() {
    try {
      const at = Number(localStorage.getItem(LS_INDEX_AT) || "0");
      if (!at || (Date.now() - at) > dayMs) return null;
      const raw = localStorage.getItem(LS_INDEX);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return null;
      return parsed;
    } catch {
      return null;
    }
  }

  function cacheIndex(arr) {
    try {
      localStorage.setItem(LS_INDEX, JSON.stringify(arr));
      localStorage.setItem(LS_INDEX_AT, String(Date.now()));
    } catch {}
  }

  function normalizeIndex(arr) {
    return arr
      .filter(Boolean)
      .map(x => ({
        title: safeText(x.title).trim(),
        url: safeText(x.url).trim(),
        text: safeText(x.text || x.excerpt || x.summary).trim(),
        tags: Array.isArray(x.tags) ? x.tags.map(t => safeText(t).toLowerCase()) : [],
        excerpt: safeText(x.excerpt || "").trim(),
        steps: Array.isArray(x.steps) ? x.steps : []
      }))
      .filter(x => x.title && x.url);
  }

  function scoreItem(item, q) {
    const query = q.toLowerCase().trim();
    if (!query) return 0;
    const title = item.title.toLowerCase();
    const text = (item.text || "").toLowerCase();
    const tags = (item.tags || []).join(" ");
    let s = 0;
    if (title.includes(query)) s += 6;
    if (tags.includes(query)) s += 3;
    if (text.includes(query)) s += 2;

    const parts = query.split(/\s+/).filter(Boolean);
    parts.forEach(p => {
      if (title.includes(p)) s += 2;
      if (tags.includes(p)) s += 1;
      if (text.includes(p)) s += 1;
    });
    return s;
  }

  function snippet(text, q) {
    const t = safeText(text);
    if (!t) return "";
    const max = 140;
    const query = q.toLowerCase().trim();
    if (!query || t.length <= max) return t.slice(0, max);
    const idx = t.toLowerCase().indexOf(query);
    if (idx < 0) return t.slice(0, max);
    const start = Math.max(0, idx - 40);
    const end = Math.min(t.length, start + max);
    const cut = t.slice(start, end);
    return (start > 0 ? "" : "") + cut + (end < t.length ? "" : "");
  }

  async function fetchHelpIndex(url) {
    try {
      const cached = loadCachedIndex();
      if (cached) return cached;

      const res = await fetch(url, { credentials: "same-origin" });
      if (!res.ok) throw new Error("index fetch failed");
      const data = await res.json();
      const norm = normalizeIndex(data);
      cacheIndex(norm);
      return norm;
    } catch {
      return null;
    }
  }

  function buildUI() {
    const mount = document.createElement("div");
    mount.id = "ll-help-bubble";
    mount.innerHTML = `
      <div id="llhb-panel" class="llhb-panel llhb-hide" role="dialog" aria-label="Help">
        <div class="llhb-hd">
          <div>
            <div class="llhb-title">Need help?</div>
            <div class="llhb-muted" id="llhb-sub">Quick answers from the Help Centre.</div>
          </div>
          <button class="llhb-close" id="llhb-close" type="button" aria-label="Close"></button>
        </div>
        <div class="llhb-bd">
          <div>
            <div class="llhb-muted" style="font-weight:900; margin-bottom:6px;">Quick help</div>
            <div class="llhb-qa" id="llhb-quick" aria-label="Quick help"></div>
            <div id="llhb-quick-answer" class="llhb-answer llhb-hide"></div>
            <div class="llhb-actions" id="llhb-quick-actions"></div>
            <button id="llhb-troubleshoot" class="llhb-link" type="button" style="margin-top:8px;">Troubleshoot</button>
          </div>

          <div class="llhb-grid">
            <input id="llhb-input" class="llhb-input" type="search" placeholder="Search Help Centre" aria-label="Search Help Centre" />
            <div class="llhb-muted" id="llhb-hint">Tip: try weekly report, login, or 5-minute plan.</div>
          </div>

          <div id="llhb-best" class="llhb-answer llhb-hide"></div>
          <div id="llhb-results" class="llhb-results" aria-live="polite"></div>

          <div class="llhb-actions">
            <a class="llhb-link" href="/help/">Open Help Centre</a>
            <a class="llhb-link" href="/contact.html">Contact support</a>
          </div>

          <details id="llhb-diag" class="llhb-item">
            <summary style="cursor:pointer; font-weight:900;">Diagnostics</summary>
            <div id="llhb-diag-body" class="llhb-muted" style="margin-top:6px;"></div>
          </details>
        </div>
      </div>

      <button id="llhb-toggle" class="llhb-btn" type="button" aria-expanded="false" aria-controls="llhb-panel">
        <span class="llhb-dot" aria-hidden="true"></span>
        <span>Need help?</span>
      </button>
    `.trim();
    document.body.appendChild(mount);
    return mount;
  }

  function renderFallback(resultsEl) {
    resultsEl.innerHTML = `
      <div class="llhb-item">
        <a href="/help/">Browse the Help Centre</a>
        <p>Find quick guides and answers. If youre stuck, contact us and well help.</p>
      </div>
      <div class="llhb-item">
        <a href="/help/">Trouble logging in</a>
        <p>If login loops or a page wont load, try refreshing, then logging out and back in.</p>
      </div>
      <div class="llhb-item">
        <a href="/help/">Parent Insight & weekly summary</a>
        <p>Weekly insight is a snapshot of recent learning. You can also download a PDF report.</p>
      </div>
    `.trim();
  }

  function renderResults(resultsEl, items, q) {
    if (!items || !items.length) {
      resultsEl.innerHTML = `
        <div class="llhb-item">
          <a href="/help/">No matches found</a>
          <p>Try a different search (e.g. weekly report, 5-minute plan, lessons).</p>
        </div>
      `.trim();
      return;
    }

    resultsEl.innerHTML = items.slice(0, 5).map(it => `
      <div class="llhb-item">
        <a href="${escHtml(it.url)}">${escHtml(it.title)}</a>
        <p>${escHtml(snippet(it.text, q))}</p>
      </div>
    `).join("");
  }

  function renderBestAnswer(bestEl, item, q) {
    if (!item) { bestEl.classList.add("llhb-hide"); bestEl.textContent = ""; return; }
    const excerpt = item.excerpt || snippet(item.text, q);
    const steps = Array.isArray(item.steps) ? item.steps.slice(0, 4) : [];
    bestEl.innerHTML = `
      <div style="font-weight:900; margin-bottom:6px;">Best answer: ${escHtml(item.title)}</div>
      <div class="llhb-muted">${escHtml(excerpt || "")}</div>
      ${steps.length ? `<ul style="margin:8px 0 0; padding-left:18px;">${steps.map(s => `<li>${escHtml(String(s))}</li>`).join("")}</ul>` : ""}
      <div style="margin-top:6px;"><a class="llhb-link" href="${escHtml(item.url)}">Open article</a></div>
    `;
    bestEl.classList.remove("llhb-hide");
  }

  function mapQuickHelp(path) {
    const p = path.toLowerCase();
    if (p.includes("reports")) return [
      "Weekly report wont save",
      "Run weekly snapshot now",
      "PDF wont download",
      "Refresh this page"
    ];
    if (p.includes("chat")) return [
      "Start a 5-minute plan",
      "Tutor asking me to choose an area",
      "Sound/voice isnt working",
      "Refresh Tutor"
    ];
    if (p.includes("lessons")) return [
      "Find the right lesson",
      "Lesson wont load",
      "Refresh Lessons"
    ];
    if (p.includes("billing")) return [
      "Payment didnt unlock",
      "Open billing portal",
      "Refresh billing status"
    ];
    if (p.includes("login")) return [
      "I cant log in",
      "Reset password",
      "Email not received"
    ];
    return [
      "Account & login",
      "Tutor & lessons",
      "Reports",
      "Billing"
    ];
  }

  function quickHelpAnswer(label) {
    const answers = {
      "Weekly report wont save": {
        steps: ["Check your connection.", "Try Run weekly report now.", "Refresh the page and try again.", "If it persists, contact support."],
        links: ["/help/category-parents-reports.html", "/help/category-troubleshooting.html"],
        actions: ["runWeekly", "refresh"]
      },
      "Run weekly snapshot now": {
        steps: ["Click Run weekly report now.", "Wait for the success message.", "Use the list below to download.", "If it fails, refresh and try again."],
        links: ["/help/category-parents-reports.html", "/help/"],
        actions: ["runWeekly"]
      },
      "PDF wont download": {
        steps: ["Try Chrome or Edge.", "Open the latest weekly snapshot.", "Use Download again.", "If it still fails, contact support."],
        links: ["/help/category-parents-reports.html", "/help/category-troubleshooting.html"],
        actions: ["refresh"]
      },
      "Refresh this page": {
        steps: ["Refresh often fixes loading issues.", "Your data is safe.", "If it keeps happening, contact support.", "Try a different browser."],
        links: ["/help/category-troubleshooting.html", "/help/"],
        actions: ["refresh"]
      },
      "Start a 5-minute plan": {
        steps: ["Open Tutor from this page.", "Pick one area only.", "Keep it short and calm.", "Finish on an easy win."],
        links: ["/help/category-lessons-tutor.html", "/help/"],
        actions: ["openTutor"]
      },
      "Tutor asking me to choose an area": {
        steps: ["Pick one area to start.", "If it keeps looping, reset Tutor focus.", "Refresh Tutor and try again.", "Contact support if stuck."],
        links: ["/help/category-lessons-tutor.html", "/help/category-troubleshooting.html"],
        actions: ["resetTutor", "refresh"]
      },
      "Sound/voice isnt working": {
        steps: ["Check device volume.", "Try the Listen button again.", "Allow audio in the browser.", "Refresh Tutor and retry."],
        links: ["/help/category-troubleshooting.html", "/help/"],
        actions: ["refresh"]
      },
      "Refresh Tutor": {
        steps: ["Refreshing can fix stuck sessions.", "Your XP is saved.", "Try again after refresh.", "Contact support if needed."],
        links: ["/help/category-troubleshooting.html", "/help/"],
        actions: ["refresh"]
      },
      "Find the right lesson": {
        steps: ["Start with a short lesson.", "Pick the closest area.", "Keep sessions calm.", "You can change later."],
        links: ["/help/category-lessons-tutor.html", "/help/"],
        actions: ["openLessons"]
      },
      "Lesson wont load": {
        steps: ["Refresh the page.", "Try a different lesson.", "Check your connection.", "Contact support if it persists."],
        links: ["/help/category-troubleshooting.html", "/help/category-lessons-tutor.html"],
        actions: ["refresh"]
      },
      "Refresh Lessons": {
        steps: ["Refresh the page.", "Try again after reload.", "If it repeats, contact support.", "You can also switch to Tutor."],
        links: ["/help/category-lessons-tutor.html", "/help/"],
        actions: ["refresh", "openTutor"]
      },
      "Payment didnt unlock": {
        steps: ["Open billing to refresh status.", "Check your email receipt.", "Log out and back in.", "Contact support if still locked."],
        links: ["/help/category-billing.html", "/help/category-troubleshooting.html"],
        actions: ["billingPortal", "refresh"]
      },
      "Open billing portal": {
        steps: ["Use Manage subscription on Billing.", "Update payment method if needed.", "Return here after changes.", "Contact support if stuck."],
        links: ["/help/category-billing.html", "/help/"],
        actions: ["billingPortal"]
      },
      "Refresh billing status": {
        steps: ["Open Billing and refresh.", "If needed, log out and back in.", "Try again after a minute.", "Contact support if it persists."],
        links: ["/help/category-billing.html", "/help/category-troubleshooting.html"],
        actions: ["refresh"]
      },
      "I cant log in": {
        steps: ["Check email/password.", "Try Reset password.", "Check spam for emails.", "Contact support if needed."],
        links: ["/help/category-troubleshooting.html", "/help/"],
        actions: ["openHelp"]
      },
      "Reset password": {
        steps: ["Use the reset link on the login page.", "Check spam for the email.", "Try again after a few minutes.", "Contact support if it fails."],
        links: ["/help/category-troubleshooting.html", "/help/"],
        actions: ["openHelp"]
      },
      "Email not received": {
        steps: ["Check spam or promotions.", "Wait a few minutes.", "Try resend on the login page.", "Contact support if needed."],
        links: ["/help/category-troubleshooting.html", "/help/"],
        actions: ["openHelp"]
      }
    };
    return answers[label] || {
      steps: ["Open the Help Centre.", "Search for your topic.", "Try the suggested steps.", "Contact support if needed."],
      links: ["/help/", "/help/category-troubleshooting.html"],
      actions: ["openHelp"]
    };
  }

  function buildActionHandlers(statusEl) {
    function setStatus(msg){ if (statusEl) statusEl.textContent = msg || ""; }

    return {
      refresh: () => { try { location.reload(); } catch { setStatus("Couldnt do that here - try Refresh."); } },
      runWeekly: () => {
        try {
          if (typeof window.runWeeklySnapshot === "function") { window.runWeeklySnapshot(); setStatus("Done"); return; }
          const btn = document.getElementById("runWeeklyBtn");
          if (btn) { btn.click(); setStatus("Done"); return; }
          setStatus("Couldnt do that here - try Refresh.");
        } catch { setStatus("Couldnt do that here - try Refresh."); }
      },
      refreshBtn: () => {
        try {
          const btn = document.getElementById("refreshBtn");
          if (btn) { btn.click(); setStatus("Done"); return; }
          if (typeof window.loadEverything === "function") { window.loadEverything(); setStatus("Done"); return; }
          location.reload();
        } catch { setStatus("Couldnt do that here - try Refresh."); }
      },
      clearChild: () => {
        try { localStorage.removeItem("selectedChild"); setStatus("Done"); location.reload(); } catch { setStatus("Couldnt do that here - try Refresh."); }
      },
      resetTutor: () => {
        try {
          const child = JSON.parse(localStorage.getItem("selectedChild") || "null");
          if (child?.id){
            localStorage.removeItem(`learnlio_last_ctx_${child.id}`);
          } else {
            Object.keys(localStorage).forEach(k => { if (k.startsWith("learnlio_last_ctx_")) localStorage.removeItem(k); });
          }
          setStatus("Done");
        } catch { setStatus("Couldnt do that here - try Refresh."); }
      },
      openTutor: () => { try { window.location.href = "/chat.html"; } catch {} },
      openLessons: () => { try { window.location.href = "/lessons.html"; } catch {} },
      billingPortal: () => { try { window.location.href = "/billing.html"; } catch {} },
      openHelp: () => { try { window.open("/help/", "_blank", "noopener"); } catch {} }
    };
  }

  function buildTroubleshooter(root, setView) {
    const wrap = document.createElement("div");
    wrap.className = "llhb-item";
    wrap.innerHTML = `
      <div style="font-weight:900;">Troubleshooter</div>
      <div id="llhb-ts" class="llhb-muted" style="margin-top:6px;"></div>
    `;
    const body = wrap.querySelector("#llhb-ts");

    const steps = {
      login: ["Check your email and password.", "Try reset password.", "Check spam for the email."],
      tutor: ["Refresh Tutor.", "Reset Tutor focus if stuck.", "Try a short lesson instead."],
      reports: ["Run weekly snapshot.", "Refresh the page.", "Try again in a few minutes."],
      billing: ["Open billing and refresh.", "Check for confirmation email.", "Contact support if still locked."],
      other: ["Refresh the page.", "Try a different browser.", "Contact support if needed."]
    };

    function renderStep1() {
      body.innerHTML = `
        <div>Whats happening?</div>
        <div class="llhb-qa" style="margin-top:6px;">
          <button class="llhb-chip" data-ts="login" type="button">Login</button>
          <button class="llhb-chip" data-ts="tutor" type="button">Tutor</button>
          <button class="llhb-chip" data-ts="reports" type="button">Reports</button>
          <button class="llhb-chip" data-ts="billing" type="button">Billing</button>
          <button class="llhb-chip" data-ts="other" type="button">Other</button>
        </div>
      `;
      body.querySelectorAll(".llhb-chip").forEach(btn => {
        btn.addEventListener("click", () => renderStep2(btn.getAttribute("data-ts")));
      });
    }

    function renderStep2(key) {
      const items = steps[key] || steps.other;
      body.innerHTML = `
        <div style="font-weight:900;">Try these</div>
        <ul style="margin:6px 0 0; padding-left:18px;">${items.map(s => `<li>${escHtml(s)}</li>`).join("")}</ul>
        <div style="margin-top:6px;"><button class="llhb-link" id="llhb-ts-next" type="button">Still stuck</button></div>
      `;
      body.querySelector("#llhb-ts-next").addEventListener("click", renderStep3);
    }

    function renderStep3() {
      body.innerHTML = `
        <div>Still stuck?</div>
        <div class="llhb-actions" style="margin-top:6px;">
          <a class="llhb-link" href="/help/">Open Help Centre</a>
          <a class="llhb-link" href="/contact.html">Contact support</a>
        </div>
      `;
    }

    renderStep1();
    return wrap;
  }

  async function init() {
    try {
      injectStyles();

      const cfg = window.LEARNLIO_SUPPORT_CONFIG || {};
      const helpIndexUrl = safeText(cfg.helpIndexUrl, "/help/search-index.json");

      const page = getPageContext();
      const root = buildUI();

      const panel = root.querySelector("#llhb-panel");
      const toggle = root.querySelector("#llhb-toggle");
      const closeBtn = root.querySelector("#llhb-close");
      const input = root.querySelector("#llhb-input");
      const resultsEl = root.querySelector("#llhb-results");
      const bestEl = root.querySelector("#llhb-best");
      const quickWrap = root.querySelector("#llhb-quick");
      const quickAnswer = root.querySelector("#llhb-quick-answer");
      const quickActions = root.querySelector("#llhb-quick-actions");
      const troubleshootBtn = root.querySelector("#llhb-troubleshoot");
      const diagBody = root.querySelector("#llhb-diag-body");

      let index = null;
      let indexUnavailable = false;

      function setOpen(open) {
        panel.classList.toggle("llhb-hide", !open);
        if (open) panel.classList.add("llhb-fadein");
        toggle.setAttribute("aria-expanded", open ? "true" : "false");
        try { localStorage.setItem(LS_OPEN, open ? "1" : "0"); } catch {}
        if (open) {
          setTimeout(() => { try { input.focus(); } catch {} }, 0);
        } else {
          quickAnswer.classList.add("llhb-hide");
        }
      }

      function isOpen() {
        return !panel.classList.contains("llhb-hide");
      }

      function close() { setOpen(false); }
      function open() { setOpen(true); }

      toggle.addEventListener("click", () => { isOpen() ? close() : open(); });
      closeBtn.addEventListener("click", close);

      document.addEventListener("keydown", (e) => {
        if (e.key === "Escape" && isOpen()) close();
      });

      document.addEventListener("click", (e) => {
        if (!isOpen()) return;
        const t = e.target;
        if (!t) return;
        if (root.contains(t)) return;
        close();
      });

      try {
        const openState = localStorage.getItem(LS_OPEN);
        const lastQ = localStorage.getItem(LS_LASTQ);
        if (lastQ) input.value = lastQ;
        if (openState === "1") open();
      } catch {}

      async function ensureIndex() {
        if (index || indexUnavailable) return;
        index = await fetchHelpIndex(helpIndexUrl);
        if (!index) indexUnavailable = true;
      }

      async function runSearch(q) {
        const query = safeText(q).trim();
        try { localStorage.setItem(LS_LASTQ, query); } catch {}

        if (!query) {
          bestEl.classList.add("llhb-hide");
          if (indexUnavailable) renderFallback(resultsEl);
          else {
            await ensureIndex();
            if (indexUnavailable) renderFallback(resultsEl);
            else renderFallback(resultsEl);
          }
          return;
        }

        await ensureIndex();
        if (indexUnavailable || !index) {
          renderFallback(resultsEl);
          bestEl.classList.add("llhb-hide");
          return;
        }

        const scored = index
          .map(it => ({ it, s: scoreItem(it, query) }))
          .filter(x => x.s > 0)
          .sort((a, b) => b.s - a.s)
          .map(x => x.it);

        renderResults(resultsEl, scored, query);
        renderBestAnswer(bestEl, scored[0], query);
      }

      // quick help buttons
      const quickItems = mapQuickHelp(page.path);
      quickWrap.innerHTML = quickItems.map(x => `<button class="llhb-chip" data-q="${escHtml(x)}" type="button">${escHtml(x)}</button>`).join("");

      const actionHandlers = buildActionHandlers(quickAnswer);

      quickWrap.querySelectorAll(".llhb-chip").forEach(btn => {
        btn.addEventListener("click", () => {
          const label = btn.getAttribute("data-q");
          const ans = quickHelpAnswer(label);
          quickAnswer.classList.remove("llhb-hide");
          quickAnswer.innerHTML = `
            <div style="font-weight:900; margin-bottom:6px;">${escHtml(label)}</div>
            <ul style="margin:0; padding-left:18px;">${ans.steps.map(s => `<li>${escHtml(String(s))}</li>`).join("")}</ul>
            <div style="margin-top:6px;">${ans.links.map(l => `<a class="llhb-link" href="${escHtml(l)}">Open Help Centre</a>`).join(" ")}</div>
          `;
          quickActions.innerHTML = "";
          (ans.actions || []).forEach(a => {
            const b = document.createElement("button");
            b.type = "button";
            b.className = "llhb-link";
            b.textContent = a === "refresh" ? "Refresh page" :
              a === "runWeekly" ? "Run weekly snapshot" :
              a === "refreshBtn" ? "Refresh" :
              a === "clearChild" ? "Clear selected child" :
              a === "resetTutor" ? "Reset Tutor focus" :
              a === "openTutor" ? "Open Tutor" :
              a === "openLessons" ? "Open Lessons" :
              a === "billingPortal" ? "Open billing" :
              a === "openHelp" ? "Open Help Centre" : "Try";
            b.addEventListener("click", () => {
              const fn = actionHandlers[a];
              if (typeof fn === "function") fn();
            });
            quickActions.appendChild(b);
          });
        });
      });

      // Troubleshooter
      troubleshootBtn.addEventListener("click", () => {
        const node = buildTroubleshooter(root);
        quickAnswer.classList.remove("llhb-hide");
        quickAnswer.innerHTML = "";
        quickAnswer.appendChild(node);
      });

      // input typing (debounced)
      let tId = null;

      input.addEventListener("input", () => {
        if (tId) clearTimeout(tId);
        tId = setTimeout(() => runSearch(input.value), 220);
      });

      await runSearch(input.value);

      // diagnostics
      try {
        const selected = localStorage.getItem("selectedChild");
        let loggedIn = "unknown";
        try {
          if (window.sb?.auth?.getUser) {
            const { data } = await window.sb.auth.getUser();
            loggedIn = data?.user ? "yes" : "no";
          }
        } catch { loggedIn = "unknown"; }

        let net = "checking";
        try {
          const r = await fetch("/favicon.ico", { cache: "no-store" });
          net = r.ok ? "ok" : "fail";
        } catch { net = "fail"; }

        diagBody.innerHTML = `
          <div>Page: ${escHtml(page.path)}</div>
          <div>Logged in: ${escHtml(loggedIn)}</div>
          <div>Selected child: ${selected ? "yes" : "no"}</div>
          <div>Network: ${escHtml(net)}</div>
        `;
      } catch {}

    } catch (e) {
      debugLog("init failed", e);
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once: true });
  } else {
    init();
  }
})();
