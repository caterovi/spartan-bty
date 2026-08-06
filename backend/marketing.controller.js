const pool = require('../config/db');

const CAMPAIGN_STATUSES = [
  'planning',
  'active',
  'completed',
  'cancelled',
];

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

const CONTENT_TYPES = [
  'poster',
  'video',
  'caption',
  'product_photo',
  'social_media_post',
  'product_promotion',
  'other',
];

const PRIORITIES = [
  'low',
  'medium',
  'high',
  'urgent',
];

function cleanText(value) {
  return String(value || '').trim();
}

function parsePositiveInteger(value) {
  const number = Number(value);

  if (
    !Number.isInteger(number) ||
    number <= 0
  ) {
    return null;
  }

  return number;
}

function parseOptionalDate(value) {
  const cleanedValue = cleanText(value);

  if (!cleanedValue) {
    return {
      valid: true,
      value: null,
    };
  }

  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(
      cleanedValue
    )
  ) {
    return {
      valid: false,
      value: null,
    };
  }

  const [
    year,
    month,
    day,
  ] = cleanedValue
    .split('-')
    .map(Number);

  const date = new Date(
    year,
    month - 1,
    day
  );

  const valid =
    date.getFullYear() === year &&
    date.getMonth() === month - 1 &&
    date.getDate() === day;

  return {
    valid,
    value: valid
      ? cleanedValue
      : null,
  };
}

function parseOptionalDateTime(value) {
  const cleanedValue = cleanText(value);

  if (!cleanedValue) {
    return {
      valid: true,
      value: null,
    };
  }

  const match = cleanedValue.match(
    /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::(\d{2}))?$/
  );

  if (!match) {
    return {
      valid: false,
      value: null,
    };
  }

  const [
    ,
    year,
    month,
    day,
    hour,
    minute,
    second = '00',
  ] = match;

  const date = new Date(
    Number(year),
    Number(month) - 1,
    Number(day),
    Number(hour),
    Number(minute),
    Number(second)
  );

  const valid =
    date.getFullYear() ===
      Number(year) &&
    date.getMonth() ===
      Number(month) - 1 &&
    date.getDate() ===
      Number(day) &&
    date.getHours() ===
      Number(hour) &&
    date.getMinutes() ===
      Number(minute) &&
    date.getSeconds() ===
      Number(second);

  return {
    valid,
    value: valid
      ? `${year}-${month}-${day} ${hour}:${minute}:${second}`
      : null,
  };
}

function isValidOutputLink(value) {
  try {
    const url = new URL(value);

    return [
      'http:',
      'https:',
    ].includes(url.protocol);
  } catch {
    return false;
  }
}

function generateCampaignCode() {
  const now = new Date();

  const datePart = [
    now.getFullYear(),
    String(
      now.getMonth() + 1
    ).padStart(2, '0'),
    String(
      now.getDate()
    ).padStart(2, '0'),
  ].join('');

  const randomPart =
    Math.random()
      .toString(36)
      .slice(2, 7)
      .toUpperCase();

  return `MKT-${datePart}-${randomPart}`;
}

async function addStatusHistory(
  connection,
  taskId,
  changedBy,
  previousStatus,
  newStatus,
  notes = null
) {
  await connection.execute(
    `
      INSERT INTO marketing_task_status_history (
        marketing_task_id,
        changed_by,
        previous_status,
        new_status,
        notes
      )
      VALUES (?, ?, ?, ?, ?)
    `,
    [
      taskId,
      changedBy,
      previousStatus || null,
      newStatus,
      notes || null,
    ]
  );
}

async function getMarketingSpecialist(
  connection,
  userId
) {
  const [rows] =
    await connection.execute(
      `
        SELECT
          u.id,
          u.full_name,
          u.email,
          u.status,

          d.code
            AS department_code,

          d.name
            AS department_name

        FROM users u

        INNER JOIN departments d
          ON d.id =
             u.department_id

        WHERE u.id = ?
          AND u.role =
              'specialist'
          AND d.code =
              'marketing'
          AND u.status =
              'active'

        LIMIT 1
      `,
      [userId]
    );

  return rows[0] || null;
}

async function getLockedTask(
  connection,
  taskId
) {
  const [rows] =
    await connection.execute(
      `
        SELECT
          id,
          campaign_id,
          task_title,
          assigned_to,
          task_status,
          revision_notes,
          approved_by,
          approved_at,
          completed_at

        FROM marketing_tasks

        WHERE id = ?

        FOR UPDATE
      `,
      [taskId]
    );

  return rows[0] || null;
}

function formatCampaign(row) {
  return {
    id: row.id,

    campaignCode:
      row.campaign_code,

    campaignName:
      row.campaign_name,

    description:
      row.description,

    productId:
      row.product_id,

    productName:
      row.product_name || null,

    startDate:
      row.start_date,

    endDate:
      row.end_date,

    campaignStatus:
      row.campaign_status,

    createdBy:
      row.created_by
        ? {
            id: row.created_by,

            fullName:
              row.created_by_name ||
              'Former user',
          }
        : null,

    taskCount: Number(
      row.task_count || 0
    ),

    completedTaskCount: Number(
      row.completed_task_count || 0
    ),

    createdAt:
      row.created_at,

    updatedAt:
      row.updated_at,
  };
}

