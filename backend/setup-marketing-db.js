const pool = require('./config/db');

const TASK_STATUSES = [
  'pending',
  'assigned',
  'in_progress',
  'submitted',
  'for_revision',
  'approved',
  'completed',
  'cancelled',
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

async function tableExists(
  connection,
  tableName
) {
  const [rows] = await connection.execute(
    `
      SELECT 1
      FROM information_schema.TABLES
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = ?
      LIMIT 1
    `,
    [tableName]
  );

  return rows.length > 0;
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

async function foreignKeyExistsForColumn(
  connection,
  tableName,
  columnName
) {
  const [rows] = await connection.execute(
    `
      SELECT 1
      FROM information_schema.KEY_COLUMN_USAGE
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = ?
        AND COLUMN_NAME = ?
        AND REFERENCED_TABLE_NAME IS NOT NULL
      LIMIT 1
    `,
    [tableName, columnName]
  );

  return rows.length > 0;
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

async function addColumnIfMissing(
  connection,
  tableName,
  columnName,
  definition
) {
  const exists = await columnExists(
    connection,
    tableName,
    columnName
  );

  if (exists) {
    return false;
  }

  await connection.query(`
    ALTER TABLE ${tableName}
    ADD COLUMN ${columnName} ${definition}
  `);

  console.log(
    `Added ${tableName}.${columnName}.`
  );

  return true;
}

async function addIndexIfMissing(
  connection,
  tableName,
  indexName,
  columns
) {
  const exists = await indexExists(
    connection,
    tableName,
    indexName
  );

  if (exists) {
    return;
  }

  await connection.query(`
    ALTER TABLE ${tableName}
    ADD KEY ${indexName} (${columns})
  `);
}

async function setupMarketingDatabase() {
  let connection;

  try {
    connection = await pool.getConnection();

    const [serverRows] = await connection.query(`
      SELECT
        DATABASE() AS database_name,
        @@port AS mysql_port,
        @@hostname AS mysql_host
    `);

    console.log(
      'Connected database:',
      serverRows[0].database_name
    );

    console.log(
      'MySQL port:',
      serverRows[0].mysql_port
    );

    console.log(
      'MySQL host:',
      serverRows[0].mysql_host
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
      'Creating Marketing campaign table...'
    );

    await connection.query(`
      CREATE TABLE IF NOT EXISTS marketing_campaigns (
        id INT UNSIGNED NOT NULL
          AUTO_INCREMENT,

        campaign_code VARCHAR(80)
          NOT NULL,

        campaign_name VARCHAR(180)
          NOT NULL,

        description TEXT NULL,

        product_id ${productIdType}
          NULL,

        start_date DATE NULL,
        end_date DATE NULL,

        campaign_status ENUM(
          'planning',
          'active',
          'completed',
          'cancelled'
        ) NOT NULL DEFAULT 'planning',

        created_by ${userIdType}
          NULL,

        created_at TIMESTAMP NOT NULL
          DEFAULT CURRENT_TIMESTAMP,

        updated_at TIMESTAMP NOT NULL
          DEFAULT CURRENT_TIMESTAMP
          ON UPDATE CURRENT_TIMESTAMP,

        PRIMARY KEY (id),

        UNIQUE KEY uq_marketing_campaign_code (
          campaign_code
        ),

        KEY idx_marketing_campaign_product (
          product_id
        ),

        KEY idx_marketing_campaign_status (
          campaign_status
        ),

        KEY idx_marketing_campaign_created_by (
          created_by
        ),

        KEY idx_marketing_campaign_dates (
          start_date,
          end_date
        ),

        CONSTRAINT fk_marketing_campaign_product
          FOREIGN KEY (product_id)
          REFERENCES products(id)
          ON UPDATE CASCADE
          ON DELETE SET NULL,

        CONSTRAINT fk_marketing_campaign_creator
          FOREIGN KEY (created_by)
          REFERENCES users(id)
          ON UPDATE CASCADE
          ON DELETE SET NULL
      ) ENGINE=InnoDB
      DEFAULT CHARSET=utf8mb4
      COLLATE=utf8mb4_unicode_ci
    `);

    /*
     * Create a default campaign that can contain
     * existing marketing tasks.
     */
    await connection.execute(`
      INSERT INTO marketing_campaigns (
        campaign_code,
        campaign_name,
        description,
        campaign_status
      )
      VALUES (
        'GENERAL-MARKETING',
        'General Marketing Activities',
        'Default campaign for existing and general marketing tasks.',
        'active'
      )
      ON DUPLICATE KEY UPDATE
        campaign_name = VALUES(campaign_name)
    `);

    const [defaultCampaignRows] =
      await connection.execute(`
        SELECT id
        FROM marketing_campaigns
        WHERE campaign_code =
          'GENERAL-MARKETING'
        LIMIT 1
      `);

    const defaultCampaignId =
      defaultCampaignRows[0].id;

    const hasMarketingTasks =
      await tableExists(
        connection,
        'marketing_tasks'
      );

    if (!hasMarketingTasks) {
      console.log(
        'Creating marketing_tasks table...'
      );

      await connection.query(`
        CREATE TABLE marketing_tasks (
          id INT UNSIGNED NOT NULL
            AUTO_INCREMENT,

          campaign_id INT UNSIGNED NULL,

          task_title VARCHAR(180)
            NOT NULL,

          task_description TEXT NULL,

          content_type ENUM(
            'poster',
            'video',
            'caption',
            'product_photo',
            'social_media_post',
            'product_promotion',
            'other'
          ) NOT NULL DEFAULT 'other',

          assigned_to ${userIdType}
            NULL,

          created_by ${userIdType}
            NULL,

          priority ENUM(
            'low',
            'medium',
            'high',
            'urgent'
          ) NOT NULL DEFAULT 'medium',

          due_date DATETIME NULL,

          task_status ENUM(
            'pending',
            'assigned',
            'in_progress',
            'submitted',
            'for_revision',
            'approved',
            'completed',
            'cancelled'
          ) NOT NULL DEFAULT 'pending',

          revision_notes TEXT NULL,

          approved_by ${userIdType}
            NULL,

          approved_at DATETIME NULL,
          completed_at DATETIME NULL,

          created_at TIMESTAMP NOT NULL
            DEFAULT CURRENT_TIMESTAMP,

          updated_at TIMESTAMP NOT NULL
            DEFAULT CURRENT_TIMESTAMP
            ON UPDATE CURRENT_TIMESTAMP,

          PRIMARY KEY (id),

          KEY idx_marketing_task_campaign (
            campaign_id
          ),

          KEY idx_marketing_task_assigned (
            assigned_to
          ),

          KEY idx_marketing_task_creator (
            created_by
          ),

          KEY idx_marketing_task_status (
            task_status
          ),

          KEY idx_marketing_task_priority (
            priority
          ),

          KEY idx_marketing_task_due (
            due_date
          ),

          KEY idx_marketing_task_approver (
            approved_by
          ),

          CONSTRAINT fk_marketing_task_campaign
            FOREIGN KEY (campaign_id)
            REFERENCES marketing_campaigns(id)
            ON UPDATE CASCADE
            ON DELETE SET NULL,

          CONSTRAINT fk_marketing_task_assigned
            FOREIGN KEY (assigned_to)
            REFERENCES users(id)
            ON UPDATE CASCADE
            ON DELETE SET NULL,

          CONSTRAINT fk_marketing_task_creator
            FOREIGN KEY (created_by)
            REFERENCES users(id)
            ON UPDATE CASCADE
            ON DELETE SET NULL,

          CONSTRAINT fk_marketing_task_approver
            FOREIGN KEY (approved_by)
            REFERENCES users(id)
            ON UPDATE CASCADE
            ON DELETE SET NULL

        ) ENGINE=InnoDB
        DEFAULT CHARSET=utf8mb4
        COLLATE=utf8mb4_unicode_ci
      `);
    } else {
      console.log(
        'Existing marketing_tasks table detected.'
      );

      console.log(
        'Upgrading existing marketing_tasks table without deleting records...'
      );

      const addedTaskTitle =
        await addColumnIfMissing(
          connection,
          'marketing_tasks',
          'task_title',
          'VARCHAR(180) NULL'
        );

      if (addedTaskTitle) {
        const hasOldTitle =
          await columnExists(
            connection,
            'marketing_tasks',
            'title'
          );

        if (hasOldTitle) {
          await connection.query(`
            UPDATE marketing_tasks
            SET task_title =
              COALESCE(
                NULLIF(TRIM(title), ''),
                CONCAT(
                  'Marketing Task #',
                  id
                )
              )
            WHERE task_title IS NULL
               OR TRIM(task_title) = ''
          `);
        } else {
          await connection.query(`
            UPDATE marketing_tasks
            SET task_title =
              CONCAT(
                'Marketing Task #',
                id
              )
            WHERE task_title IS NULL
               OR TRIM(task_title) = ''
          `);
        }

        await connection.query(`
          ALTER TABLE marketing_tasks
          MODIFY COLUMN task_title
            VARCHAR(180) NOT NULL
        `);
      }

      const addedDescription =
        await addColumnIfMissing(
          connection,
          'marketing_tasks',
          'task_description',
          'TEXT NULL'
        );

      if (addedDescription) {
        const hasOldDescription =
          await columnExists(
            connection,
            'marketing_tasks',
            'description'
          );

        if (hasOldDescription) {
          await connection.query(`
            UPDATE marketing_tasks
            SET task_description =
              description
            WHERE task_description IS NULL
          `);
        }
      }

      await addColumnIfMissing(
        connection,
        'marketing_tasks',
        'campaign_id',
        'INT UNSIGNED NULL'
      );

      await addColumnIfMissing(
        connection,
        'marketing_tasks',
        'content_type',
        `
          ENUM(
            'poster',
            'video',
            'caption',
            'product_photo',
            'social_media_post',
            'product_promotion',
            'other'
          ) NOT NULL DEFAULT 'other'
        `
      );

      await addColumnIfMissing(
        connection,
        'marketing_tasks',
        'assigned_to',
        `${userIdType} NULL`
      );

      await addColumnIfMissing(
        connection,
        'marketing_tasks',
        'created_by',
        `${userIdType} NULL`
      );

      await addColumnIfMissing(
        connection,
        'marketing_tasks',
        'priority',
        `
          ENUM(
            'low',
            'medium',
            'high',
            'urgent'
          ) NOT NULL DEFAULT 'medium'
        `
      );

      await addColumnIfMissing(
        connection,
        'marketing_tasks',
        'due_date',
        'DATETIME NULL'
      );

      const addedTaskStatus =
        await addColumnIfMissing(
          connection,
          'marketing_tasks',
          'task_status',
          `
            ENUM(
              'pending',
              'assigned',
              'in_progress',
              'submitted',
              'for_revision',
              'approved',
              'completed',
              'cancelled'
            ) NOT NULL DEFAULT 'pending'
          `
        );

      /*
       * Preserve compatible status values from an
       * older status column when one exists.
       */
      if (
        addedTaskStatus &&
        await columnExists(
          connection,
          'marketing_tasks',
          'status'
        )
      ) {
        await connection.query(`
          UPDATE marketing_tasks
          SET task_status =
            CASE LOWER(TRIM(status))
              WHEN 'pending'
                THEN 'pending'

              WHEN 'assigned'
                THEN 'assigned'

              WHEN 'in progress'
                THEN 'in_progress'

              WHEN 'in_progress'
                THEN 'in_progress'

              WHEN 'submitted'
                THEN 'submitted'

              WHEN 'for revision'
                THEN 'for_revision'

              WHEN 'for_revision'
                THEN 'for_revision'

              WHEN 'approved'
                THEN 'approved'

              WHEN 'completed'
                THEN 'completed'

              WHEN 'cancelled'
                THEN 'cancelled'

              ELSE task_status
            END
        `);
      }

      await addColumnIfMissing(
        connection,
        'marketing_tasks',
        'revision_notes',
        'TEXT NULL'
      );

      await addColumnIfMissing(
        connection,
        'marketing_tasks',
        'approved_by',
        `${userIdType} NULL`
      );

      await addColumnIfMissing(
        connection,
        'marketing_tasks',
        'approved_at',
        'DATETIME NULL'
      );

      await addColumnIfMissing(
        connection,
        'marketing_tasks',
        'completed_at',
        'DATETIME NULL'
      );

      await addColumnIfMissing(
        connection,
        'marketing_tasks',
        'created_at',
        `
          TIMESTAMP NOT NULL
          DEFAULT CURRENT_TIMESTAMP
        `
      );

      await addColumnIfMissing(
        connection,
        'marketing_tasks',
        'updated_at',
        `
          TIMESTAMP NOT NULL
          DEFAULT CURRENT_TIMESTAMP
          ON UPDATE CURRENT_TIMESTAMP
        `
      );

      await connection.execute(
        `
          UPDATE marketing_tasks
          SET campaign_id = ?
          WHERE campaign_id IS NULL
        `,
        [defaultCampaignId]
      );

      await addIndexIfMissing(
        connection,
        'marketing_tasks',
        'idx_marketing_task_campaign_v2',
        'campaign_id'
      );

      await addIndexIfMissing(
        connection,
        'marketing_tasks',
        'idx_marketing_task_assigned_v2',
        'assigned_to'
      );

      await addIndexIfMissing(
        connection,
        'marketing_tasks',
        'idx_marketing_task_creator_v2',
        'created_by'
      );

      await addIndexIfMissing(
        connection,
        'marketing_tasks',
        'idx_marketing_task_status_v2',
        'task_status'
      );

      await addIndexIfMissing(
        connection,
        'marketing_tasks',
        'idx_marketing_task_due_v2',
        'due_date'
      );

      const campaignForeignKeyExists =
        await foreignKeyExistsForColumn(
          connection,
          'marketing_tasks',
          'campaign_id'
        );

      if (!campaignForeignKeyExists) {
        await connection.query(`
          ALTER TABLE marketing_tasks
          ADD CONSTRAINT
            fk_marketing_task_campaign_v2

          FOREIGN KEY (campaign_id)
          REFERENCES marketing_campaigns(id)
          ON UPDATE CASCADE
          ON DELETE SET NULL
        `);
      }

      const assignedForeignKeyExists =
        await foreignKeyExistsForColumn(
          connection,
          'marketing_tasks',
          'assigned_to'
        );

      if (!assignedForeignKeyExists) {
        await connection.query(`
          ALTER TABLE marketing_tasks
          ADD CONSTRAINT
            fk_marketing_task_assigned_v2

          FOREIGN KEY (assigned_to)
          REFERENCES users(id)
          ON UPDATE CASCADE
          ON DELETE SET NULL
        `);
      }

      const creatorForeignKeyExists =
        await foreignKeyExistsForColumn(
          connection,
          'marketing_tasks',
          'created_by'
        );

      if (!creatorForeignKeyExists) {
        await connection.query(`
          ALTER TABLE marketing_tasks
          ADD CONSTRAINT
            fk_marketing_task_creator_v2

          FOREIGN KEY (created_by)
          REFERENCES users(id)
          ON UPDATE CASCADE
          ON DELETE SET NULL
        `);
      }

      const approverForeignKeyExists =
        await foreignKeyExistsForColumn(
          connection,
          'marketing_tasks',
          'approved_by'
        );

      if (!approverForeignKeyExists) {
        await connection.query(`
          ALTER TABLE marketing_tasks
          ADD CONSTRAINT
            fk_marketing_task_approver_v2

          FOREIGN KEY (approved_by)
          REFERENCES users(id)
          ON UPDATE CASCADE
          ON DELETE SET NULL
        `);
      }
    }

    const marketingTaskIdType =
      await getColumnType(
        connection,
        'marketing_tasks',
        'id'
      );

    validateIntegerType(
      marketingTaskIdType,
      'marketing_tasks.id'
    );

    console.log(
      'Detected marketing_tasks.id type:',
      marketingTaskIdType
    );

    console.log(
      'Creating Marketing submissions table...'
    );

    await connection.query(`
      CREATE TABLE IF NOT EXISTS
        marketing_task_submissions (

        id INT UNSIGNED NOT NULL
          AUTO_INCREMENT,

        marketing_task_id
          ${marketingTaskIdType}
          NOT NULL,

        submitted_by ${userIdType}
          NULL,

        submission_number
          INT UNSIGNED NOT NULL,

        output_link VARCHAR(600)
          NOT NULL,

        submission_notes TEXT NULL,

        review_status ENUM(
          'pending_review',
          'approved',
          'for_revision'
        ) NOT NULL
          DEFAULT 'pending_review',

        reviewed_by ${userIdType}
          NULL,

        review_notes TEXT NULL,

        submitted_at DATETIME NOT NULL
          DEFAULT CURRENT_TIMESTAMP,

        reviewed_at DATETIME NULL,

        created_at TIMESTAMP NOT NULL
          DEFAULT CURRENT_TIMESTAMP,

        updated_at TIMESTAMP NOT NULL
          DEFAULT CURRENT_TIMESTAMP
          ON UPDATE CURRENT_TIMESTAMP,

        PRIMARY KEY (id),

        UNIQUE KEY uq_marketing_submission_number (
          marketing_task_id,
          submission_number
        ),

        KEY idx_marketing_submission_task (
          marketing_task_id
        ),

        KEY idx_marketing_submission_user (
          submitted_by
        ),

        KEY idx_marketing_submission_review_status (
          review_status
        ),

        KEY idx_marketing_submission_reviewer (
          reviewed_by
        ),

        KEY idx_marketing_submission_date (
          submitted_at
        ),

        CONSTRAINT fk_marketing_submission_task
          FOREIGN KEY (marketing_task_id)
          REFERENCES marketing_tasks(id)
          ON UPDATE CASCADE
          ON DELETE CASCADE,

        CONSTRAINT fk_marketing_submission_user
          FOREIGN KEY (submitted_by)
          REFERENCES users(id)
          ON UPDATE CASCADE
          ON DELETE SET NULL,

        CONSTRAINT fk_marketing_submission_reviewer
          FOREIGN KEY (reviewed_by)
          REFERENCES users(id)
          ON UPDATE CASCADE
          ON DELETE SET NULL

      ) ENGINE=InnoDB
      DEFAULT CHARSET=utf8mb4
      COLLATE=utf8mb4_unicode_ci
    `);

    console.log(
      'Creating Marketing status-history table...'
    );

    await connection.query(`
      CREATE TABLE IF NOT EXISTS
        marketing_task_status_history (

        id INT UNSIGNED NOT NULL
          AUTO_INCREMENT,

        marketing_task_id
          ${marketingTaskIdType}
          NOT NULL,

        changed_by ${userIdType}
          NULL,

        previous_status ENUM(
          'pending',
          'assigned',
          'in_progress',
          'submitted',
          'for_revision',
          'approved',
          'completed',
          'cancelled'
        ) NULL,

        new_status ENUM(
          'pending',
          'assigned',
          'in_progress',
          'submitted',
          'for_revision',
          'approved',
          'completed',
          'cancelled'
        ) NOT NULL,

        notes TEXT NULL,

        created_at TIMESTAMP NOT NULL
          DEFAULT CURRENT_TIMESTAMP,

        PRIMARY KEY (id),

        KEY idx_marketing_history_task (
          marketing_task_id
        ),

        KEY idx_marketing_history_user (
          changed_by
        ),

        KEY idx_marketing_history_status (
          new_status
        ),

        KEY idx_marketing_history_created (
          created_at
        ),

        CONSTRAINT fk_marketing_history_task
          FOREIGN KEY (marketing_task_id)
          REFERENCES marketing_tasks(id)
          ON UPDATE CASCADE
          ON DELETE CASCADE,

        CONSTRAINT fk_marketing_history_user
          FOREIGN KEY (changed_by)
          REFERENCES users(id)
          ON UPDATE CASCADE
          ON DELETE SET NULL

      ) ENGINE=InnoDB
      DEFAULT CHARSET=utf8mb4
      COLLATE=utf8mb4_unicode_ci
    `);

    /*
     * Ensure all tasks belong to the default
     * campaign when no campaign was assigned.
     */
    await connection.execute(
      `
        UPDATE marketing_tasks
        SET campaign_id = ?
        WHERE campaign_id IS NULL
      `,
      [defaultCampaignId]
    );

    const [tableRows] =
      await connection.execute(`
        SELECT TABLE_NAME
        FROM information_schema.TABLES
        WHERE TABLE_SCHEMA = DATABASE()
          AND TABLE_NAME IN (
            'marketing_campaigns',
            'marketing_tasks',
            'marketing_task_submissions',
            'marketing_task_status_history'
          )
        ORDER BY TABLE_NAME
      `);

    const [campaignRows] =
      await connection.execute(`
        SELECT COUNT(*) AS total
        FROM marketing_campaigns
      `);

    const [taskRows] =
      await connection.execute(`
        SELECT COUNT(*) AS total
        FROM marketing_tasks
      `);

    const [submissionRows] =
      await connection.execute(`
        SELECT COUNT(*) AS total
        FROM marketing_task_submissions
      `);

    console.log(
      'Available Marketing tables:',
      tableRows.map(
        (row) => row.TABLE_NAME
      )
    );

    console.log(
      'Marketing campaigns:',
      Number(campaignRows[0].total)
    );

    console.log(
      'Existing marketing tasks preserved:',
      Number(taskRows[0].total)
    );

    console.log(
      'Marketing submissions:',
      Number(submissionRows[0].total)
    );

    console.log(
      'Marketing database setup completed successfully.'
    );
  } catch (error) {
    console.error(
      'Marketing database setup failed:',
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

setupMarketingDatabase();