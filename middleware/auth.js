import jwt from 'jsonwebtoken';
import crypto from 'crypto';

export const COOKIE_NAME = 'qs_session';
const SESSION_DAYS = 7;
const SESSION_MS = SESSION_DAYS * 24 * 60 * 60 * 1000;

// Read lazily so dotenv has already run. If JWT_SECRET is missing we fall back to a
// random per-process secret: the site keeps working, but everyone is logged out on
// every restart until JWT_SECRET is set.
let fallbackSecret = null;
function getSecret() {
  if (process.env.JWT_SECRET) return process.env.JWT_SECRET;
  if (!fallbackSecret) {
    fallbackSecret = crypto.randomBytes(48).toString('hex');
    console.warn('⚠️  JWT_SECRET is not set. Using a temporary secret; logins reset on every restart.');
  }
  return fallbackSecret;
}

function parseCookies(header = '') {
  const out = {};
  for (const part of header.split(';')) {
    const idx = part.indexOf('=');
    if (idx === -1) continue;
    const key = part.slice(0, idx).trim();
    const val = part.slice(idx + 1).trim();
    if (key) {
      try { out[key] = decodeURIComponent(val); } catch { out[key] = val; }
    }
  }
  return out;
}

function cookieOptions() {
  return {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production' || !!process.env.RENDER,
    path: '/',
    maxAge: SESSION_MS
  };
}

export function issueSession(res, userId) {
  const token = jwt.sign({ sub: String(userId) }, getSecret(), { expiresIn: `${SESSION_DAYS}d` });
  res.cookie(COOKIE_NAME, token, cookieOptions());
}

export function clearSession(res) {
  const { maxAge, ...opts } = cookieOptions();
  res.clearCookie(COOKIE_NAME, opts);
}

function readUserId(req) {
  const token = parseCookies(req.headers.cookie)[COOKIE_NAME];
  if (!token) return null;
  try {
    const payload = jwt.verify(token, getSecret());
    return payload.sub ? String(payload.sub) : null;
  } catch {
    return null;
  }
}

// Requires a valid session. Sets req.auth.userId.
export function requireAuth(req, res, next) {
  const userId = readUserId(req);
  if (!userId) {
    return res.status(401).json({ success: false, code: 'AUTH_REQUIRED', message: 'Please log in to continue' });
  }
  req.auth = { userId };
  next();
}

// Same check for browser navigations (e.g. Stripe sending the user back to us):
// send them to the login page instead of returning JSON.
export function requireAuthPage(req, res, next) {
  const userId = readUserId(req);
  if (!userId) return res.redirect('/login.html');
  req.auth = { userId };
  next();
}

// The id the client sends must be the logged-in user. If the client left it out,
// fill it in from the session. Use after requireAuth.
//   matchesAuth('body', 'fromUserId')  matchesAuth('params', 'userId')
export function matchesAuth(source, field) {
  return (req, res, next) => {
    if (!req[source]) req[source] = {};
    const sent = req[source][field];
    if (sent === undefined || sent === null || sent === '') {
      if (source === 'params') {
        return res.status(400).json({ success: false, message: `${field} is required` });
      }
      req[source][field] = req.auth.userId;
      return next();
    }
    if (String(sent) !== req.auth.userId) {
      return res.status(403).json({ success: false, message: 'You can only act as yourself' });
    }
    next();
  };
}

// Small in-memory limiter for login and signup. Resets on restart, which is fine
// for slowing down password guessing on a single server.
export function rateLimit({ windowMs, max, keyFn, message }) {
  const hits = new Map();
  setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of hits) if (entry.reset <= now) hits.delete(key);
  }, 60 * 1000).unref();

  return (req, res, next) => {
    const key = keyFn ? keyFn(req) : req.ip;
    const now = Date.now();
    let entry = hits.get(key);
    if (!entry || entry.reset <= now) {
      entry = { count: 0, reset: now + windowMs };
      hits.set(key, entry);
    }
    entry.count++;
    if (entry.count > max) {
      res.set('Retry-After', String(Math.ceil((entry.reset - now) / 1000)));
      return res.status(429).json({ success: false, message: message || 'Too many attempts. Please try again later.' });
    }
    next();
  };
}
