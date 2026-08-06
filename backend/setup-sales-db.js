const pool = require('./config/db');

const PRODUCTS = [
  ['BTY-INSTAGLOW', 'BTY Instaglow', 0.0],
  ['BTY-DAILY-RADIANCE', 'BTY Daily Radiance', 0.0],
  ['BTY-OVERNIGHT-MASK', 'BTY Overnight Mask', 0.0],
  ['BTY-BRIGHT-LIGHT', 'BTY Bright and Light', 0.0],
  ['BTY-SUNSTICK', 'BTY Sunstick', 0.0],
];

async function setupSalesDatabase() {
  let connection;

  try {
    connection = await pool.getConnection();

    const [serverRows] = await connection.query(`
      SELECT
        DATABASE() AS database_name,
        @@port AS mysql_port,
        @@hostname AS mysql_host
    `);

    console.log('Connected database:', serverRows[0].database_name);
    console.log('MySQL port:', serverRows[0].mysql_port);
    console.log('MySQL host:', serverRows[0].mysql_host);

    const [userIdRows] = await connection.execute(`
      SELECT COLUMN_TYPE
      FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = 'users'
        AND COLUMN_NAME = 'id'
      LIMIT 1
    `);

    if (userIdRows.length === 0) {
      throw new Error(
        'The users table was not found in the backend database.'
      );
    }

    const userIdType = userIdRows[0].COLUMN_TYPE;

    const validIntegerType =
      /^(tinyint|smallint|mediumint|int|bigint)(\(\d+\))?( unsigned)?$/i;

    if (!validIntegerType.test(userIdType)) {
      throw new Error(
        `Unsupported users.id type: ${userIdType}`
      );
    }

    console.log('Detected users.id type:', userIdType);
    console.log('Creating Sales tables...');

    await connection.query(`
      CREATE TABLE IF NOT EXISTS customers (
        id INT UNSIGNED NOT NULL AUTO_INCREMENT,
        full_name VARCHAR(150) NOT NULL,
        contact_number VARCHAR(30) NOT NULL,
        address TEXT NOT NULL,

        created_at TIMESTAMP NOT NULL
          DEFAULT CURRENT_TIMESTAMP,

        updated_at TIMESTAMP NOT NULL
          DEFAULT CURRENT_TIMESTAMP
          ON UPDATE CURRENT_TIMESTAMP,

        PRIMARY KEY (id),
        KEY idx_customers_full_name (full_name),
        KEY idx_customers_contact_number (contact_number)
      ) ENGINE=InnoDB
      DEFAULT CHARSET=utf8mb4
      COLLATE=utf8mb4_unicode_ci
    `);

    await connection.query(`
      CREATE TABLE IF NOT EXISTS products (
        id INT UNSIGNED NOT NULL AUTO_INCREMENT,
        sku VARCHAR(50) NOT NULL,
        product_name VARCHAR(120) NOT NULL,
        default_price DECIMAL(12,2) NOT NULL DEFAULT 0.00,

        status ENUM(
          'active',
          'inactive'
        ) NOT NULL DEFAULT 'active',

        created_at TIMESTAMP NOT NULL
          DEFAULT CURRENT_TIMESTAMP,

        updated_at TIMESTAMP NOT NULL
          DEFAULT CURRENT_TIMESTAMP
          ON UPDATE CURRENT_TIMESTAMP,

        PRIMARY KEY (id),
        UNIQUE KEY uq_products_sku (sku),
        UNIQUE KEY uq_products_name (product_name)
      ) ENGINE=InnoDB
      DEFAULT CHARSET=utf8mb4
      COLLATE=utf8mb4_unicode_ci
    `);

    await connection.query(`
      CREATE TABLE IF NOT EXISTS \`orders\` (
        id INT UNSIGNED NOT NULL AUTO_INCREMENT,
        order_number VARCHAR(40) NOT NULL,

        customer_id INT UNSIGNED NOT NULL,
        encoded_by ${userIdType} NULL,

        conversation_link TEXT NULL,
        skin_concern VARCHAR(255) NULL,
        tags VARCHAR(255) NULL,
        notes TEXT NULL,

        total_amount DECIMAL(12,2)
          NOT NULL DEFAULT 0.00,

        order_status ENUM(
          'draft',
          'for_confirmation',
          'confirmed',
          'rejected',
          'cancelled'
        ) NOT NULL DEFAULT 'draft',

        date_encoded DATETIME NOT NULL
          DEFAULT CURRENT_TIMESTAMP,

        submitted_at DATETIME NULL,
        confirmed_at DATETIME NULL,
        rejected_at DATETIME NULL,
        cancelled_at DATETIME NULL,

        created_at TIMESTAMP NOT NULL
          DEFAULT CURRENT_TIMESTAMP,

        updated_at TIMESTAMP NOT NULL
          DEFAULT CURRENT_TIMESTAMP
          ON UPDATE CURRENT_TIMESTAMP,

        PRIMARY KEY (id),

        UNIQUE KEY uq_orders_order_number (
          order_number
        ),

        KEY idx_orders_customer_id (
          customer_id
        ),

        KEY idx_orders_encoded_by (
          encoded_by
        ),

        KEY idx_orders_status (
          order_status
        ),

        KEY idx_orders_date_encoded (
          date_encoded
        ),

        CONSTRAINT fk_orders_customer
          FOREIGN KEY (customer_id)
          REFERENCES customers(id)
          ON UPDATE CASCADE
          ON DELETE RESTRICT,

        CONSTRAINT fk_orders_encoded_by
          FOREIGN KEY (encoded_by)
          REFERENCES users(id)
          ON UPDATE CASCADE
          ON DELETE SET NULL
      ) ENGINE=InnoDB
      DEFAULT CHARSET=utf8mb4
      COLLATE=utf8mb4_unicode_ci
    `);

    await connection.query(`
      CREATE TABLE IF NOT EXISTS order_items (
        id INT UNSIGNED NOT NULL AUTO_INCREMENT,
        order_id INT UNSIGNED NOT NULL,
        product_id INT UNSIGNED NOT NULL,

        quantity INT UNSIGNED NOT NULL,
        unit_price DECIMAL(12,2) NOT NULL,
        line_total DECIMAL(12,2) NOT NULL,

        created_at TIMESTAMP NOT NULL
          DEFAULT CURRENT_TIMESTAMP,

        updated_at TIMESTAMP NOT NULL
          DEFAULT CURRENT_TIMESTAMP
          ON UPDATE CURRENT_TIMESTAMP,

        PRIMARY KEY (id),

        UNIQUE KEY uq_order_product (
          order_id,
          product_id
        ),

        KEY idx_order_items_order_id (
          order_id
        ),

        KEY idx_order_items_product_id (
          product_id
        ),

        CONSTRAINT fk_order_items_order
          FOREIGN KEY (order_id)
          REFERENCES \`orders\`(id)
          ON UPDATE CASCADE
          ON DELETE CASCADE,

        CONSTRAINT fk_order_items_product
          FOREIGN KEY (product_id)
          REFERENCES products(id)
          ON UPDATE CASCADE
          ON DELETE RESTRICT
      ) ENGINE=InnoDB
      DEFAULT CHARSET=utf8mb4
      COLLATE=utf8mb4_unicode_ci
    `);

    console.log('Sales tables created.');

    for (const product of PRODUCTS) {
      await connection.execute(
        `
          INSERT INTO products (
            sku,
            product_name,
            default_price,
            status
          )
          VALUES (?, ?, ?, 'active')
          ON DUPLICATE KEY UPDATE
            product_name = VALUES(product_name),
            status = 'active'
        `,
        product
      );
    }

    const [tableRows] = await connection.execute(`
      SELECT TABLE_NAME
      FROM information_schema.TABLES
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME IN (
          'customers',
          'products',
          'orders',
          'order_items'
        )
      ORDER BY TABLE_NAME
    `);

    const [productRows] = await connection.execute(`
      SELECT
        id,
        sku,
        product_name,
        default_price,
        status
      FROM products
      ORDER BY id
    `);

    console.log(
      'Available Sales tables:',
      tableRows.map((row) => row.TABLE_NAME)
    );

    console.log(
      'Products inserted:',
      productRows.length
    );

    console.log(
      'Sales database setup completed successfully.'
    );
  } catch (error) {
    console.error(
      'Sales database setup failed:',
      error
    );

    process.exitCode = 1;
  } finally {
    if (connection) {
      connection.release();
    }

    await pool.end();
  }
}

setupSalesDatabase();