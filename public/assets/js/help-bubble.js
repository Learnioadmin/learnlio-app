/* Mobile visual viewport fix for keyboard-safe help bubble (no desktop impact). */
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

  function injectStyles() {
    const css = `
/* Learnlio Help Bubble (isolated) */
#ll-help-bubble{
  position:fixed;
  right:16px;
  bottom:16px;
  z-index:9999;
  font-family:system-ui,-apple-system,Segoe UI,Roboto,Arial,sans-serif;
}
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
  max-height: calc(100vh - 90px);
  display:flex;
  flex-direction:column;
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
.llhb-bd{
  padding:12px;
  display:grid;
  gap:10px;
  overflow:auto;
  max-height: calc(100vh - 160px);
}
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
@media (max-width:420px){
  #ll-help-bubble{ right:12px; bottom:12px; }
}
@media (max-width:980px){
  .llhb-panel{
    max-height: calc(var(--vvh) * 100 - 24px - env(safe-area-inset-bottom));
    overflow: auto;
    -webkit-overflow-scrolling: touch;
    padding-bottom: env(safe-area-inset-bottom);
  }
  .llhb-hd{
    position: sticky;
    top: 0;
    z-index: 1;
  }
  .llhb-bd{
    max-height: calc(var(--vvh) * 100 - 120px - env(safe-area-inset-bottom));
    overflow: auto;
    -webkit-overflow-scrolling: touch;
    padding-bottom: env(safe-area-inset-bottom);
  }
}
    `.trim();

    const style = document.createElement("style");
    style.id = "ll-help-bubble-style";
    style.textContent = css;
    document.head.appendChild(style);
  }

  function initVisualViewportFix() {
    try {
      const root = document.documentElement;
      const update = () => {
        const h = window.visualViewport ? window.visualViewport.height : window.innerHeight;
        const v = h / 100;
        if (Number.isFinite(v)) root.style.setProperty("--vvh", String(v));
      };
      update();
      window.addEventListener("resize", update, { passive: true });
      if (window.visualViewport) {
        window.visualViewport.addEventListener("resize", update, { passive: true });
        window.visualViewport.addEventListener("scroll", update, { passive: true });
      }
    } catch {}
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
          <button class="llhb-close" id="llhb-close" type="button" aria-label="Close">&#215;</button>
        </div>
        <div class="llhb-bd">
          <div>
            <div class="llhb-muted" style="font-weight:900; margin-bottom:6px;">Quick help</div>
            <div class="llhb-qa" id="llhb-quick" aria-label="Quick help"></div>
            <div id="llhb-answer" class="llhb-answer llhb-hide"></div>
            <div class="llhb-actions" id="llhb-quick-actions"></div>
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

  const KB = {
    global: {
      next: [
        "Pick one small thing to do now: a 5-minute plan, Tutor, or Lessons.",
        "Keep it short. End on an easy win to protect confidence.",
        "If a page looks stuck, refresh once, then log out/in."
      ],
      broken: [
        "Refresh the page once. If it still looks wrong, log out and back in.",
        "Check you selected the right child in the dashboard/parent area.",
        "If buttons dont respond, try Chrome/Edge and disable ad blockers for learnlio.co.uk."
      ],
      explain: [
        "This page helps you understand progress without pressure.",
        "Use small, calm steps and short sessions.",
        "If anything is unclear, open the Help Centre or contact support."
      ]
    },
    "/reports.html": {
      explain: [
        "This page turns Tutor + Lessons activity into clear parent insight.",
        "Highlights shows the main focus and what needs support this week.",
        "Use Start a 5-minute plan for a quick confidence-building session."
      ],
      next: [
        "Press Start a 5-minute plan to practise the one key area calmly.",
        "If you want a record, download the PDF after refreshing.",
        "If weekly summaries are on, use Run weekly report now after a short session."
      ],
      broken: [
        "If weekly toggle wont save: refresh, then try again (it can be a permissions/policy issue).",
        "If the weekly list is empty: run Run weekly report now after at least 1 short session.",
        "If it still fails, it may be database permissions - use Contact support."
      ]
    },
    "/chat.html": {
      explain: [
        "Tutor gives calm practice questions and adapts to your child.",
        "Choose a subject/area or use a 5-minute plan if one was started from Parent Insight.",
        "Hints are there to keep confidence high - use them early."
      ],
      next: [
        "Do a short 5-minute session. Stop while it still feels okay.",
        "If your child hesitates, choose an easier area first for quick wins.",
        "Return to Parent Insight to see what to do next."
      ],
      broken: [
        "If Tutor asks for an area unexpectedly: go back and try the 5-minute plan again.",
        "If audio wont play: check device volume and try Chrome/Edge.",
        "If the page wont load: log out/in and retry."
      ]
    },
    "/lessons.html": {
      explain: [
        "Lessons are guided practice in small steps with calm pacing.",
        "Pick the recommended area, do a short block, then stop on a win.",
        "You can switch back to Tutor any time."
      ],
      next: [
        "Do one short lesson (5-10 minutes).",
        "If it feels hard, drop to an easier area first.",
        "Then check Parent Insight for the next focus."
      ],
      broken: [
        "Refresh once, then retry the lesson.",
        "If progress looks missing, re-select the child and refresh.",
        "Try a different browser if taps dont register."
      ]
    },
    "/billing.html": {
      explain: [
        "Billing shows your plan status and manages access.",
        "If youre expired, start a trial/subscription to unlock Tutor and reports.",
        "If you paid but still blocked, refresh then log out/in."
      ],
      next: [
        "If you want access now, complete checkout then return to the dashboard.",
        "If you think you already paid, log out/in and refresh.",
        "If it still doesnt unlock, contact support with your email."
      ],
      broken: [
        "If checkout loops, disable ad blockers for learnlio.co.uk and retry.",
        "Refresh, then log out/in and try again.",
        "If you still cant access, contact support."
      ]
    }
  };

  function getScopeKey(path) {
    const key = (path || "").toLowerCase();
    return KB[key] ? key : "global";
  }

  function buildAnswer(intentKey, pagePath) {
    const scopeKey = getScopeKey(pagePath);
    const base = (KB[scopeKey] && KB[scopeKey][intentKey]) || KB.global[intentKey] || KB.global.next;
    const links = scopeKey === "/reports.html"
      ? ["/chat.html", "/lessons.html"]
      : ["/help/", "/contact.html"];

    return {
      bullets: base.slice(0, 3),
      links,
      footer: "If this still feels stuck, contact us - well help."
    };
  }

  function renderAnswer(answerEl, answer) {
    if (!answerEl) return;
    const bullets = answer.bullets || [];
    const links = answer.links || [];
    answerEl.classList.remove("llhb-hide");
    answerEl.innerHTML = `
      <ul style="margin:0; padding-left:18px;">
        ${bullets.map(s => `<li>${escHtml(String(s))}</li>`).join("")}
      </ul>
      <div style="margin-top:6px;">${links.map(l => `<a class="llhb-link" href="${escHtml(l)}">${l === "/chat.html" ? "Open Tutor" : l === "/lessons.html" ? "Open Lessons" : l === "/help/" ? "Open Help Centre" : "Contact support"}</a>`).join(" ")}</div>
      <div class="llhb-muted" style="margin-top:6px;">${escHtml(answer.footer || "")}</div>
    `;
  }

  function renderFallback(resultsEl) {
    if (!resultsEl) return;
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
    if (!resultsEl) return;
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
    if (!bestEl) return;
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
    const p = (path || "").toLowerCase();
    if (p.includes("reports")) return [
      { label: "What do I do next?", intent: "next" },
      { label: "Something isnt working", intent: "broken" },
      { label: "Explain this page", intent: "explain" }
    ];
    if (p.includes("chat")) return [
      { label: "What do I do next?", intent: "next" },
      { label: "Something isnt working", intent: "broken" },
      { label: "Explain this page", intent: "explain" }
    ];
    if (p.includes("lessons")) return [
      { label: "What do I do next?", intent: "next" },
      { label: "Something isnt working", intent: "broken" },
      { label: "Explain this page", intent: "explain" }
    ];
    if (p.includes("billing")) return [
      { label: "What do I do next?", intent: "next" },
      { label: "Something isnt working", intent: "broken" },
      { label: "Explain this page", intent: "explain" }
    ];
    if (p.includes("login")) return [
      { label: "What do I do next?", intent: "next" },
      { label: "Something isnt working", intent: "broken" },
      { label: "Explain this page", intent: "explain" }
    ];
    return [
      { label: "What do I do next?", intent: "next" },
      { label: "Something isnt working", intent: "broken" },
      { label: "Explain this page", intent: "explain" }
    ];
  }

  function detectIntent(query) {
    const q = (query || "").toLowerCase();
    if (q.includes("next")) return "next";
    if (q.includes("work") || q.includes("error") || q.includes("cant") || q.includes("won't") || q.includes("wont")) return "broken";
    if (q.includes("what is") || q.includes("explain")) return "explain";
    return "next";
  }

  async function init() {
    try {
      initVisualViewportFix();
      injectStyles();

      const cfg = window.LEARNLIO_SUPPORT_CONFIG || {};
      const helpIndexUrl = safeText(cfg.helpIndexUrl, "/help/search-index.json");
      const aiEndpoint = safeText(cfg.aiEndpoint, "").trim();
      const aiEnabled = !!aiEndpoint;

      const page = getPageContext();
      const root = buildUI();

      const panel = root.querySelector("#llhb-panel");
      const toggle = root.querySelector("#llhb-toggle");
      const closeBtn = root.querySelector("#llhb-close");
      const input = root.querySelector("#llhb-input");
      const resultsEl = root.querySelector("#llhb-results");
      const bestEl = root.querySelector("#llhb-best");
      const quickWrap = root.querySelector("#llhb-quick");
      const answerEl = root.querySelector("#llhb-answer");

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
          answerEl.classList.add("llhb-hide");
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
        if (!resultsEl) return;
        resultsEl.innerHTML = `<div class="llhb-item"><p class="llhb-muted">Searching</p></div>`;

        const query = safeText(q).trim();
        try { localStorage.setItem(LS_LASTQ, query); } catch {}

        if (!query) {
          const intent = "next";
          renderAnswer(answerEl, buildAnswer(intent, page.path));
          await ensureIndex();
          if (!indexUnavailable && index) {
            renderFallback(resultsEl);
          } else {
            renderFallback(resultsEl);
          }
          return;
        }

        const intent = detectIntent(query);
        renderAnswer(answerEl, buildAnswer(intent, page.path));

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
      quickWrap.innerHTML = quickItems.map(x => `<button class="llhb-chip" data-intent="${escHtml(x.intent)}" type="button">${escHtml(x.label)}</button>`).join("");

      function runIntent(intentKey){
        open();
        renderAnswer(answerEl, buildAnswer(intentKey, page.path));
        runSearch(intentKey);
      }

      root.addEventListener("click", (e) => {
        const chip = e.target && e.target.closest ? e.target.closest(".llhb-chip") : null;
        if (!chip) return;
        const intent = chip.getAttribute("data-intent") || "next";
        runIntent(intent);
      });

      // input typing (debounced)
      let tId = null;
      input.addEventListener("input", () => {
        if (tId) clearTimeout(tId);
        tId = setTimeout(() => runSearch(input.value), 220);
      });
      input.addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          runSearch(input.value);
        }
      });

      await runSearch(input.value);

      if (aiEnabled) {
        const askBtn = document.createElement("button");
        askBtn.className = "llhb-link";
        askBtn.type = "button";
        askBtn.textContent = "Ask AI";
        askBtn.addEventListener("click", async () => {
          const question = safeText(input.value).trim() || "Help me with this page";
          answerEl.classList.remove("llhb-hide");
          answerEl.textContent = "Thinking";

          let snippets = [];
          await ensureIndex();
          if (index && !indexUnavailable) {
            snippets = index
              .map(it => ({ it, s: scoreItem(it, question) }))
              .filter(x => x.s > 0)
              .sort((a, b) => b.s - a.s)
              .slice(0, 3)
              .map(x => ({ title: x.it.title, url: x.it.url, excerpt: snippet(x.it.text, question) }));
          }

          try {
            const res = await fetch(aiEndpoint, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              credentials: "same-origin",
              body: JSON.stringify({
                question,
                page: { path: page.path, title: page.title, h1: page.h1 },
                snippets
              })
            });
            if (!res.ok) throw new Error("ai call failed");
            const data = await res.json();
            const text = safeText(data.answer || data.text || "");
            answerEl.textContent = text
              ? text + "\n\nIf this doesnt look right, open the Help Centre or contact us."
              : "Sorry - I couldnt generate a helpful answer. Please open the Help Centre or contact us.";
          } catch (err) {
            answerEl.textContent = "Sorry - I couldnt load AI help right now. Please open the Help Centre or contact us.";
            console.warn("[HelpBubble]", err);
          }
        });
        const actions = root.querySelector(".llhb-actions");
        if (actions) actions.appendChild(askBtn);
      }

    } catch (err) {
      console.warn("[HelpBubble]", err);
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => {
      try { init(); } catch (err) { console.warn("[HelpBubble]", err); }
    }, { once: true });
  } else {
    try { init(); } catch (err) { console.warn("[HelpBubble]", err); }
  }
})();
