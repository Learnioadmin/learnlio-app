/* public/assets/js/layout-public.js */
(() => {
  const LINKS = [
    { href: "/index.html", label: "Home" },
    { href: "/why.html", label: "Why Learnlio" },
    { href: "/pricing.html", label: "Pricing" },
    { href: "/faq.html", label: "FAQ" },
    { href: "/login.html", label: "Log in" },
  ];

  function normPath(p) {
    if (!p) return "/";
    if (p === "/") return "/index.html";
    return p;
  }

  function isActive(linkHref) {
    const cur = normPath(window.location.pathname);
    const target = normPath(linkHref);
    return cur === target;
  }

  function navHTML() {
    const links = LINKS.map(l => {
      const active = isActive(l.href) ? "active" : "";
      return `<a class="${active}" href="${l.href}">${l.label}</a>`;
    }).join("");

    return `
      <header class="nav">
        <div class="nav-inner">
          <a class="brand" href="/index.html" aria-label="Learnlio home">
            <img class="brand-logo" src="/assets/img/logo.webp" alt="Learnlio" onerror="this.style.display='none'">
            <span>Learnlio</span>
          </a>
          <nav class="links">
            ${links}
          </nav>
        </div>
      </header>
    `;
  }

  function footerHTML() {
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

  function inject() {
    const navMount = document.getElementById("navMount");
    const footerMount = document.getElementById("footerMount");
    if (navMount) navMount.innerHTML = navHTML();
    if (footerMount) footerMount.innerHTML = footerHTML();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", inject);
  } else {
    inject();
  }
})();
