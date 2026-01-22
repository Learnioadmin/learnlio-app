export async function onRequest(context) {
  const req = context.request;
  const url = new URL(req.url);
  const host = (url.hostname || "").toLowerCase();

  if (url.pathname === "/child-mode/on") {
    return handleChildModeOn(context);
  }
  if (url.pathname === "/child-mode/status") {
    return handleChildModeStatus(context);
  }
  if (url.pathname === "/parent/unlock") {
    return handleParentUnlock(context);
  }
  if (url.pathname === "/parent/pin/set") {
    return handleParentPinSet(context);
  }
  if (url.pathname === "/parent/pin/verify") {
    return handleParentPinVerify(context);
  }
  if (url.pathname === "/parent/pin/clear") {
    return handleParentPinClear(context);
  }
  if (url.pathname === "/child-mode/off") {
    return handleChildModeOff(context);
  }
  if (url.pathname === "/account/delete") {
    return handleAccountDelete(context);
  }

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

function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store"
    }
  });
}

async function handleAccountDelete(context) {
  const req = context.request;

  if (req.method !== "POST") {
    return jsonResponse({ ok: false, error: "Method not allowed" }, 405);
  }

  let payload;
  try {
    payload = await req.json();
  } catch {
    return jsonResponse({ ok: false, error: "Invalid JSON body" }, 400);
  }

  const password = String(payload?.password || "").trim();
  if (!password) {
    return jsonResponse({ ok: false, error: "Password required" }, 400);
  }

  const authHeader = req.headers.get("Authorization") || "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
  if (!token) {
    return jsonResponse({ ok: false, error: "Missing auth token" }, 401);
  }

  const {
    SUPABASE_URL,
    SUPABASE_ANON_KEY,
    SUPABASE_SERVICE_ROLE_KEY,
    STRIPE_SECRET_KEY
  } = context.env;

  if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !SUPABASE_SERVICE_ROLE_KEY) {
    return jsonResponse({ ok: false, error: "Server not configured" }, 500);
  }

  const user = await getSupabaseUser(SUPABASE_URL, SUPABASE_ANON_KEY, token);
  if (!user?.id || !user?.email) {
    return jsonResponse({ ok: false, error: "Unable to load user" }, 401);
  }

  const verified = await verifySupabasePassword(
    SUPABASE_URL,
    SUPABASE_ANON_KEY,
    user.email,
    password
  );

  if (!verified) {
    return jsonResponse({ ok: false, error: "Incorrect password" }, 400);
  }

  if (!STRIPE_SECRET_KEY) {
    return jsonResponse({ ok: false, error: "Stripe not configured" }, 500);
  }

  try {
    await cancelStripeSubscriptions(STRIPE_SECRET_KEY, user.email);
    await deleteSupabaseData(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, user.id);
    await deleteSupabaseUser(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, user.id);
    return jsonResponse({ ok: true });
  } catch (err) {
    const message = String(err?.message || err || "Account deletion failed");
    return jsonResponse({ ok: false, error: message }, 500);
  }
}

async function handleChildModeOn(context) {
  const req = context.request;
  if (req.method !== "POST") {
    return jsonResponse({ ok: false, error: "Method not allowed" }, 405);
  }

  const authHeader = req.headers.get("Authorization") || "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
  if (!token) {
    return jsonResponse({ ok: false, error: "Missing auth token" }, 401);
  }

  const { SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY } = context.env;
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !SUPABASE_SERVICE_ROLE_KEY) {
    return jsonResponse({ ok: false, error: "Server not configured" }, 500);
  }

  const user = await getSupabaseUser(SUPABASE_URL, SUPABASE_ANON_KEY, token);
  if (!user?.id) {
    return jsonResponse({ ok: false, error: "Unable to load user" }, 401);
  }

  try {
    await ensureProfile(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, user.id);
    await updateChildMode(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, user.id, true);
    return jsonResponse({ ok: true, child_mode: true });
  } catch (err) {
    return jsonResponse({ ok: false, error: String(err?.message || err) }, 500);
  }
}