function formatTask(row) {
  return {
    id: row.id,

    campaignId:
      row.campaign_id,

    campaignCode:
      row.campaign_code,

    campaignName:
      row.campaign_name,

    taskTitle:
      row.task_title,

    taskDescription:
      row.task_description,

    contentType:
      row.content_type,

    priority:
      row.priority,

    dueDate:
      row.due_date,

    taskStatus:
      row.task_status,

    revisionNotes:
      row.revision_notes,

    assignedUser:
      row.assigned_to
        ? {
            id: row.assigned_to,

            fullName:
              row.assigned_to_name ||
              'Former Marketing user',

            email:
              row.assigned_to_email ||
              null,
          }
        : null,

    createdBy:
      row.created_by
        ? {
            id: row.created_by,

            fullName:
              row.created_by_name ||
              'Former user',
          }
        : null,

    approvedBy:
      row.approved_by
        ? {
            id: row.approved_by,

            fullName:
              row.approved_by_name ||
              'Former user',
          }
        : null,

    approvedAt:
      row.approved_at,

    completedAt:
      row.completed_at,

    submissionCount: Number(
      row.submission_count || 0
    ),

    latestSubmissionNumber:
      row.latest_submission_number ===
        null ||
      row.latest_submission_number ===
        undefined
        ? null
        : Number(
            row.latest_submission_number
          ),

    latestOutputLink:
      row.latest_output_link || null,

    latestReviewStatus:
      row.latest_review_status || null,

    latestSubmittedAt:
      row.latest_submitted_at || null,

    isOverdue:
      Boolean(
        row.due_date &&
        new Date(
          row.due_date
        ).getTime() < Date.now() &&
        ![
          'completed',
          'cancelled',
        ].includes(
          row.task_status
        )
      ),

    createdAt:
      row.created_at,

    updatedAt:
      row.updated_at,
  };
}

const campaignSelect = `
  SELECT
    mc.id,
    mc.campaign_code,
    mc.campaign_name,
    mc.description,
    mc.product_id,
    mc.start_date,
    mc.end_date,
    mc.campaign_status,
    mc.created_by,
    mc.created_at,
    mc.updated_at,

    p.product_name,

    creator.full_name
      AS created_by_name,

    COALESCE(
      task_summary.task_count,
      0
    ) AS task_count,

    COALESCE(
      task_summary.completed_task_count,
      0
    ) AS completed_task_count

  FROM marketing_campaigns mc

  LEFT JOIN products p
    ON p.id = mc.product_id

  LEFT JOIN users creator
    ON creator.id =
       mc.created_by

  LEFT JOIN (
    SELECT
      campaign_id,

      COUNT(*) AS task_count,

      SUM(
        CASE
          WHEN task_status =
            'completed'
          THEN 1
          ELSE 0
        END
      ) AS completed_task_count

    FROM marketing_tasks

    GROUP BY campaign_id
  ) task_summary
    ON task_summary.campaign_id =
       mc.id
`;

const taskSelect = `
  SELECT
    mt.id,
    mt.campaign_id,
    mt.task_title,
    mt.task_description,
    mt.content_type,
    mt.assigned_to,
    mt.created_by,
    mt.priority,
    mt.due_date,
    mt.task_status,
    mt.revision_notes,
    mt.approved_by,
    mt.approved_at,
    mt.completed_at,
    mt.created_at,
    mt.updated_at,

    mc.campaign_code,
    mc.campaign_name,

    assigned.full_name
      AS assigned_to_name,

    assigned.email
      AS assigned_to_email,

    creator.full_name
      AS created_by_name,

    approver.full_name
      AS approved_by_name,

    COALESCE(
      submission_summary.submission_count,
      0
    ) AS submission_count,

    latest_submission.submission_number
      AS latest_submission_number,

    latest_submission.output_link
      AS latest_output_link,

    latest_submission.review_status
      AS latest_review_status,

    latest_submission.submitted_at
      AS latest_submitted_at

  FROM marketing_tasks mt

  LEFT JOIN marketing_campaigns mc
    ON mc.id = mt.campaign_id

  LEFT JOIN users assigned
    ON assigned.id =
       mt.assigned_to

  LEFT JOIN users creator
    ON creator.id =
       mt.created_by

  LEFT JOIN users approver
    ON approver.id =
       mt.approved_by

  LEFT JOIN (
    SELECT
      marketing_task_id,
      COUNT(*) AS submission_count,
      MAX(submission_number)
        AS latest_number

    FROM marketing_task_submissions

    GROUP BY marketing_task_id
  ) submission_summary
    ON submission_summary
         .marketing_task_id =
       mt.id

  LEFT JOIN marketing_task_submissions
    latest_submission

    ON latest_submission
         .marketing_task_id =
       mt.id

   AND latest_submission
         .submission_number =
       submission_summary.latest_number
`;

// GET /api/marketing/users
exports.getMarketingUsers = async (
  req,
  res
) => {
  try {
    const [rows] =
      await pool.execute(`
        SELECT
          u.id,
          u.full_name,
          u.email,
          u.status,

          d.id
            AS department_id,

          d.code
            AS department_code,

          d.name
            AS department_name

        FROM users u

        INNER JOIN departments d
          ON d.id =
             u.department_id

        WHERE u.role =
          'specialist'

          AND d.code =
          'marketing'

          AND u.status =
          'active'

        ORDER BY
          u.full_name ASC
      `);

    return res.json({
      success: true,

      users: rows.map(
        (user) => ({
          id: user.id,

          fullName:
            user.full_name,

          email:
            user.email,

          status:
            user.status,

          department: {
            id:
              user.department_id,

            code:
              user.department_code,

            name:
              user.department_name,
          },
        })
      ),
    });
  } catch (error) {
    console.error(
      'Get Marketing users error:',
      error
    );

    return res.status(500).json({
      success: false,

      message:
        'Unable to retrieve Marketing users.',
    });
  }
};

// GET /api/marketing/products
exports.getProducts = async (req, res) => {
  try {
    const [rows] = await pool.execute(`
      SELECT
        id,
        sku,
        product_name,
        default_price,
        status
      FROM products
      WHERE status = 'active'
      ORDER BY product_name ASC
    `);

    return res.json({
      success: true,

      products: rows.map((product) => ({
        id: product.id,
        sku: product.sku,
        productName: product.product_name,

        defaultPrice: Number(
          product.default_price || 0
        ),

        status: product.status,
      })),
    });
  } catch (error) {
    console.error(
      'Get Marketing products error:',
      error
    );

    return res.status(500).json({
      success: false,
      message:
        'Unable to retrieve products.',
    });
  }
};

