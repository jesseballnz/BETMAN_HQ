#!/usr/bin/env node
'use strict';

const crypto = require('node:crypto');
const fs = require('node:fs');
const http = require('node:http');
const https = require('node:https');
const net = require('node:net');

const PORT = Number(process.env.PORT || 14321);
const HOST = process.env.HOST || '0.0.0.0';
const HQ_HOST = process.env.HQ_HOST || '127.0.0.1';
const HQ_PORT = Number(process.env.HQ_PORT || 14320);
const CORE_HOST = process.env.CORE_HOST || '127.0.0.1';
const CORE_PORT = Number(process.env.CORE_PORT || 18081);
const TLS_CERT = process.env.BETMAN_HQ_TLS_CERT || process.env.BETMAN_TLS_CERT || '/etc/ssl/betman/sectigo-fullchain.pem';
const TLS_KEY = process.env.BETMAN_HQ_TLS_KEY || process.env.BETMAN_TLS_KEY || '/etc/ssl/betman/betman.co.nz.key';
const AUTH_SECRET = process.env.BETMAN_HQ_AUTH_SECRET || '';
const ALLOWED_USER = String(process.env.ALLOWED_USER || 'betman').trim().toLowerCase();
const PASSWORD_SETUP_URL = process.env.BETMAN_PASSWORD_SETUP_URL || '';
const COOKIE = 'bm_hq_token';
const MAX_AGE = Number(process.env.BETMAN_HQ_TOKEN_MAX_AGE_SECONDS || 30 * 60);

function json(res, status, body) {
  res.writeHead(status, { 'content-type': 'application/json', 'cache-control': 'no-store' });
  res.end(JSON.stringify(body));
}

function html(res, status, body) {
  res.writeHead(status, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' });
  res.end(body);
}

function escapeHtml(value) {
  return String(value || '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}

function normalizeUser(value) {
  return String(value || '').trim().toLowerCase();
}

function readBody(req, limit = 65536) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.setEncoding('utf8');
    req.on('data', (chunk) => {
      body += chunk;
      if (body.length > limit) {
        reject(new Error('request_too_large'));
        req.destroy();
      }
    });
    req.on('end', () => resolve(body));
    req.on('error', reject);
  });
}

function b64(input) {
  return Buffer.from(input).toString('base64url');
}

function sign(value) {
  return crypto.createHmac('sha256', AUTH_SECRET).update(value).digest('base64url');
}

function issueToken(user) {
  const payload = {
    sub: normalizeUser(user),
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + MAX_AGE,
  };
  const encoded = b64(JSON.stringify(payload));
  return `${encoded}.${sign(encoded)}`;
}

function verifyToken(raw) {
  if (!AUTH_SECRET) return null;
  const [encoded, signature] = String(raw || '').split('.');
  if (!encoded || !signature) return null;
  const expected = sign(encoded);
  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  try {
    const payload = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8'));
    if (!payload.sub || Number(payload.exp || 0) < Math.floor(Date.now() / 1000)) return null;
    if (ALLOWED_USER && normalizeUser(payload.sub) !== ALLOWED_USER) return null;
    return payload;
  } catch {
    return null;
  }
}

function cookieValue(req, name) {
  const raw = String(req.headers.cookie || '');
  for (const part of raw.split(';')) {
    const [k, ...rest] = part.trim().split('=');
    if (k === name) return decodeURIComponent(rest.join('=') || '');
  }
  return '';
}

function bearer(req) {
  return String(req.headers.authorization || '').replace(/^Bearer\s+/i, '').trim();
}

function authPayload(req) {
  return verifyToken(cookieValue(req, COOKIE)) || verifyToken(bearer(req));
}

function loginCookie(token, req) {
  const secure = req.socket.encrypted ? '; Secure' : '';
  return `${COOKIE}=${encodeURIComponent(token)}; Path=/; Max-Age=${MAX_AGE}; HttpOnly; SameSite=Lax${secure}`;
}

function clearCookie(req) {
  const secure = req.socket.encrypted ? '; Secure' : '';
  return `${COOKIE}=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax${secure}`;
}

function passwordSetupUrl(req) {
  if (PASSWORD_SETUP_URL) return PASSWORD_SETUP_URL;
  return 'https://170.64.201.182/set-password';
}

function coreLogin(username, password) {
  return new Promise((resolve) => {
    const payload = JSON.stringify({ username, password });
    const upstream = http.request({
      hostname: CORE_HOST,
      port: CORE_PORT,
      method: 'POST',
      path: '/api/login',
      headers: {
        'content-type': 'application/json',
        'content-length': Buffer.byteLength(payload),
      },
    }, (coreRes) => {
      let body = '';
      coreRes.setEncoding('utf8');
      coreRes.on('data', (chunk) => { body += chunk; });
      coreRes.on('end', () => {
        let parsed = {};
        try { parsed = JSON.parse(body || '{}'); } catch {}
        resolve({ status: coreRes.statusCode || 0, body: parsed });
      });
    });
    upstream.setTimeout(8000, () => upstream.destroy(new Error('auth_timeout')));
    upstream.on('error', () => resolve({ status: 502, body: {} }));
    upstream.end(payload);
  });
}

