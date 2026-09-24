const pool = require('./config/db');

function validateIntegerType(columnType, label) {
  const validIntegerType =
    /^(tinyint|smallint|mediumint|int|bigint)(\(\d+\))?( unsigned)?$/i;

  if (!validIntegerType.test(columnType)) {
    throw new Error(`Unsupported ${label} type: ${columnType}`);
  }
}

async function setupCustomerAuthDatabase() {
  let connection;

  try {
    connection = await pool.getConnection();

    const [customerIdRows] = await connection.execute(`
      SELECT COLUMN_TYPE
      FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = 'customers'
        AND COLUMN_NAME = 'id'
      LIMIT 1
    `);

    if (customerIdRows.length === 0) {
      throw new Error(
        'The customers table was not found. Run the Sales database setup first.'
      );
    }

    const customerIdType = customerIdRows[0].COLUMN_TYPE;
    validateIntegerType(customerIdType, 'customers.id');

    await connection.query(`
      CREATE TABLE IF NOT EXISTS customer_accounts (
        id INT UNSIGNED NOT NULL AUTO_INCREMENT,
        customer_id ${customerIdType} NOT NULL,
        email VARCHAR(150) NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        status ENUM(
          'active',
          'inactive'
        ) NOT NULL DEFAULT 'active',
        last_login_at DATETIME NULL,
        created_at TIMESTAMP NOT NULL
          DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NOT NULL
          DEFAULT CURRENT_TIMESTAMP
          ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        UNIQUE KEY uq_customer_accounts_customer (customer_id),
        UNIQUE KEY uq_customer_accounts_email (email),
        KEY idx_customer_accounts_status (status),
        CONSTRAINT fk_customer_accounts_customer
          FOREIGN KEY (customer_id)
          REFERENCES customers(id)
          ON UPDATE CASCADE
          ON DELETE CASCADE
      ) ENGINE=InnoDB
      DEFAULT CHARSET=utf8mb4
      COLLATE=utf8mb4_unicode_ci
    `);

    console.log(
      'Customer authentication schema created. No customer accounts were seeded.'
    );
  } catch (error) {
    console.error(
      'Customer authentication database setup failed:',
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

setupCustomerAuthDatabase();