async function handleChildModeStatus(context) {
  const req = context.request;
  if (req.method !== "GET") {
    return jsonResponse({ ok: false, error: "Method not allowed" }, 405);
  }

  const authHeader = req.headers.get("Authorization") || "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
  if (!token) {
    return jsonResponse({ ok: false, error: "Missing auth token" }, 401);
  }

  const { SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY } = context.env;
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !SUPABASE_SERVICE_ROLE_KEY) {
    return jsonResponse({ ok: false, error: "Server not configured" }, 500);
  }

  const user = await getSupabaseUser(SUPABASE_URL, SUPABASE_ANON_KEY, token);
  if (!user?.id) {
    return jsonResponse({ ok: false, error: "Unable to load user" }, 401);
  }

  try {
    await ensureProfile(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, user.id);
    const profile = await getProfile(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, user.id);
    const childMode = !!profile?.child_mode;
    const pinSet = typeof profile?.parent_pin_hash === "string"
      ? profile.parent_pin_hash.trim().length > 0
      : !!profile?.parent_pin_hash;
    return jsonResponse({ ok: true, child_mode: childMode, pin_set: pinSet });
  } catch (err) {
    return jsonResponse({ ok: false, error: String(err?.message || err) }, 500);
  }
}

async function handleParentUnlock(context) {
  const req = context.request;
  if (req.method !== "POST") {
    return jsonResponse({ ok: false, error: "Method not allowed" }, 405);
  }

  const authHeader = req.headers.get("Authorization") || "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
  if (!token) {
    return jsonResponse({ ok: false, error: "Missing auth token" }, 401);
  }

  let payload;
  try {
    payload = await req.json();
  } catch {
    return jsonResponse({ ok: false, error: "Invalid JSON body" }, 400);
  }

  const password = String(payload?.password || "").trim();
  if (!password) {
    return jsonResponse({ ok: false, error: "Password required" }, 400);
  }

  const { SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY } = context.env;
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !SUPABASE_SERVICE_ROLE_KEY) {
    return jsonResponse({ ok: false, error: "Server not configured" }, 500);
  }

  const user = await getSupabaseUser(SUPABASE_URL, SUPABASE_ANON_KEY, token);
  if (!user?.id || !user?.email) {
    return jsonResponse({ ok: false, error: "Unable to load user" }, 401);
  }

  const ok = await verifySupabasePassword(
    SUPABASE_URL,
    SUPABASE_ANON_KEY,
    user.email,
    password
  );

  if (!ok) {
    return jsonResponse({ ok: false, error: "Incorrect password" }, 403);
  }

  try {
    await ensureProfile(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, user.id);
    await updateChildMode(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, user.id, false);
    return jsonResponse({ ok: true, child_mode: false });
  } catch (err) {
    return jsonResponse({ ok: false, error: String(err?.message || err) }, 500);
  }
}

async function handleParentPinSet(context) {
  const req = context.request;
  if (req.method !== "POST") {
    return jsonResponse({ ok: false, error: "Method not allowed" }, 405);
  }

  const authHeader = req.headers.get("Authorization") || "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
  if (!token) {
    return jsonResponse({ ok: false, error: "Missing auth token" }, 401);
  }

  let payload;
  try {
    payload = await req.json();
  } catch {
    return jsonResponse({ ok: false, error: "Invalid JSON body" }, 400);
  }

  const pin = String(payload?.pin || "").trim();
  if (!isValidPin(pin)) {
    return jsonResponse({ ok: false, error: "PIN must be exactly 4 digits" }, 400);
  }

  const { SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY } = context.env;
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !SUPABASE_SERVICE_ROLE_KEY) {
    return jsonResponse({ ok: false, error: "Server not configured" }, 500);
  }

  const user = await getSupabaseUser(SUPABASE_URL, SUPABASE_ANON_KEY, token);
  if (!user?.id) {
    return jsonResponse({ ok: false, error: "Unable to load user" }, 401);
  }

  try {
    await ensureProfile(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, user.id);
    const hash = await hashPin(pin);
    await setParentPinHash(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, user.id, hash);
    return jsonResponse({ ok: true });
  } catch (err) {
    return jsonResponse({ ok: false, error: String(err?.message || err) }, 500);
  }
}

