const pool = require('./config/db');

function validateIntegerType(columnType, label) {
  const validIntegerType =
    /^(tinyint|smallint|mediumint|int|bigint)(\(\d+\))?( unsigned)?$/i;

  if (!validIntegerType.test(columnType)) {
    throw new Error(
      `Unsupported ${label} type: ${columnType}`
    );
  }
}

async function getColumnType(
  connection,
  tableName,
  columnName
) {
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
    throw new Error(
      `${tableName}.${columnName} was not found.`
    );
  }

  return rows[0].COLUMN_TYPE;
}

async function setupFulfillmentDatabase() {
  let connection;

  try {
    connection = await pool.getConnection();

    const [serverRows] = await connection.query(`
      SELECT
        DATABASE() AS database_name,
        @@port AS mysql_port
    `);

    console.log(
      'Connected database:',
      serverRows[0].database_name
    );

    console.log(
      'MySQL port:',
      serverRows[0].mysql_port
    );

    const userIdType = await getColumnType(
      connection,
      'users',
      'id'
    );

    const orderIdType = await getColumnType(
      connection,
      'orders',
      'id'
    );

    const inventoryItemIdType =
      await getColumnType(
        connection,
        'inventory_items',
        'id'
      );

    validateIntegerType(
      userIdType,
      'users.id'
    );

    validateIntegerType(
      orderIdType,
      'orders.id'
    );

    validateIntegerType(
      inventoryItemIdType,
      'inventory_items.id'
    );

    console.log(
      'Detected users.id type:',
      userIdType
    );

    console.log(
      'Detected orders.id type:',
      orderIdType
    );

    console.log(
      'Detected inventory_items.id type:',
      inventoryItemIdType
    );

    console.log(
      'Creating Fulfillment tables...'
    );

    await connection.query(`
      CREATE TABLE IF NOT EXISTS fulfillment_orders (
        id INT UNSIGNED NOT NULL AUTO_INCREMENT,

        order_id ${orderIdType} NOT NULL,
        handled_by ${userIdType} NULL,

        fulfillment_status ENUM(
          'pending_packing',
          'packing',
          'packed',
          'ready_for_shipment',
          'shipped_out',
          'delivered',
          'returned_to_sender',
          'cancelled'
        ) NOT NULL DEFAULT 'pending_packing',

        third_party_logistics VARCHAR(120) NULL,
        tracking_number VARCHAR(120) NULL,

        packing_notes TEXT NULL,
        shipping_notes TEXT NULL,
        return_reason TEXT NULL,

        packing_started_at DATETIME NULL,
        packed_at DATETIME NULL,
        ready_for_shipment_at DATETIME NULL,
        shipped_out_at DATETIME NULL,
        delivered_at DATETIME NULL,
        returned_at DATETIME NULL,

        inventory_deducted_at DATETIME NULL,

        created_at TIMESTAMP NOT NULL
          DEFAULT CURRENT_TIMESTAMP,

        updated_at TIMESTAMP NOT NULL
          DEFAULT CURRENT_TIMESTAMP
          ON UPDATE CURRENT_TIMESTAMP,

        PRIMARY KEY (id),

        UNIQUE KEY uq_fulfillment_order (
          order_id
        ),

        KEY idx_fulfillment_handler (
          handled_by
        ),

        KEY idx_fulfillment_status (
          fulfillment_status
        ),

        KEY idx_fulfillment_tracking (
          tracking_number
        ),

        CONSTRAINT fk_fulfillment_order
          FOREIGN KEY (order_id)
          REFERENCES orders(id)
          ON UPDATE CASCADE
          ON DELETE CASCADE,

        CONSTRAINT fk_fulfillment_handler
          FOREIGN KEY (handled_by)
          REFERENCES users(id)
          ON UPDATE CASCADE
          ON DELETE SET NULL
      ) ENGINE=InnoDB
      DEFAULT CHARSET=utf8mb4
      COLLATE=utf8mb4_unicode_ci
    `);

    await connection.query(`
      CREATE TABLE IF NOT EXISTS fulfillment_packaging_usage (
        id INT UNSIGNED NOT NULL AUTO_INCREMENT,

        fulfillment_order_id INT UNSIGNED NOT NULL,

        inventory_item_id ${inventoryItemIdType}
          NOT NULL,

        quantity_used INT UNSIGNED NOT NULL,

        created_at TIMESTAMP NOT NULL
          DEFAULT CURRENT_TIMESTAMP,

        updated_at TIMESTAMP NOT NULL
          DEFAULT CURRENT_TIMESTAMP
          ON UPDATE CURRENT_TIMESTAMP,

        PRIMARY KEY (id),

        UNIQUE KEY uq_fulfillment_packaging_item (
          fulfillment_order_id,
          inventory_item_id
        ),

        KEY idx_packaging_inventory_item (
          inventory_item_id
        ),

        CONSTRAINT fk_packaging_fulfillment_order
          FOREIGN KEY (fulfillment_order_id)
          REFERENCES fulfillment_orders(id)
          ON UPDATE CASCADE
          ON DELETE CASCADE,

        CONSTRAINT fk_packaging_inventory_item
          FOREIGN KEY (inventory_item_id)
          REFERENCES inventory_items(id)
          ON UPDATE CASCADE
          ON DELETE RESTRICT
      ) ENGINE=InnoDB
      DEFAULT CHARSET=utf8mb4
      COLLATE=utf8mb4_unicode_ci
    `);

    await connection.query(`
      CREATE TABLE IF NOT EXISTS fulfillment_status_history (
        id INT UNSIGNED NOT NULL AUTO_INCREMENT,

        fulfillment_order_id INT UNSIGNED NOT NULL,
        changed_by ${userIdType} NULL,

        previous_status ENUM(
          'pending_packing',
          'packing',
          'packed',
          'ready_for_shipment',
          'shipped_out',
          'delivered',
          'returned_to_sender',
          'cancelled'
        ) NULL,

        new_status ENUM(
          'pending_packing',
          'packing',
          'packed',
          'ready_for_shipment',
          'shipped_out',
          'delivered',
          'returned_to_sender',
          'cancelled'
        ) NOT NULL,

        notes TEXT NULL,

        created_at TIMESTAMP NOT NULL
          DEFAULT CURRENT_TIMESTAMP,

        PRIMARY KEY (id),

        KEY idx_history_fulfillment_order (
          fulfillment_order_id
        ),

        KEY idx_history_changed_by (
          changed_by
        ),

        KEY idx_history_new_status (
          new_status
        ),

        KEY idx_history_created_at (
          created_at
        ),

        CONSTRAINT fk_history_fulfillment_order
          FOREIGN KEY (fulfillment_order_id)
          REFERENCES fulfillment_orders(id)
          ON UPDATE CASCADE
          ON DELETE CASCADE,

        CONSTRAINT fk_history_changed_by
          FOREIGN KEY (changed_by)
          REFERENCES users(id)
          ON UPDATE CASCADE
          ON DELETE SET NULL
      ) ENGINE=InnoDB
      DEFAULT CHARSET=utf8mb4
      COLLATE=utf8mb4_unicode_ci
    `);

    /*
     * Create fulfillment records for existing confirmed
     * orders whose waybills were already marked as sent
     * by the CDM Specialist.
     */
    const [seedResult] =
      await connection.execute(`
        INSERT INTO fulfillment_orders (
          order_id,
          fulfillment_status
        )

        SELECT
          o.id,
          'pending_packing'

        FROM orders o

        INNER JOIN cdm_order_processing cp
          ON cp.order_id = o.id

        WHERE o.order_status = 'confirmed'
          AND cp.sent_to_customer_at IS NOT NULL

        ON DUPLICATE KEY UPDATE
          order_id = VALUES(order_id)
      `);

    const [tableRows] =
      await connection.execute(`
        SELECT TABLE_NAME
        FROM information_schema.TABLES
        WHERE TABLE_SCHEMA = DATABASE()
          AND TABLE_NAME IN (
            'fulfillment_orders',
            'fulfillment_packaging_usage',
            'fulfillment_status_history'
          )
        ORDER BY TABLE_NAME
      `);

    const [fulfillmentRows] =
      await connection.execute(`
        SELECT COUNT(*) AS total
        FROM fulfillment_orders
      `);

    console.log(
      'Available Fulfillment tables:',
      tableRows.map(
        (row) => row.TABLE_NAME
      )
    );

    console.log(
      'Existing eligible orders processed:',
      seedResult.affectedRows
    );

    console.log(
      'Fulfillment orders available:',
      fulfillmentRows[0].total
    );

    console.log(
      'Fulfillment database setup completed successfully.'
    );
  } catch (error) {
    console.error(
      'Fulfillment database setup failed:',
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

setupFulfillmentDatabase();