// GET /api/marketing/summary
exports.getSummary = async (
  req,
  res
) => {
  try {
    const isSpecialist =
      req.user.role ===
      'specialist';

    const taskCondition =
      isSpecialist
        ? 'WHERE assigned_to = ?'
        : '';

    const taskValues =
      isSpecialist
        ? [req.user.id]
        : [];

    const [taskRows] =
      await pool.execute(
        `
          SELECT
            COUNT(*) AS total_tasks,

            SUM(
              CASE
                WHEN task_status =
                  'assigned'
                THEN 1
                ELSE 0
              END
            ) AS assigned,

            SUM(
              CASE
                WHEN task_status =
                  'in_progress'
                THEN 1
                ELSE 0
              END
            ) AS in_progress,

            SUM(
              CASE
                WHEN task_status =
                  'submitted'
                THEN 1
                ELSE 0
              END
            ) AS submitted,

            SUM(
              CASE
                WHEN task_status =
                  'for_revision'
                THEN 1
                ELSE 0
              END
            ) AS for_revision,

            SUM(
              CASE
                WHEN task_status =
                  'approved'
                THEN 1
                ELSE 0
              END
            ) AS approved,

            SUM(
              CASE
                WHEN task_status =
                  'completed'
                THEN 1
                ELSE 0
              END
            ) AS completed,

            SUM(
              CASE
                WHEN due_date IS NOT NULL
                  AND due_date < NOW()

                  AND task_status NOT IN (
                    'completed',
                    'cancelled'
                  )
                THEN 1
                ELSE 0
              END
            ) AS overdue

          FROM marketing_tasks

          ${taskCondition}
        `,
        taskValues
      );

    let campaignQuery = `
      SELECT COUNT(*) AS total_campaigns
      FROM marketing_campaigns
    `;

    let campaignValues = [];

    if (isSpecialist) {
      campaignQuery = `
        SELECT
          COUNT(
            DISTINCT campaign_id
          ) AS total_campaigns

        FROM marketing_tasks

        WHERE assigned_to = ?
      `;

      campaignValues = [
        req.user.id,
      ];
    }

    const [campaignRows] =
      await pool.execute(
        campaignQuery,
        campaignValues
      );

    const tasks = taskRows[0];

    return res.json({
      success: true,

      summary: {
        totalCampaigns: Number(
          campaignRows[0]
            .total_campaigns || 0
        ),

        totalTasks: Number(
          tasks.total_tasks || 0
        ),

        assigned: Number(
          tasks.assigned || 0
        ),

        inProgress: Number(
          tasks.in_progress || 0
        ),

        submitted: Number(
          tasks.submitted || 0
        ),

        forRevision: Number(
          tasks.for_revision || 0
        ),

        approved: Number(
          tasks.approved || 0
        ),

        completed: Number(
          tasks.completed || 0
        ),

        overdue: Number(
          tasks.overdue || 0
        ),
      },
    });
  } catch (error) {
    console.error(
      'Get Marketing summary error:',
      error
    );

    return res.status(500).json({
      success: false,

      message:
        'Unable to retrieve the Marketing summary.',
    });
  }
};

// GET /api/marketing/campaigns
exports.getCampaigns = async (
  req,
  res
) => {
  try {
    const search = cleanText(
      req.query.search
    );

    const status = cleanText(
      req.query.status
    );

    if (
      status &&
      !CAMPAIGN_STATUSES.includes(
        status
      )
    ) {
      return res.status(400).json({
        success: false,

        message:
          'Invalid campaign status.',
      });
    }

    const conditions = [];
    const values = [];

    if (search) {
      const keyword =
        `%${search}%`;

      conditions.push(`
        (
          mc.campaign_code LIKE ?
          OR mc.campaign_name LIKE ?
          OR mc.description LIKE ?
          OR p.product_name LIKE ?
        )
      `);

      values.push(
        keyword,
        keyword,
        keyword,
        keyword
      );
    }

    if (status) {
      conditions.push(`
        mc.campaign_status = ?
      `);

      values.push(status);
    }

    if (
      req.user.role ===
      'specialist'
    ) {
      conditions.push(`
        EXISTS (
          SELECT 1

          FROM marketing_tasks
            assigned_task

          WHERE
            assigned_task.campaign_id =
              mc.id

            AND assigned_task.assigned_to =
              ?
        )
      `);

      values.push(req.user.id);
    }

    const whereClause =
      conditions.length > 0
        ? `WHERE ${conditions.join(
            ' AND '
          )}`
        : '';

    const [rows] =
      await pool.execute(
        `
          ${campaignSelect}

          ${whereClause}

          ORDER BY
            CASE
              WHEN mc.campaign_status =
                'active'
              THEN 1

              WHEN mc.campaign_status =
                'planning'
              THEN 2

              WHEN mc.campaign_status =
                'completed'
              THEN 3

              ELSE 4
            END,

            mc.updated_at DESC
        `,
        values
      );

    return res.json({
      success: true,

      campaigns:
        rows.map(formatCampaign),
    });
  } catch (error) {
    console.error(
      'Get Marketing campaigns error:',
      error
    );

    return res.status(500).json({
      success: false,

      message:
        'Unable to retrieve Marketing campaigns.',
    });
  }
};

