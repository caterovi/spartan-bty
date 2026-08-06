const bcrypt = require('bcrypt');
const pool = require('../config/db');

const ALLOWED_ROLES = [
  'head',
  'specialist',
  'system_configuration',
];

function cleanText(value) {
  return String(value || '').trim();
}

function formatUser(user) {
  return {
    id: user.id,
    fullName: user.full_name,
    username: user.username,
    email: user.email,
    role: user.role,
    status: user.status,
    departmentId: user.department_id,
    departmentCode: user.department_code,
    departmentName: user.department_name,
    mustChangePassword: Boolean(user.must_change_password),
    lastLoginAt: user.last_login_at,
    createdAt: user.created_at,
    updatedAt: user.updated_at,
  };
}

// GET /api/users
exports.getUsers = async (req, res) => {
  try {
    const [rows] = await pool.execute(`
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
        u.created_at,
        u.updated_at,
        d.code AS department_code,
        d.name AS department_name
      FROM users u
      LEFT JOIN departments d
        ON d.id = u.department_id
      ORDER BY
        FIELD(
          u.role,
          'system_configuration',
          'head',
          'specialist'
        ),
        u.full_name ASC
    `);

    return res.json({
      success: true,
      users: rows.map(formatUser),
    });
  } catch (error) {
    console.error('Get users error:', error);

    return res.status(500).json({
      success: false,
      message: 'Unable to retrieve user accounts.',
    });
  }
};

// GET /api/users/departments
exports.getDepartments = async (req, res) => {
  try {
    const [rows] = await pool.execute(`
      SELECT
        id,
        code,
        name,
        is_active,
        created_at,
        updated_at
      FROM departments
      WHERE is_active = 1
      ORDER BY name ASC
    `);

    return res.json({
      success: true,
      departments: rows.map((department) => ({
        id: department.id,
        code: department.code,
        name: department.name,
        isActive: Boolean(department.is_active),
      })),
    });
  } catch (error) {
    console.error('Get departments error:', error);

    return res.status(500).json({
      success: false,
      message: 'Unable to retrieve departments.',
    });
  }
};

