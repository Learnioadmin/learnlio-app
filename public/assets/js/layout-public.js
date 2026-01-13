(() => {
  const $ = (id) => document.getElementById(id);

  // --- Public nav ---
  // FAQ stays as an anchor link to the homepage section.
  const PUBLIC_NAV = [
    { label: "Home", href: "/" },
    { label: "Why Learnlio", href: "/why-learnlio.html" },
    { label: "Pricing", href: "/pricing.html" },
    { label: "FAQ", href: "/#how-it-works" }
  ];

  function normalizePath(path) {
    if (!path) return "/";
    if (path === "/index.html") return "/";
    return path;
  }

  function isActiveLink(linkHref, currentPath) {
    const a = normalizePath(linkHref);
    const p = normalizePath(currentPath);

    // Don’t mark the FAQ anchor as active (it’s a jump link)
    if (a.includes("#")) return false;

    if (a === "/") return p === "/";
    return p === a;
  }

  function buildPublicNav() {
    const currentPath = normalizePath(window.location.pathname);

    const linksHtml = PUBLIC_NAV.map((item) => {
      const active = isActiveLink(item.href, currentPath) ? "active" : "";
      return `<a class="${active}" href="${item.href}">${item.label}</a>`;
    }).join("");

    // Both go to login for now (Start free trial is the primary CTA)
    const ctas = `
      <a class="btn" href="/login.html">Start free trial</a>
      <a class="btn light" href="/login.html">Log in</a>
    `;

    // Logo with fallback (webp -> png)
    const brand = `
      <a class="brand" href="/" aria-label="Learnlio home">
        <picture>
          <source srcset="/assets/img/logo.webp" type="image/webp">
          <source srcset="/assets/img/logo.png" type="image/png">
          <img src="/assets/img/logo.png" alt="Learnlio" />
        </picture>
        <span>Learnlio</span>
      </a>
    `;

    return `
      <header class="nav">
        <div class="nav-inner">
          ${brand}
          <nav class="links">
            ${linksHtml}
            ${ctas}
          </nav>
        </div>
      </header>
    `;
  }

  function buildFooter() {
    const year = new Date().getFullYear();
    return `
      <footer class="footer">
        <div style="display:flex; justify-content:space-between; gap:12px; flex-wrap:wrap; align-items:center;">
          <div>© ${year} Learnlio. Built in the UK.</div>
          <div style="display:flex; gap:12px; flex-wrap:wrap;">
            <a href="/privacy.html">Privacy</a>
            <a href="/terms.html">Terms</a>
            <a href="/cookies.html">Cookies</a>
            <a href="/contact.html">Contact</a>
          </div>
        </div>
      </footer>
    `;
  }

  // Mount
  const navMount = $("navMount");
  if (navMount) navMount.innerHTML = buildPublicNav();

  const footerMount = $("footerMount");
  if (footerMount) footerMount.innerHTML = buildFooter();

  // Safety styling (keeps logo/buttons tidy even if app.css fails)
  const styleFix = document.createElement("style");
  styleFix.textContent = `
    .brand img { height:34px; width:auto; display:block; }
    .links .btn { margin-left:6px; }
    @media (max-width: 520px) {
      .links .btn { padding:10px 12px; border-radius:12px; }
    }
  `;
  document.head.appendChild(styleFix);
})();

