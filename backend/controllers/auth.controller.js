const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const pool = require('../config/db');

const ACCESS_EXPIRES = '1h';
const REFRESH_EXPIRES = '7d';

function createAccessToken(user) {
  return jwt.sign(
    {
      id: user.id,
      username: user.username,
      role: user.role,
      departmentId: user.department_id || null,
      departmentCode: user.department_code || null,
    },
    process.env.JWT_SECRET,
    {
      expiresIn: ACCESS_EXPIRES,
    }
  );
}

function createRefreshToken(user) {
  return jwt.sign(
    {
      id: user.id,
    },
    process.env.JWT_REFRESH_SECRET,
    {
      expiresIn: REFRESH_EXPIRES,
    }
  );
}

function formatUser(user) {
  return {
    id: user.id,
    fullName: user.full_name,
    username: user.username,
    email: user.email,
    role: user.role,
    status: user.status,
    departmentId: user.department_id || null,
    departmentCode: user.department_code || null,
    departmentName: user.department_name || null,
    mustChangePassword: Boolean(user.must_change_password),
    lastLoginAt: user.last_login_at,
  };
}

exports.login = async (req, res) => {
  try {
    const identifier = String(req.body.username || '').trim();
    const password = String(req.body.password || '');

    if (!identifier || !password) {
      return res.status(400).json({
        success: false,
        message: 'Username or email and password are required.',
      });
    }

    const [rows] = await pool.execute(
      `
        SELECT
          u.id,
          u.department_id,
          u.full_name,
          u.username,
          u.email,
          u.password_hash,
          u.role,
          u.status,
          u.must_change_password,
          u.last_login_at,
          d.code AS department_code,
          d.name AS department_name
        FROM users u
        LEFT JOIN departments d
          ON d.id = u.department_id
        WHERE (
          u.username = ?
          OR u.email = ?
        )
        AND u.status = 'active'
        LIMIT 1
      `,
      [identifier, identifier]
    );

    if (rows.length === 0) {
      return res.status(401).json({
        success: false,
        message: 'Invalid username, email, or password.',
      });
    }

    const user = rows[0];

    const passwordMatches = await bcrypt.compare(
      password,
      user.password_hash
    );

    if (!passwordMatches) {
      return res.status(401).json({
        success: false,
        message: 'Invalid username, email, or password.',
      });
    }

    await pool.execute(
      `
        UPDATE users
        SET last_login_at = NOW()
        WHERE id = ?
      `,
      [user.id]
    );

    user.last_login_at = new Date();

    const accessToken = createAccessToken(user);
    const refreshToken = createRefreshToken(user);

    return res.json({
      success: true,
      message: 'Login successful.',
      accessToken,
      refreshToken,
      user: formatUser(user),
    });
  } catch (error) {
    console.error('Login error:', error);

    return res.status(500).json({
      success: false,
      message: 'Server error during login.',
    });
  }
};

exports.refresh = async (req, res) => {
  try {
    const refreshToken = req.body.refreshToken;

    if (!refreshToken) {
      return res.status(401).json({
        success: false,
        message: 'Refresh token is required.',
      });
    }

    const decoded = jwt.verify(
      refreshToken,
      process.env.JWT_REFRESH_SECRET
    );

    const [rows] = await pool.execute(
      `
        SELECT
          u.id,
          u.department_id,
          u.full_name,
          u.username,
          u.email,
          u.role,
          u.status,
          u.must_change_password,
          u.last_login_at,
          d.code AS department_code,
          d.name AS department_name
        FROM users u
        LEFT JOIN departments d
          ON d.id = u.department_id
        WHERE u.id = ?
          AND u.status = 'active'
        LIMIT 1
      `,
      [decoded.id]
    );

    if (rows.length === 0) {
      return res.status(401).json({
        success: false,
        message: 'User account is unavailable or inactive.',
      });
    }

    const user = rows[0];
    const accessToken = createAccessToken(user);

    return res.json({
      success: true,
      accessToken,
      user: formatUser(user),
    });
  } catch (error) {
    return res.status(401).json({
      success: false,
      message: 'Invalid or expired refresh token.',
    });
  }
};

