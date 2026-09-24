const jwt = require('jsonwebtoken');

function verifyToken(req, res, next) {
  const authorization = req.headers.authorization;

  if (!authorization) {
    return res.status(401).json({
      success: false,
      message: 'Authentication token is required.',
    });
  }

  const [scheme, token] = authorization.trim().split(/\s+/);

  if (scheme !== 'Bearer' || !token) {
    return res.status(401).json({
      success: false,
      message: 'Invalid authentication format.',
    });
  }

  try {
    const decoded = jwt.verify(
      token,
      process.env.JWT_SECRET,
      {
        issuer: 'spartan-bty',
        audience: 'staff',
      }
    );

    if (
      decoded.accountType !== 'staff' ||
      ![
        'head',
        'specialist',
        'system_configuration',
      ].includes(decoded.role)
    ) {
      return res.status(403).json({
        success: false,
        message: 'A staff account is required.',
      });
    }

    req.user = decoded;
    next();
  } catch (error) {
    const message =
      error.name === 'TokenExpiredError'
        ? 'Authentication token has expired.'
        : 'Invalid authentication token.';

    return res.status(401).json({
      success: false,
      message,
    });
  }
}

module.exports = verifyToken;