// POST /api/users
exports.createUser = async (req, res) => {
  try {
    const fullName = cleanText(req.body.fullName);
    const username = cleanText(req.body.username).toLowerCase();
    const email = cleanText(req.body.email).toLowerCase();
    const role = cleanText(req.body.role);
    const temporaryPassword = String(
      req.body.temporaryPassword || ''
    );

    let departmentId =
      req.body.departmentId === null ||
      req.body.departmentId === undefined ||
      req.body.departmentId === ''
        ? null
        : Number(req.body.departmentId);

    if (
      !fullName ||
      !username ||
      !email ||
      !role ||
      !temporaryPassword
    ) {
      return res.status(400).json({
        success: false,
        message:
          'Full name, username, email, role, and temporary password are required.',
      });
    }

    if (!ALLOWED_ROLES.includes(role)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid user role.',
      });
    }

    if (!/^[a-z0-9._-]{4,60}$/.test(username)) {
      return res.status(400).json({
        success: false,
        message:
          'Username must contain 4–60 lowercase letters, numbers, dots, underscores, or hyphens.',
      });
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({
        success: false,
        message: 'Enter a valid email address.',
      });
    }

    if (temporaryPassword.length < 8) {
      return res.status(400).json({
        success: false,
        message:
          'Temporary password must contain at least 8 characters.',
      });
    }

    if (role === 'specialist') {
      if (!Number.isInteger(departmentId) || departmentId <= 0) {
        return res.status(400).json({
          success: false,
          message:
            'A department must be assigned to a specialist.',
        });
      }

      const [departments] = await pool.execute(
        `
          SELECT id
          FROM departments
          WHERE id = ?
            AND is_active = 1
          LIMIT 1
        `,
        [departmentId]
      );

      if (departments.length === 0) {
        return res.status(400).json({
          success: false,
          message:
            'The selected department does not exist or is inactive.',
        });
      }
    } else {
      departmentId = null;
    }

    const [existingUsers] = await pool.execute(
      `
        SELECT
          username,
          email
        FROM users
        WHERE username = ?
           OR email = ?
        LIMIT 1
      `,
      [username, email]
    );

    if (existingUsers.length > 0) {
      const existingUser = existingUsers[0];

      if (existingUser.username === username) {
        return res.status(409).json({
          success: false,
          message: 'Username is already in use.',
        });
      }

      return res.status(409).json({
        success: false,
        message: 'Email address is already in use.',
      });
    }

    const passwordHash = await bcrypt.hash(
      temporaryPassword,
      12
    );

    const [result] = await pool.execute(
      `
        INSERT INTO users (
          department_id,
          full_name,
          username,
          email,
          password_hash,
          role,
          status,
          must_change_password
        )
        VALUES (?, ?, ?, ?, ?, ?, 'active', 1)
      `,
      [
        departmentId,
        fullName,
        username,
        email,
        passwordHash,
        role,
      ]
    );

    const [newUsers] = await pool.execute(
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
          u.created_at,
          u.updated_at,
          d.code AS department_code,
          d.name AS department_name
        FROM users u
        LEFT JOIN departments d
          ON d.id = u.department_id
        WHERE u.id = ?
        LIMIT 1
      `,
      [result.insertId]
    );

    return res.status(201).json({
      success: true,
      message: 'User account created successfully.',
      user: formatUser(newUsers[0]),
    });
  } catch (error) {
    console.error('Create user error:', error);

    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({
        success: false,
        message:
          'The username or email address is already in use.',
      });
    }

    return res.status(500).json({
      success: false,
      message: 'Unable to create the user account.',
    });
  }
};


// PATCH /api/users/:id
exports.updateUser = async (req, res) => {
  try {
    const userId = Number(req.params.id);

    const fullName = cleanText(req.body.fullName);
    const username = cleanText(req.body.username).toLowerCase();
    const email = cleanText(req.body.email).toLowerCase();
    const role = cleanText(req.body.role);

    let departmentId =
      req.body.departmentId === null ||
      req.body.departmentId === undefined ||
      req.body.departmentId === ''
        ? null
        : Number(req.body.departmentId);

    if (!Number.isInteger(userId) || userId <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Invalid user account.',
      });
    }

    if (!fullName || !username || !email || !role) {
      return res.status(400).json({
        success: false,
        message:
          'Full name, username, email, and role are required.',
      });
    }

    if (!ALLOWED_ROLES.includes(role)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid user role.',
      });
    }

    if (!/^[a-z0-9._-]{4,60}$/.test(username)) {
      return res.status(400).json({
        success: false,
        message:
          'Username must contain 4–60 lowercase letters, numbers, dots, underscores, or hyphens.',
      });
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({
        success: false,
        message: 'Enter a valid email address.',
      });
    }

    const [targetRows] = await pool.execute(
      `
        SELECT id, role
        FROM users
        WHERE id = ?
        LIMIT 1
      `,
      [userId]
    );

    if (targetRows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'User account not found.',
      });
    }

    if (
      userId === req.user.id &&
      role !== 'system_configuration'
    ) {
      return res.status(400).json({
        success: false,
        message:
          'You cannot remove your own System Configuration role.',
      });
    }

    if (role === 'specialist') {
      if (!Number.isInteger(departmentId) || departmentId <= 0) {
        return res.status(400).json({
          success: false,
          message:
            'A department must be assigned to a specialist.',
        });
      }

      const [departmentRows] = await pool.execute(
        `
          SELECT id
          FROM departments
          WHERE id = ?
            AND is_active = 1
          LIMIT 1
        `,
        [departmentId]
      );

      if (departmentRows.length === 0) {
        return res.status(400).json({
          success: false,
          message:
            'The selected department does not exist or is inactive.',
        });
      }
    } else {
      departmentId = null;
    }

    const [duplicateRows] = await pool.execute(
      `
        SELECT id, username, email
        FROM users
        WHERE id <> ?
          AND (
            username = ?
            OR email = ?
          )
        LIMIT 1
      `,
      [userId, username, email]
    );

    if (duplicateRows.length > 0) {
      if (duplicateRows[0].username === username) {
        return res.status(409).json({
          success: false,
          message: 'Username is already in use.',
        });
      }

      return res.status(409).json({
        success: false,
        message: 'Email address is already in use.',
      });
    }

    await pool.execute(
      `
        UPDATE users
        SET
          department_id = ?,
          full_name = ?,
          username = ?,
          email = ?,
          role = ?
        WHERE id = ?
      `,
      [
        departmentId,
        fullName,
        username,
        email,
        role,
        userId,
      ]
    );

    const [updatedRows] = await pool.execute(
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
          u.created_at,
          u.updated_at,
          d.code AS department_code,
          d.name AS department_name
        FROM users u
        LEFT JOIN departments d
          ON d.id = u.department_id
        WHERE u.id = ?
        LIMIT 1
      `,
      [userId]
    );

    return res.json({
      success: true,
      message: 'User account updated successfully.',
      user: formatUser(updatedRows[0]),
    });
  } catch (error) {
    console.error('Update user error:', error);

    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({
        success: false,
        message:
          'The username or email address is already in use.',
      });
    }

    return res.status(500).json({
      success: false,
      message: 'Unable to update the user account.',
    });
  }
};


