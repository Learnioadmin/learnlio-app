/* public/assets/js/layout.js */
(() => {
  const LINKS = [
    { href: "/dash.html",    label: "Dashboard" },
    { href: "/chat.html",    label: "Learnlio Tutor" },
    { href: "/screener.html",label: "Dyslexia Screener" },
    { href: "/reports.html", label: "Reports" },
    { href: "/billing.html", label: "Billing" },
  ];

  function normPath(p) {
    if (!p) return "/";
    // treat "/" as home if you have index.html (optional)
    if (p === "/") return "/index.html";
    return p;
  }

  function isActive(linkHref) {
    const cur = normPath(window.location.pathname);
    const target = normPath(linkHref);
    return cur === target;
  }

  function buildNavHTML() {
    const linksHtml = LINKS.map(l => {
      const active = isActive(l.href) ? "active" : "";
      return `<a class="${active}" href="${l.href}">${l.label}</a>`;
    }).join("");

    return `
      <header class="nav">
        <div class="nav-inner">
          <a class="brand" href="/dash.html" aria-label="Learnlio home">
            <img class="brand-logo" src="/assets/img/logo.webp" alt="Learnlio" onerror="this.style.display='none'">
            <span>Learnlio</span>
          </a>

          <nav class="links">
            ${linksHtml}
            <button id="logoutBtn" class="btn light" type="button" style="display:none;">Log out</button>
          </nav>
        </div>
      </header>
    `;
  }

  function buildFooterHTML() {
    const year = new Date().getFullYear();
    return `
      <footer class="footer">
        <div class="footer-inner">
          <div class="footer-left">
            <span>© ${year} Learnlio</span>
            <span class="dot">•</span>
            <a href="/privacy.html">Privacy</a>
            <span class="dot">•</span>
            <a href="/cookies.html">Cookies</a>
            <span class="dot">•</span>
            <a href="/terms.html">Terms</a>
          </div>
          <div class="footer-right">
            <span class="muted">Child-led • Dyslexia-friendly • Safe tutoring</span>
          </div>
        </div>
      </footer>
    `;
  }

  function wireLogoutIfPossible() {
    const btn = document.getElementById("logoutBtn");
    if (!btn) return;

    // If Supabase exists on the page, show logout
    const hasSupabase = !!(window.supabase && window.supabase.createClient);
    if (!hasSupabase) return;

    // You already create clients per page. If a page exposes window.sb we can use it.
    // If not, we fall back to hiding logout so we don’t break pages.
    const sb = window.sb;
    if (!sb || !sb.auth) return;

    btn.style.display = "inline-block";
    btn.addEventListener("click", async () => {
      try { await sb.auth.signOut(); } catch {}
      try { localStorage.removeItem("selectedChild"); } catch {}
      window.location.href = "/login.html";
    });
  }

  function inject() {
    const navMount = document.getElementById("navMount");
    const footerMount = document.getElementById("footerMount");

    if (navMount) navMount.innerHTML = buildNavHTML();
    if (footerMount) footerMount.innerHTML = buildFooterHTML();

    wireLogoutIfPossible();
  }

  // Run ASAP once DOM exists
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", inject);
  } else {
    inject();
  }
})();
