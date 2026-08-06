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

async function setupCrmDatabase() {
  let connection;

  try {
    connection = await pool.getConnection();

    const [serverRows] =
      await connection.query(`
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

    const userIdType =
      await getColumnType(
        connection,
        'users',
        'id'
      );

    const orderIdType =
      await getColumnType(
        connection,
        'orders',
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

    console.log(
      'Detected users.id type:',
      userIdType
    );

    console.log(
      'Detected orders.id type:',
      orderIdType
    );

    console.log(
      'Creating CRM tables...'
    );

    await connection.query(`
      CREATE TABLE IF NOT EXISTS crm_cases (
        id INT UNSIGNED NOT NULL
          AUTO_INCREMENT,

        order_id ${orderIdType} NOT NULL,

        handled_by ${userIdType} NULL,

        case_status ENUM(
          'pending_follow_up',
          'in_progress',
          'awaiting_customer',
          'resolved',
          'closed'
        ) NOT NULL
          DEFAULT 'pending_follow_up',

        delivery_confirmation ENUM(
          'pending',
          'received',
          'not_received',
          'returned'
        ) NOT NULL DEFAULT 'pending',

        concern_category ENUM(
          'none',
          'product_issue',
          'delivery_issue',
          'wrong_item',
          'damaged_item',
          'missing_item',
          'payment_issue',
          'other'
        ) NOT NULL DEFAULT 'none',

        concern_details TEXT NULL,

        customer_response TEXT NULL,

        resolution_notes TEXT NULL,

        next_follow_up_at DATETIME NULL,

        first_contacted_at DATETIME NULL,

        resolved_at DATETIME NULL,

        closed_at DATETIME NULL,

        created_at TIMESTAMP NOT NULL
          DEFAULT CURRENT_TIMESTAMP,

        updated_at TIMESTAMP NOT NULL
          DEFAULT CURRENT_TIMESTAMP
          ON UPDATE CURRENT_TIMESTAMP,

        PRIMARY KEY (id),

        UNIQUE KEY uq_crm_order (
          order_id
        ),

        KEY idx_crm_handler (
          handled_by
        ),

        KEY idx_crm_case_status (
          case_status
        ),

        KEY idx_crm_delivery_confirmation (
          delivery_confirmation
        ),

        KEY idx_crm_next_follow_up (
          next_follow_up_at
        ),

        CONSTRAINT fk_crm_case_order
          FOREIGN KEY (order_id)
          REFERENCES orders(id)
          ON UPDATE CASCADE
          ON DELETE CASCADE,

        CONSTRAINT fk_crm_case_handler
          FOREIGN KEY (handled_by)
          REFERENCES users(id)
          ON UPDATE CASCADE
          ON DELETE SET NULL
      ) ENGINE=InnoDB
      DEFAULT CHARSET=utf8mb4
      COLLATE=utf8mb4_unicode_ci
    `);

    await connection.query(`
      CREATE TABLE IF NOT EXISTS crm_interactions (
        id INT UNSIGNED NOT NULL
          AUTO_INCREMENT,

        crm_case_id INT UNSIGNED NOT NULL,

        recorded_by ${userIdType} NULL,

        interaction_type ENUM(
          'call',
          'sms',
          'email',
          'messenger',
          'social_media',
          'other'
        ) NOT NULL,

        interaction_outcome ENUM(
          'no_answer',
          'contacted',
          'awaiting_response',
          'concern_raised',
          'resolved',
          'follow_up_required'
        ) NOT NULL,

        customer_response TEXT NULL,

        notes TEXT NULL,

        next_follow_up_at DATETIME NULL,

        contacted_at DATETIME NOT NULL
          DEFAULT CURRENT_TIMESTAMP,

        created_at TIMESTAMP NOT NULL
          DEFAULT CURRENT_TIMESTAMP,

        PRIMARY KEY (id),

        KEY idx_crm_interaction_case (
          crm_case_id
        ),

        KEY idx_crm_interaction_user (
          recorded_by
        ),

        KEY idx_crm_interaction_outcome (
          interaction_outcome
        ),

        KEY idx_crm_interaction_date (
          contacted_at
        ),

        CONSTRAINT fk_crm_interaction_case
          FOREIGN KEY (crm_case_id)
          REFERENCES crm_cases(id)
          ON UPDATE CASCADE
          ON DELETE CASCADE,

        CONSTRAINT fk_crm_interaction_user
          FOREIGN KEY (recorded_by)
          REFERENCES users(id)
          ON UPDATE CASCADE
          ON DELETE SET NULL
      ) ENGINE=InnoDB
      DEFAULT CHARSET=utf8mb4
      COLLATE=utf8mb4_unicode_ci
    `);

    await connection.query(`
      CREATE TABLE IF NOT EXISTS crm_feedback (
        id INT UNSIGNED NOT NULL
          AUTO_INCREMENT,

        crm_case_id INT UNSIGNED NOT NULL,

        recorded_by ${userIdType} NULL,

        satisfaction_rating TINYINT UNSIGNED
          NOT NULL,

        feedback TEXT NULL,

        would_repurchase ENUM(
          'yes',
          'no',
          'undecided'
        ) NOT NULL DEFAULT 'undecided',

        submitted_at DATETIME NOT NULL
          DEFAULT CURRENT_TIMESTAMP,

        created_at TIMESTAMP NOT NULL
          DEFAULT CURRENT_TIMESTAMP,

        updated_at TIMESTAMP NOT NULL
          DEFAULT CURRENT_TIMESTAMP
          ON UPDATE CURRENT_TIMESTAMP,

        PRIMARY KEY (id),

        UNIQUE KEY uq_crm_case_feedback (
          crm_case_id
        ),

        KEY idx_crm_feedback_user (
          recorded_by
        ),

        KEY idx_crm_feedback_rating (
          satisfaction_rating
        ),

        CONSTRAINT fk_crm_feedback_case
          FOREIGN KEY (crm_case_id)
          REFERENCES crm_cases(id)
          ON UPDATE CASCADE
          ON DELETE CASCADE,

        CONSTRAINT fk_crm_feedback_user
          FOREIGN KEY (recorded_by)
          REFERENCES users(id)
          ON UPDATE CASCADE
          ON DELETE SET NULL
      ) ENGINE=InnoDB
      DEFAULT CHARSET=utf8mb4
      COLLATE=utf8mb4_unicode_ci
    `);

    /*
     * Gumawa ng CRM records para sa existing
     * Delivered at Returned-to-Sender orders.
     */
    const [seedResult] =
      await connection.execute(`
        INSERT INTO crm_cases (
          order_id,
          case_status,
          delivery_confirmation
        )

        SELECT
          fo.order_id,

          'pending_follow_up',

          CASE
            WHEN fo.fulfillment_status =
              'returned_to_sender'
            THEN 'returned'

            ELSE 'pending'
          END

        FROM fulfillment_orders fo

        WHERE fo.fulfillment_status IN (
          'delivered',
          'returned_to_sender'
        )

        ON DUPLICATE KEY UPDATE
          order_id = VALUES(order_id)
      `);

    const [tableRows] =
      await connection.execute(`
        SELECT TABLE_NAME
        FROM information_schema.TABLES
        WHERE TABLE_SCHEMA = DATABASE()
          AND TABLE_NAME IN (
            'crm_cases',
            'crm_interactions',
            'crm_feedback'
          )
        ORDER BY TABLE_NAME
      `);

    const [caseRows] =
      await connection.execute(`
        SELECT COUNT(*) AS total
        FROM crm_cases
      `);

    console.log(
      'Available CRM tables:',
      tableRows.map(
        (row) => row.TABLE_NAME
      )
    );

    console.log(
      'Existing eligible orders processed:',
      seedResult.affectedRows
    );

    console.log(
      'CRM cases available:',
      caseRows[0].total
    );

    console.log(
      'CRM database setup completed successfully.'
    );
  } catch (error) {
    console.error(
      'CRM database setup failed:',
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

setupCrmDatabase();