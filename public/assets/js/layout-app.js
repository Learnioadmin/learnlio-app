/* layout-app.js
   Logged-in app navigation (Dashboard/Tutor/Screener/Reports/Billing + Logout).
   Mounts into:
     <div id="navMount"></div>
*/

(() => {
  const NAV_MOUNT_ID = "navMount";

  const LOGO_SRC = "/assets/img/logo.webp";
  const BRAND_TEXT = "Learnlio";

  const routes = [
    { label: "Dashboard", href: "/dash.html" },
    { label: "Learnlio Tutor", href: "/chat.html" },
    { label: "Dyslexia Screener", href: "/screener.html" },
    { label: "Reports", href: "/reports.html" },
    { label: "Billing", href: "/billing.html" },
  ];

  function normalizePath(pathname) {
    return pathname;
  }

  function isActive(href) {
    const u = new URL(href, window.location.origin);
    const currentPath = normalizePath(window.location.pathname);
    const hrefPath = normalizePath(u.pathname);
    return hrefPath === currentPath;
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

    // If the page already has its own logout handler, it can still hook this ID.
    // If not, we do a safe fallback:
    logoutBtn.addEventListener("click", async () => {
      try {
        if (window.supabase && window.supabase?.createClient) {
          // If the page has sb client as `sb`, it will handle it.
          // Fallback: do nothing.
        }
      } catch {}
      // Always redirect to login (pages may also signOut)
      window.location.href = "/login.html";
    });

    navEl.appendChild(logoutBtn);

    inner.appendChild(brand);
    inner.appendChild(navEl);
    nav.appendChild(inner);
    return nav;
  }

  function mount() {
    ensureBaseStyles();
    const navMount = document.getElementById(NAV_MOUNT_ID);
    if (!navMount) return;

    navMount.innerHTML = "";
    navMount.appendChild(buildNav());
  }

  mount();
})();