async function handleParentPinVerify(context) {
  const req = context.request;
  if (req.method !== "POST") {
    return jsonResponse({ ok: false, error: "Method not allowed" }, 405);
  }

  const authHeader = req.headers.get("Authorization") || "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
  if (!token) {
    return jsonResponse({ ok: false, error: "Missing auth token" }, 401);
  }

  let payload;
  try {
    payload = await req.json();
  } catch {
    return jsonResponse({ ok: false, error: "Invalid JSON body" }, 400);
  }

  const pin = String(payload?.pin || "").trim();
  if (!isValidPin(pin)) {
    return jsonResponse({ ok: false, error: "PIN must be exactly 4 digits" }, 400);
  }

  const { SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY } = context.env;
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !SUPABASE_SERVICE_ROLE_KEY) {
    return jsonResponse({ ok: false, error: "Server not configured" }, 500);
  }

  const user = await getSupabaseUser(SUPABASE_URL, SUPABASE_ANON_KEY, token);
  if (!user?.id) {
    return jsonResponse({ ok: false, error: "Unable to load user" }, 401);
  }

  try {
    await ensureProfile(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, user.id);
    const profile = await getProfile(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, user.id);
    const stored = String(profile?.parent_pin_hash || "");
    const ok = stored ? await verifyPin(pin, stored) : false;
    if (!ok) {
      return jsonResponse({ ok: false, error: "Invalid PIN" }, 401);
    }
    await updateChildMode(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, user.id, false);
    return jsonResponse({ ok: true });
  } catch (err) {
    return jsonResponse({ ok: false, error: String(err?.message || err) }, 500);
  }
}

async function handleParentPinClear(context) {
  const req = context.request;
  if (req.method !== "POST") {
    return jsonResponse({ ok: false, error: "Method not allowed" }, 405);
  }

  const authHeader = req.headers.get("Authorization") || "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
  if (!token) {
    return jsonResponse({ ok: false, error: "Missing auth token" }, 401);
  }

  let payload;
  try {
    payload = await req.json();
  } catch {
    return jsonResponse({ ok: false, error: "Invalid JSON body" }, 400);
  }

  const password = String(payload?.password || "").trim();
  if (!password) {
    return jsonResponse({ ok: false, error: "Password required" }, 400);
  }

  const { SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY } = context.env;
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !SUPABASE_SERVICE_ROLE_KEY) {
    return jsonResponse({ ok: false, error: "Server not configured" }, 500);
  }

  const user = await getSupabaseUser(SUPABASE_URL, SUPABASE_ANON_KEY, token);
  if (!user?.id || !user?.email) {
    return jsonResponse({ ok: false, error: "Unable to load user" }, 401);
  }

  const ok = await verifySupabasePassword(
    SUPABASE_URL,
    SUPABASE_ANON_KEY,
    user.email,
    password
  );
  if (!ok) {
    return jsonResponse({ ok: false, error: "Incorrect password" }, 403);
  }

  try {
    await ensureProfile(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, user.id);
    await setParentPinHash(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, user.id, null);
    return jsonResponse({ ok: true });
  } catch (err) {
    return jsonResponse({ ok: false, error: String(err?.message || err) }, 500);
  }
}

async function handleChildModeOff(context) {
  const req = context.request;
  if (req.method !== "POST") {
    return jsonResponse({ ok: false, error: "Method not allowed" }, 405);
  }

  const authHeader = req.headers.get("Authorization") || "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
  if (!token) {
    return jsonResponse({ ok: false, error: "Missing auth token" }, 401);
  }

  const { SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY } = context.env;
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !SUPABASE_SERVICE_ROLE_KEY) {
    return jsonResponse({ ok: false, error: "Server not configured" }, 500);
  }

  const user = await getSupabaseUser(SUPABASE_URL, SUPABASE_ANON_KEY, token);
  if (!user?.id) {
    return jsonResponse({ ok: false, error: "Unable to load user" }, 401);
  }

  try {
    await ensureProfile(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, user.id);
    await updateChildMode(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, user.id, false);
    return jsonResponse({ ok: true, child_mode: false });
  } catch (err) {
    return jsonResponse({ ok: false, error: String(err?.message || err) }, 500);
  }
}

async function getSupabaseUser(supabaseUrl, anonKey, accessToken) {
  const res = await fetch(`${supabaseUrl}/auth/v1/user`, {
    headers: {
      "Authorization": `Bearer ${accessToken}`,
      "apikey": anonKey
    }
  });

  if (!res.ok) return null;
  const data = await res.json();
  return data?.user || data;
}