exports.me = async (req, res) => {
  try {
    const [rows] = await pool.execute(
      `
        SELECT
          u.id,
          u.department_id,
          u.full_name,
          u.username,
          u.email,
          u.role,
          u.status,
          u.must_change_password,
          u.last_login_at,
          d.code AS department_code,
          d.name AS department_name
        FROM users u
        LEFT JOIN departments d
          ON d.id = u.department_id
        WHERE u.id = ?
          AND u.status = 'active'
        LIMIT 1
      `,
      [req.user.id]
    );

    if (rows.length === 0) {
      return res.status(401).json({
        success: false,
        message: 'User account is unavailable or inactive.',
      });
    }

    return res.json({
      success: true,
      user: formatUser(rows[0]),
    });
  } catch (error) {
    console.error('Get current user error:', error);

    return res.status(500).json({
      success: false,
      message: 'Unable to retrieve the current user.',
    });
  }
};

exports.changePassword = async (req, res) => {
  try {
    const userId = req.user.id;

    const currentPassword = String(
      req.body.currentPassword || ''
    );

    const newPassword = String(
      req.body.newPassword || ''
    );

    const confirmPassword = String(
      req.body.confirmPassword || ''
    );

    if (
      !currentPassword ||
      !newPassword ||
      !confirmPassword
    ) {
      return res.status(400).json({
        success: false,
        message: 'All password fields are required.',
      });
    }

    if (newPassword.length < 8) {
      return res.status(400).json({
        success: false,
        message:
          'New password must contain at least 8 characters.',
      });
    }

    if (newPassword !== confirmPassword) {
      return res.status(400).json({
        success: false,
        message:
          'New password and confirmation do not match.',
      });
    }

    const [rows] = await pool.execute(
      `
        SELECT
          id,
          password_hash,
          status
        FROM users
        WHERE id = ?
        LIMIT 1
      `,
      [userId]
    );

    if (
      rows.length === 0 ||
      rows[0].status !== 'active'
    ) {
      return res.status(401).json({
        success: false,
        message:
          'User account is unavailable or inactive.',
      });
    }

    const user = rows[0];

    const currentPasswordMatches =
      await bcrypt.compare(
        currentPassword,
        user.password_hash
      );

    if (!currentPasswordMatches) {
      return res.status(400).json({
        success: false,
        message: 'Current password is incorrect.',
      });
    }

    const isSamePassword = await bcrypt.compare(
      newPassword,
      user.password_hash
    );

    if (isSamePassword) {
      return res.status(400).json({
        success: false,
        message:
          'New password must be different from the current password.',
      });
    }

    const newPasswordHash = await bcrypt.hash(
      newPassword,
      12
    );

    await pool.execute(
      `
        UPDATE users
        SET
          password_hash = ?,
          must_change_password = 0
        WHERE id = ?
      `,
      [newPasswordHash, userId]
    );

    return res.json({
      success: true,
      message: 'Password changed successfully.',
    });
  } catch (error) {
    console.error('Change password error:', error);

    return res.status(500).json({
      success: false,
      message: 'Unable to change the password.',
    });
  }
};

exports.getCurrentUser = async (req, res) => {
  try {
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'Authentication is required.',
      });
    }

    const [rows] = await pool.execute(
      `
        SELECT
          u.id,
          u.full_name,
          u.username,
          u.email,
          u.role,
          u.status,
          u.department_id,
          u.created_at,
          d.name AS department_name,
          d.code AS department_code
        FROM users u
        LEFT JOIN departments d
          ON d.id = u.department_id
        WHERE u.id = ?
        LIMIT 1
      `,
      [userId]
    );

    if (rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'User account not found.',
      });
    }

    const user = rows[0];

    return res.json({
      success: true,
      user: {
        id: user.id,
        fullName: user.full_name,
        username: user.username,
        email: user.email,
        role: user.role,
        status: user.status,
        departmentId: user.department_id,
        departmentName:
          user.department_name || null,
        departmentCode:
          user.department_code || null,
        createdAt: user.created_at,
      },
    });
  } catch (error) {
    console.error(
      'Get current user error:',
      error
    );

    return res.status(500).json({
      success: false,
      message:
        'Unable to retrieve account information.',
    });
  }
};