function loginPage(req, res, message = '') {
  const url = new URL(req.url || '/', `http://${req.headers.host || 'betman-hq.local'}`);
  const next = url.searchParams.get('next') || '/';
  return html(res, 200, `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>BETMAN HQ Login</title>
  <style>
    * { box-sizing: border-box; }
    body { margin:0; min-height:100vh; display:grid; place-items:center; background:#07110a; color:#f6f8fb; font:16px system-ui,-apple-system,Segoe UI,Roboto,Arial,sans-serif; }
    body::before { content:""; position:fixed; inset:0; background:radial-gradient(circle at 18% 14%, rgba(197,255,0,.24), transparent 28rem), linear-gradient(135deg, rgba(255,255,255,.08), rgba(255,255,255,0)); pointer-events:none; }
    form { position:relative; width:min(440px,calc(100% - 32px)); border:1px solid rgba(197,255,0,.34); border-radius:8px; padding:32px; background:rgba(9,22,13,.92); box-shadow:0 28px 90px rgba(0,0,0,.36); }
    .brand { color:#c5ff00; font-size:12px; font-weight:900; letter-spacing:.16em; text-transform:uppercase; }
    h1 { margin:8px 0 6px; font-size:34px; line-height:1; letter-spacing:0; }
    p { margin:0 0 18px; color:rgba(246,248,251,.76); line-height:1.45; }
    label { display:block; margin-top:12px; color:#dbe6df; font-size:13px; font-weight:850; }
    input,button { width:100%; border-radius:8px; padding:13px; margin-top:7px; font:inherit; }
    input { background:#030805; color:#f6f8fb; border:1px solid rgba(255,255,255,.18); }
    button { margin-top:16px; background:#c5ff00; color:#07110a; border:0; font-weight:950; cursor:pointer; }
    .setup { display:block; margin-top:14px; border:1px solid rgba(197,255,0,.34); border-radius:8px; padding:12px; color:#c5ff00; text-align:center; text-decoration:none; font-weight:900; }
    .setup:hover { background:rgba(197,255,0,.08); }
    .msg { min-height:20px; margin-top:12px; color:#ffb4a8; font-size:13px; }
  </style>
</head>
<body>
  <form id="login">
    <div class="brand">BETMAN HQ</div>
    <h1>Company Operating System</h1>
    <p>Sign in with the BETMAN account to open HQ.</p>
    <label>Username</label>
    <input name="username" autocomplete="username" required autofocus />
    <label>Password</label>
    <input name="password" type="password" autocomplete="current-password" required />
    <button type="submit">Enter BETMAN HQ</button>
    <button class="setup" type="button" id="setupBtn">Set password from Stripe checkout</button>
    <div class="msg" id="msg">${escapeHtml(message)}</div>
  </form>
  <script>
    const next = ${JSON.stringify(next.startsWith('/') ? next : '/')};
    const msg = document.getElementById('msg');
    const setupBtn = document.getElementById('setupBtn');
    document.getElementById('login').addEventListener('submit', async (event) => {
      event.preventDefault();
      msg.textContent = '';
      const form = new FormData(event.currentTarget);
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ username: form.get('username'), password: form.get('password') })
      });
      if (!response.ok) {
        msg.textContent = 'Login failed.';
        return;
      }
      location.href = next || '/';
    });
    setupBtn.addEventListener('click', async () => {
      const email = document.querySelector('input[name="username"]').value || '';
      if (!email.trim()) {
        msg.textContent = 'Enter your Stripe account email first.';
        return;
      }
      msg.textContent = 'Requesting setup link...';
      setupBtn.disabled = true;
      try {
        const response = await fetch('/api/password-setup-link', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ email })
        });
        const body = await response.json().catch(() => ({}));
        if (!response.ok || body.ok === false) {
          msg.textContent = body.error === 'user_not_found' ? 'No Stripe account found for that email.' : 'Setup request failed.';
          return;
        }
        if (body.setupLink) location.href = body.setupLink;
        else msg.textContent = 'Setup request failed.';
      } catch {
        msg.textContent = 'Setup request failed.';
      } finally {
        setupBtn.disabled = false;
      }
    });
  </script>
</body>
</html>`);
}

async function handleLogin(req, res) {
  let body;
  try {
    body = JSON.parse(await readBody(req) || '{}');
  } catch {
    return json(res, 400, { ok: false, error: 'invalid_json' });
  }
  const username = String(body.username || '').trim();
  const password = String(body.password || '');
  if (!username || !password) return json(res, 400, { ok: false, error: 'missing_credentials' });

  const result = await coreLogin(username, password);
  if (result.status < 200 || result.status >= 300 || !result.body?.ok) {
    return json(res, 401, { ok: false, error: 'invalid_credentials' });
  }
  const user = normalizeUser(result.body.user || result.body.principal?.username || username);
  if (ALLOWED_USER && user !== ALLOWED_USER) return json(res, 403, { ok: false, error: 'betman_user_required' });
  const token = issueToken(user);
  res.writeHead(200, {
    'content-type': 'application/json',
    'cache-control': 'no-store',
    'set-cookie': loginCookie(token, req),
  });
  res.end(JSON.stringify({ ok: true, user, expiresIn: MAX_AGE }));
}

