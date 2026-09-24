const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const pool = require('../config/db');

const ACCESS_EXPIRES = '1h';
const REFRESH_EXPIRES = '7d';
const TOKEN_ISSUER = 'spartan-bty';
const CUSTOMER_AUDIENCE = 'customer';
const FORBIDDEN_SIGNUP_FIELDS = [
  'role',
  'department',
  'departmentId',
  'departmentCode',
  'accountType',
  'permissions',
];

function cleanText(value) {
  return String(value || '').trim();
}

function normalizeContactNumber(value) {
  return cleanText(value).replace(/[+ ()-]/g, '');
}

function getAccessSecret() {
  if (!process.env.CUSTOMER_JWT_SECRET) {
    throw new Error('CUSTOMER_JWT_SECRET is not configured.');
  }

  return process.env.CUSTOMER_JWT_SECRET;
}

function getRefreshSecret() {
  if (!process.env.CUSTOMER_JWT_REFRESH_SECRET) {
    throw new Error(
      'CUSTOMER_JWT_REFRESH_SECRET is not configured.'
    );
  }

  return process.env.CUSTOMER_JWT_REFRESH_SECRET;
}

function createAccessToken(account) {
  return jwt.sign(
    {
      id: Number(account.id),
      customerId: Number(account.customer_id),
      email: account.email,
      accountType: 'customer',
    },
    getAccessSecret(),
    {
      expiresIn: ACCESS_EXPIRES,
      issuer: TOKEN_ISSUER,
      audience: CUSTOMER_AUDIENCE,
    }
  );
}

function createRefreshToken(account) {
  return jwt.sign(
    {
      id: Number(account.id),
      customerId: Number(account.customer_id),
      accountType: 'customer',
    },
    getRefreshSecret(),
    {
      expiresIn: REFRESH_EXPIRES,
      issuer: TOKEN_ISSUER,
      audience: CUSTOMER_AUDIENCE,
    }
  );
}

function formatCustomerAccount(account) {
  return {
    id: Number(account.id),
    customerId: Number(account.customer_id),
    email: account.email,
    fullName: account.full_name,
    contactNumber: account.contact_number,
    address: account.address,
    accountType: 'customer',
    lastLoginAt: account.last_login_at || null,
    createdAt: account.created_at || null,
  };
}

function hasForbiddenSignupField(body) {
  return FORBIDDEN_SIGNUP_FIELDS.some((field) =>
    Object.prototype.hasOwnProperty.call(body, field)
  );
}

function validateSignupInput({
  fullName,
  email,
  password,
  contactNumber,
  address,
}) {
  if (!fullName || !email || !password || !contactNumber || !address) {
    return 'Full name, email, password, contact number, and address are required.';
  }

  if (fullName.length < 2 || fullName.length > 150) {
    return 'Full name must contain 2 to 150 characters.';
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return 'Enter a valid email address.';
  }

  if (email.length > 150) {
    return 'Email address is too long.';
  }

  if (password.length < 8 || password.length > 128) {
    return 'Password must contain 8 to 128 characters.';
  }

  if (
    contactNumber.length > 30 ||
    normalizeContactNumber(contactNumber).length < 7
  ) {
    return 'Enter a valid contact number.';
  }

  if (address.length > 1000) {
    return 'Address is too long.';
  }

  return null;
}

async function findActiveAccountById(accountId, customerId = null) {
  const customerCondition = customerId
    ? 'AND ca.customer_id = ?'
    : '';
  const values = customerId
    ? [accountId, customerId]
    : [accountId];

  const [rows] = await pool.execute(
    `
      SELECT
        ca.id,
        ca.customer_id,
        ca.email,
        ca.status,
        ca.last_login_at,
        ca.created_at,
        c.full_name,
        c.contact_number,
        c.address
      FROM customer_accounts ca
      INNER JOIN customers c
        ON c.id = ca.customer_id
      WHERE ca.id = ?
        ${customerCondition}
        AND ca.status = 'active'
      LIMIT 1
    `,
    values
  );

  return rows[0] || null;
}