// POST /api/marketing/campaigns
exports.createCampaign = async (
  req,
  res
) => {
  try {
    const campaignName =
      cleanText(
        req.body.campaignName
      );

    const description =
      cleanText(
        req.body.description
      );

    const productId =
      req.body.productId
        ? parsePositiveInteger(
            req.body.productId
          )
        : null;

    const campaignStatus =
      cleanText(
        req.body.campaignStatus ||
        'planning'
      );

    const parsedStartDate =
      parseOptionalDate(
        req.body.startDate
      );

    const parsedEndDate =
      parseOptionalDate(
        req.body.endDate
      );

    if (!campaignName) {
      return res.status(400).json({
        success: false,

        message:
          'Campaign name is required.',
      });
    }

    if (
      !CAMPAIGN_STATUSES.includes(
        campaignStatus
      )
    ) {
      return res.status(400).json({
        success: false,

        message:
          'Invalid campaign status.',
      });
    }

    if (
      !parsedStartDate.valid ||
      !parsedEndDate.valid
    ) {
      return res.status(400).json({
        success: false,

        message:
          'Enter valid campaign dates.',
      });
    }

    if (
      parsedStartDate.value &&
      parsedEndDate.value &&
      parsedEndDate.value <
        parsedStartDate.value
    ) {
      return res.status(400).json({
        success: false,

        message:
          'Campaign end date cannot be earlier than the start date.',
      });
    }

    if (productId) {
      const [productRows] =
        await pool.execute(
          `
            SELECT id
            FROM products
            WHERE id = ?
              AND status = 'active'
            LIMIT 1
          `,
          [productId]
        );

      if (
        productRows.length === 0
      ) {
        return res.status(400).json({
          success: false,

          message:
            'Selected product was not found.',
        });
      }
    }

    const campaignCode =
      generateCampaignCode();

    const [result] =
      await pool.execute(
        `
          INSERT INTO marketing_campaigns (
            campaign_code,
            campaign_name,
            description,
            product_id,
            start_date,
            end_date,
            campaign_status,
            created_by
          )
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `,
        [
          campaignCode,
          campaignName,
          description || null,
          productId,
          parsedStartDate.value,
          parsedEndDate.value,
          campaignStatus,
          req.user.id,
        ]
      );

    return res.status(201).json({
      success: true,

      message:
        'Marketing campaign created successfully.',

      campaign: {
        id: result.insertId,
        campaignCode,
        campaignName,
        description:
          description || null,
        productId,
        startDate:
          parsedStartDate.value,
        endDate:
          parsedEndDate.value,
        campaignStatus,
      },
    });
  } catch (error) {
    console.error(
      'Create Marketing campaign error:',
      error
    );

    return res.status(500).json({
      success: false,

      message:
        'Unable to create the Marketing campaign.',
    });
  }
};

// PATCH /api/marketing/campaigns/:id
exports.updateCampaign = async (
  req,
  res
) => {
  try {
    const campaignId =
      parsePositiveInteger(
        req.params.id
      );

    const campaignName =
      cleanText(
        req.body.campaignName
      );

    const description =
      cleanText(
        req.body.description
      );

    const productId =
      req.body.productId
        ? parsePositiveInteger(
            req.body.productId
          )
        : null;

    const campaignStatus =
      cleanText(
        req.body.campaignStatus
      );

    const parsedStartDate =
      parseOptionalDate(
        req.body.startDate
      );

    const parsedEndDate =
      parseOptionalDate(
        req.body.endDate
      );

    if (!campaignId) {
      return res.status(400).json({
        success: false,

        message:
          'Invalid Marketing campaign.',
      });
    }

    if (!campaignName) {
      return res.status(400).json({
        success: false,

        message:
          'Campaign name is required.',
      });
    }

    if (
      !CAMPAIGN_STATUSES.includes(
        campaignStatus
      )
    ) {
      return res.status(400).json({
        success: false,

        message:
          'Invalid campaign status.',
      });
    }

    if (
      !parsedStartDate.valid ||
      !parsedEndDate.valid
    ) {
      return res.status(400).json({
        success: false,

        message:
          'Enter valid campaign dates.',
      });
    }

    if (
      parsedStartDate.value &&
      parsedEndDate.value &&
      parsedEndDate.value <
        parsedStartDate.value
    ) {
      return res.status(400).json({
        success: false,

        message:
          'Campaign end date cannot be earlier than the start date.',
      });
    }

    const [result] =
      await pool.execute(
        `
          UPDATE marketing_campaigns
          SET
            campaign_name = ?,
            description = ?,
            product_id = ?,
            start_date = ?,
            end_date = ?,
            campaign_status = ?
          WHERE id = ?
        `,
        [
          campaignName,
          description || null,
          productId,
          parsedStartDate.value,
          parsedEndDate.value,
          campaignStatus,
          campaignId,
        ]
      );

    if (
      result.affectedRows === 0
    ) {
      return res.status(404).json({
        success: false,

        message:
          'Marketing campaign not found.',
      });
    }

    return res.json({
      success: true,

      message:
        'Marketing campaign updated successfully.',
    });
  } catch (error) {
    console.error(
      'Update Marketing campaign error:',
      error
    );

    return res.status(500).json({
      success: false,

      message:
        'Unable to update the Marketing campaign.',
    });
  }
};

// GET /api/marketing/tasks
exports.getTasks = async (
  req,
  res
) => {
  try {
    const search = cleanText(
      req.query.search
    );

    const status = cleanText(
      req.query.status
    );

    const priority = cleanText(
      req.query.priority
    );

    const campaignId =
      req.query.campaignId
        ? parsePositiveInteger(
            req.query.campaignId
          )
        : null;

    const conditions = [];
    const values = [];

    if (
      status &&
      !TASK_STATUSES.includes(
        status
      )
    ) {
      return res.status(400).json({
        success: false,

        message:
          'Invalid Marketing task status.',
      });
    }

    if (
      priority &&
      !PRIORITIES.includes(priority)
    ) {
      return res.status(400).json({
        success: false,

        message:
          'Invalid Marketing task priority.',
      });
    }

    if (
      req.query.campaignId &&
      !campaignId
    ) {
      return res.status(400).json({
        success: false,

        message:
          'Invalid campaign filter.',
      });
    }

    if (search) {
      const keyword =
        `%${search}%`;

      conditions.push(`
        (
          mt.task_title LIKE ?
          OR mt.task_description LIKE ?
          OR mc.campaign_name LIKE ?
          OR assigned.full_name LIKE ?
        )
      `);

      values.push(
        keyword,
        keyword,
        keyword,
        keyword
      );
    }

    if (status) {
      conditions.push(`
        mt.task_status = ?
      `);

      values.push(status);
    }

    if (priority) {
      conditions.push(`
        mt.priority = ?
      `);

      values.push(priority);
    }

    if (campaignId) {
      conditions.push(`
        mt.campaign_id = ?
      `);

      values.push(campaignId);
    }

    if (
      req.user.role ===
      'specialist'
    ) {
      conditions.push(`
        mt.assigned_to = ?
      `);

      values.push(req.user.id);
    }

    const whereClause =
      conditions.length > 0
        ? `WHERE ${conditions.join(
            ' AND '
          )}`
        : '';

    const [rows] =
      await pool.execute(
        `
          ${taskSelect}

          ${whereClause}

          ORDER BY
            CASE
              WHEN mt.task_status =
                'submitted'
              THEN 1

              WHEN mt.task_status =
                'for_revision'
              THEN 2

              WHEN mt.task_status =
                'in_progress'
              THEN 3

              WHEN mt.task_status =
                'assigned'
              THEN 4

              WHEN mt.task_status =
                'approved'
              THEN 5

              WHEN mt.task_status =
                'pending'
              THEN 6

              WHEN mt.task_status =
                'completed'
              THEN 7

              ELSE 8
            END,

            mt.due_date IS NULL,

            mt.due_date ASC,

            mt.updated_at DESC
        `,
        values
      );

    return res.json({
      success: true,

      tasks: rows.map(
        formatTask
      ),
    });
  } catch (error) {
    console.error(
      'Get Marketing tasks error:',
      error
    );

    return res.status(500).json({
      success: false,

      message:
        'Unable to retrieve Marketing tasks.',
    });
  }
};

