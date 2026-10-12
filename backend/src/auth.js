import crypto from 'node:crypto';
import { Router } from 'express';

// Dashboard password protection.
// - DASHBOARD_PASSWORD: the password for the dashboard. If unset, auth is disabled.
// - AUTH_SECRET: key used to sign login tokens (defaults to one derived from the password,
//   so changing the password logs everyone out).
// Tokens are stateless: "<expiry ms>.<HMAC-SHA256 signature>".

const PASSWORD = process.env.DASHBOARD_PASSWORD || '';
const SECRET =
  process.env.AUTH_SECRET || crypto.createHash('sha256').update(`dashboard:${PASSWORD}`).digest('hex');
const TOKEN_TTL_MS = 12 * 60 * 60 * 1000; // 12 hours

// Login attempt limit per IP, to slow down password guessing.
const MAX_ATTEMPTS = 10;
const ATTEMPT_WINDOW_MS = 15 * 60 * 1000;
const attempts = new Map();

export const authEnabled = PASSWORD.length > 0;

const sha256 = (value) => crypto.createHash('sha256').update(value).digest();
const sign = (payload) => crypto.createHmac('sha256', SECRET).update(payload).digest('hex');

function passwordMatches(candidate) {
  // Compare fixed-length hashes so the comparison time doesn't depend on the input.
  return crypto.timingSafeEqual(sha256(String(candidate)), sha256(PASSWORD));
}

function createToken() {
  const expires = String(Date.now() + TOKEN_TTL_MS);
  return { token: `${expires}.${sign(expires)}`, expires_at: Number(expires) };
}

function verifyToken(token) {
  if (typeof token !== 'string') return false;
  const [expires, signature] = token.split('.');
  if (!expires || !signature || Number(expires) < Date.now()) return false;
  const expected = Buffer.from(sign(expires), 'hex');
  const given = Buffer.from(signature, 'hex');
  return given.length === expected.length && crypto.timingSafeEqual(given, expected);
}

function tooManyAttempts(ip) {
  const now = Date.now();
  const entry = attempts.get(ip);
  if (!entry || now - entry.start > ATTEMPT_WINDOW_MS) {
    attempts.set(ip, { start: now, count: 1 });
    return false;
  }
  entry.count += 1;
  return entry.count > MAX_ATTEMPTS;
}

// Middleware: rejects requests without a valid "Authorization: Bearer <token>" header.
export function requireAuth(req, res, next) {
  if (!authEnabled) return next();
  const header = req.get('authorization') || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : '';
  if (verifyToken(token)) return next();
  res.status(401).json({ error: 'authentication required' });
}

export const authRouter = Router();

// GET /api/auth/status: tells the dashboard whether a password is required
// and whether the token it sent (if any) is still valid.
authRouter.get('/status', (req, res) => {
  const header = req.get('authorization') || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : '';
  res.json({ required: authEnabled, authenticated: !authEnabled || verifyToken(token) });
});

// POST /api/auth/login  { password } -> { token, expires_at }
authRouter.post('/login', (req, res) => {
  if (!authEnabled) return res.json({ token: null, expires_at: null });

  if (tooManyAttempts(req.ip)) {
    return res.status(429).json({ error: 'Too many attempts. Try again in a few minutes.' });
  }

  const { password } = req.body || {};
  if (typeof password !== 'string' || !passwordMatches(password)) {
    return res.status(401).json({ error: 'Incorrect password' });
  }

  attempts.delete(req.ip);
  res.json(createToken());
});
