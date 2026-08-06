const pool = require('./config/db');

const PACKAGING_ITEMS = [
  {
    itemCode: 'AIR-COLUMN-ROLL',
    itemName: 'Air Column Roll',
    category: 'air_column_roll',
    unit: 'roll',
  },
  {
    itemCode: 'T4-BOX',
    itemName: 'T4 Box',
    category: 't4_box',
    unit: 'piece',
  },
  {
    itemCode: 'THANK-YOU-NOTE',
    itemName: 'Thank You Note',
    category: 'thank_you_note',
    unit: 'piece',
  },
];

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

async function setupSupplyChainDatabase() {
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

    const productIdType = await getColumnType(
      connection,
      'products',
      'id'
    );

    validateIntegerType(
      userIdType,
      'users.id'
    );

    validateIntegerType(
      productIdType,
      'products.id'
    );

    console.log(
      'Detected users.id type:',
      userIdType
    );

    console.log(
      'Detected products.id type:',
      productIdType
    );

    console.log(
      'Creating Supply Chain tables...'
    );

    await connection.query(`
      CREATE TABLE IF NOT EXISTS inventory_items (
        id INT UNSIGNED NOT NULL AUTO_INCREMENT,

        product_id ${productIdType} NULL,

        item_code VARCHAR(80) NOT NULL,
        item_name VARCHAR(150) NOT NULL,

        category ENUM(
          'finished_product',
          'product_box',
          'air_column_roll',
          't4_box',
          'thank_you_note',
          'other'
        ) NOT NULL,

        unit VARCHAR(30) NOT NULL
          DEFAULT 'piece',

        current_quantity INT UNSIGNED
          NOT NULL DEFAULT 0,

        reorder_level INT UNSIGNED
          NOT NULL DEFAULT 0,

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

        UNIQUE KEY uq_inventory_item_code (
          item_code
        ),

        KEY idx_inventory_product (
          product_id
        ),

        KEY idx_inventory_category (
          category
        ),

        KEY idx_inventory_status (
          status
        ),

        CONSTRAINT fk_inventory_items_product
          FOREIGN KEY (product_id)
          REFERENCES products(id)
          ON UPDATE CASCADE
          ON DELETE SET NULL
      ) ENGINE=InnoDB
      DEFAULT CHARSET=utf8mb4
      COLLATE=utf8mb4_unicode_ci
    `);

    await connection.query(`
      CREATE TABLE IF NOT EXISTS inventory_movements (
        id INT UNSIGNED NOT NULL AUTO_INCREMENT,

        inventory_item_id INT UNSIGNED NOT NULL,
        recorded_by ${userIdType} NULL,

        movement_type ENUM(
          'stock_in',
          'stock_out',
          'distributed',
          'adjustment_in',
          'adjustment_out'
        ) NOT NULL,

        quantity INT UNSIGNED NOT NULL,

        balance_before INT UNSIGNED
          NOT NULL,

        balance_after INT UNSIGNED
          NOT NULL,

        reference_type VARCHAR(50) NULL,
        reference_id INT UNSIGNED NULL,

        notes TEXT NULL,

        created_at TIMESTAMP NOT NULL
          DEFAULT CURRENT_TIMESTAMP,

        PRIMARY KEY (id),

        KEY idx_movements_item (
          inventory_item_id
        ),

        KEY idx_movements_recorded_by (
          recorded_by
        ),

        KEY idx_movements_type (
          movement_type
        ),

        KEY idx_movements_created_at (
          created_at
        ),

        CONSTRAINT fk_movements_inventory_item
          FOREIGN KEY (inventory_item_id)
          REFERENCES inventory_items(id)
          ON UPDATE CASCADE
          ON DELETE RESTRICT,

        CONSTRAINT fk_movements_recorded_by
          FOREIGN KEY (recorded_by)
          REFERENCES users(id)
          ON UPDATE CASCADE
          ON DELETE SET NULL
      ) ENGINE=InnoDB
      DEFAULT CHARSET=utf8mb4
      COLLATE=utf8mb4_unicode_ci
    `);

    await connection.query(`
      CREATE TABLE IF NOT EXISTS inventory_quality_checks (
        id INT UNSIGNED NOT NULL AUTO_INCREMENT,

        inventory_item_id INT UNSIGNED NOT NULL,
        checked_by ${userIdType} NULL,

        checked_quantity INT UNSIGNED NOT NULL,
        approved_quantity INT UNSIGNED NOT NULL,
        rejected_quantity INT UNSIGNED NOT NULL,

        notes TEXT NULL,

        checked_at DATETIME NOT NULL
          DEFAULT CURRENT_TIMESTAMP,

        created_at TIMESTAMP NOT NULL
          DEFAULT CURRENT_TIMESTAMP,

        PRIMARY KEY (id),

        KEY idx_quality_item (
          inventory_item_id
        ),

        KEY idx_quality_checked_by (
          checked_by
        ),

        KEY idx_quality_checked_at (
          checked_at
        ),

        CONSTRAINT fk_quality_inventory_item
          FOREIGN KEY (inventory_item_id)
          REFERENCES inventory_items(id)
          ON UPDATE CASCADE
          ON DELETE RESTRICT,

        CONSTRAINT fk_quality_checked_by
          FOREIGN KEY (checked_by)
          REFERENCES users(id)
          ON UPDATE CASCADE
          ON DELETE SET NULL
      ) ENGINE=InnoDB
      DEFAULT CHARSET=utf8mb4
      COLLATE=utf8mb4_unicode_ci
    `);

    console.log(
      'Supply Chain tables created.'
    );

    const [products] = await connection.execute(`
      SELECT
        id,
        sku,
        product_name
      FROM products
      WHERE status = 'active'
      ORDER BY product_name
    `);

    /*
     * Create one finished-product inventory item
     * and one packaging-box item per product.
     */
    for (const product of products) {
      await connection.execute(
        `
          INSERT INTO inventory_items (
            product_id,
            item_code,
            item_name,
            category,
            unit,
            current_quantity,
            reorder_level,
            status
          )
          VALUES (
            ?,
            ?,
            ?,
            'finished_product',
            'piece',
            0,
            0,
            'active'
          )
          ON DUPLICATE KEY UPDATE
            product_id = VALUES(product_id),
            item_name = VALUES(item_name),
            status = 'active'
        `,
        [
          product.id,
          `PRODUCT-${product.sku}`,
          product.product_name,
        ]
      );

      await connection.execute(
        `
          INSERT INTO inventory_items (
            product_id,
            item_code,
            item_name,
            category,
            unit,
            current_quantity,
            reorder_level,
            status
          )
          VALUES (
            ?,
            ?,
            ?,
            'product_box',
            'piece',
            0,
            0,
            'active'
          )
          ON DUPLICATE KEY UPDATE
            product_id = VALUES(product_id),
            item_name = VALUES(item_name),
            status = 'active'
        `,
        [
          product.id,
          `BOX-${product.sku}`,
          `${product.product_name} Box`,
        ]
      );
    }

    for (const item of PACKAGING_ITEMS) {
      await connection.execute(
        `
          INSERT INTO inventory_items (
            product_id,
            item_code,
            item_name,
            category,
            unit,
            current_quantity,
            reorder_level,
            status
          )
          VALUES (
            NULL,
            ?,
            ?,
            ?,
            ?,
            0,
            0,
            'active'
          )
          ON DUPLICATE KEY UPDATE
            item_name = VALUES(item_name),
            category = VALUES(category),
            unit = VALUES(unit),
            status = 'active'
        `,
        [
          item.itemCode,
          item.itemName,
          item.category,
          item.unit,
        ]
      );
    }

    const [tableRows] = await connection.execute(`
      SELECT TABLE_NAME
      FROM information_schema.TABLES
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME IN (
          'inventory_items',
          'inventory_movements',
          'inventory_quality_checks'
        )
      ORDER BY TABLE_NAME
    `);

    const [itemRows] = await connection.execute(`
      SELECT
        id,
        item_code,
        item_name,
        category,
        unit,
        current_quantity
      FROM inventory_items
      ORDER BY category, item_name
    `);

    console.log(
      'Available Supply Chain tables:',
      tableRows.map(
        (row) => row.TABLE_NAME
      )
    );

    console.log(
      'Inventory items created:',
      itemRows.length
    );

    console.log(
      'Supply Chain database setup completed successfully.'
    );
  } catch (error) {
    console.error(
      'Supply Chain database setup failed:',
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

setupSupplyChainDatabase();