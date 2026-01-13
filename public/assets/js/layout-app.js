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
  const sb = window.supabase?.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  if (!sb) {
    console.error("[layout-app] Supabase not loaded.");
    return;
  }

  function now() { return Date.now(); }

  function safeGetInt(key) {
    const v = localStorage.getItem(key);
    const n = v ? Number(v) : NaN;
    return Number.isFinite(n) ? n : null;
  }

  function setInt(key, value) {
    localStorage.setItem(key, String(value));
  }

  function isAppPage() {
    // We only run the auth guard + session timers on app pages (not public pages).
    // If you accidentally include layout-app.js on public pages, this protects you.
    const path = window.location.pathname || "";
    return (
      path.endsWith("/dash.html") ||
      path.endsWith("/chat.html") ||
      path.endsWith("/reports.html") ||
      path.endsWith("/billing.html") ||
      path.endsWith("/screener.html") // your screener is inside app nav currently
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
  function mountAppNav() {
    const mount = document.getElementById("navMount");
    if (!mount) return;

    const path = window.location.pathname || "";
    const isActive = (p) => path.endsWith(p);

    mount.innerHTML = `
      <header class="nav">
        <div class="nav-inner">
          <a class="brand" href="/dash.html" aria-label="Learnlio dashboard">
            <img src="/assets/img/logo.webp" alt="Learnlio" onerror="this.style.display='none'">
            <span>Learnlio</span>
          </a>
          <nav class="links">
            <a href="/dash.html" class="${isActive("/dash.html") ? "active" : ""}">Dashboard</a>
            <a href="/chat.html" class="${isActive("/chat.html") ? "active" : ""}">Tutor</a>
            <a href="/screener.html" class="${isActive("/screener.html") ? "active" : ""}">Screener</a>
            <a href="/reports.html" class="${isActive("/reports.html") ? "active" : ""}">Reports</a>
            <a href="/billing.html" class="${isActive("/billing.html") ? "active" : ""}">Billing</a>
            <button id="appLogoutBtn" class="btn light" type="button">Log out</button>
          </nav>
        </div>
      </header>
    `;

    const btn = document.getElementById("appLogoutBtn");
    if (btn) {
      btn.addEventListener("click", async () => {
        await doLogout("manual");
      });
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
    const { data, error } = await sb.auth.getUser();

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

      await sb.auth.signOut();
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
  (async () => {
    // Always mount UI if mounts exist (safe)
    mountAppNav();
    mountAppFooter();

    // Only run guard/timers on app pages
    if (!isAppPage()) return;

    const ok = await requireAuthOrRedirect();
    if (!ok) return;

    wireActivityListeners();
    scheduleTimers();
  })();
})();
