const pool = require('./config/db');

const ORDER_COLUMNS = [
  {
    name: 'order_source',
    definition:
      "order_source ENUM('staff', 'storefront') NOT NULL DEFAULT 'staff' AFTER encoded_by",
  },
  {
    name: 'sales_review_status',
    definition:
      "sales_review_status ENUM('not_required', 'pending', 'approved', 'rejected') NOT NULL DEFAULT 'not_required' AFTER order_source",
  },
  {
    name: 'delivery_name_snapshot',
    definition:
      'delivery_name_snapshot VARCHAR(150) NULL AFTER sales_review_status',
  },
  {
    name: 'delivery_contact_snapshot',
    definition:
      'delivery_contact_snapshot VARCHAR(30) NULL AFTER delivery_name_snapshot',
  },
  {
    name: 'delivery_address_snapshot',
    definition:
      'delivery_address_snapshot TEXT NULL AFTER delivery_contact_snapshot',
  },
  {
    name: 'idempotency_key',
    definition:
      'idempotency_key VARCHAR(100) NULL AFTER delivery_address_snapshot',
  },
  {
    name: 'public_status_message',
    definition:
      'public_status_message VARCHAR(500) NULL AFTER idempotency_key',
  },
  {
    name: 'sales_reviewed_by',
    definition:
      'sales_reviewed_by INT UNSIGNED NULL AFTER public_status_message',
  },
  {
    name: 'sales_reviewed_at',
    definition:
      'sales_reviewed_at DATETIME NULL AFTER sales_reviewed_by',
  },
];

async function columnExists(connection, tableName, columnName) {
  const [rows] = await connection.execute(
    `
      SELECT COLUMN_NAME
      FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = ?
        AND COLUMN_NAME = ?
      LIMIT 1
    `,
    [tableName, columnName]
  );

  return rows.length > 0;
}

async function indexExists(connection, tableName, indexName) {
  const [rows] = await connection.execute(
    `
      SELECT INDEX_NAME
      FROM information_schema.STATISTICS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = ?
        AND INDEX_NAME = ?
      LIMIT 1
    `,
    [tableName, indexName]
  );

  return rows.length > 0;
}

async function constraintExists(connection, constraintName) {
  const [rows] = await connection.execute(
    `
      SELECT CONSTRAINT_NAME
      FROM information_schema.TABLE_CONSTRAINTS
      WHERE CONSTRAINT_SCHEMA = DATABASE()
        AND CONSTRAINT_NAME = ?
      LIMIT 1
    `,
    [constraintName]
  );

  return rows.length > 0;
}

function validateIntegerType(columnType, label) {
  if (!/^(tinyint|smallint|mediumint|int|bigint)(\(\d+\))?( unsigned)?$/i.test(columnType)) {
    throw new Error(`Unsupported ${label} type: ${columnType}`);
  }
}

async function getColumnType(connection, tableName, columnName) {
  const [rows] = await connection.execute(
    `
      SELECT COLUMN_TYPE
      FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = ?
        AND COLUMN_NAME = ?
      LIMIT 1
    `,
    [tableName, columnName]
  );
  if (rows.length === 0) {
    throw new Error(`${tableName}.${columnName} was not found.`);
  }
  validateIntegerType(rows[0].COLUMN_TYPE, `${tableName}.${columnName}`);
  return rows[0].COLUMN_TYPE;
}

