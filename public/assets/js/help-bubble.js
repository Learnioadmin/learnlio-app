/* Learnlio Help Bubble (retrieval-first). Additive, safe, no layout impact. */

(() => {

  "use strict";

  const LS_OPEN = "learnlio_help_open";
  const LS_LASTQ = "learnlio_help_lastq";
  const LS_INDEX = "learnlio_help_index_cache_v1";
  const LS_INDEX_AT = "learnlio_help_index_cache_at_v1";

  const dayMs = 24 * 60 * 60 * 1000;

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
.llhb-qa{
  display:flex; flex-wrap:wrap; gap:8px;
}
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
.llhb-ai{
  border:1px solid rgba(221,227,239,.95);
  background:#eef3ff;
  color:#0b5cff;
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
        tags: Array.isArray(x.tags) ? x.tags.map(t => safeText(t).toLowerCase()) : []
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

  function buildUI({ aiEnabled }) {
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

          <div class="llhb-qa" aria-label="Quick help">

            <button class="llhb-chip" data-q="What should I do next?" type="button">What do I do next?</button>

            <button class="llhb-chip" data-q="Something isn't working" type="button">Something isnt working</button>

            <button class="llhb-chip" data-q="Explain this page" type="button">Explain this page</button>

          </div>



          <div class="llhb-grid">

            <input id="llhb-input" class="llhb-input" type="search" placeholder="Search Help Centre" aria-label="Search Help Centre" />

            <div class="llhb-muted" id="llhb-hint">Tip: try weekly report, login, or 5-minute plan.</div>

          </div>



          <div id="llhb-results" class="llhb-results" aria-live="polite"></div>



          <div class="llhb-actions">

            <a class="llhb-link" href="/help/">Open Help Centre</a>

            <a class="llhb-link" href="/contact.html">Contact support</a>

            ${aiEnabled ? `<button id="llhb-askai" class="llhb-link llhb-ai" type="button">Ask AI</button>` : ``}

          </div>



          <div id="llhb-answer" class="llhb-answer llhb-hide"></div>

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

  async function askAI({ endpoint, question, page, snippets, answerEl }) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);

    try {
      answerEl.classList.remove("llhb-hide");
      answerEl.textContent = "Thinking";

      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        signal: controller.signal,
        body: JSON.stringify({ question, page, snippets })
      });
      if (!res.ok) throw new Error("ai call failed");
      const data = await res.json();
      const text = safeText(data.answer || data.text || "");
      answerEl.textContent = text
        ? text + "\n\nIf this doesnt look right, open the Help Centre or contact us."
        : "Sorry  I couldnt generate a helpful answer. Please open the Help Centre or contact us.";
    } catch {
      answerEl.textContent = "Sorry  I couldnt load AI help right now. Please open the Help Centre or contact us.";
    } finally {
      clearTimeout(timeout);
    }
  }

  async function init() {
    try {
      injectStyles();

      const cfg = window.LEARNLIO_SUPPORT_CONFIG || {};
      const helpIndexUrl = safeText(cfg.helpIndexUrl, "/help/search-index.json");
      const aiEndpoint = safeText(cfg.aiEndpoint, "").trim();
      const aiEnabled = !!aiEndpoint;

      const page = getPageContext();
      const root = buildUI({ aiEnabled });

      const panel = root.querySelector("#llhb-panel");
      const toggle = root.querySelector("#llhb-toggle");
      const closeBtn = root.querySelector("#llhb-close");
      const input = root.querySelector("#llhb-input");
      const resultsEl = root.querySelector("#llhb-results");
      const answerEl = root.querySelector("#llhb-answer");
      const askAiBtn = root.querySelector("#llhb-askai");

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
          answerEl.textContent = "";
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

        answerEl.classList.add("llhb-hide");
        answerEl.textContent = "";

        if (!query) {
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
          return;
        }

        const scored = index
          .map(it => ({ it, s: scoreItem(it, query) }))
          .filter(x => x.s > 0)
          .sort((a, b) => b.s - a.s)
          .map(x => x.it);

        renderResults(resultsEl, scored, query);
      }

      root.querySelectorAll(".llhb-chip").forEach(btn => {
        btn.addEventListener("click", async () => {
          const q = safeText(btn.getAttribute("data-q")).trim();
          const pageHint = page.h1 || page.title;
          const query = q === "Explain this page" && pageHint
            ? `Explain ${pageHint}`
            : q;
          input.value = query;
          await runSearch(query);
        });
      });

      let tId = null;

      input.addEventListener("input", () => {
        if (tId) clearTimeout(tId);
        tId = setTimeout(() => runSearch(input.value), 220);
      });

      await runSearch(input.value);

      if (aiEnabled && askAiBtn) {
        askAiBtn.addEventListener("click", async () => {
          const question = safeText(input.value).trim() || "Help me with this page";
          await ensureIndex();

          let snippets = [];
          if (index && !indexUnavailable) {
            const scored = index
              .map(it => ({ it, s: scoreItem(it, question) }))
              .filter(x => x.s > 0)
              .sort((a, b) => b.s - a.s)
              .slice(0, 3)
              .map(x => ({
                title: x.it.title,
                url: x.it.url,
                excerpt: snippet(x.it.text, question)
              }));
            snippets = scored;
          }

          await askAI({ endpoint: aiEndpoint, question, page, snippets, answerEl });
        });
      } else {
      }
    } catch {
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once: true });
  } else {
    init();
  }
})();