function proxy(req, res) {
  const headers = {
    ...req.headers,
    host: `${HQ_HOST}:${HQ_PORT}`,
    'x-forwarded-host': req.headers.host || '',
    'x-forwarded-proto': req.socket.encrypted ? 'https' : 'http',
  };
  delete headers.connection;
  const upstream = http.request({
    hostname: HQ_HOST,
    port: HQ_PORT,
    method: req.method,
    path: req.url || '/',
    headers,
  }, (upstreamRes) => {
    res.writeHead(upstreamRes.statusCode || 502, upstreamRes.headers);
    upstreamRes.pipe(res);
  });
  upstream.on('error', (error) => json(res, 502, { ok: false, error: 'hq_backend_unavailable', message: error.message }));
  req.pipe(upstream);
}

function proxyCore(req, res) {
  const isSetupLink = req.method === 'POST' && String(req.url || '').split('?')[0] === '/api/password-setup-link';
  const headers = {
    ...req.headers,
    host: isSetupLink ? '170.64.201.182' : (req.headers.host || `${CORE_HOST}:${CORE_PORT}`),
    'x-forwarded-host': isSetupLink ? '170.64.201.182' : (req.headers.host || ''),
    'x-forwarded-proto': isSetupLink ? 'https' : (req.socket.encrypted ? 'https' : 'http'),
  };
  delete headers.connection;
  const upstream = http.request({
    hostname: CORE_HOST,
    port: CORE_PORT,
    method: req.method,
    path: req.url || '/',
    headers,
  }, (upstreamRes) => {
    res.writeHead(upstreamRes.statusCode || 502, upstreamRes.headers);
    upstreamRes.pipe(res);
  });
  upstream.on('error', (error) => json(res, 502, { ok: false, error: 'core_backend_unavailable', message: error.message }));
  req.pipe(upstream);
}

function isPasswordSetupRoute(method, pathname) {
  if ((method === 'GET' || method === 'HEAD') && (pathname === '/set-password' || pathname === '/set-password.html')) return true;
  return method === 'POST' && (pathname === '/api/password-setup-link' || pathname === '/api/set-password');
}

function redirectToPasswordSetup(req, res, sourceUrl) {
  const target = new URL(passwordSetupUrl(req));
  sourceUrl.searchParams.forEach((value, key) => target.searchParams.set(key, value));
  res.writeHead(302, { location: target.toString(), 'cache-control': 'no-store' });
  res.end();
}

function redirectToLogin(req, res) {
  const next = encodeURIComponent(req.url || '/');
  res.writeHead(302, { location: `/login?next=${next}`, 'cache-control': 'no-store' });
  res.end();
}

async function handle(req, res) {
  const url = new URL(req.url || '/', `http://${req.headers.host || 'betman-hq.local'}`);
  if (url.pathname === '/healthz') return json(res, 200, { ok: true, service: 'betman-hq-gate' });
  if ((req.method === 'GET' || req.method === 'HEAD') && (url.pathname === '/set-password' || url.pathname === '/set-password.html')) return redirectToPasswordSetup(req, res, url);
  if (isPasswordSetupRoute(req.method, url.pathname)) return proxyCore(req, res);
  if ((req.method === 'GET' || req.method === 'HEAD') && (url.pathname === '/login' || url.pathname === '/')) {
    if (url.pathname === '/' && !authPayload(req)) return loginPage(req, res);
    if (url.pathname === '/login') return loginPage(req, res);
  }
  if (req.method === 'POST' && url.pathname === '/api/auth/login') return handleLogin(req, res);
  if (req.method === 'POST' && url.pathname === '/api/auth/logout') {
    res.writeHead(200, { 'content-type': 'application/json', 'set-cookie': clearCookie(req), 'cache-control': 'no-store' });
    return res.end(JSON.stringify({ ok: true }));
  }
  if (!authPayload(req)) return redirectToLogin(req, res);
  return proxy(req, res);
}

function requestHandler(req, res) {
  handle(req, res).catch((error) => json(res, 500, { ok: false, error: 'hq_gate_error', message: error.message }));
}

const hasTls = TLS_CERT && TLS_KEY && fs.existsSync(TLS_CERT) && fs.existsSync(TLS_KEY);
if (!hasTls) {
  http.createServer(requestHandler).listen(PORT, HOST, () => {
    console.log(`betman-hq-gate listening on http://${HOST}:${PORT}`);
  });
} else {
  const httpsServer = https.createServer({ cert: fs.readFileSync(TLS_CERT), key: fs.readFileSync(TLS_KEY) }, requestHandler);
  const httpServer = http.createServer(requestHandler);
  net.createServer((socket) => {
    socket.once('data', (buffer) => {
      if (buffer[0] === 22) httpsServer.emit('connection', socket);
      else httpServer.emit('connection', socket);
      socket.unshift(buffer);
    });
  }).listen(PORT, HOST, () => {
    console.log(`betman-hq-gate listening on http+https://${HOST}:${PORT}`);
  });
}