async function verifySupabasePassword(supabaseUrl, anonKey, email, password) {
  const res = await fetch(`${supabaseUrl}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "apikey": anonKey
    },
    body: JSON.stringify({ email, password })
  });

  return res.ok;
}

async function cancelStripeSubscriptions(stripeKey, email) {
  const customerRes = await stripeFetch(
    stripeKey,
    `https://api.stripe.com/v1/customers?${new URLSearchParams({ email, limit: "1" })}`
  );

  const customer = customerRes?.data?.[0];
  if (!customer?.id) return;

  const subsRes = await stripeFetch(
    stripeKey,
    `https://api.stripe.com/v1/subscriptions?${new URLSearchParams({
      customer: customer.id,
      status: "all",
      limit: "100"
    })}`
  );

  const cancelable = new Set([
    "active",
    "trialing",
    "past_due",
    "unpaid",
    "incomplete"
  ]);

  for (const sub of subsRes?.data || []) {
    if (!sub?.id || !cancelable.has(sub.status)) continue;
    const params = new URLSearchParams({ invoice_now: "true", prorate: "true" });
    await stripeFetch(
      stripeKey,
      `https://api.stripe.com/v1/subscriptions/${sub.id}?${params}`,
      "DELETE",
      null,
      true
    );
  }
}

async function stripeFetch(stripeKey, url, method = "GET", body = null, allowMissing = false) {
  const res = await fetch(url, {
    method,
    headers: {
      "Authorization": `Bearer ${stripeKey}`,
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body
  });

  const text = await res.text();
  let json = null;
  try { json = text ? JSON.parse(text) : null; } catch {}

  if (!res.ok) {
    const code = json?.error?.code;
    const msg = json?.error?.message || text || `Stripe ${res.status}`;
    if (allowMissing && code === "resource_missing") return null;
    throw new Error(msg);
  }
  return json;
}

function isValidPin(pin) {
  return /^\d{4}$/.test(pin);
}

function toBase64(bytes) {
  let binary = "";
  bytes.forEach((b) => { binary += String.fromCharCode(b); });
  return btoa(binary);
}

function fromBase64(b64) {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

async function pbkdf2(pin, salt, iterations) {
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(pin),
    { name: "PBKDF2" },
    false,
    ["deriveBits"]
  );
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", hash: "SHA-256", salt, iterations },
    keyMaterial,
    256
  );
  return new Uint8Array(bits);
}

async function hashPin(pin) {
  const iterations = 100000;
  const salt = new Uint8Array(16);
  crypto.getRandomValues(salt);
  const hash = await pbkdf2(pin, salt, iterations);
  return `pbkdf2$${iterations}$${toBase64(salt)}$${toBase64(hash)}`;
}

async function verifyPin(pin, stored) {
  const parts = String(stored || "").split("$");
  if (parts.length !== 4 || parts[0] !== "pbkdf2") return false;
  const iterations = Number(parts[1]);
  if (!Number.isFinite(iterations) || iterations <= 0) return false;
  const salt = fromBase64(parts[2]);
  const expected = fromBase64(parts[3]);
  const actual = await pbkdf2(pin, salt, iterations);
  if (actual.length !== expected.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i++) diff |= expected[i] ^ actual[i];
  return diff === 0;
}

async function ensureProfile(supabaseUrl, serviceKey, userId) {
  const restBase = `${supabaseUrl}/rest/v1`;
  const headers = {
    "Authorization": `Bearer ${serviceKey}`,
    "apikey": serviceKey,
    "Content-Type": "application/json",
    "Prefer": "resolution=merge-duplicates"
  };

  const res = await fetch(`${restBase}/profiles?on_conflict=user_id`, {
    method: "POST",
    headers,
    body: JSON.stringify({ user_id: userId })
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || "Profile upsert failed");
  }
}

async function setParentPinHash(supabaseUrl, serviceKey, userId, hash) {
  const restBase = `${supabaseUrl}/rest/v1`;
  const headers = {
    "Authorization": `Bearer ${serviceKey}`,
    "apikey": serviceKey,
    "Content-Type": "application/json"
  };

  const params = new URLSearchParams({ user_id: `eq.${userId}` });
  const res = await fetch(`${restBase}/profiles?${params.toString()}`, {
    method: "PATCH",
    headers,
    body: JSON.stringify({ parent_pin_hash: hash })
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || "PIN update failed");
  }
}

async function getProfile(supabaseUrl, serviceKey, userId) {
  const restBase = `${supabaseUrl}/rest/v1`;
  const headers = {
    "Authorization": `Bearer ${serviceKey}`,
    "apikey": serviceKey
  };

  const params = new URLSearchParams({
    select: "child_mode,parent_pin_hash",
    user_id: `eq.${userId}`
  });

  const res = await fetch(`${restBase}/profiles?${params.toString()}`, {
    method: "GET",
    headers
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || "Profile fetch failed");
  }

  const rows = await res.json();
  return Array.isArray(rows) ? rows[0] : rows;
}

