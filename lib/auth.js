import crypto from 'crypto';

const COOKIE_NAME = 'leadgen_session';

function expectedToken() {
  // Deterministic token derived from the app password + a fixed salt.
  // Not bank-grade auth — this is a single-user internal tool sitting
  // behind a URL nobody else knows. Good enough to keep it from being
  // wide open, not a substitute for real auth if this ever has >1 user.
  return crypto
    .createHash('sha256')
    .update('leadgen-dashboard:' + process.env.APP_PASSWORD)
    .digest('hex');
}

export function isAuthed(req) {
  const cookie = req.cookies?.[COOKIE_NAME];
  return Boolean(cookie) && cookie === expectedToken();
}

export function setAuthCookie(res) {
  const token = expectedToken();
  res.setHeader(
    'Set-Cookie',
    `${COOKIE_NAME}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${60 * 60 * 24 * 30}`
  );
}

export function checkPassword(candidate) {
  return candidate === process.env.APP_PASSWORD;
}

export function isCronRequest(req) {
  const auth = req.headers['authorization'];
  return auth === `Bearer ${process.env.CRON_SECRET}`;
}
