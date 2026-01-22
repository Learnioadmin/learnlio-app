/* public/assets/js/layout-app.js
   Learnlio App Layout + Session Security

   - Requires Supabase JS loaded on the page:
     <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>

   - Assumes your app pages have:
     <div id="navMount"></div>
     <div id="footerMount"></div>   (optional, but recommended)

   - Security:
     Idle logout: 30 minutes
     Absolute logout: 2 hours
*/

(() => {
  window.__learnlioLayoutLoaded = true;
  window.__learnlioGateRendered = false;
  // =========================
  // CONFIG
  // =========================
  const SUPABASE_URL = "https://jesuzdpivwsprkmqmoab.supabase.co";
  const SUPABASE_ANON_KEY = "sb_publishable_7y2jcI_sLwLG-8IHMI3WMw_7Y8IFUdL";

  // Where to send users after sign out (public site)
  const PUBLIC_HOME_URL = "https://learnlio.co.uk/";

  // Login page (app)
  const LOGIN_URL = "/login.html";

  // Session security
  const IDLE_TIMEOUT_MINUTES = 30;               // you chose 30
  const ABSOLUTE_SESSION_HOURS = 2;              // hard cap
  const IDLE_TIMEOUT_MS = IDLE_TIMEOUT_MINUTES * 60 * 1000;
  const ABSOLUTE_TIMEOUT_MS = ABSOLUTE_SESSION_HOURS * 60 * 60 * 1000;

  // Cross-tab keys
  const LS_LAST_ACTIVITY = "learnlio_last_activity_at";
  const LS_SESSION_START = "learnlio_session_start_at";

  // =========================
  // HELPERS
  // =========================
  const sb = window.sb || window.supabase?.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  if (sb && !window.sb) window.sb = sb;

  function now() { return Date.now(); }

  function safeGetInt(key) {
    const v = localStorage.getItem(key);
    const n = v ? Number(v) : NaN;
    return Number.isFinite(n) ? n : null;
  }

  function setInt(key, value) {
    localStorage.setItem(key, String(value));
  }

  async function getAccessToken() {
    const client = window.sb;
    if (!client) return null;
    let { data: sessionData } = await client.auth.getSession();
    let accessToken = sessionData?.session?.access_token;

    if (!accessToken) {
      const refreshed = await client.auth.refreshSession();
      accessToken = refreshed?.data?.session?.access_token;
    }

    return accessToken || null;
  }

  async function authedFetch(path, options = {}) {
    const accessToken = await getAccessToken();
    if (!accessToken) return null;

    const headers = {
      "Authorization": `Bearer ${accessToken}`,
      ...(options.headers || {})
    };

    if (options.body && !headers["Content-Type"]) {
      headers["Content-Type"] = "application/json";
    }

    const res = await fetch(path, {
      method: options.method || "GET",
      headers,
      body: options.body ? JSON.stringify(options.body) : undefined
    });

    let json = null;
    try { json = await res.json(); } catch {}
    if (!res.ok) {
      const message = json?.error || `HTTP ${res.status}`;
      throw new Error(message);
    }
    return { status: res.status, json };
  }

  function pathIs(path, ...candidates) {
    return candidates.some((c) => path === c || path.endsWith(c));
  }

  function normPath(p) { return (p || "").replace(/\/+$/,""); }

  function isAppPage() {
    // We only run the auth guard + session timers on app pages (not public pages).
    // If you accidentally include layout-app.js on public pages, this protects you.
    const path = normPath(window.location.pathname);
    return (
      path === "/dash" || path.endsWith("/dash.html") ||
      path === "/chat" || path.endsWith("/chat.html") ||
      path === "/reports" || path.endsWith("/reports.html") ||
      path === "/billing" || path.endsWith("/billing.html") ||
      path === "/lesson" || path.endsWith("/lesson.html") ||
      path === "/lessons" || path.endsWith("/lessons.html")
    );
  }

  function escapeHtml(str) {
    return String(str ?? "").replace(/[&<>"']/g, s => ({
      "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"
    }[s]));
  }

  // =========================
  // NAV + FOOTER (APP)
  // =========================
  function ensureNavStyles() {
    if (document.getElementById("appNavStyles")) return;
    const style = document.createElement("style");
    style.id = "appNavStyles";
    style.textContent = `
      .nav{
        background:#fff;
        border-bottom:1px solid rgba(15,23,42,.08);
        position:sticky; top:0; z-index:50;
      }
      .nav-inner{
        max-width:1100px;
        margin:0 auto;
        padding:12px 18px;
        display:flex;
        align-items:center;
        justify-content:space-between;
        gap:12px;
      }
      .brand{
        display:flex; align-items:center; gap:10px;
        font-weight:950; letter-spacing:.2px;
      }
      .brand img{ height:34px; width:auto; display:block; }
      .links{
        display:flex; gap:6px; align-items:center; flex-wrap:wrap; justify-content:flex-end;
      }
      .links a{
        padding:9px 10px;
        border-radius:12px;
        font-size:14px;
        color:var(--ink);
      }
      .links a:hover{ background: rgba(15,23,42,.04); }
      .links a.active{ background: rgba(15,23,42,.04); }
    `;
    document.head.appendChild(style);
  }

  function mountAppNav() {
    if (document.querySelector("header.nav.app-nav")) return;
    const path = normPath(window.location.pathname);
    const isActive = (p) => path.endsWith(p);

    const wrapper = document.createElement("div");
    wrapper.innerHTML = `
      <header class="nav app-nav" role="banner">
        <div class="nav-inner">
          <a class="brand" href="/dash.html" aria-label="Learnlio dashboard">
            <img src="/assets/img/logo.webp" alt="Learnlio" onerror="this.style.display='none'">
            <span>Learnlio</span>
          </a>
          <nav class="links" aria-label="Primary">
            <a href="/dash.html" class="${isActive("/dash.html") ? "active" : ""}">Dashboard</a>
            <a href="/chat.html" class="${isActive("/chat.html") ? "active" : ""}">Learnlio Tutor</a>
            <a href="/reports.html" class="${isActive("/reports.html") ? "active" : ""}">Reports</a>
            <button id="logoutBtn" class="btn light" type="button">Logout</button>
          </nav>
        </div>
      </header>
    `;

    const navEl = wrapper.firstElementChild;
    const mount = document.getElementById("navMount");
    if (mount) {
      mount.innerHTML = "";
      mount.appendChild(navEl);
    } else if (document.body) {
      document.body.insertBefore(navEl, document.body.firstChild);
    }

  }

  function mountAppFooter() {
    const mount = document.getElementById("footerMount");
    if (!mount) return;

    const year = new Date().getFullYear();
    mount.innerHTML = `
      <footer style="border-top:1px solid #ececf4; background:#fff; margin-top:18px;">
        <div style="max-width:980px; margin:0 auto; padding:14px 18px; display:flex; justify-content:space-between; gap:12px; flex-wrap:wrap; color:#6b7280; font-size:14px;">
          <div>© ${year} Learnlio</div>
          <div style="display:flex; gap:12px; flex-wrap:wrap;">
            <a href="/privacy.html" style="color:#6b7280; text-decoration:none;">Privacy</a>
            <a href="/terms.html" style="color:#6b7280; text-decoration:none;">Terms</a>
            <a href="/cookies.html" style="color:#6b7280; text-decoration:none;">Cookies</a>
            <a href="/contact.html" style="color:#6b7280; text-decoration:none;">Contact</a>
          </div>
        </div>
      </footer>
    `;
  }

  // =========================
  // AUTH GUARD
  // =========================
  async function requireAuthOrRedirect() {
    if (!window.sb) return false;
    const { data, error } = await window.sb.auth.getUser();

    if (error || !data?.user) {
      // Not logged in
      window.location.href = LOGIN_URL;
      return false;
    }

    // Logged in: ensure session start/last activity exist
    const start = safeGetInt(LS_SESSION_START);
    if (!start) setInt(LS_SESSION_START, now());

    const last = safeGetInt(LS_LAST_ACTIVITY);
    if (!last) setInt(LS_LAST_ACTIVITY, now());

    return true;
  }

  // =========================
  // LOGOUT
  // =========================
  async function doLogout(reason = "unknown") {
    try {
      // Clear app-local state too
      localStorage.removeItem("selectedChild");
      localStorage.removeItem(LS_LAST_ACTIVITY);
      localStorage.removeItem(LS_SESSION_START);

      if (window.sb) {
        await window.sb.auth.signOut();
      }
    } catch (e) {
      console.warn("[layout-app] signOut error:", e);
    } finally {
      // Always send them to public home (best customer journey)
      // Reason is useful if you want later debugging:
      // e.g. https://learnlio.co.uk/?signed_out=idle
      const u = new URL(PUBLIC_HOME_URL);
      u.searchParams.set("signed_out", reason);
      window.location.href = u.toString();
    }
  }

  // =========================
  // SESSION SECURITY
  // =========================
  let idleTimer = null;
  let absoluteTimer = null;

  function bumpActivity() {
    setInt(LS_LAST_ACTIVITY, now());
  }

  function scheduleTimers() {
    // Clear existing
    if (idleTimer) clearTimeout(idleTimer);
    if (absoluteTimer) clearTimeout(absoluteTimer);

    const startAt = safeGetInt(LS_SESSION_START) || now();
    const lastAt = safeGetInt(LS_LAST_ACTIVITY) || now();

    const idleDueIn = Math.max(0, (lastAt + IDLE_TIMEOUT_MS) - now());
    const absDueIn  = Math.max(0, (startAt + ABSOLUTE_TIMEOUT_MS) - now());

    idleTimer = setTimeout(() => {
      // Re-check at fire-time (cross-tab safe)
      const last = safeGetInt(LS_LAST_ACTIVITY) || now();
      if (now() - last >= IDLE_TIMEOUT_MS) {
        doLogout("idle");
      } else {
        scheduleTimers(); // activity happened in another tab
      }
    }, idleDueIn + 250);

    absoluteTimer = setTimeout(() => {
      doLogout("max");
    }, absDueIn + 250);
  }

  function wireActivityListeners() {
    const events = [
      "click", "keydown", "mousemove",
      "touchstart", "scroll", "pointerdown"
    ];

    let lastBump = 0;

    function onActivity() {
      // Throttle bumps to reduce spam
      const t = now();
      if (t - lastBump < 1500) return;
      lastBump = t;

      bumpActivity();
      scheduleTimers();
    }

    events.forEach(evt => window.addEventListener(evt, onActivity, { passive: true }));

    // Cross-tab sync: if another tab updates activity, reschedule timers
    window.addEventListener("storage", (e) => {
      if (e.key === LS_LAST_ACTIVITY || e.key === LS_SESSION_START) {
        scheduleTimers();
      }
    });
  }

  // =========================
  // INIT
  // =========================
  function runWithBody(fn) {
    if (document.body) {
      fn();
    } else {
      document.addEventListener("DOMContentLoaded", fn, { once: true });
    }
  }

  const DEBUG = new URLSearchParams(window.location.search).get("debug") === "1";
  const debugState = {
    loaded: true,
    pathname: normPath(window.location.pathname),
    sbReady: "unknown",
    statusHttp: "none",
    childMode: "unknown",
    gateRendered: false,
    lastError: ""
  };

  function debugLog(...args) {
    if (DEBUG) console.log("[child-mode]", ...args);
  }

  function ensureDebugBadge() {
    if (!DEBUG || document.getElementById("childModeDebugBadge")) return;
    const badge = document.createElement("div");
    badge.id = "childModeDebugBadge";
    badge.style.cssText = "position:fixed; top:12px; right:12px; z-index:20000; font-size:12px; background:#fff; border:1px solid rgba(15,23,42,.12); border-radius:10px; padding:8px 10px; color:#111; line-height:1.4; max-width:260px; box-shadow:0 6px 16px rgba(15,23,42,.08);";
    document.body.appendChild(badge);
    updateDebugBadge();
  }

  function updateDebugBadge(patch = {}) {
    if (!DEBUG) return;
    Object.assign(debugState, patch);
    const badge = document.getElementById("childModeDebugBadge");
    if (!badge) return;
    badge.innerHTML =
      `loaded: ${debugState.loaded}<br>` +
      `pathname: ${debugState.pathname}<br>` +
      `sbReady: ${debugState.sbReady}<br>` +
      `statusHttp: ${debugState.statusHttp}<br>` +
      `childMode: ${debugState.childMode}<br>` +
      `gateRendered: ${debugState.gateRendered}<br>` +
      `lastError: ${escapeHtml(debugState.lastError || "")}`;
  }

  async function waitForSupabaseClient(timeoutMs = 5000) {
    const start = Date.now();
    while (!window.sb && Date.now() - start < timeoutMs) {
      await new Promise(r => setTimeout(r, 100));
    }
    return !!window.sb;
  }

  async function waitForBody(timeoutMs = 5000) {
    if (document.body) return true;
    const start = Date.now();
    await new Promise(resolve => {
      const timer = setTimeout(resolve, timeoutMs);
      document.addEventListener("DOMContentLoaded", () => {
        clearTimeout(timer);
        resolve();
      }, { once: true });
    });
    return !!document.body;
  }

  async function maybeEnableChildMode() {
    const path = normPath(window.location.pathname);
    const isChildArea =
      path === "/chat" || path.endsWith("/chat.html") ||
      path === "/lessons" || path.endsWith("/lessons.html") ||
      path === "/lesson" || path.endsWith("/lesson.html");

    if (!isChildArea) return;
    try {
      await authedFetch("/child-mode/on", { method: "POST", body: {} });
    } catch {
      // Silent: user may not be logged in yet
    }
  }

  function renderChildGate() {
    if (document.getElementById("childModeGate")) return;
    const gate = document.createElement("div");
    gate.id = "childModeGate";
    gate.style.cssText = "position:fixed; inset:0; z-index:9999; background:#f7f7fb; display:flex; align-items:center; justify-content:center; padding:18px; overflow:auto; pointer-events:auto;";
    gate.innerHTML = `
      <div class="card" style="max-width:520px; width:100%; text-align:left;">
        <div style="font-weight:900; font-size:20px; margin-bottom:8px;">This area is for grown-ups</div>
        <div class="muted" style="margin-bottom:14px;">
          Reports and account settings are for parents and carers. If a grown-up wants to see this, they can unlock it below.
        </div>
        <div class="row" style="display:flex; gap:10px; flex-wrap:wrap; align-items:center;">
          <button id="childUnlockBtn" class="btn" type="button">Ask a grown-up to unlock</button>
          <a class="btn light" href="/chat.html" style="text-decoration:none;">Go back to Learnlio Tutor</a>
        </div>
      </div>
      <div id="childUnlockModal" style="display:none; position:fixed; inset:0; z-index:10000; background:rgba(2,6,23,.45); padding:18px; align-items:center; justify-content:center;">
        <div class="card" style="max-width:520px; width:100%;">
          <div style="font-weight:900; font-size:18px; margin-bottom:6px;">Unlock parent access</div>
          <div class="muted" style="margin-bottom:12px;">Enter your password to continue.</div>
          <label style="display:block; font-size:13px; font-weight:800; margin-bottom:6px;" for="childUnlockPassword">Password</label>
          <input id="childUnlockPassword" class="input" type="password" autocomplete="current-password" placeholder="Enter password" />
          <div id="childUnlockMsg" class="status" aria-live="polite"></div>
          <div class="row" style="margin-top:10px; display:flex; gap:10px; flex-wrap:wrap; align-items:center;">
            <button id="childUnlockConfirm" class="btn" type="button" disabled>Unlock</button>
            <button id="childUnlockCancel" class="btn light" type="button">Cancel</button>
          </div>
        </div>
      </div>
    `;

    document.body.appendChild(gate);
    document.body.style.overflow = "hidden";

    const modal = document.getElementById("childUnlockModal");
    const openBtn = document.getElementById("childUnlockBtn");
    const cancelBtn = document.getElementById("childUnlockCancel");
    const confirmBtn = document.getElementById("childUnlockConfirm");
    const passwordInput = document.getElementById("childUnlockPassword");
    const msgEl = document.getElementById("childUnlockMsg");

    function setMsg(text, good = false) {
      msgEl.textContent = text || "";
      msgEl.className = "status " + (good ? "good" : "bad");
      if (!text) msgEl.className = "status";
    }

    function openModal() {
      modal.style.display = "flex";
      passwordInput.value = "";
      confirmBtn.disabled = true;
      setMsg("");
      passwordInput.focus();
    }

    function closeModal() {
      modal.style.display = "none";
    }

    openBtn?.addEventListener("click", () => openModal());
    cancelBtn?.addEventListener("click", () => closeModal());
    modal?.addEventListener("click", (e) => { if (e.target === modal) closeModal(); });

    passwordInput?.addEventListener("input", () => {
      confirmBtn.disabled = !passwordInput.value.trim();
    });

    confirmBtn?.addEventListener("click", async () => {
      const password = passwordInput.value.trim();
      if (!password) return;
      confirmBtn.disabled = true;
      setMsg("");
      try {
        await authedFetch("/parent/unlock", { method: "POST", body: { password } });
        window.location.reload();
      } catch (err) {
        setMsg(String(err.message || err));
        confirmBtn.disabled = false;
      }
    });
  }

  async function maybeGateParentPages() {
    const path = normPath(window.location.pathname);
    const isParentArea =
      path === "/reports" || path.endsWith("/reports.html") ||
      path === "/billing" || path.endsWith("/billing.html");

    debugLog("pathname", path, "parentArea", isParentArea);
    updateDebugBadge({ pathname: path });

    if (!isParentArea) return;
    if (window.__learnlioGateRendered) return;
    const sbReady = await waitForSupabaseClient();
    debugLog("sbReady", sbReady);
    updateDebugBadge({ sbReady });
    if (!sbReady) return;
    try {
      const statusRes = await authedFetch("/child-mode/status", { method: "GET" });
      if (!statusRes) return;
      updateDebugBadge({ statusHttp: statusRes.status });
      debugLog("status", statusRes.json);
      updateDebugBadge({ childMode: statusRes.json?.child_mode ?? "unknown" });
      if (statusRes.json?.child_mode) {
        const bodyReady = await waitForBody();
        if (!bodyReady) return;
        try {
          renderChildGate();
          window.__learnlioGateRendered = true;
          debugLog("gate", "rendered");
          updateDebugBadge({ gateRendered: true });
        } catch (err) {
          updateDebugBadge({ lastError: String(err?.message || err) });
          debugLog("gate", "error", err);
          if (DEBUG) console.error(err);
        }
      } else {
        debugLog("gate", "skipped");
        updateDebugBadge({ gateRendered: false });
      }
    } catch (err) {
      // Silent: if not logged in or API fails, don't block page
      updateDebugBadge({ lastError: String(err?.message || err) });
      debugLog("gate", "failed");
      if (DEBUG) console.error(err);
    }
  }

  (async () => {
    // Always mount UI if mounts exist (safe)
    runWithBody(() => {
      ensureNavStyles();
      mountAppNav();
      mountAppFooter();
      ensureDebugBadge();
    });

    // Only run guard/timers on app pages
    if (!isAppPage()) return;

    const ok = await requireAuthOrRedirect();
    if (!ok) return;

    await maybeEnableChildMode();
    await maybeGateParentPages();
    const path = normPath(window.location.pathname);
    const isParentArea =
      path === "/reports" || path.endsWith("/reports.html") ||
      path === "/billing" || path.endsWith("/billing.html");
    if (isParentArea) {
      document.addEventListener("DOMContentLoaded", () => {
        if (!window.__learnlioGateRendered) maybeGateParentPages();
      }, { once: true });
      setTimeout(() => {
        if (!window.__learnlioGateRendered) maybeGateParentPages();
      }, 1000);
    }

    wireActivityListeners();
    scheduleTimers();
  })();
})();
