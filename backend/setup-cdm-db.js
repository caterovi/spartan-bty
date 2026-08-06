const pool = require('./config/db');

async function setupCdmDatabase() {
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

    const [userIdRows] = await connection.execute(`
      SELECT COLUMN_TYPE
      FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = 'users'
        AND COLUMN_NAME = 'id'
      LIMIT 1
    `);

    const [orderIdRows] = await connection.execute(`
      SELECT COLUMN_TYPE
      FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = 'orders'
        AND COLUMN_NAME = 'id'
      LIMIT 1
    `);

    if (userIdRows.length === 0) {
      throw new Error(
        'The users table was not found.'
      );
    }

    if (orderIdRows.length === 0) {
      throw new Error(
        'The orders table was not found.'
      );
    }

    const userIdType =
      userIdRows[0].COLUMN_TYPE;

    const orderIdType =
      orderIdRows[0].COLUMN_TYPE;

    const validIntegerType =
      /^(tinyint|smallint|mediumint|int|bigint)(\(\d+\))?( unsigned)?$/i;

    if (!validIntegerType.test(userIdType)) {
      throw new Error(
        `Unsupported users.id type: ${userIdType}`
      );
    }

    if (!validIntegerType.test(orderIdType)) {
      throw new Error(
        `Unsupported orders.id type: ${orderIdType}`
      );
    }

    console.log(
      'Detected users.id type:',
      userIdType
    );

    console.log(
      'Detected orders.id type:',
      orderIdType
    );

    await connection.query(`
      CREATE TABLE IF NOT EXISTS cdm_order_processing (
        id INT UNSIGNED NOT NULL AUTO_INCREMENT,

        order_id ${orderIdType} NOT NULL,
        handled_by ${userIdType} NULL,

        confirmation_status ENUM(
          'pending',
          'confirmed',
          'rejected'
        ) NOT NULL DEFAULT 'pending',

        confirmation_notes TEXT NULL,

        waybill_number VARCHAR(100) NULL,
        waybill_link TEXT NULL,

        confirmed_at DATETIME NULL,
        rejected_at DATETIME NULL,
        waybill_generated_at DATETIME NULL,
        sent_to_customer_at DATETIME NULL,

        created_at TIMESTAMP NOT NULL
          DEFAULT CURRENT_TIMESTAMP,

        updated_at TIMESTAMP NOT NULL
          DEFAULT CURRENT_TIMESTAMP
          ON UPDATE CURRENT_TIMESTAMP,

        PRIMARY KEY (id),

        UNIQUE KEY uq_cdm_order (
          order_id
        ),

        KEY idx_cdm_handled_by (
          handled_by
        ),

        KEY idx_cdm_confirmation_status (
          confirmation_status
        ),

        CONSTRAINT fk_cdm_order
          FOREIGN KEY (order_id)
          REFERENCES orders(id)
          ON UPDATE CASCADE
          ON DELETE CASCADE,

        CONSTRAINT fk_cdm_handled_by
          FOREIGN KEY (handled_by)
          REFERENCES users(id)
          ON UPDATE CASCADE
          ON DELETE SET NULL
      ) ENGINE=InnoDB
      DEFAULT CHARSET=utf8mb4
      COLLATE=utf8mb4_unicode_ci
    `);

    const [tableRows] = await connection.execute(`
      SELECT TABLE_NAME
      FROM information_schema.TABLES
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = 'cdm_order_processing'
    `);

    if (tableRows.length === 0) {
      throw new Error(
        'The CDM table was not created.'
      );
    }

    console.log(
      'CDM table created successfully.'
    );
  } catch (error) {
    console.error(
      'CDM database setup failed:',
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

setupCdmDatabase();