// POST /api/marketing/tasks
exports.createTask = async (
  req,
  res
) => {
  let connection;

  try {
    const campaignId =
      parsePositiveInteger(
        req.body.campaignId
      );

    const taskTitle =
      cleanText(
        req.body.taskTitle
      );

    const taskDescription =
      cleanText(
        req.body.taskDescription
      );

    const contentType =
      cleanText(
        req.body.contentType
      );

    const priority =
      cleanText(
        req.body.priority ||
        'medium'
      );

    const assignedUserId =
      req.body.assignedUserId
        ? parsePositiveInteger(
            req.body.assignedUserId
          )
        : null;

    const parsedDueDate =
      parseOptionalDateTime(
        req.body.dueDate
      );

    if (!campaignId) {
      return res.status(400).json({
        success: false,

        message:
          'Select a Marketing campaign.',
      });
    }

    if (!taskTitle) {
      return res.status(400).json({
        success: false,

        message:
          'Task title is required.',
      });
    }

    if (
      !CONTENT_TYPES.includes(
        contentType
      )
    ) {
      return res.status(400).json({
        success: false,

        message:
          'Select a valid content type.',
      });
    }

    if (
      !PRIORITIES.includes(priority)
    ) {
      return res.status(400).json({
        success: false,

        message:
          'Select a valid task priority.',
      });
    }

    if (!parsedDueDate.valid) {
      return res.status(400).json({
        success: false,

        message:
          'Enter a valid due date and time.',
      });
    }

    connection =
      await pool.getConnection();

    await connection.beginTransaction();

    const [campaignRows] =
      await connection.execute(
        `
          SELECT
            id,
            campaign_status

          FROM marketing_campaigns

          WHERE id = ?

          LIMIT 1
        `,
        [campaignId]
      );

    if (
      campaignRows.length === 0
    ) {
      await connection.rollback();

      return res.status(404).json({
        success: false,

        message:
          'Marketing campaign not found.',
      });
    }

    if (
      campaignRows[0]
        .campaign_status ===
      'cancelled'
    ) {
      await connection.rollback();

      return res.status(400).json({
        success: false,

        message:
          'Tasks cannot be added to a cancelled campaign.',
      });
    }

    if (assignedUserId) {
      const specialist =
        await getMarketingSpecialist(
          connection,
          assignedUserId
        );

      if (!specialist) {
        await connection.rollback();

        return res.status(400).json({
          success: false,

          message:
            'The selected user is not an active Marketing Specialist.',
        });
      }
    }

    const initialStatus =
      assignedUserId
        ? 'assigned'
        : 'pending';

    const [result] =
      await connection.execute(
        `
          INSERT INTO marketing_tasks (
            campaign_id,
            task_title,
            task_description,
            content_type,
            assigned_to,
            created_by,
            priority,
            due_date,
            task_status
          )
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `,
        [
          campaignId,
          taskTitle,
          taskDescription || null,
          contentType,
          assignedUserId,
          req.user.id,
          priority,
          parsedDueDate.value,
          initialStatus,
        ]
      );

    await addStatusHistory(
      connection,
      result.insertId,
      req.user.id,
      null,
      initialStatus,
      assignedUserId
        ? 'Task created and assigned.'
        : 'Task created without assignment.'
    );

    await connection.commit();

    return res.status(201).json({
      success: true,

      message:
        'Marketing task created successfully.',

      task: {
        id: result.insertId,
        campaignId,
        taskTitle,
        contentType,
        assignedUserId,
        priority,
        dueDate:
          parsedDueDate.value,
        taskStatus:
          initialStatus,
      },
    });
  } catch (error) {
    if (connection) {
      try {
        await connection.rollback();
      } catch (rollbackError) {
        console.error(
          'Create Marketing task rollback error:',
          rollbackError
        );
      }
    }

    console.error(
      'Create Marketing task error:',
      error
    );

    return res.status(500).json({
      success: false,

      message:
        'Unable to create the Marketing task.',
    });
  } finally {
    if (connection) {
      connection.release();
    }
  }
};

// PATCH /api/marketing/tasks/:id/assign
exports.assignTask = async (
  req,
  res
) => {
  let connection;

  try {
    const taskId =
      parsePositiveInteger(
        req.params.id
      );

    const assignedUserId =
      parsePositiveInteger(
        req.body.assignedUserId
      );

    if (!taskId) {
      return res.status(400).json({
        success: false,

        message:
          'Invalid Marketing task.',
      });
    }

    if (!assignedUserId) {
      return res.status(400).json({
        success: false,

        message:
          'Select a Marketing Specialist.',
      });
    }

    connection =
      await pool.getConnection();

    await connection.beginTransaction();

    const specialist =
      await getMarketingSpecialist(
        connection,
        assignedUserId
      );

    if (!specialist) {
      await connection.rollback();

      return res.status(400).json({
        success: false,

        message:
          'Selected user is not an active Marketing Specialist.',
      });
    }

    const task =
      await getLockedTask(
        connection,
        taskId
      );

    if (!task) {
      await connection.rollback();

      return res.status(404).json({
        success: false,

        message:
          'Marketing task not found.',
      });
    }

    if (
      ![
        'pending',
        'assigned',
      ].includes(
        task.task_status
      )
    ) {
      await connection.rollback();

      return res.status(400).json({
        success: false,

        message:
          'Only pending or assigned tasks can be reassigned.',
      });
    }

    const previousStatus =
      task.task_status;

    await connection.execute(
      `
        UPDATE marketing_tasks
        SET
          assigned_to = ?,
          task_status = 'assigned'
        WHERE id = ?
      `,
      [
        assignedUserId,
        taskId,
      ]
    );

    await addStatusHistory(
      connection,
      taskId,
      req.user.id,
      previousStatus,
      'assigned',
      `Assigned to ${specialist.full_name}.`
    );

    await connection.commit();

    return res.json({
      success: true,

      message:
        'Marketing task assigned successfully.',
    });
  } catch (error) {
    if (connection) {
      try {
        await connection.rollback();
      } catch (rollbackError) {
        console.error(
          'Assign Marketing task rollback error:',
          rollbackError
        );
      }
    }

    console.error(
      'Assign Marketing task error:',
      error
    );

    return res.status(500).json({
      success: false,

      message:
        'Unable to assign the Marketing task.',
    });
  } finally {
    if (connection) {
      connection.release();
    }
  }
};