// POST /api/customer-auth/signup
exports.signup = async (req, res) => {
  let connection;

  try {
    getAccessSecret();
    getRefreshSecret();

    if (hasForbiddenSignupField(req.body || {})) {
      return res.status(400).json({
        success: false,
        message:
          'Role, department, account type, and permissions cannot be assigned during customer signup.',
      });
    }

    const fullName = cleanText(req.body.fullName);
    const email = cleanText(req.body.email).toLowerCase();
    const password = String(req.body.password || '');
    const contactNumber = cleanText(req.body.contactNumber);
    const address = cleanText(req.body.address);

    const validationError = validateSignupInput({
      fullName,
      email,
      password,
      contactNumber,
      address,
    });

    if (validationError) {
      return res.status(400).json({
        success: false,
        message: validationError,
      });
    }

    connection = await pool.getConnection();
    await connection.beginTransaction();

    const [existingAccountRows] = await connection.execute(
      `
        SELECT id
        FROM customer_accounts
        WHERE email = ?
        LIMIT 1
        FOR UPDATE
      `,
      [email]
    );

    if (existingAccountRows.length > 0) {
      await connection.rollback();
      return res.status(409).json({
        success: false,
        message: 'A customer account already uses this email address.',
      });
    }

    const normalizedContact = normalizeContactNumber(contactNumber);
    const [existingCustomerRows] = await connection.execute(
      `
        SELECT c.id
        FROM customers c
        WHERE REPLACE(
          REPLACE(
            REPLACE(
              REPLACE(
                REPLACE(c.contact_number, ' ', ''),
                '-',
                ''
              ),
              '(',
              ''
            ),
            ')',
            ''
          ),
          '+',
          ''
        ) = ?
        LIMIT 1
        FOR UPDATE
      `,
      [normalizedContact]
    );

    if (existingCustomerRows.length > 0) {
      await connection.rollback();
      return res.status(409).json({
        success: false,
        message:
          'A customer record already uses this contact number. Staff verification is required before it can be linked to an online account.',
      });
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const [customerResult] = await connection.execute(
      `
        INSERT INTO customers (
          full_name,
          contact_number,
          address
        )
        VALUES (?, ?, ?)
      `,
      [fullName, contactNumber, address]
    );

    const [accountResult] = await connection.execute(
      `
        INSERT INTO customer_accounts (
          customer_id,
          email,
          password_hash,
          status
        )
        VALUES (?, ?, ?, 'active')
      `,
      [customerResult.insertId, email, passwordHash]
    );

    await connection.commit();

    const account = {
      id: accountResult.insertId,
      customer_id: customerResult.insertId,
      email,
      full_name: fullName,
      contact_number: contactNumber,
      address,
      status: 'active',
      last_login_at: null,
      created_at: new Date(),
    };

    return res.status(201).json({
      success: true,
      message: 'Customer account created successfully.',
      accessToken: createAccessToken(account),
      refreshToken: createRefreshToken(account),
      customer: formatCustomerAccount(account),
    });
  } catch (error) {
    if (connection) {
      try {
        await connection.rollback();
      } catch (rollbackError) {
        console.error('Customer signup rollback error:', rollbackError);
      }
    }

    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({
        success: false,
        message: 'The customer account could not be created with those details.',
      });
    }

    console.error('Customer signup error:', error);
    return res.status(500).json({
      success: false,
      message: 'Unable to create the customer account.',
    });
  } finally {
    if (connection) {
      connection.release();
    }
  }
};

// POST /api/customer-auth/login
exports.login = async (req, res) => {
  try {
    getAccessSecret();
    getRefreshSecret();

    const email = cleanText(req.body.email).toLowerCase();
    const password = String(req.body.password || '');

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Email and password are required.',
      });
    }

    const [rows] = await pool.execute(
      `
        SELECT
          ca.id,
          ca.customer_id,
          ca.email,
          ca.password_hash,
          ca.status,
          ca.last_login_at,
          ca.created_at,
          c.full_name,
          c.contact_number,
          c.address
        FROM customer_accounts ca
        INNER JOIN customers c
          ON c.id = ca.customer_id
        WHERE ca.email = ?
          AND ca.status = 'active'
        LIMIT 1
      `,
      [email]
    );

    if (rows.length === 0) {
      return res.status(401).json({
        success: false,
        message: 'Invalid customer email or password.',
      });
    }

    const account = rows[0];
    const passwordMatches = await bcrypt.compare(
      password,
      account.password_hash
    );

    if (!passwordMatches) {
      return res.status(401).json({
        success: false,
        message: 'Invalid customer email or password.',
      });
    }

    await pool.execute(
      `
        UPDATE customer_accounts
        SET last_login_at = NOW()
        WHERE id = ?
      `,
      [account.id]
    );

    account.last_login_at = new Date();

    return res.json({
      success: true,
      message: 'Customer login successful.',
      accessToken: createAccessToken(account),
      refreshToken: createRefreshToken(account),
      customer: formatCustomerAccount(account),
    });
  } catch (error) {
    console.error('Customer login error:', error);
    return res.status(500).json({
      success: false,
      message: 'Unable to sign in to the customer account.',
    });
  }
};

// POST /api/customer-auth/refresh
exports.refresh = async (req, res) => {
  try {
    const refreshToken = req.body.refreshToken;

    if (!refreshToken) {
      return res.status(401).json({
        success: false,
        message: 'Customer refresh token is required.',
      });
    }

    const decoded = jwt.verify(refreshToken, getRefreshSecret(), {
      issuer: TOKEN_ISSUER,
      audience: CUSTOMER_AUDIENCE,
    });

    if (decoded.accountType !== 'customer') {
      throw new Error('Invalid customer refresh token.');
    }

    const account = await findActiveAccountById(
      Number(decoded.id),
      Number(decoded.customerId)
    );

    if (!account) {
      return res.status(401).json({
        success: false,
        message: 'Customer account is unavailable or inactive.',
      });
    }

    return res.json({
      success: true,
      accessToken: createAccessToken(account),
      customer: formatCustomerAccount(account),
    });
  } catch {
    return res.status(401).json({
      success: false,
      message: 'Invalid or expired customer refresh token.',
    });
  }
};

// GET /api/customer-auth/me
exports.me = async (req, res) => {
  try {
    const account = await findActiveAccountById(
      Number(req.customer.id),
      Number(req.customer.customerId)
    );

    if (!account) {
      return res.status(401).json({
        success: false,
        message: 'Customer account is unavailable or inactive.',
      });
    }

    return res.json({
      success: true,
      customer: formatCustomerAccount(account),
    });
  } catch (error) {
    console.error('Get customer profile error:', error);
    return res.status(500).json({
      success: false,
      message: 'Unable to retrieve the customer profile.',
    });
  }
};
