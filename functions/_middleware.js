export async function onRequest(context) {
  const req = context.request;
  const url = new URL(req.url);
  const host = (url.hostname || "").toLowerCase();

  const isAppHost =
    host === "app.learnlio.co.uk" ||
    host.startsWith("app.learnlio-app.pages.dev"); // optional safety for preview

  // Always allow assets through untouched
  if (url.pathname.startsWith("/assets/")) {
    return context.next();
  }

  // =========
  // APP HOST
  // =========
  if (isAppHost) {
    // If someone hits the app root, send them to login (or dash if you prefer)
    if (url.pathname === "/" || url.pathname === "/index.html") {
      return Response.redirect(new URL("/login.html", url), 302);
    }
    // Let app pages load normally (dash.html, chat.html, billing.html, etc.)
    return context.next();
  }

  // =============
  // PUBLIC HOSTS
  // =============
  // If someone tries to open app pages on the public domain, bounce them to app subdomain
  const appPaths = new Set([
    "/login.html",
    "/dash.html",
    "/chat.html",
    "/billing.html",
    "/reports.html",
    "/screener.html"
  ]);

  if (appPaths.has(url.pathname)) {
    const redirectTo = new URL(req.url);
    redirectTo.hostname = "app.learnlio.co.uk";
    return Response.redirect(redirectTo, 302);
  }

  // If someone hits "/" on public, serve homepage normally
  return context.next();
}
