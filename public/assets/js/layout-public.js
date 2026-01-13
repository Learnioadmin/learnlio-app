/* layout-public.js
   Public/marketing navigation + footer.
   Mounts into:
     <div id="navMount"></div>
     <div id="footerMount"></div>
*/

(() => {
  const NAV_MOUNT_ID = "navMount";
  const FOOTER_MOUNT_ID = "footerMount";

  const LOGO_SRC = "/assets/img/logo.webp";
  const BRAND_TEXT = "Learnlio";

  // Public routes
  const routes = [
    { label: "Home", href: "/" },
    { label: "Why Learnlio", href: "/why-learnlio.html" },
    { label: "Pricing", href: "/pricing.html" },
    // FAQ is a section on homepage:
    { label: "FAQ", href: "/#faq" },
  ];

  // CTA buttons (right side)
  const ctas = [
    { label: "Log in", href: "/login.html", kind: "light" },
    { label: "Start free trial", href: "/login.html", kind: "primary" },
  ];

  function normalizePath(pathname) {
    // treat "/" and "/index.html" as same
    if (pathname === "/index.html") return "/";
    return pathname;
  }

  function isActive(href) {
    const u = new URL(href, window.location.origin);
    const currentPath = normalizePath(window.location.pathname);
    const hrefPath = normalizePath(u.pathname);

    // Active match by pathname only (FAQ anchor should not break active state)
    // If we're on home page, Home should be active.
    if (hrefPath === "/" && currentPath === "/") return true;

    // If exact pathname matches, active
    if (hrefPath !== "/" && hrefPath === currentPath) return true;

    return false;
  }

  function ensureBaseStyles() {
    // If app.css fails, the page should still look OK.
    // Only inject if not already present.
    if (document.getElementById("learnlio-layout-public-style")) return;

    const style = document.createElement("style");
    style.id = "learnlio-layout-public-style";
    style.textContent = `
      .nav{background:#fff;border-bottom:1px solid #ececf4;position:sticky;top:0;z-index:50}
      .nav-inner{max-width:1100px;margin:0 auto;padding:12px 18px;display:flex;align-items:center;justify-content:space-between;gap:12px}
      .brand{display:flex;align-items:center;gap:10px;text-decoration:none;color:#111;font-weight:800;letter-spacing:.2px}
      .brand img{height:34px;width:auto;display:block}
      .links{display:flex;gap:8px;align-items:center;flex-wrap:wrap;justify-content:flex-end}
      .links a{text-decoration:none;padding:10px 12px;border-radius:12px;color:#111}
      .links a:hover{background:#f3f4f6}
      .links a.active{background:#eef2ff}
      .btn{background:#0b5cff;color:#fff;border:none;padding:12px 14px;border-radius:14px;cursor:pointer;font-size:14px;font-weight:700;text-decoration:none;display:inline-flex;align-items:center;gap:10px}
      .btn:hover{filter:brightness(.95)}
      .btn.light{background:#e5e7eb;color:#111}
      .footer-strip{border-top:1px solid #ececf4;margin-top:24px;padding:18px 0 40px;color:#6b7280;font-size:14px}
      .footer-inner{max-width:1100px;margin:0 auto;padding:0 18px;display:flex;justify-content:space-between;gap:12px;flex-wrap:wrap;align-items:center}
      .footer-inner a{color:#6b7280;text-decoration:none}
      .footer-inner a:hover{text-decoration:underline}
    `;
    document.head.appendChild(style);
  }

  function buildNav() {
    const nav = document.createElement("header");
    nav.className = "nav";

    const inner = document.createElement("div");
    inner.className = "nav-inner";

    // Brand
    const brand = document.createElement("a");
    brand.className = "brand";
    brand.href = "/";
    brand.setAttribute("aria-label", "Learnlio home");

    const img = document.createElement("img");
    img.src = LOGO_SRC;
    img.alt = BRAND_TEXT;
    img.onerror = () => {
      img.style.display = "none";
    };

    const text = document.createElement("span");
    text.textContent = BRAND_TEXT;

    brand.appendChild(img);
    brand.appendChild(text);

    // Links
    const navEl = document.createElement("nav");
    navEl.className = "links";

    routes.forEach((r) => {
      const a = document.createElement("a");
      a.href = r.href;
      a.textContent = r.label;

      if (isActive(r.href)) a.classList.add("active");

      navEl.appendChild(a);
    });

    // CTAs
    ctas.forEach((c) => {
      const a = document.createElement("a");
      a.href = c.href;
      a.textContent = c.label;
      a.className = c.kind === "primary" ? "btn" : "btn light";
      navEl.appendChild(a);
    });

    inner.appendChild(brand);
    inner.appendChild(navEl);
    nav.appendChild(inner);

    return nav;
  }

  function buildFooter() {
    const foot = document.createElement("footer");
    foot.className = "footer-strip";

    const inner = document.createElement("div");
    inner.className = "footer-inner";

    const left = document.createElement("div");
    left.innerHTML = `© <span id="llYear"></span> Learnlio. Built in the UK.`;

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

    // year
    setTimeout(() => {
      const y = document.getElementById("llYear");
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

