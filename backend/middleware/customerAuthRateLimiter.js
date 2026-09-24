const {
  ipKeyGenerator,
  rateLimit,
} = require('express-rate-limit');

const customerLoginAccountLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  keyGenerator: (req) => {
    const email = String(req.body?.email || 'anonymous')
      .trim()
      .toLowerCase();
    return `${ipKeyGenerator(req.ip)}:${email}`;
  },
  handler: (req, res) =>
    res.status(429).json({
      success: false,
      message:
        'Too many customer login attempts. Please wait and try again.',
    }),
});

const customerLoginIpLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 30,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  handler: (req, res) =>
    res.status(429).json({
      success: false,
      message:
        'Too many customer login attempts. Please wait and try again.',
    }),
});

const customerSignupLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 5,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  handler: (req, res) =>
    res.status(429).json({
      success: false,
      message:
        'Too many signup attempts. Please wait before trying again.',
    }),
});

module.exports = {
  customerLoginAccountLimiter,
  customerLoginIpLimiter,
  customerSignupLimiter,
};
