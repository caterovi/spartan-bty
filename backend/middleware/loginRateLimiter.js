/**
 * Server-side brute-force protection for the login endpoint
 * (Spartan BTY security audit — Recommendation #2).
 *
 * Two complementary limits, both keyed from the real client IP
 * (`req.ip`, which behind Render's reverse proxy resolves from the
 * `X-Forwarded-For` header thanks to `app.set('trust proxy', 1)` in
 * server.js):
 *
 *   - loginAccountLimiter: 10 failed attempts / 15 min per IP + account.
 *       Stops an attacker from guessing a single account's password, while
 *       giving a legitimate user up to 10 tries per 15 minutes to recover
 *       from typos.
 *   - loginIpLimiter: 30 failed attempts / 15 min per client IP.
 *       Stops an attacker spraying many different usernames from one IP.
 *
 * Both limiters only count FAILED logins (`skipSuccessfulRequests: true`),
 * so normal users are never penalized for occasional mistakes, and any
 * successful login from a given IP / account resets that window (treated as
 * fresh human activity). Combined with bcrypt cost 12 on the existing login
 * handler, this makes automated password guessing impractical.
 *
 * The chosen limits are conservative defaults appropriate for a small
 * internal MIS and can be tuned in this single file if deployment needs
 * change. No account lockout is introduced (per audit guidance) — the
 * protection is temporary throttling that self-heals after each window.
 */
const { rateLimit } = require('express-rate-limit');

const WINDOW_MS = 15 * 60 * 1000; // 15 minutes
const ACCOUNT_MAX_FAILED = 10; // failed attempts per IP + account
const IP_MAX_FAILED = 30; // failed attempts per client IP (all accounts)

const baseOptions = {
  windowMs: WINDOW_MS,
  standardHeaders: 'draft-7', // IETF draft-7 RateLimit-* headers
  legacyHeaders: false, // do not emit deprecated X-RateLimit-* headers
  skipSuccessfulRequests: true, // only failed logins count; a success resets the window
  requestWasSuccessful: (req, res) => res.statusCode < 400,
  handler: (req, res) => {
    res.status(429).json({
      success: false,
      message:
        'Too many login attempts. Please wait a few minutes and try again.',
    });
  },
};

// Limits failed logins per client IP + account (username or email).
const loginAccountLimiter = rateLimit({
  ...baseOptions,
  limit: ACCOUNT_MAX_FAILED,
  keyGenerator: (req) => {
    const identifier = String(
      req.body?.username || req.body?.email || 'anonymous'
    )
      .trim()
      .toLowerCase();

    return `${req.ip}:${identifier}`;
  },
});

// Hard cap on failed logins per client IP, regardless of account.
const loginIpLimiter = rateLimit({
  ...baseOptions,
  limit: IP_MAX_FAILED,
  keyGenerator: (req) => req.ip,
});

module.exports = {
  loginAccountLimiter,
  loginIpLimiter,
};