// GET /api/marketing/tasks/:id
exports.getTaskById = async (
  req,
  res
) => {
  try {
    const taskId =
      parsePositiveInteger(
        req.params.id
      );

    if (!taskId) {
      return res.status(400).json({
        success: false,

        message:
          'Invalid Marketing task.',
      });
    }

    const conditions = [
      'mt.id = ?',
    ];

    const values = [taskId];

    if (
      req.user.role ===
      'specialist'
    ) {
      conditions.push(`
        mt.assigned_to = ?
      `);

      values.push(req.user.id);
    }

    const [taskRows] =
      await pool.execute(
        `
          ${taskSelect}

          WHERE ${conditions.join(
            ' AND '
          )}

          LIMIT 1
        `,
        values
      );

    if (
      taskRows.length === 0
    ) {
      return res.status(404).json({
        success: false,

        message:
          'Marketing task not found or not assigned to you.',
      });
    }

    const task = formatTask(
      taskRows[0]
    );

    const [submissionRows] =
      await pool.execute(
        `
          SELECT
            mts.id,
            mts.submission_number,
            mts.output_link,
            mts.submission_notes,
            mts.review_status,
            mts.review_notes,
            mts.submitted_at,
            mts.reviewed_at,

            submitter.id
              AS submitted_by,

            submitter.full_name
              AS submitted_by_name,

            reviewer.id
              AS reviewed_by,

            reviewer.full_name
              AS reviewed_by_name

          FROM marketing_task_submissions
            mts

          LEFT JOIN users submitter
            ON submitter.id =
               mts.submitted_by

          LEFT JOIN users reviewer
            ON reviewer.id =
               mts.reviewed_by

          WHERE mts.marketing_task_id = ?

          ORDER BY
            mts.submission_number DESC
        `,
        [taskId]
      );

    const [historyRows] =
      await pool.execute(
        `
          SELECT
            history.id,
            history.previous_status,
            history.new_status,
            history.notes,
            history.created_at,

            user.id
              AS changed_by,

            user.full_name
              AS changed_by_name

          FROM marketing_task_status_history
            history

          LEFT JOIN users user
            ON user.id =
               history.changed_by

          WHERE history.marketing_task_id = ?

          ORDER BY
            history.created_at DESC,
            history.id DESC
        `,
        [taskId]
      );

    task.submissions =
      submissionRows.map(
        (submission) => ({
          id: submission.id,

          submissionNumber: Number(
            submission.submission_number
          ),

          outputLink:
            submission.output_link,

          submissionNotes:
            submission.submission_notes,

          reviewStatus:
            submission.review_status,

          reviewNotes:
            submission.review_notes,

          submittedBy:
            submission.submitted_by
              ? {
                  id:
                    submission.submitted_by,

                  fullName:
                    submission
                      .submitted_by_name ||
                    'Former user',
                }
              : null,

          reviewedBy:
            submission.reviewed_by
              ? {
                  id:
                    submission.reviewed_by,

                  fullName:
                    submission
                      .reviewed_by_name ||
                    'Former user',
                }
              : null,

          submittedAt:
            submission.submitted_at,

          reviewedAt:
            submission.reviewed_at,
        })
      );

    task.statusHistory =
      historyRows.map(
        (history) => ({
          id: history.id,

          previousStatus:
            history.previous_status,

          newStatus:
            history.new_status,

          notes:
            history.notes,

          changedBy:
            history.changed_by
              ? {
                  id:
                    history.changed_by,

                  fullName:
                    history
                      .changed_by_name ||
                    'Former user',
                }
              : null,

          createdAt:
            history.created_at,
        })
      );

    return res.json({
      success: true,
      task,
    });
  } catch (error) {
    console.error(
      'Get Marketing task details error:',
      error
    );

    return res.status(500).json({
      success: false,

      message:
        'Unable to retrieve the Marketing task details.',
    });
  }
};

// PATCH /api/marketing/tasks/:id/start
exports.startTask = async (
  req,
  res
) => {
  let connection;

  try {
    const taskId =
      parsePositiveInteger(
        req.params.id
      );

    if (!taskId) {
      return res.status(400).json({
        success: false,

        message:
          'Invalid Marketing task.',
      });
    }

    connection =
      await pool.getConnection();

    await connection.beginTransaction();

    const task =
      await getLockedTask(
        connection,
        taskId
      );

    if (!task) {
      await connection.rollback();

      return res.status(404).json({
        success: false,

        message:
          'Marketing task not found.',
      });
    }

    if (
      Number(task.assigned_to) !==
      Number(req.user.id)
    ) {
      await connection.rollback();

      return res.status(403).json({
        success: false,

        message:
          'Only the assigned Marketing Specialist can start this task.',
      });
    }

    if (
      ![
        'assigned',
        'for_revision',
      ].includes(
        task.task_status
      )
    ) {
      await connection.rollback();

      return res.status(400).json({
        success: false,

        message:
          'Only assigned or revision tasks can be started.',
      });
    }

    const previousStatus =
      task.task_status;

    await connection.execute(
      `
        UPDATE marketing_tasks
        SET task_status =
          'in_progress'
        WHERE id = ?
      `,
      [taskId]
    );

    await addStatusHistory(
      connection,
      taskId,
      req.user.id,
      previousStatus,
      'in_progress',
      previousStatus ===
        'for_revision'
        ? 'Revision work started.'
        : 'Task work started.'
    );

    await connection.commit();

    return res.json({
      success: true,

      message:
        'Marketing task started successfully.',

      taskStatus:
        'in_progress',
    });
  } catch (error) {
    if (connection) {
      try {
        await connection.rollback();
      } catch (rollbackError) {
        console.error(
          'Start Marketing task rollback error:',
          rollbackError
        );
      }
    }

    console.error(
      'Start Marketing task error:',
      error
    );

    return res.status(500).json({
      success: false,

      message:
        'Unable to start the Marketing task.',
    });
  } finally {
    if (connection) {
      connection.release();
    }
  }
};

