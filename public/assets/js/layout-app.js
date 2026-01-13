/* public/assets/js/layout-app.js
   Learnlio — App layout + auth helpers
   - Injects the logged-in app nav
   - Provides consistent auth + access gating
   - Handles logout -> redirect to homepage
*/

(() => {
  // =========================
  // CONFIG (YOUR VALUES)
  // =========================
  const SUPABASE_URL = "https://jesuzdpivwsprkmqmoab.supabase.co";
  const SUPABASE_ANON_KEY = "sb_publishable_7y2jcI_sLwLG-8IHMI3WMw_7Y8IFUdL";

  // Your billing Worker base URL
  const BILLING_API_BASE = "https://learnlio-billing.falling-grass-34ab.workers.dev";
  // Endpoints:
  //   GET  /me
  // =========================

  // Safety: ensure Supabase script loaded
  if (!window.supabase || !window.supabase.createClient) {
    console.error("Supabase SDK not loaded. Add <script src='https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2'></script> before layout-app.js");
    return;
  }

  const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

  // -------------------------
  // Utilities
  // -------------------------
  function $(id) {
    return document.getElementById(id);
  }

  function escapeHtml(str) {
    return String(str ?? "").replace(/[&<>"']/g, (s) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#039;",
    }[s]));
  }

  function formatDateDDMMYYYY(isoLike) {
    if (!isoLike) return "";
    const d = new Date(isoLike);
    if (isNaN(d.getTime())) {
      const s = String(isoLike).slice(0, 10);
      const parts = s.split("-");
      if (parts.length === 3) return `${parts[2]}/${parts[1]}/${parts[0]}`;
      return s;
    }
    const dd = String(d.getDate()).padStart(2, "0");
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const yyyy = d.getFullYear();
    return `${dd}/${mm}/${yyyy}`;
  }

  async function safeJson(response) {
    const text = await response.text();
    try {
      return { ok: true, json: JSON.parse(text), raw: text };
    } catch {
      return { ok: false, raw: text };
    }
  }

  async function getAccessTokenOrThrow() {
    // 1) Try current session
    let { data: sessionData } = await sb.auth.getSession();
    let accessToken = sessionData?.session?.access_token;

    // 2) If missing, attempt refresh (fixes “session not restored yet / stale”)
    if (!accessToken) {
      const refreshed = await sb.auth.refreshSession();
      accessToken = refreshed?.data?.session?.access_token;
    }

    // 3) Still missing => not logged in
    if (!accessToken) {
      throw new Error("No Supabase session token found.");
    }
    return accessToken;
  }

  async function callBillingApi(path, opts = {}) {
    if (!BILLING_API_BASE) throw new Error("BILLING_API_BASE is not set.");

    const token = await getAccessTokenOrThrow();

    const res = await fetch(`${BILLING_API_BASE}${path}`, {
      method: opts.method || "GET",
      headers: {
        "Accept": "application/json",
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}`,
        ...(opts.headers || {}),
      },
      body: opts.body ? JSON.stringify(opts.body) : undefined,
    });

    const parsed = await safeJson(res);

    if (!parsed.ok) {
      const snippet = (parsed.raw || "").slice(0, 140);
      throw new Error(`Billing API did not return JSON (starts with): ${snippet}`);
    }
    if (!res.ok) {
      throw new Error(parsed.json?.error || `HTTP ${res.status}`);
    }
    return parsed.json;
  }

  // -------------------------
  // Layout injection
  // -------------------------
  function getActivePath() {
    const p = (location.pathname || "/").toLowerCase();
    // normalize
    if (p === "/index.html") return "/";
    return p;
  }

  function navLink(href, label, isActive) {
    return `<a href="${href}" class="${isActive ? "active" : ""}">${escapeHtml(label)}</a>`;
  }

  function renderAppNav() {
    const mount = $("navMount");
    if (!mount) return;

    const path = getActivePath();
    const isDash = path.endsWith("/dash.html");
    const isChat = path.endsWith("/chat.html");
    const isScreener = path.endsWith("/screener.html") || path.endsWith("/screener");
    const isReports = path.endsWith("/reports.html");
    const isBilling = path.endsWith("/billing.html");

    mount.innerHTML = `
      <header class="nav">
        <div class="nav-inner">
          <a class="brand" href="/dash.html" aria-label="Learnlio home">
            <img src="/assets/img/logo.webp" alt="Learnlio" onerror="this.style.display='none'">
            <span>Learnlio</span>
          </a>
          <nav class="links">
            ${navLink("/dash.html", "Dashboard", isDash)}
            ${navLink("/chat.html", "Learnlio Tutor", isChat)}
            ${navLink("/screener.html", "Dyslexia Screener", isScreener)}
            ${navLink("/reports.html", "Reports", isReports)}
            ${navLink("/billing.html", "Billing", isBilling)}
            <button id="logoutBtn" class="btn light" type="button">Log out</button>
          </nav>
        </div>
      </header>
    `;
  }

  function renderAppFooter() {
    const mount = $("footerMount");
    if (!mount) return;

    mount.innerHTML = `
      <footer class="footer">
        <div class="container" style="padding-top:18px; padding-bottom:40px;">
          <div style="display:flex; justify-content:space-between; gap:12px; flex-wrap:wrap; align-items:center;">
            <div style="color:#6b7280; font-size:14px;">
              © <span id="year"></span> Learnlio.
            </div>
            <div style="display:flex; gap:12px; flex-wrap:wrap;">
              <a href="/privacy.html" style="color:#6b7280; text-decoration:none;">Privacy</a>
              <a href="/terms.html" style="color:#6b7280; text-decoration:none;">Terms</a>
              <a href="/cookies.html" style="color:#6b7280; text-decoration:none;">Cookies</a>
              <a href="/contact.html" style="color:#6b7280; text-decoration:none;">Contact</a>
            </div>
          </div>
        </div>
      </footer>
    `;

    const yearEl = document.getElementById("year");
    if (yearEl) yearEl.textContent = String(new Date().getFullYear());
  }

  // -------------------------
  // Auth + access gate
  // -------------------------
  async function requireAuthOrRedirect() {
    const { data, error } = await sb.auth.getUser();

    if (error || !data?.user) {
      // Session missing/expired => login page
      window.location.href = "/login.html";
      return null;
    }
    return data.user;
  }

  async function enforceAccessGateOrRedirect() {
    // Calls billing worker to determine status
    // If expired => billing page
    // If trialing/active => ok
    // If none => ok (you may choose to force to billing; current behaviour = allow trial start on billing)
    try {
      const me = await callBillingApi("/me", { method: "GET" });

      // Expected: { status: "none"|"trialing"|"active"|"expired", trial_ends_at, plan }
      if (me?.status === "expired") {
        // Keep user in app shell? No — redirect to billing so they see next step.
        window.location.href = "/billing.html";
        return { ok: false, me };
      }

      return { ok: true, me };
    } catch (e) {
      // IMPORTANT: If billing worker is temporarily unreachable,
      // we should NOT hard-lock the app (bad UX). Allow page to load.
      console.warn("Access gate check failed (allowing page to load):", e);
      return { ok: true, me: { status: "unknown", error: String(e?.message || e) } };
    }
  }

  // -------------------------
  // Logout handler
  // -------------------------
  async function wireLogout() {
    const btn = $("logoutBtn");
    if (!btn) return;

    btn.addEventListener("click", async () => {
      try {
        await sb.auth.signOut();
      } catch (e) {
        console.warn("Logout error (safe to ignore):", e);
      }

      // clear local state
      localStorage.removeItem("selectedChild");

      // Intentional logout => homepage
      window.location.href = "/";
      // Optional: add query to show friendly message on home later
      // window.location.href = "/?logged_out=1";
    });
  }

  // -------------------------
  // Expose helpers (optional)
  // -------------------------
  // You can call these from page scripts if you want:
  window.LearnlioApp = {
    sb,
    requireAuthOrRedirect,
    enforceAccessGateOrRedirect,
    formatDateDDMMYYYY,
  };

  // -------------------------
  // Init (runs on every app page that includes this file)
  // -------------------------
  (async () => {
    renderAppNav();
    renderAppFooter();
    await wireLogout();

    // If a page wants to skip gating (rare), add <body data-skip-gate="1">
    const skipGate = document.body?.getAttribute("data-skip-gate") === "1";

    // Require auth on all app pages by default
    const user = await requireAuthOrRedirect();
    if (!user) return;

    // Gate paid/trial status (unless skipped)
    if (!skipGate) {
      await enforceAccessGateOrRedirect();
    }

    // Optional: small debug pill if you ever need it
    // console.log("LearnlioApp ready", user.id);
  })();
})();
