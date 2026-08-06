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

async function columnExists(
  connection,
  tableName,
  columnName
) {
  const [rows] = await connection.execute(
    `
      SELECT 1
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

async function indexExists(
  connection,
  tableName,
  indexName
) {
  const [rows] = await connection.execute(
    `
      SELECT 1
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

async function setupCrmFourSteps() {
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

    const crmCaseIdType = await getColumnType(
      connection,
      'crm_cases',
      'id'
    );

    validateIntegerType(
      userIdType,
      'users.id'
    );

    validateIntegerType(
      crmCaseIdType,
      'crm_cases.id'
    );

    console.log(
      'Detected users.id type:',
      userIdType
    );

    console.log(
      'Detected crm_cases.id type:',
      crmCaseIdType
    );

    console.log(
      'Upgrading CRM case structure...'
    );

    /*
     * Add the Assigned status while preserving
     * the existing CRM case statuses.
     */
    await connection.query(`
      ALTER TABLE crm_cases
      MODIFY COLUMN case_status ENUM(
        'pending_follow_up',
        'assigned',
        'in_progress',
        'awaiting_customer',
        'resolved',
        'closed'
      ) NOT NULL DEFAULT 'pending_follow_up'
    `);

    /*
     * handled_by remains the assigned CRM user.
     * These fields make assignment and step
     * monitoring explicit.
     */
    const hasAssignedAt = await columnExists(
      connection,
      'crm_cases',
      'assigned_at'
    );

    if (!hasAssignedAt) {
      await connection.query(`
        ALTER TABLE crm_cases
        ADD COLUMN assigned_at DATETIME NULL
        AFTER handled_by
      `);

      console.log(
        'Added crm_cases.assigned_at.'
      );
    }

    const hasCurrentStep = await columnExists(
      connection,
      'crm_cases',
      'current_step'
    );

    if (!hasCurrentStep) {
      await connection.query(`
        ALTER TABLE crm_cases
        ADD COLUMN current_step
          TINYINT UNSIGNED NOT NULL
          DEFAULT 1
        AFTER case_status
      `);

      console.log(
        'Added crm_cases.current_step.'
      );
    }

    const hasCurrentStepIndex =
      await indexExists(
        connection,
        'crm_cases',
        'idx_crm_current_step'
      );

    if (!hasCurrentStepIndex) {
      await connection.query(`
        ALTER TABLE crm_cases
        ADD KEY idx_crm_current_step (
          current_step
        )
      `);
    }

    const hasAssignedAtIndex =
      await indexExists(
        connection,
        'crm_cases',
        'idx_crm_assigned_at'
      );

    if (!hasAssignedAtIndex) {
      await connection.query(`
        ALTER TABLE crm_cases
        ADD KEY idx_crm_assigned_at (
          assigned_at
        )
      `);
    }

    /*
     * Existing cases that already have a handler
     * are considered assigned.
     */
    await connection.query(`
      UPDATE crm_cases
      SET
        assigned_at = COALESCE(
          assigned_at,
          created_at
        ),

        case_status =
          CASE
            WHEN case_status =
              'pending_follow_up'
            THEN 'assigned'

            ELSE case_status
          END

      WHERE handled_by IS NOT NULL
    `);

    await connection.query(`
      CREATE TABLE IF NOT EXISTS
        crm_after_sales_steps (

        id INT UNSIGNED NOT NULL
          AUTO_INCREMENT,

        crm_case_id ${crmCaseIdType}
          NOT NULL,

        step_number TINYINT UNSIGNED
          NOT NULL,

        step_status ENUM(
          'not_started',
          'in_progress',
          'completed',
          'skipped'
        ) NOT NULL DEFAULT 'not_started',

        customer_feedback TEXT NULL,

        crm_response TEXT NULL,

        follow_up_at DATETIME NULL,

        handled_by ${userIdType} NULL,

        started_at DATETIME NULL,

        completed_at DATETIME NULL,

        created_at TIMESTAMP NOT NULL
          DEFAULT CURRENT_TIMESTAMP,

        updated_at TIMESTAMP NOT NULL
          DEFAULT CURRENT_TIMESTAMP
          ON UPDATE CURRENT_TIMESTAMP,

        PRIMARY KEY (id),

        UNIQUE KEY uq_crm_case_step (
          crm_case_id,
          step_number
        ),

        KEY idx_crm_step_case (
          crm_case_id
        ),

        KEY idx_crm_step_status (
          step_status
        ),

        KEY idx_crm_step_handler (
          handled_by
        ),

        KEY idx_crm_step_follow_up (
          follow_up_at
        ),

        CONSTRAINT fk_crm_step_case
          FOREIGN KEY (crm_case_id)
          REFERENCES crm_cases(id)
          ON UPDATE CASCADE
          ON DELETE CASCADE,

        CONSTRAINT fk_crm_step_handler
          FOREIGN KEY (handled_by)
          REFERENCES users(id)
          ON UPDATE CASCADE
          ON DELETE SET NULL

      ) ENGINE=InnoDB
      DEFAULT CHARSET=utf8mb4
      COLLATE=utf8mb4_unicode_ci
    `);

    console.log(
      'CRM after-sales steps table created.'
    );

    /*
     * Create exactly four after-sales steps
     * for every existing CRM case.
     */
    await connection.query(`
      INSERT IGNORE INTO
        crm_after_sales_steps (
          crm_case_id,
          step_number,
          step_status,
          handled_by
        )

      SELECT
        cc.id,
        steps.step_number,
        'not_started',
        cc.handled_by

      FROM crm_cases cc

      CROSS JOIN (
        SELECT 1 AS step_number
        UNION ALL
        SELECT 2
        UNION ALL
        SELECT 3
        UNION ALL
        SELECT 4
      ) steps
    `);

    /*
     * Make sure the current step is valid.
     */
    await connection.query(`
      UPDATE crm_cases
      SET current_step = 1
      WHERE current_step IS NULL
        OR current_step < 1
        OR current_step > 4
    `);

    const [tableRows] =
      await connection.execute(`
        SELECT TABLE_NAME
        FROM information_schema.TABLES
        WHERE TABLE_SCHEMA = DATABASE()
          AND TABLE_NAME IN (
            'crm_cases',
            'crm_interactions',
            'crm_feedback',
            'crm_after_sales_steps'
          )
        ORDER BY TABLE_NAME
      `);

    const [caseRows] =
      await connection.execute(`
        SELECT COUNT(*) AS total
        FROM crm_cases
      `);

    const [stepRows] =
      await connection.execute(`
        SELECT COUNT(*) AS total
        FROM crm_after_sales_steps
      `);

    const [incompleteRows] =
      await connection.execute(`
        SELECT
          cc.id,
          COUNT(cass.id) AS step_count

        FROM crm_cases cc

        LEFT JOIN crm_after_sales_steps cass
          ON cass.crm_case_id = cc.id

        GROUP BY cc.id

        HAVING COUNT(cass.id) <> 4
      `);

    console.log(
      'Available CRM tables:',
      tableRows.map(
        (row) => row.TABLE_NAME
      )
    );

    console.log(
      'CRM cases:',
      Number(caseRows[0].total)
    );

    console.log(
      'After-sales step records:',
      Number(stepRows[0].total)
    );

    if (incompleteRows.length > 0) {
      throw new Error(
        `${incompleteRows.length} CRM case(s) do not have exactly four steps.`
      );
    }

    console.log(
      'All CRM cases have exactly four after-sales steps.'
    );

    console.log(
      'CRM four-step upgrade completed successfully.'
    );
  } catch (error) {
    console.error(
      'CRM four-step upgrade failed:',
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

setupCrmFourSteps();