// POST /api/marketing/tasks/:id/submissions
exports.submitTask = async (
  req,
  res
) => {
  let connection;

  try {
    const taskId =
      parsePositiveInteger(
        req.params.id
      );

    const outputLink =
      cleanText(
        req.body.outputLink
      );

    const submissionNotes =
      cleanText(
        req.body.submissionNotes
      );

    if (!taskId) {
      return res.status(400).json({
        success: false,

        message:
          'Invalid Marketing task.',
      });
    }

    if (
      !outputLink ||
      !isValidOutputLink(
        outputLink
      )
    ) {
      return res.status(400).json({
        success: false,

        message:
          'Enter a valid HTTP or HTTPS output link.',
      });
    }

    connection =
      await pool.getConnection();

    await connection.beginTransaction();

    const task =
      await getLockedTask(
        connection,
        taskId
      );

    if (!task) {
      await connection.rollback();

      return res.status(404).json({
        success: false,

        message:
          'Marketing task not found.',
      });
    }

    if (
      Number(task.assigned_to) !==
      Number(req.user.id)
    ) {
      await connection.rollback();

      return res.status(403).json({
        success: false,

        message:
          'Only the assigned Marketing Specialist can submit this task.',
      });
    }

    if (
      ![
        'in_progress',
        'for_revision',
      ].includes(
        task.task_status
      )
    ) {
      await connection.rollback();

      return res.status(400).json({
        success: false,

        message:
          'Start the task before submitting an output.',
      });
    }

    const [numberRows] =
      await connection.execute(
        `
          SELECT
            COALESCE(
              MAX(submission_number),
              0
            ) AS latest_number

          FROM marketing_task_submissions

          WHERE marketing_task_id = ?

          FOR UPDATE
        `,
        [taskId]
      );

    const submissionNumber =
      Number(
        numberRows[0].latest_number ||
        0
      ) + 1;

    const [result] =
      await connection.execute(
        `
          INSERT INTO marketing_task_submissions (
            marketing_task_id,
            submitted_by,
            submission_number,
            output_link,
            submission_notes,
            review_status,
            submitted_at
          )
          VALUES (
            ?,
            ?,
            ?,
            ?,
            ?,
            'pending_review',
            NOW()
          )
        `,
        [
          taskId,
          req.user.id,
          submissionNumber,
          outputLink,
          submissionNotes || null,
        ]
      );

    const previousStatus =
      task.task_status;

    await connection.execute(
      `
        UPDATE marketing_tasks
        SET
          task_status =
            'submitted',
          revision_notes = NULL
        WHERE id = ?
      `,
      [taskId]
    );

    await addStatusHistory(
      connection,
      taskId,
      req.user.id,
      previousStatus,
      'submitted',
      `Submission #${submissionNumber} sent for review.`
    );

    await connection.commit();

    return res.status(201).json({
      success: true,

      message:
        'Marketing output submitted successfully.',

      submission: {
        id: result.insertId,
        taskId,
        submissionNumber,
        outputLink,
        submissionNotes:
          submissionNotes || null,
        reviewStatus:
          'pending_review',
      },
    });
  } catch (error) {
    if (connection) {
      try {
        await connection.rollback();
      } catch (rollbackError) {
        console.error(
          'Submit Marketing task rollback error:',
          rollbackError
        );
      }
    }

    console.error(
      'Submit Marketing task error:',
      error
    );

    return res.status(500).json({
      success: false,

      message:
        'Unable to submit the Marketing output.',
    });
  } finally {
    if (connection) {
      connection.release();
    }
  }
};

