const jwt = require('jsonwebtoken');

function getCustomerAccessSecret() {
  return process.env.CUSTOMER_JWT_SECRET || null;
}

function verifyCustomerToken(req, res, next) {
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
