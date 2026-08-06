const bcrypt = require('bcrypt');
const pool = require('./config/db');

const departments = [
  { code: 'marketing', name: 'Marketing' },
  { code: 'sales', name: 'Sales' },
  { code: 'supply_chain', name: 'Supply Chain' },
  { code: 'fulfillment', name: 'Fulfillment' },
  { code: 'cdm', name: 'Customer Data Management' },
  { code: 'crm', name: 'Customer Relationship Management' },
];

async function createTables(connection) {
  console.log('Creating database tables...');

  await connection.query(`
    CREATE TABLE IF NOT EXISTS departments (
      id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      code VARCHAR(50) NOT NULL UNIQUE,
      name VARCHAR(100) NOT NULL UNIQUE,
      is_active TINYINT(1) NOT NULL DEFAULT 1,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
        ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB
      DEFAULT CHARSET=utf8mb4
      COLLATE=utf8mb4_unicode_ci
  `);

  await connection.query(`
    CREATE TABLE IF NOT EXISTS users (
      id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      department_id INT UNSIGNED NULL,

      full_name VARCHAR(150) NOT NULL,
      username VARCHAR(60) NOT NULL UNIQUE,
      email VARCHAR(150) NOT NULL UNIQUE,
      password_hash VARCHAR(255) NOT NULL,

      role ENUM(
        'head',
        'specialist',
        'system_configuration'
      ) NOT NULL,

      status ENUM(
        'active',
        'inactive'
      ) NOT NULL DEFAULT 'active',

      must_change_password TINYINT(1) NOT NULL DEFAULT 1,
      last_login_at DATETIME NULL,

      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
        ON UPDATE CURRENT_TIMESTAMP,

      CONSTRAINT fk_users_department
        FOREIGN KEY (department_id)
        REFERENCES departments(id)
        ON UPDATE CASCADE
        ON DELETE SET NULL
    ) ENGINE=InnoDB
      DEFAULT CHARSET=utf8mb4
      COLLATE=utf8mb4_unicode_ci
  `);

  console.log('Database tables created.');
}

async function seedDepartments(connection) {
  console.log('Creating departments...');

  for (const department of departments) {
    await connection.execute(
      `
        INSERT INTO departments (
          code,
          name,
          is_active
        )
        VALUES (?, ?, 1)
        ON DUPLICATE KEY UPDATE
          name = ?,
          is_active = 1
      `,
      [
        department.code,
        department.name,
        department.name,
      ]
    );
  }

  console.log('Departments created.');
}

async function seedSystemConfigurationUser(connection) {
  const fullName =
    process.env.SEED_CONFIG_NAME || 'System Configuration';

  const username =
    process.env.SEED_CONFIG_USERNAME || 'systemconfig';

  const email =
    process.env.SEED_CONFIG_EMAIL ||
    'systemconfig@spartanbty.com';

  const password = process.env.SEED_CONFIG_PASSWORD;

  if (!password) {
    throw new Error(
      'SEED_CONFIG_PASSWORD is missing from the .env file.'
    );
  }

  const [existingUsers] = await connection.execute(
    `
      SELECT id
      FROM users
      WHERE username = ?
         OR email = ?
      LIMIT 1
    `,
    [username, email]
  );

  if (existingUsers.length > 0) {
    console.log(
      'System Configuration account already exists.'
    );
    return;
  }

  const passwordHash = await bcrypt.hash(password, 12);

  await connection.execute(
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
      VALUES (
        NULL,
        ?,
        ?,
        ?,
        ?,
        'system_configuration',
        'active',
        1
      )
    `,
    [
      fullName,
      username,
      email,
      passwordHash,
    ]
  );

  console.log('System Configuration account created.');
}

async function seedDatabase() {
  let connection;

  try {
    connection = await pool.getConnection();

    await createTables(connection);

    await connection.beginTransaction();

    await seedDepartments(connection);
    await seedSystemConfigurationUser(connection);

    await connection.commit();

    console.log('Database seeding completed successfully.');
  } catch (error) {
    if (connection) {
      try {
        await connection.rollback();
      } catch (rollbackError) {
        console.error(
          'Rollback failed:',
          rollbackError.message
        );
      }
    }

    console.error(
      'Database seeding failed:',
      error.message
    );

    process.exitCode = 1;
  } finally {
    if (connection) {
      connection.release();
    }

    await pool.end();
  }
}

seedDatabase();