/* layout-app.js
   Logged-in app navigation + app footer.
   Mounts into:
     <div id="navMount"></div>
     <div id="footerMount"></div>
*/

(() => {
  const NAV_MOUNT_ID = "navMount";
  const FOOTER_MOUNT_ID = "footerMount";

  const LOGO_SRC = "/assets/img/logo.webp";
  const BRAND_TEXT = "Learnlio";

  const routes = [
    { label: "Dashboard", href: "/dash.html" },
    { label: "Learnlio Tutor", href: "/chat.html" },
    { label: "Dyslexia Screener", href: "/screener.html" },
    { label: "Reports", href: "/reports.html" },
    { label: "Billing", href: "/billing.html" },
  ];

  function isActive(href) {
    const u = new URL(href, window.location.origin);
    return u.pathname === window.location.pathname;
  }

  function ensureBaseStyles() {
    if (document.getElementById("learnlio-layout-app-style")) return;

    const style = document.createElement("style");
    style.id = "learnlio-layout-app-style";
    style.textContent = `
      .nav{background:#fff;border-bottom:1px solid #ececf4;position:sticky;top:0;z-index:50}
      .nav-inner{max-width:980px;margin:0 auto;padding:12px 18px;display:flex;align-items:center;justify-content:space-between;gap:12px}
      .brand{display:flex;align-items:center;gap:10px;text-decoration:none;color:#111;font-weight:800}
      .brand img{height:34px;width:auto;display:block}
      .links{display:flex;gap:10px;flex-wrap:wrap;align-items:center}
      .links a{text-decoration:none;color:#111;padding:10px 12px;border-radius:12px}
      .links a:hover{background:#f3f4f6}
      .links a.active{background:#eef2ff}
      .btn{background:#0b5cff;border:none;color:#fff;padding:10px 12px;border-radius:12px;cursor:pointer;font-size:14px;font-weight:700}
      .btn.light{background:#e5e7eb;color:#111}

      .app-footer{border-top:1px solid #ececf4;margin-top:24px;padding:18px 0 34px;color:#6b7280;font-size:14px}
      .app-footer-inner{max-width:980px;margin:0 auto;padding:0 18px;display:flex;justify-content:space-between;gap:12px;flex-wrap:wrap;align-items:center}
      .app-footer-inner a{color:#6b7280;text-decoration:none}
      .app-footer-inner a:hover{text-decoration:underline}
    `;
    document.head.appendChild(style);
  }

  function buildNav() {
    const nav = document.createElement("header");
    nav.className = "nav";

    const inner = document.createElement("div");
    inner.className = "nav-inner";

    const brand = document.createElement("a");
    brand.className = "brand";
    brand.href = "/dash.html";
    brand.setAttribute("aria-label", "Learnlio home");

    const img = document.createElement("img");
    img.src = LOGO_SRC;
    img.alt = BRAND_TEXT;
    img.onerror = () => (img.style.display = "none");

    const text = document.createElement("span");
    text.textContent = BRAND_TEXT;

    brand.appendChild(img);
    brand.appendChild(text);

    const navEl = document.createElement("nav");
    navEl.className = "links";

    routes.forEach((r) => {
      const a = document.createElement("a");
      a.href = r.href;
      a.textContent = r.label;
      if (isActive(r.href)) a.classList.add("active");
      navEl.appendChild(a);
    });

    const logoutBtn = document.createElement("button");
    logoutBtn.id = "logoutBtn";
    logoutBtn.className = "btn light";
    logoutBtn.type = "button";
    logoutBtn.textContent = "Log out";

    // Your pages already handle logout in most cases.
    // This is a safe fallback redirect.
    logoutBtn.addEventListener("click", () => {
      window.location.href = "/.html";
    });

    navEl.appendChild(logoutBtn);

    inner.appendChild(brand);
    inner.appendChild(navEl);
    nav.appendChild(inner);
    return nav;
  }

  function buildFooter() {
    const foot = document.createElement("footer");
    foot.className = "app-footer";

    const inner = document.createElement("div");
    inner.className = "app-footer-inner";

    const left = document.createElement("div");
    left.innerHTML = `© <span id="llYearApp"></span> Learnlio`;

    const right = document.createElement("div");
    right.style.display = "flex";
    right.style.gap = "12px";
    right.style.flexWrap = "wrap";

    const links = [
      { label: "Privacy", href: "/privacy.html" },
      { label: "Terms", href: "/terms.html" },
      { label: "Cookies", href: "/cookies.html" },
      { label: "Contact", href: "/contact.html" },
    ];

    links.forEach((l) => {
      const a = document.createElement("a");
      a.href = l.href;
      a.textContent = l.label;
      right.appendChild(a);
    });

    inner.appendChild(left);
    inner.appendChild(right);
    foot.appendChild(inner);

    setTimeout(() => {
      const y = document.getElementById("llYearApp");
      if (y) y.textContent = String(new Date().getFullYear());
    }, 0);

    return foot;
  }

  function mount() {
    ensureBaseStyles();

    const navMount = document.getElementById(NAV_MOUNT_ID);
    if (navMount) {
      navMount.innerHTML = "";
      navMount.appendChild(buildNav());
    }

    const footerMount = document.getElementById(FOOTER_MOUNT_ID);
    if (footerMount) {
      footerMount.innerHTML = "";
      footerMount.appendChild(buildFooter());
    }
  }

  mount();
})();