async function setupCustomerCommerceDatabase() {
  let connection;

  try {
    connection = await pool.getConnection();

    const customerIdType = await getColumnType(
      connection,
      'customers',
      'id'
    );
    const productIdType = await getColumnType(
      connection,
      'products',
      'id'
    );
    const orderIdType = await getColumnType(connection, 'orders', 'id');
    const userIdType = await getColumnType(connection, 'users', 'id');

    ORDER_COLUMNS.find(
      (column) => column.name === 'sales_reviewed_by'
    ).definition =
      `sales_reviewed_by ${userIdType} NULL AFTER public_status_message`;

    for (const column of ORDER_COLUMNS) {
      if (!(await columnExists(connection, 'orders', column.name))) {
        await connection.query(
          `ALTER TABLE orders ADD COLUMN ${column.definition}`
        );
        console.log(`Added orders.${column.name}.`);
      }
    }

    if (
      !(await indexExists(
        connection,
        'orders',
        'uq_orders_customer_idempotency'
      ))
    ) {
      await connection.query(`
        ALTER TABLE orders
        ADD UNIQUE KEY uq_orders_customer_idempotency (
          customer_id,
          idempotency_key
        )
      `);
    }

    if (
      !(await constraintExists(
        connection,
        'fk_orders_sales_reviewed_by'
      ))
    ) {
      await connection.query(`
        ALTER TABLE orders
        ADD CONSTRAINT fk_orders_sales_reviewed_by
          FOREIGN KEY (sales_reviewed_by)
          REFERENCES users(id)
          ON UPDATE CASCADE
          ON DELETE SET NULL
      `);
    }

    await connection.query(`
      CREATE TABLE IF NOT EXISTS customer_carts (
        id INT UNSIGNED NOT NULL AUTO_INCREMENT,
        customer_id ${customerIdType} NOT NULL,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
          ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        UNIQUE KEY uq_customer_carts_customer (customer_id),
        CONSTRAINT fk_customer_carts_customer
          FOREIGN KEY (customer_id)
          REFERENCES customers(id)
          ON UPDATE CASCADE
          ON DELETE CASCADE
      ) ENGINE=InnoDB
      DEFAULT CHARSET=utf8mb4
      COLLATE=utf8mb4_unicode_ci
    `);

    await connection.query(`
      CREATE TABLE IF NOT EXISTS customer_cart_items (
        id INT UNSIGNED NOT NULL AUTO_INCREMENT,
        cart_id INT UNSIGNED NOT NULL,
        product_id ${productIdType} NOT NULL,
        quantity INT UNSIGNED NOT NULL,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
          ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        UNIQUE KEY uq_customer_cart_product (cart_id, product_id),
        CONSTRAINT fk_customer_cart_items_cart
          FOREIGN KEY (cart_id)
          REFERENCES customer_carts(id)
          ON UPDATE CASCADE
          ON DELETE CASCADE,
        CONSTRAINT fk_customer_cart_items_product
          FOREIGN KEY (product_id)
          REFERENCES products(id)
          ON UPDATE CASCADE
          ON DELETE CASCADE
      ) ENGINE=InnoDB
      DEFAULT CHARSET=utf8mb4
      COLLATE=utf8mb4_unicode_ci
    `);

    await connection.query(`
      CREATE TABLE IF NOT EXISTS sales_order_review_events (
        id INT UNSIGNED NOT NULL AUTO_INCREMENT,
        order_id ${orderIdType} NOT NULL,
        reviewed_by ${userIdType} NULL,
        action ENUM(
          'submitted',
          'corrected_and_submitted',
          'rejected'
        ) NOT NULL,
        reason VARCHAR(500) NULL,
        before_snapshot LONGTEXT NOT NULL,
        after_snapshot LONGTEXT NOT NULL,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        KEY idx_sales_review_order (order_id),
        KEY idx_sales_review_user (reviewed_by),
        CONSTRAINT fk_sales_review_order
          FOREIGN KEY (order_id)
          REFERENCES orders(id)
          ON UPDATE CASCADE
          ON DELETE CASCADE,
        CONSTRAINT fk_sales_review_user
          FOREIGN KEY (reviewed_by)
          REFERENCES users(id)
          ON UPDATE CASCADE
          ON DELETE SET NULL
      ) ENGINE=InnoDB
      DEFAULT CHARSET=utf8mb4
      COLLATE=utf8mb4_unicode_ci
    `);

    console.log(
      'Customer cart, online order review, and audit schema is ready.'
    );
  } catch (error) {
    console.error(
      'Customer commerce database setup failed:',
      error.message
    );
    process.exitCode = 1;
  } finally {
    if (connection) connection.release();
    await pool.end();
  }
}

setupCustomerCommerceDatabase();