async function updateChildMode(supabaseUrl, serviceKey, userId, enabled) {
  const restBase = `${supabaseUrl}/rest/v1`;
  const headers = {
    "Authorization": `Bearer ${serviceKey}`,
    "apikey": serviceKey,
    "Content-Type": "application/json"
  };

  const payload = {
    child_mode: !!enabled,
    child_mode_updated_at: new Date().toISOString()
  };
  const params = new URLSearchParams({ user_id: `eq.${userId}` });
  const res = await fetch(`${restBase}/profiles?${params.toString()}`, {
    method: "PATCH",
    headers,
    body: JSON.stringify(payload)
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || "Profile update failed");
  }
}

async function deleteSupabaseData(supabaseUrl, serviceKey, userId) {
  const restBase = `${supabaseUrl}/rest/v1`;
  const headers = {
    "Authorization": `Bearer ${serviceKey}`,
    "apikey": serviceKey,
    "Content-Type": "application/json"
  };

  const children = await sbSelect(
    restBase,
    headers,
    "children",
    new URLSearchParams({ select: "id", parent_user_id: `eq.${userId}` })
  );
  const childIds = Array.isArray(children) ? children.map(c => c.id).filter(Boolean) : [];

  await sbDelete(restBase, headers, "session_items", new URLSearchParams({ owner_id: `eq.${userId}` }));
  await sbDelete(restBase, headers, "sessions", new URLSearchParams({ owner_id: `eq.${userId}` }));
  await sbDelete(restBase, headers, "child_skill_progress", new URLSearchParams({ owner_id: `eq.${userId}` }));
  await sbDelete(restBase, headers, "child_xp", new URLSearchParams({ owner_id: `eq.${userId}` }));
  await sbDelete(restBase, headers, "lesson_attempts", new URLSearchParams({ owner_id: `eq.${userId}` }));
  await sbDelete(restBase, headers, "weekly_report_settings", new URLSearchParams({ parent_user_id: `eq.${userId}` }));
  await sbDelete(restBase, headers, "weekly_reports", new URLSearchParams({ parent_user_id: `eq.${userId}` }));

  if (childIds.length) {
    const childFilter = new URLSearchParams({ child_id: `in.(${childIds.join(",")})` });
    await sbDelete(restBase, headers, "child_progress", childFilter);
    await sbDelete(restBase, headers, "progress", childFilter);
  }

  await sbDelete(restBase, headers, "children", new URLSearchParams({ parent_user_id: `eq.${userId}` }));
  await sbDelete(restBase, headers, "profiles", new URLSearchParams({ id: `eq.${userId}` }), true);
  await sbDelete(restBase, headers, "screeners", new URLSearchParams({ owner_id: `eq.${userId}` }), true);
  await sbDelete(restBase, headers, "screener_results", new URLSearchParams({ parent_user_id: `eq.${userId}` }), true);
}

async function sbSelect(restBase, headers, table, params) {
  const res = await fetch(`${restBase}/${table}?${params.toString()}`, {
    method: "GET",
    headers
  });
  if (!res.ok) {
    const text = await res.text();
    if (isMissingTable(text)) return [];
    throw new Error(text || `Supabase ${table} select failed`);
  }
  return res.json();
}

async function sbDelete(restBase, headers, table, params, allowMissing = false) {
  const res = await fetch(`${restBase}/${table}?${params.toString()}`, {
    method: "DELETE",
    headers
  });

  if (!res.ok) {
    const text = await res.text();
    if (allowMissing && isMissingTable(text)) return;
    throw new Error(text || `Supabase ${table} delete failed`);
  }
}

function isMissingTable(text) {
  const msg = String(text || "");
  return msg.includes("does not exist") || msg.includes("relation") || msg.includes("not found");
}

async function deleteSupabaseUser(supabaseUrl, serviceKey, userId) {
  const res = await fetch(`${supabaseUrl}/auth/v1/admin/users/${userId}`, {
    method: "DELETE",
    headers: {
      "Authorization": `Bearer ${serviceKey}`,
      "apikey": serviceKey
    }
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || "Failed to delete auth user");
  }
}