// PATCH /api/marketing/submissions/:id/review
exports.reviewSubmission = async (
  req,
  res
) => {
  let connection;

  try {
    const submissionId =
      parsePositiveInteger(
        req.params.id
      );

    const decision =
      cleanText(
        req.body.decision
      );

    const reviewNotes =
      cleanText(
        req.body.reviewNotes
      );

    if (!submissionId) {
      return res.status(400).json({
        success: false,

        message:
          'Invalid Marketing submission.',
      });
    }

    if (
      ![
        'approved',
        'for_revision',
      ].includes(decision)
    ) {
      return res.status(400).json({
        success: false,

        message:
          'Review decision must be Approved or For Revision.',
      });
    }

    if (
      decision ===
        'for_revision' &&
      !reviewNotes
    ) {
      return res.status(400).json({
        success: false,

        message:
          'Revision notes are required.',
      });
    }

    connection =
      await pool.getConnection();

    await connection.beginTransaction();

    const [submissionRows] =
      await connection.execute(
        `
          SELECT
            mts.id,
            mts.marketing_task_id,
            mts.submission_number,
            mts.review_status,

            mt.task_status

          FROM marketing_task_submissions
            mts

          INNER JOIN marketing_tasks mt
            ON mt.id =
               mts.marketing_task_id

          WHERE mts.id = ?

          FOR UPDATE
        `,
        [submissionId]
      );

    if (
      submissionRows.length === 0
    ) {
      await connection.rollback();

      return res.status(404).json({
        success: false,

        message:
          'Marketing submission not found.',
      });
    }

    const submission =
      submissionRows[0];

    if (
      submission.review_status !==
      'pending_review'
    ) {
      await connection.rollback();

      return res.status(400).json({
        success: false,

        message:
          'This submission has already been reviewed.',
      });
    }

    await connection.execute(
      `
        UPDATE marketing_task_submissions
        SET
          review_status = ?,
          reviewed_by = ?,
          review_notes = ?,
          reviewed_at = NOW()
        WHERE id = ?
      `,
      [
        decision,
        req.user.id,
        reviewNotes || null,
        submissionId,
      ]
    );

    await connection.execute(
      `
        UPDATE marketing_tasks
        SET
          task_status = ?,

          revision_notes =
            CASE
              WHEN ? =
                'for_revision'
              THEN ?

              ELSE NULL
            END,

          approved_by =
            CASE
              WHEN ? = 'approved'
              THEN ?

              ELSE NULL
            END,

          approved_at =
            CASE
              WHEN ? = 'approved'
              THEN NOW()

              ELSE NULL
            END

        WHERE id = ?
      `,
      [
        decision,
        decision,
        reviewNotes || null,
        decision,
        req.user.id,
        decision,
        submission
          .marketing_task_id,
      ]
    );

    await addStatusHistory(
      connection,
      submission
        .marketing_task_id,
      req.user.id,
      submission.task_status,
      decision,
      decision === 'approved'
        ? `Submission #${submission.submission_number} approved.`
        : reviewNotes
    );

    await connection.commit();

    return res.json({
      success: true,

      message:
        decision === 'approved'
          ? 'Marketing submission approved successfully.'
          : 'Revision requested successfully.',

      review: {
        submissionId,
        decision,
        reviewNotes:
          reviewNotes || null,
      },
    });
  } catch (error) {
    if (connection) {
      try {
        await connection.rollback();
      } catch (rollbackError) {
        console.error(
          'Review Marketing submission rollback error:',
          rollbackError
        );
      }
    }

    console.error(
      'Review Marketing submission error:',
      error
    );

    return res.status(500).json({
      success: false,

      message:
        'Unable to review the Marketing submission.',
    });
  } finally {
    if (connection) {
      connection.release();
    }
  }
};

// PATCH /api/marketing/tasks/:id/complete
exports.completeTask = async (
  req,
  res
) => {
  let connection;

  try {
    const taskId =
      parsePositiveInteger(
        req.params.id
      );

    if (!taskId) {
      return res.status(400).json({
        success: false,

        message:
          'Invalid Marketing task.',
      });
    }

    connection =
      await pool.getConnection();

    await connection.beginTransaction();

    const task =
      await getLockedTask(
        connection,
        taskId
      );

    if (!task) {
      await connection.rollback();

      return res.status(404).json({
        success: false,

        message:
          'Marketing task not found.',
      });
    }

    if (
      Number(task.assigned_to) !==
      Number(req.user.id)
    ) {
      await connection.rollback();

      return res.status(403).json({
        success: false,

        message:
          'Only the assigned Marketing Specialist can complete this task.',
      });
    }

    if (
      task.task_status !==
      'approved'
    ) {
      await connection.rollback();

      return res.status(400).json({
        success: false,

        message:
          'Only approved tasks can be completed.',
      });
    }

    await connection.execute(
      `
        UPDATE marketing_tasks
        SET
          task_status =
            'completed',
          completed_at = NOW()
        WHERE id = ?
      `,
      [taskId]
    );

    await addStatusHistory(
      connection,
      taskId,
      req.user.id,
      'approved',
      'completed',
      'Approved task marked as completed.'
    );

    await connection.commit();

    return res.json({
      success: true,

      message:
        'Marketing task completed successfully.',

      taskStatus:
        'completed',
    });
  } catch (error) {
    if (connection) {
      try {
        await connection.rollback();
      } catch (rollbackError) {
        console.error(
          'Complete Marketing task rollback error:',
          rollbackError
        );
      }
    }

    console.error(
      'Complete Marketing task error:',
      error
    );

    return res.status(500).json({
      success: false,

      message:
        'Unable to complete the Marketing task.',
    });
  } finally {
    if (connection) {
      connection.release();
    }
  }
};

// PATCH /api/marketing/tasks/:id/cancel
exports.cancelTask = async (
  req,
  res
) => {
  let connection;

  try {
    const taskId =
      parsePositiveInteger(
        req.params.id
      );

    const notes = cleanText(
      req.body.notes
    );

    if (!taskId) {
      return res.status(400).json({
        success: false,

        message:
          'Invalid Marketing task.',
      });
    }

    if (!notes) {
      return res.status(400).json({
        success: false,

        message:
          'Cancellation reason is required.',
      });
    }

    connection =
      await pool.getConnection();

    await connection.beginTransaction();

    const task =
      await getLockedTask(
        connection,
        taskId
      );

    if (!task) {
      await connection.rollback();

      return res.status(404).json({
        success: false,

        message:
          'Marketing task not found.',
      });
    }

    if (
      [
        'completed',
        'cancelled',
      ].includes(
        task.task_status
      )
    ) {
      await connection.rollback();

      return res.status(400).json({
        success: false,

        message:
          'Completed or cancelled tasks cannot be cancelled again.',
      });
    }

    const previousStatus =
      task.task_status;

    await connection.execute(
      `
        UPDATE marketing_tasks
        SET task_status =
          'cancelled'
        WHERE id = ?
      `,
      [taskId]
    );

    await addStatusHistory(
      connection,
      taskId,
      req.user.id,
      previousStatus,
      'cancelled',
      notes
    );

    await connection.commit();

    return res.json({
      success: true,

      message:
        'Marketing task cancelled successfully.',
    });
  } catch (error) {
    if (connection) {
      try {
        await connection.rollback();
      } catch (rollbackError) {
        console.error(
          'Cancel Marketing task rollback error:',
          rollbackError
        );
      }
    }

    console.error(
      'Cancel Marketing task error:',
      error
    );

    return res.status(500).json({
      success: false,

      message:
        'Unable to cancel the Marketing task.',
    });
  } finally {
    if (connection) {
      connection.release();
    }
  }
};