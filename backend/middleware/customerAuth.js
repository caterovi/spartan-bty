const jwt = require('jsonwebtoken');
const pool = require('../config/db');

function getCustomerAccessSecret() {
  return process.env.CUSTOMER_JWT_SECRET || null;
}

async function verifyCustomerToken(req, res, next) {
  const authorization = req.headers.authorization;

  if (!authorization) {
    return res.status(401).json({
      success: false,
      message: 'Customer authentication token is required.',
    });
  }

  const [scheme, token] = authorization.trim().split(/\s+/);

  if (scheme !== 'Bearer' || !token) {
    return res.status(401).json({
      success: false,
      message: 'Invalid customer authentication format.',
    });
  }

  try {
    const customerAccessSecret = getCustomerAccessSecret();

    if (!customerAccessSecret) {
      return res.status(503).json({
        success: false,
        message: 'Customer authentication is not configured.',
      });
    }

    const decoded = jwt.verify(
      token,
      customerAccessSecret,
      {
        issuer: 'spartan-bty',
        audience: 'customer',
      }
    );

    if (
      decoded.accountType !== 'customer' ||
      !Number.isInteger(Number(decoded.customerId))
    ) {
      return res.status(403).json({
        success: false,
        message: 'A customer account is required.',
      });
    }

    const [accountRows] = await pool.execute(
      `
        SELECT id
        FROM customer_accounts
        WHERE id = ?
          AND customer_id = ?
          AND status = 'active'
        LIMIT 1
      `,
      [Number(decoded.id), Number(decoded.customerId)]
    );

    if (accountRows.length === 0) {
      return res.status(401).json({
        success: false,
        message: 'Customer account is unavailable or inactive.',
      });
    }

    req.customer = decoded;
    next();
  } catch (error) {
    const message =
      error.name === 'TokenExpiredError'
        ? 'Customer authentication token has expired.'
        : 'Invalid customer authentication token.';

    return res.status(401).json({
      success: false,
      message,
    });
  }
}

module.exports = verifyCustomerToken;