// PATCH /api/users/:id/status
exports.updateUserStatus = async (req, res) => {
  try {
    const userId = Number(req.params.id);
    const status = cleanText(req.body.status);

    if (!Number.isInteger(userId) || userId <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Invalid user account.',
      });
    }

    if (!['active', 'inactive'].includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid account status.',
      });
    }

    if (userId === req.user.id && status === 'inactive') {
      return res.status(400).json({
        success: false,
        message: 'You cannot deactivate your own account.',
      });
    }

    const [targetRows] = await pool.execute(
      `
        SELECT id, role, status
        FROM users
        WHERE id = ?
        LIMIT 1
      `,
      [userId]
    );

    if (targetRows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'User account not found.',
      });
    }

    const targetUser = targetRows[0];

    if (
      targetUser.role === 'system_configuration' &&
      status === 'inactive'
    ) {
      const [countRows] = await pool.execute(
        `
          SELECT COUNT(*) AS active_count
          FROM users
          WHERE role = 'system_configuration'
            AND status = 'active'
        `
      );

      if (Number(countRows[0].active_count) <= 1) {
        return res.status(400).json({
          success: false,
          message:
            'The last active System Configuration account cannot be deactivated.',
        });
      }
    }

    await pool.execute(
      `
        UPDATE users
        SET status = ?
        WHERE id = ?
      `,
      [status, userId]
    );

    return res.json({
      success: true,
      message:
        status === 'active'
          ? 'User account activated successfully.'
          : 'User account deactivated successfully.',
      status,
    });
  } catch (error) {
    console.error('Update user status error:', error);

    return res.status(500).json({
      success: false,
      message: 'Unable to update the account status.',
    });
  }
};


// PATCH /api/users/:id/reset-password
exports.resetUserPassword = async (req, res) => {
  try {
    const userId = Number(req.params.id);
    const temporaryPassword = String(
      req.body.temporaryPassword || ''
    );

    if (!Number.isInteger(userId) || userId <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Invalid user account.',
      });
    }

    if (userId === req.user.id) {
      return res.status(400).json({
        success: false,
        message:
          'Use Account Settings to change your own password.',
      });
    }

    if (temporaryPassword.length < 8) {
      return res.status(400).json({
        success: false,
        message:
          'Temporary password must contain at least 8 characters.',
      });
    }

    const [targetRows] = await pool.execute(
      `
        SELECT id
        FROM users
        WHERE id = ?
        LIMIT 1
      `,
      [userId]
    );

    if (targetRows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'User account not found.',
      });
    }

    const passwordHash = await bcrypt.hash(
      temporaryPassword,
      12
    );

    await pool.execute(
      `
        UPDATE users
        SET
          password_hash = ?,
          must_change_password = 1
        WHERE id = ?
      `,
      [passwordHash, userId]
    );

    return res.json({
      success: true,
      message:
        'Temporary password assigned successfully. The user must change it after signing in.',
    });
  } catch (error) {
    console.error('Reset password error:', error);

    return res.status(500).json({
      success: false,
      message: 'Unable to reset the user password.',
    });
  }
};