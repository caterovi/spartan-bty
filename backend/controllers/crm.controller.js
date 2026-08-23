const pool = require('../config/db');
const {
  deriveOrderWorkflow,
} = require('../utils/orderWorkflow');

const CASE_STATUSES = [
  'pending_follow_up',
  'assigned',
  'in_progress',
  'awaiting_customer',
  'resolved',
  'closed',
];

const DELIVERY_CONFIRMATIONS = [
  'pending',
  'received',
  'not_received',
  'returned',
];

const CONCERN_CATEGORIES = [
  'none',
  'product_issue',
  'delivery_issue',
  'wrong_item',
  'damaged_item',
  'missing_item',
  'payment_issue',
  'other',
];

const STEP_STATUSES = [
  'not_started',
  'in_progress',
  'completed',
  'skipped',
];

const REPURCHASE_OPTIONS = [
  'yes',
  'no',
  'undecided',
];

function cleanText(value) {
  return String(value || '').trim();
}

function parsePositiveInteger(value) {
  const parsedValue = Number(value);

  if (
    !Number.isInteger(parsedValue) ||
    parsedValue <= 0
  ) {
    return null;
  }

  return parsedValue;
}

function parseStepNumber(value) {
  const stepNumber = Number(value);

  if (
    !Number.isInteger(stepNumber) ||
    stepNumber < 1 ||
    stepNumber > 4
  ) {
    return null;
  }

  return stepNumber;
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

  const isValid =
    date.getFullYear() === Number(year) &&
    date.getMonth() === Number(month) - 1 &&
    date.getDate() === Number(day) &&
    date.getHours() === Number(hour) &&
    date.getMinutes() === Number(minute) &&
    date.getSeconds() === Number(second);

  if (!isValid) {
    return {
      valid: false,
      value: null,
    };
  }

  return {
    valid: true,
    value:
      `${year}-${month}-${day} ` +
      `${hour}:${minute}:${second}`,
  };
}

function getSatisfactionResult(rating) {
  const numericRating = Number(rating);

  const labels = {
    1: 'very_dissatisfied',
    2: 'dissatisfied',
    3: 'neutral',
    4: 'satisfied',
    5: 'very_satisfied',
  };

  return labels[numericRating] || null;
}

function formatCase(row) {
  return {
    id: row.id,
    orderId: row.order_id,
    orderNumber: row.order_number,

    customer: {
      id: row.customer_id,
      fullName: row.customer_name,
      contactNumber: row.contact_number,
      address: row.address,
    },

    assignedUser: row.handled_by
      ? {
          id: row.handled_by,
          fullName:
            row.handled_by_name ||
            'Former CRM user',
          email:
            row.handled_by_email ||
            null,
        }
      : null,

    assignedAt: row.assigned_at,

    caseStatus: row.case_status,

    currentStep: Number(
      row.current_step || 1
    ),

    deliveryConfirmation:
      row.delivery_confirmation,

    concernCategory:
      row.concern_category,

    concernDetails:
      row.concern_details,

    resolutionNotes:
      row.resolution_notes,

    nextFollowUpAt:
      row.next_follow_up_at,

    followUpStatus:
      row.follow_up_status ||
      'unscheduled',

    overdueDays: Number(
      row.overdue_days || 0
    ),

    firstContactedAt:
      row.first_contacted_at,

    resolvedAt:
      row.resolved_at,

    closedAt:
      row.closed_at,

    fulfillmentStatus:
      row.fulfillment_status,

    thirdPartyLogistics:
      row.third_party_logistics,

    trackingNumber:
      row.tracking_number,

    deliveredAt:
      row.delivered_at,

    returnedAt:
      row.returned_at,

    returnReason:
      row.return_reason,

    waybillNumber:
      row.waybill_number,

    totalAmount: Number(
      row.total_amount || 0
    ),

    itemCount: Number(
      row.item_count || 0
    ),

    totalUnits: Number(
      row.total_units || 0
    ),

    totalSteps: Number(
      row.total_steps || 4
    ),

    completedSteps: Number(
      row.completed_steps || 0
    ),

    activeSteps: Number(
      row.active_steps || 0
    ),

    satisfactionRating:
      row.satisfaction_rating === null ||
      row.satisfaction_rating === undefined
        ? null
        : Number(
            row.satisfaction_rating
          ),

    satisfactionResult:
      row.satisfaction_rating
        ? getSatisfactionResult(
            row.satisfaction_rating
          )
        : null,

    finalFeedback:
      row.feedback || null,

    wouldRepurchase:
      row.would_repurchase || null,

    feedbackSubmittedAt:
      row.feedback_submitted_at || null,

    createdAt:
      row.created_at,

    updatedAt:
      row.updated_at,

    workflow: deriveOrderWorkflow({
      fulfillmentStatus:
        row.fulfillment_status,
      deliveredAt: row.delivered_at,
      returnedAt: row.returned_at,
      crmCaseId: row.id,
      crmCaseStatus: row.case_status,
      crmCurrentStep: row.current_step,
      crmHandledBy: row.handled_by,
      crmCreatedAt: row.created_at,
    }),
  };
}

async function getLockedCase(
  connection,
  caseId
) {
  const [rows] =
    await connection.execute(
      `
        SELECT
          cc.id,
          cc.order_id,
          cc.handled_by,
          cc.assigned_at,
          cc.case_status,
          cc.current_step,
          cc.delivery_confirmation,
          cc.concern_category,
          cc.concern_details,
          cc.resolution_notes,
          cc.resolved_at,
          cc.closed_at,

          o.order_number,

          fo.fulfillment_status

        FROM crm_cases cc

        INNER JOIN orders o
          ON o.id = cc.order_id

        INNER JOIN fulfillment_orders fo
          ON fo.order_id =
             cc.order_id

        WHERE cc.id = ?

        FOR UPDATE
      `,
      [caseId]
    );

  return rows[0] || null;
}

function requireAssignedUser(
  crmCase,
  currentUserId
) {
  if (!crmCase.handled_by) {
    return {
      allowed: false,
      message:
        'Assign the CRM case before processing it.',
    };
  }

  if (
    Number(crmCase.handled_by) !==
    Number(currentUserId)
  ) {
    return {
      allowed: false,
      message:
        'Only the assigned CRM user can process this case.',
    };
  }

  return {
    allowed: true,
    message: null,
  };
}

const crmCaseSelect = `
  SELECT
    cc.id,
    cc.order_id,
    cc.handled_by,
    cc.assigned_at,
    cc.case_status,
    cc.current_step,
    cc.delivery_confirmation,
    cc.concern_category,
    cc.concern_details,
    cc.resolution_notes,
    cc.next_follow_up_at,
    cc.first_contacted_at,
    cc.resolved_at,
    cc.closed_at,
    cc.created_at,
    cc.updated_at,

    o.order_number,
    o.customer_id,
    o.total_amount,

    c.full_name
      AS customer_name,

    c.contact_number,
    c.address,

    handler.full_name
      AS handled_by_name,

    handler.email
      AS handled_by_email,

    fo.fulfillment_status,
    fo.third_party_logistics,
    fo.tracking_number,
    fo.delivered_at,
    fo.returned_at,
    fo.return_reason,

    cp.waybill_number,

    COALESCE(
      order_summary.item_count,
      0
    ) AS item_count,

    COALESCE(
      order_summary.total_units,
      0
    ) AS total_units,

    COALESCE(
      step_summary.total_steps,
      0
    ) AS total_steps,

    COALESCE(
      step_summary.completed_steps,
      0
    ) AS completed_steps,

    COALESCE(
      step_summary.active_steps,
      0
    ) AS active_steps,

    CASE
      WHEN cc.case_status IN (
        'resolved',
        'closed'
      )
      THEN 'complete'

      WHEN cc.handled_by IS NULL
      THEN 'unassigned'

      WHEN COALESCE(
        step_summary.completed_steps,
        0
      ) >= 4
      THEN 'follow_up_complete'

      WHEN cc.next_follow_up_at IS NULL
      THEN 'unscheduled'

      WHEN cc.next_follow_up_at < NOW()
      THEN 'overdue'

      WHEN DATE(
        cc.next_follow_up_at
      ) = CURRENT_DATE()
      THEN 'due_today'

      ELSE 'upcoming'
    END AS follow_up_status,

    CASE
      WHEN cc.next_follow_up_at < NOW()
      THEN GREATEST(
        DATEDIFF(
          CURRENT_DATE(),
          DATE(cc.next_follow_up_at)
        ),
        0
      )
      ELSE 0
    END AS overdue_days,

    cf.satisfaction_rating,
    cf.feedback,
    cf.would_repurchase,

    cf.submitted_at
      AS feedback_submitted_at

  FROM crm_cases cc

  INNER JOIN orders o
    ON o.id = cc.order_id

  INNER JOIN customers c
    ON c.id = o.customer_id

  INNER JOIN fulfillment_orders fo
    ON fo.order_id = cc.order_id

  LEFT JOIN cdm_order_processing cp
    ON cp.order_id = cc.order_id

  LEFT JOIN users handler
    ON handler.id = cc.handled_by

  LEFT JOIN crm_feedback cf
    ON cf.crm_case_id = cc.id

  LEFT JOIN (
    SELECT
      order_id,
      COUNT(*) AS item_count,
      SUM(quantity) AS total_units

    FROM order_items

    GROUP BY order_id
  ) order_summary
    ON order_summary.order_id =
       cc.order_id

  LEFT JOIN (
    SELECT
      crm_case_id,

      COUNT(*) AS total_steps,

      SUM(
        CASE
          WHEN step_status IN (
            'completed',
            'skipped'
          )
          THEN 1
          ELSE 0
        END
      ) AS completed_steps,

      SUM(
        CASE
          WHEN step_status =
            'in_progress'
          THEN 1
          ELSE 0
        END
      ) AS active_steps

    FROM crm_after_sales_steps

    GROUP BY crm_case_id
  ) step_summary
    ON step_summary.crm_case_id =
       cc.id
`;

// GET /api/crm/users
exports.getCrmUsers = async (
  req,
  res
) => {
  try {
    const [rows] = await pool.execute(`
      SELECT
        u.id,
        u.full_name,
        u.email,
        u.status,

        d.id AS department_id,
        d.code AS department_code,
        d.name AS department_name

      FROM users u

      INNER JOIN departments d
        ON d.id = u.department_id

      WHERE u.role = 'specialist'
        AND d.code = 'crm'
        AND u.status = 'active'

      ORDER BY
        u.full_name ASC
    `);

    return res.json({
      success: true,

      users: rows.map((user) => ({
        id: user.id,
        fullName: user.full_name,
        email: user.email,
        role: 'specialist',

        department: {
          id: user.department_id,
          code: user.department_code,
          name: user.department_name,
        },

        status: user.status,
      })),

      expectedUserCount: 4,
      currentUserCount: rows.length,
    });
  } catch (error) {
    console.error(
      'Get CRM users error:',
      error
    );

    return res.status(500).json({
      success: false,
      message:
        'Unable to retrieve CRM users.',
    });
  }
};

// GET /api/crm/summary
exports.getSummary = async (
  req,
  res
) => {
  try {
    const [rows] = await pool.execute(`
      SELECT
        COUNT(*) AS total_cases,

        SUM(
          CASE
            WHEN handled_by IS NULL
            THEN 1
            ELSE 0
          END
        ) AS unassigned,

        SUM(
          CASE
            WHEN case_status =
              'assigned'
            THEN 1
            ELSE 0
          END
        ) AS assigned,

        SUM(
          CASE
            WHEN case_status =
              'in_progress'
            THEN 1
            ELSE 0
          END
        ) AS in_progress,

        SUM(
          CASE
            WHEN case_status =
              'resolved'
            THEN 1
            ELSE 0
          END
        ) AS resolved,

        SUM(
          CASE
            WHEN case_status =
              'closed'
            THEN 1
            ELSE 0
          END
        ) AS closed,

        SUM(
          CASE
            WHEN delivery_confirmation =
              'received'
            THEN 1
            ELSE 0
          END
        ) AS received,

        SUM(
          CASE
            WHEN delivery_confirmation =
              'returned'
            THEN 1
            ELSE 0
          END
        ) AS returned

      FROM crm_cases
    `);

    const [stepRows] =
      await pool.execute(`
        SELECT
          SUM(
            CASE
              WHEN step_status =
                'in_progress'
              THEN 1
              ELSE 0
            END
          ) AS active_steps,

          SUM(
            CASE
              WHEN step_status IN (
                'completed',
                'skipped'
              )
              THEN 1
              ELSE 0
            END
          ) AS completed_steps,

          SUM(
            CASE
              WHEN follow_up_at
                IS NOT NULL

                AND follow_up_at <=
                    NOW()

                AND step_status NOT IN (
                  'completed',
                  'skipped'
                )
              THEN 1
              ELSE 0
            END
          ) AS overdue_steps

        FROM crm_after_sales_steps
      `);

    const [feedbackRows] =
      await pool.execute(`
        SELECT
          COUNT(*) AS feedback_count,

          ROUND(
            AVG(satisfaction_rating),
            2
          ) AS average_rating

        FROM crm_feedback
      `);

    const summary = rows[0];
    const steps = stepRows[0];
    const feedback =
      feedbackRows[0];

    return res.json({
      success: true,

      summary: {
        totalCases: Number(
          summary.total_cases || 0
        ),

        unassigned: Number(
          summary.unassigned || 0
        ),

        assigned: Number(
          summary.assigned || 0
        ),

        inProgress: Number(
          summary.in_progress || 0
        ),

        resolved: Number(
          summary.resolved || 0
        ),

        closed: Number(
          summary.closed || 0
        ),

        received: Number(
          summary.received || 0
        ),

        returned: Number(
          summary.returned || 0
        ),

        activeSteps: Number(
          steps.active_steps || 0
        ),

        completedSteps: Number(
          steps.completed_steps || 0
        ),

        overdueSteps: Number(
          steps.overdue_steps || 0
        ),

        feedbackCount: Number(
          feedback.feedback_count || 0
        ),

        averageRating:
          feedback.average_rating ===
            null
            ? null
            : Number(
                feedback.average_rating
              ),
      },
    });
  } catch (error) {
    console.error(
      'Get revised CRM summary error:',
      error
    );

    return res.status(500).json({
      success: false,
      message:
        'Unable to retrieve the CRM summary.',
    });
  }
};

// GET /api/crm/cases
exports.getCases = async (
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

    const assignment = cleanText(
      req.query.assignment
    );

    const currentStep =
      req.query.currentStep
        ? parseStepNumber(
            req.query.currentStep
          )
        : null;

    const dueOnly =
      cleanText(req.query.dueOnly) ===
      'true';

    if (
      status &&
      !CASE_STATUSES.includes(status)
    ) {
      return res.status(400).json({
        success: false,
        message:
          'Invalid CRM case status.',
      });
    }

    if (
      assignment &&
      ![
        'assigned',
        'unassigned',
        'mine',
      ].includes(assignment)
    ) {
      return res.status(400).json({
        success: false,
        message:
          'Invalid CRM assignment filter.',
      });
    }

    if (
      req.query.currentStep &&
      !currentStep
    ) {
      return res.status(400).json({
        success: false,
        message:
          'Current step must be from 1 to 4.',
      });
    }

    const conditions = [];
    const values = [];

    if (search) {
      const keyword = `%${search}%`;

      conditions.push(`
        (
          o.order_number LIKE ?
          OR c.full_name LIKE ?
          OR c.contact_number LIKE ?
          OR handler.full_name LIKE ?
          OR cc.concern_details LIKE ?
          OR fo.tracking_number LIKE ?
        )
      `);

      values.push(
        keyword,
        keyword,
        keyword,
        keyword,
        keyword,
        keyword
      );
    }

    if (status) {
      conditions.push(`
        cc.case_status = ?
      `);

      values.push(status);
    }

    if (assignment === 'assigned') {
      conditions.push(`
        cc.handled_by IS NOT NULL
      `);
    }

    if (assignment === 'unassigned') {
      conditions.push(`
        cc.handled_by IS NULL
      `);
    }

    if (assignment === 'mine') {
      conditions.push(`
        cc.handled_by = ?
      `);

      values.push(req.user.id);
    }

    if (currentStep) {
      conditions.push(`
        cc.current_step = ?
      `);

      values.push(currentStep);
    }

    if (dueOnly) {
      conditions.push(`
        EXISTS (
          SELECT 1

          FROM crm_after_sales_steps due_step

          WHERE due_step.crm_case_id =
                cc.id

            AND due_step.follow_up_at
                IS NOT NULL

            AND due_step.follow_up_at <=
                NOW()

            AND due_step.step_status
                NOT IN (
                  'completed',
                  'skipped'
                )
        )
      `);
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
          ${crmCaseSelect}

          ${whereClause}

          ORDER BY
            CASE
              WHEN cc.handled_by IS NULL
              THEN 1

              WHEN EXISTS (
                SELECT 1

                FROM crm_after_sales_steps due_step

                WHERE
                  due_step.crm_case_id =
                    cc.id

                  AND due_step.follow_up_at
                      IS NOT NULL

                  AND due_step.follow_up_at <=
                      NOW()

                  AND due_step.step_status
                      NOT IN (
                        'completed',
                        'skipped'
                      )
              )
              THEN 2

              WHEN cc.case_status =
                'assigned'
              THEN 3

              WHEN cc.case_status =
                'in_progress'
              THEN 4

              WHEN cc.case_status =
                'resolved'
              THEN 5

              ELSE 6
            END,

            cc.updated_at DESC
        `,
        values
      );

    return res.json({
      success: true,
      cases: rows.map(formatCase),
    });
  } catch (error) {
    console.error(
      'Get revised CRM cases error:',
      error
    );

    return res.status(500).json({
      success: false,
      message:
        'Unable to retrieve CRM cases.',
    });
  }
};

// GET /api/crm/cases/:id
exports.getCaseById = async (
  req,
  res
) => {
  try {
    const caseId =
      parsePositiveInteger(
        req.params.id
      );

    if (!caseId) {
      return res.status(400).json({
        success: false,
        message:
          'Invalid CRM case.',
      });
    }

    const [caseRows] =
      await pool.execute(
        `
          ${crmCaseSelect}

          WHERE cc.id = ?

          LIMIT 1
        `,
        [caseId]
      );

    if (caseRows.length === 0) {
      return res.status(404).json({
        success: false,
        message:
          'CRM case not found.',
      });
    }

    const crmCase = formatCase(
      caseRows[0]
    );

    const [itemRows] =
      await pool.execute(
        `
          SELECT
            oi.id,
            oi.product_id,
            oi.quantity,
            oi.unit_price,
            oi.line_total,

            p.sku,
            p.product_name

          FROM order_items oi

          INNER JOIN products p
            ON p.id = oi.product_id

          WHERE oi.order_id = ?

          ORDER BY
            p.product_name ASC
        `,
        [crmCase.orderId]
      );

    const [stepRows] =
      await pool.execute(
        `
          SELECT
            step_record.id,
            step_record.crm_case_id,
            step_record.step_number,
            step_record.step_status,
            step_record.customer_feedback,
            step_record.crm_response,
            step_record.follow_up_at,
            step_record.handled_by,
            step_record.started_at,
            step_record.completed_at,
            step_record.created_at,
            step_record.updated_at,

            handler.full_name
              AS handled_by_name,

            handler.email
              AS handled_by_email

          FROM crm_after_sales_steps
            step_record

          LEFT JOIN users handler
            ON handler.id =
               step_record.handled_by

          WHERE step_record.crm_case_id = ?

          ORDER BY
            step_record.step_number ASC
        `,
        [caseId]
      );

    crmCase.items = itemRows.map(
      (item) => ({
        id: item.id,
        productId:
          item.product_id,
        sku: item.sku,

        productName:
          item.product_name,

        quantity: Number(
          item.quantity
        ),

        unitPrice: Number(
          item.unit_price
        ),

        lineTotal: Number(
          item.line_total
        ),
      })
    );

    crmCase.steps = stepRows.map(
      (step) => ({
        id: step.id,
        stepNumber: Number(
          step.step_number
        ),

        stepStatus:
          step.step_status,

        customerFeedback:
          step.customer_feedback,

        crmResponse:
          step.crm_response,

        followUpAt:
          step.follow_up_at,

        handledBy:
          step.handled_by
            ? {
                id:
                  step.handled_by,

                fullName:
                  step.handled_by_name ||
                  'Former CRM user',

                email:
                  step.handled_by_email ||
                  null,
              }
            : null,

        startedAt:
          step.started_at,

        completedAt:
          step.completed_at,

        createdAt:
          step.created_at,

        updatedAt:
          step.updated_at,
      })
    );

    crmCase.feedbackRecord =
      crmCase.satisfactionRating
        ? {
            satisfactionRating:
              crmCase.satisfactionRating,

            satisfactionResult:
              crmCase.satisfactionResult,

            finalFeedback:
              crmCase.finalFeedback,

            wouldRepurchase:
              crmCase.wouldRepurchase,

            submittedAt:
              crmCase.feedbackSubmittedAt,
          }
        : null;

    return res.json({
      success: true,
      case: crmCase,
    });
  } catch (error) {
    console.error(
      'Get revised CRM case error:',
      error
    );

    return res.status(500).json({
      success: false,
      message:
        'Unable to retrieve CRM case details.',
    });
  }
};

// PATCH /api/crm/cases/:id/assign
exports.assignCase = async (
  req,
  res
) => {
  let connection;

  try {
    const caseId =
      parsePositiveInteger(
        req.params.id
      );

    const assignedUserId =
      parsePositiveInteger(
        req.body.assignedUserId
      );

    if (!caseId) {
      return res.status(400).json({
        success: false,
        message:
          'Invalid CRM case.',
      });
    }

    if (!assignedUserId) {
      return res.status(400).json({
        success: false,
        message:
          'Select a valid CRM user.',
      });
    }

    connection =
      await pool.getConnection();

    await connection.beginTransaction();

    const [userRows] =
      await connection.execute(
        `
          SELECT
            u.id,
            u.full_name,
            u.email,
            u.status,

            d.code
              AS department_code

          FROM users u

          INNER JOIN departments d
            ON d.id =
               u.department_id

          WHERE u.id = ?
            AND u.role =
                'specialist'
            AND d.code = 'crm'
            AND u.status = 'active'

          LIMIT 1
        `,
        [assignedUserId]
      );

    if (userRows.length === 0) {
      await connection.rollback();

      return res.status(400).json({
        success: false,
        message:
          'The selected user is not an active CRM Specialist.',
      });
    }

    const crmCase =
      await getLockedCase(
        connection,
        caseId
      );

    if (!crmCase) {
      await connection.rollback();

      return res.status(404).json({
        success: false,
        message:
          'CRM case not found.',
      });
    }

    if (
      crmCase.case_status ===
      'closed'
    ) {
      await connection.rollback();

      return res.status(400).json({
        success: false,
        message:
          'A closed CRM case cannot be reassigned.',
      });
    }

    const nextStatus =
      crmCase.case_status ===
        'pending_follow_up'
        ? 'assigned'
        : crmCase.case_status;

    await connection.execute(
      `
        UPDATE crm_cases
        SET
          handled_by = ?,
          assigned_at = NOW(),
          case_status = ?
        WHERE id = ?
      `,
      [
        assignedUserId,
        nextStatus,
        caseId,
      ]
    );

    /*
     * Preserve the handler of completed steps.
     * Assign only unfinished steps.
     */
    await connection.execute(
      `
        UPDATE crm_after_sales_steps
        SET handled_by = ?
        WHERE crm_case_id = ?
          AND step_status NOT IN (
            'completed',
            'skipped'
          )
      `,
      [
        assignedUserId,
        caseId,
      ]
    );

    await connection.commit();

    return res.json({
      success: true,

      message:
        'CRM case assigned successfully.',

      assignment: {
        assignedUserId,

        assignedUserName:
          userRows[0].full_name,

        assignedUserEmail:
          userRows[0].email,

        assignedAt:
          new Date(),

        caseStatus:
          nextStatus,
      },
    });
  } catch (error) {
    if (connection) {
      try {
        await connection.rollback();
      } catch (rollbackError) {
        console.error(
          'CRM assignment rollback error:',
          rollbackError
        );
      }
    }

    console.error(
      'Assign CRM case error:',
      error
    );

    return res.status(500).json({
      success: false,
      message:
        'Unable to assign the CRM case.',
    });
  } finally {
    if (connection) {
      connection.release();
    }
  }
};

// PATCH /api/crm/cases/:id/concern
exports.updateConcern = async (
  req,
  res
) => {
  let connection;

  try {
    const caseId =
      parsePositiveInteger(
        req.params.id
      );

    const deliveryConfirmation =
      cleanText(
        req.body.deliveryConfirmation
      );

    const concernCategory =
      cleanText(
        req.body.concernCategory
      );

    const concernDetails =
      cleanText(
        req.body.concernDetails
      );

    if (!caseId) {
      return res.status(400).json({
        success: false,
        message:
          'Invalid CRM case.',
      });
    }

    if (
      !DELIVERY_CONFIRMATIONS.includes(
        deliveryConfirmation
      )
    ) {
      return res.status(400).json({
        success: false,
        message:
          'Select a valid delivery confirmation.',
      });
    }

    if (
      !CONCERN_CATEGORIES.includes(
        concernCategory
      )
    ) {
      return res.status(400).json({
        success: false,
        message:
          'Select a valid concern category.',
      });
    }

    if (
      concernCategory !== 'none' &&
      !concernDetails
    ) {
      return res.status(400).json({
        success: false,
        message:
          'Concern details are required.',
      });
    }

    connection =
      await pool.getConnection();

    await connection.beginTransaction();

    const crmCase =
      await getLockedCase(
        connection,
        caseId
      );

    if (!crmCase) {
      await connection.rollback();

      return res.status(404).json({
        success: false,
        message:
          'CRM case not found.',
      });
    }

    const assignmentCheck =
      requireAssignedUser(
        crmCase,
        req.user.id
      );

    if (!assignmentCheck.allowed) {
      await connection.rollback();

      return res.status(403).json({
        success: false,
        message:
          assignmentCheck.message,
      });
    }

    if (
      [
        'resolved',
        'closed',
      ].includes(
        crmCase.case_status
      )
    ) {
      await connection.rollback();

      return res.status(400).json({
        success: false,
        message:
          'A resolved or closed CRM case cannot be edited.',
      });
    }

    await connection.execute(
      `
        UPDATE crm_cases
        SET
          delivery_confirmation = ?,
          concern_category = ?,
          concern_details = ?,

          case_status =
            CASE
              WHEN case_status IN (
                'pending_follow_up',
                'assigned'
              )
              THEN 'in_progress'

              ELSE case_status
            END

        WHERE id = ?
      `,
      [
        deliveryConfirmation,
        concernCategory,
        concernDetails || null,
        caseId,
      ]
    );

    await connection.commit();

    return res.json({
      success: true,
      message:
        'Customer concern details updated successfully.',
    });
  } catch (error) {
    if (connection) {
      try {
        await connection.rollback();
      } catch (rollbackError) {
        console.error(
          'Concern rollback error:',
          rollbackError
        );
      }
    }

    console.error(
      'Update CRM concern error:',
      error
    );

    return res.status(500).json({
      success: false,
      message:
        'Unable to update the customer concern.',
    });
  } finally {
    if (connection) {
      connection.release();
    }
  }
};

// PATCH /api/crm/cases/:id/schedule
exports.scheduleFollowUp = async (
  req,
  res
) => {
  let connection;

  try {
    const caseId = parsePositiveInteger(
      req.params.id
    );
    const parsedFollowUp =
      parseOptionalDateTime(
        req.body.followUpAt
      );

    if (!caseId) {
      return res.status(400).json({
        success: false,
        message: 'Invalid CRM case.',
      });
    }

    if (
      !parsedFollowUp.valid ||
      !parsedFollowUp.value
    ) {
      return res.status(400).json({
        success: false,
        message:
          'Select a valid follow-up date and time.',
      });
    }

    connection = await pool.getConnection();
    await connection.beginTransaction();

    const crmCase = await getLockedCase(
      connection,
      caseId
    );

    if (!crmCase) {
      await connection.rollback();
      return res.status(404).json({
        success: false,
        message: 'CRM case not found.',
      });
    }

    const assignmentCheck = requireAssignedUser(
      crmCase,
      req.user.id
    );

    if (!assignmentCheck.allowed) {
      await connection.rollback();
      return res.status(403).json({
        success: false,
        message: assignmentCheck.message,
      });
    }

    if (
      ['resolved', 'closed'].includes(
        crmCase.case_status
      )
    ) {
      await connection.rollback();
      return res.status(400).json({
        success: false,
        message:
          'A resolved or closed case cannot be scheduled.',
      });
    }

    const [stepRows] =
      await connection.execute(
        `
          SELECT id, step_number
          FROM crm_after_sales_steps
          WHERE crm_case_id = ?
            AND step_status NOT IN (
              'completed',
              'skipped'
            )
          ORDER BY step_number ASC
          LIMIT 1
          FOR UPDATE
        `,
        [caseId]
      );

    if (stepRows.length === 0) {
      await connection.rollback();
      return res.status(400).json({
        success: false,
        message:
          'All four follow-up steps are complete. No additional follow-up can be scheduled.',
      });
    }

    const currentStep = Number(
      stepRows[0].step_number
    );

    await connection.execute(
      `
        UPDATE crm_after_sales_steps
        SET
          follow_up_at = ?,
          handled_by = ?
        WHERE id = ?
      `,
      [
        parsedFollowUp.value,
        req.user.id,
        stepRows[0].id,
      ]
    );

    await connection.execute(
      `
        UPDATE crm_cases
        SET
          current_step = ?,
          next_follow_up_at = ?
        WHERE id = ?
      `,
      [
        currentStep,
        parsedFollowUp.value,
        caseId,
      ]
    );

    await connection.commit();

    return res.json({
      success: true,
      message:
        `Step ${currentStep} follow-up scheduled successfully.`,
      currentStep,
      nextFollowUpAt: parsedFollowUp.value,
    });
  } catch (error) {
    if (connection) {
      try {
        await connection.rollback();
      } catch (rollbackError) {
        console.error(
          'CRM schedule rollback error:',
          rollbackError
        );
      }
    }

    console.error(
      'Schedule CRM follow-up error:',
      error
    );

    return res.status(500).json({
      success: false,
      message:
        'Unable to schedule the CRM follow-up.',
    });
  } finally {
    if (connection) {
      connection.release();
    }
  }
};

// PATCH /api/crm/cases/:id/steps/:stepNumber
exports.updateAfterSalesStep = async (
  req,
  res
) => {
  let connection;

  try {
    const caseId =
      parsePositiveInteger(
        req.params.id
      );

    const stepNumber =
      parseStepNumber(
        req.params.stepNumber
      );

    const stepStatus =
      cleanText(
        req.body.stepStatus
      );

    const customerFeedback =
      cleanText(
        req.body.customerFeedback
      );

    const crmResponse =
      cleanText(
        req.body.crmResponse
      );

    const parsedFollowUp =
      parseOptionalDateTime(
        req.body.followUpAt
      );

    const parsedNextFollowUp =
      parseOptionalDateTime(
        req.body.nextFollowUpAt
      );

    if (!caseId || !stepNumber) {
      return res.status(400).json({
        success: false,
        message:
          'Invalid CRM case or after-sales step.',
      });
    }

    if (
      !STEP_STATUSES.includes(
        stepStatus
      ) ||
      stepStatus ===
        'not_started'
    ) {
      return res.status(400).json({
        success: false,
        message:
          'Step status must be In Progress, Completed, or Skipped.',
      });
    }

    if (!parsedFollowUp.valid) {
      return res.status(400).json({
        success: false,
        message:
          'Enter a valid follow-up date and time.',
      });
    }

    if (!parsedNextFollowUp.valid) {
      return res.status(400).json({
        success: false,
        message:
          'Enter a valid next follow-up date and time.',
      });
    }

    const finishesStep = [
      'completed',
      'skipped',
    ].includes(stepStatus);

    if (
      finishesStep &&
      stepNumber < 4 &&
      !parsedNextFollowUp.value
    ) {
      return res.status(400).json({
        success: false,
        message:
          `Schedule the Step ${stepNumber + 1} follow-up before completing or skipping Step ${stepNumber}.`,
      });
    }

    if (
      stepNumber === 4 &&
      parsedNextFollowUp.value
    ) {
      return res.status(400).json({
        success: false,
        message:
          'A follow-up cannot be scheduled beyond Step 4.',
      });
    }

    if (
      stepStatus === 'completed' &&
      (!customerFeedback ||
        !crmResponse)
    ) {
      return res.status(400).json({
        success: false,
        message:
          'Customer feedback and CRM response are required before completing a step.',
      });
    }

    if (
      stepStatus === 'skipped' &&
      !crmResponse
    ) {
      return res.status(400).json({
        success: false,
        message:
          'Enter the reason for skipping this step in the CRM response.',
      });
    }

    connection =
      await pool.getConnection();

    await connection.beginTransaction();

    const crmCase =
      await getLockedCase(
        connection,
        caseId
      );

    if (!crmCase) {
      await connection.rollback();

      return res.status(404).json({
        success: false,
        message:
          'CRM case not found.',
      });
    }

    const assignmentCheck =
      requireAssignedUser(
        crmCase,
        req.user.id
      );

    if (!assignmentCheck.allowed) {
      await connection.rollback();

      return res.status(403).json({
        success: false,
        message:
          assignmentCheck.message,
      });
    }

    if (
      [
        'resolved',
        'closed',
      ].includes(
        crmCase.case_status
      )
    ) {
      await connection.rollback();

      return res.status(400).json({
        success: false,
        message:
          'After-sales steps cannot be edited after the case is resolved or closed.',
      });
    }

    const [stepRows] =
      await connection.execute(
        `
          SELECT
            id,
            step_number,
            step_status,
            customer_feedback,
            crm_response,
            follow_up_at,
            handled_by,
            started_at,
            completed_at

          FROM crm_after_sales_steps

          WHERE crm_case_id = ?
            AND step_number = ?

          FOR UPDATE
        `,
        [caseId, stepNumber]
      );

    if (stepRows.length === 0) {
      await connection.rollback();

      return res.status(404).json({
        success: false,
        message:
          'After-sales step not found.',
      });
    }

    const currentStepRecord =
      stepRows[0];

    if (
      [
        'completed',
        'skipped',
      ].includes(
        currentStepRecord.step_status
      ) &&
      ![
        'completed',
        'skipped',
      ].includes(stepStatus)
    ) {
      await connection.rollback();

      return res.status(400).json({
        success: false,
        message:
          'A completed or skipped step cannot be returned to In Progress.',
      });
    }

    if (stepNumber > 1) {
      const [previousRows] =
        await connection.execute(
          `
            SELECT COUNT(*) AS incomplete

            FROM crm_after_sales_steps

            WHERE crm_case_id = ?
              AND step_number < ?
              AND step_status NOT IN (
                'completed',
                'skipped'
              )
          `,
          [caseId, stepNumber]
        );

      if (
        Number(
          previousRows[0].incomplete
        ) > 0
      ) {
        await connection.rollback();

        return res.status(400).json({
          success: false,
          message:
            'Complete or skip the previous after-sales steps first.',
        });
      }
    }

    await connection.execute(
      `
        UPDATE crm_after_sales_steps
        SET
          step_status = ?,
          customer_feedback = ?,
          crm_response = ?,
          follow_up_at = ?,
          handled_by = ?,

          started_at =
            COALESCE(
              started_at,
              NOW()
            ),

          completed_at =
            CASE
              WHEN ? IN (
                'completed',
                'skipped'
              )
              THEN COALESCE(
                completed_at,
                NOW()
              )

              ELSE NULL
            END

        WHERE crm_case_id = ?
          AND step_number = ?
      `,
      [
        stepStatus,
        customerFeedback || null,
        crmResponse || null,
        parsedFollowUp.value,
        req.user.id,
        stepStatus,
        caseId,
        stepNumber,
      ]
    );

    const [nextStepRows] =
      await connection.execute(
        `
          SELECT
            step_number,
            follow_up_at

          FROM crm_after_sales_steps

          WHERE crm_case_id = ?
            AND step_status NOT IN (
              'completed',
              'skipped'
            )

          ORDER BY
            step_number ASC

          LIMIT 1
        `,
        [caseId]
      );

    const allStepsCompleted =
      nextStepRows.length === 0;

    const newCurrentStep =
      allStepsCompleted
        ? 4
        : Number(
            nextStepRows[0]
              .step_number
          );

    let nextFollowUpAt =
      allStepsCompleted
        ? null
        : nextStepRows[0]
            .follow_up_at;

    if (
      !allStepsCompleted &&
      finishesStep
    ) {
      nextFollowUpAt =
        parsedNextFollowUp.value;

      await connection.execute(
        `
          UPDATE crm_after_sales_steps
          SET
            follow_up_at = ?,
            handled_by = ?
          WHERE crm_case_id = ?
            AND step_number = ?
        `,
        [
          nextFollowUpAt,
          req.user.id,
          caseId,
          newCurrentStep,
        ]
      );
    }

    await connection.execute(
      `
        UPDATE crm_cases
        SET
          current_step = ?,
          case_status = 'in_progress',
          next_follow_up_at = ?,

          first_contacted_at =
            COALESCE(
              first_contacted_at,
              NOW()
            )

        WHERE id = ?
      `,
      [
        newCurrentStep,
        nextFollowUpAt,
        caseId,
      ]
    );

    await connection.commit();

    return res.json({
      success: true,

      message:
        `After-sales Step ${stepNumber} updated successfully.`,

      step: {
        stepNumber,
        stepStatus,
        customerFeedback:
          customerFeedback || null,
        crmResponse:
          crmResponse || null,
        followUpAt:
          parsedFollowUp.value,
      },

      currentStep:
        newCurrentStep,

      allStepsCompleted,

      nextFollowUpAt,
    });
  } catch (error) {
    if (connection) {
      try {
        await connection.rollback();
      } catch (rollbackError) {
        console.error(
          'CRM step rollback error:',
          rollbackError
        );
      }
    }

    console.error(
      'Update after-sales step error:',
      error
    );

    return res.status(500).json({
      success: false,
      message:
        'Unable to update the after-sales step.',
    });
  } finally {
    if (connection) {
      connection.release();
    }
  }
};

// PUT /api/crm/cases/:id/satisfaction
exports.saveSatisfaction = async (
  req,
  res
) => {
  let connection;

  try {
    const caseId =
      parsePositiveInteger(
        req.params.id
      );

    const satisfactionRating =
      Number(
        req.body.satisfactionRating
      );

    const finalFeedback =
      cleanText(
        req.body.finalFeedback
      );

    const wouldRepurchase =
      cleanText(
        req.body.wouldRepurchase
      );

    if (!caseId) {
      return res.status(400).json({
        success: false,
        message:
          'Invalid CRM case.',
      });
    }

    if (
      !Number.isInteger(
        satisfactionRating
      ) ||
      satisfactionRating < 1 ||
      satisfactionRating > 5
    ) {
      return res.status(400).json({
        success: false,
        message:
          'Satisfaction rating must be from 1 to 5.',
      });
    }

    if (
      !REPURCHASE_OPTIONS.includes(
        wouldRepurchase
      )
    ) {
      return res.status(400).json({
        success: false,
        message:
          'Select a valid repurchase response.',
      });
    }

    connection =
      await pool.getConnection();

    await connection.beginTransaction();

    const crmCase =
      await getLockedCase(
        connection,
        caseId
      );

    if (!crmCase) {
      await connection.rollback();

      return res.status(404).json({
        success: false,
        message:
          'CRM case not found.',
      });
    }

    const assignmentCheck =
      requireAssignedUser(
        crmCase,
        req.user.id
      );

    if (!assignmentCheck.allowed) {
      await connection.rollback();

      return res.status(403).json({
        success: false,
        message:
          assignmentCheck.message,
      });
    }

    if (
      crmCase.case_status ===
      'closed'
    ) {
      await connection.rollback();

      return res.status(400).json({
        success: false,
        message:
          'Customer satisfaction cannot be changed after the case is closed.',
      });
    }

    const [stepRows] =
      await connection.execute(
        `
          SELECT COUNT(*) AS incomplete

          FROM crm_after_sales_steps

          WHERE crm_case_id = ?
            AND step_status NOT IN (
              'completed',
              'skipped'
            )
        `,
        [caseId]
      );

    if (
      Number(
        stepRows[0].incomplete
      ) > 0
    ) {
      await connection.rollback();

      return res.status(400).json({
        success: false,
        message:
          'Complete or skip all four after-sales steps before recording customer satisfaction.',
      });
    }

    await connection.execute(
      `
        INSERT INTO crm_feedback (
          crm_case_id,
          recorded_by,
          satisfaction_rating,
          feedback,
          would_repurchase,
          submitted_at
        )
        VALUES (
          ?,
          ?,
          ?,
          ?,
          ?,
          NOW()
        )

        ON DUPLICATE KEY UPDATE
          recorded_by =
            VALUES(recorded_by),

          satisfaction_rating =
            VALUES(
              satisfaction_rating
            ),

          feedback =
            VALUES(feedback),

          would_repurchase =
            VALUES(
              would_repurchase
            ),

          submitted_at = NOW()
      `,
      [
        caseId,
        req.user.id,
        satisfactionRating,
        finalFeedback || null,
        wouldRepurchase,
      ]
    );

    await connection.commit();

    return res.json({
      success: true,

      message:
        'Customer satisfaction result saved successfully.',

      satisfaction: {
        satisfactionRating,

        satisfactionResult:
          getSatisfactionResult(
            satisfactionRating
          ),

        finalFeedback:
          finalFeedback || null,

        wouldRepurchase,

        recordedAt:
          new Date(),
      },
    });
  } catch (error) {
    if (connection) {
      try {
        await connection.rollback();
      } catch (rollbackError) {
        console.error(
          'Satisfaction rollback error:',
          rollbackError
        );
      }
    }

    console.error(
      'Save satisfaction error:',
      error
    );

    return res.status(500).json({
      success: false,
      message:
        'Unable to save the customer satisfaction result.',
    });
  } finally {
    if (connection) {
      connection.release();
    }
  }
};

// PATCH /api/crm/cases/:id/resolve
exports.resolveCase = async (
  req,
  res
) => {
  let connection;

  try {
    const caseId =
      parsePositiveInteger(
        req.params.id
      );

    const resolutionNotes =
      cleanText(
        req.body.resolutionNotes
      );

    if (!caseId) {
      return res.status(400).json({
        success: false,
        message:
          'Invalid CRM case.',
      });
    }

    if (!resolutionNotes) {
      return res.status(400).json({
        success: false,
        message:
          'Resolution notes are required.',
      });
    }

    connection =
      await pool.getConnection();

    await connection.beginTransaction();

    const crmCase =
      await getLockedCase(
        connection,
        caseId
      );

    if (!crmCase) {
      await connection.rollback();

      return res.status(404).json({
        success: false,
        message:
          'CRM case not found.',
      });
    }

    const assignmentCheck =
      requireAssignedUser(
        crmCase,
        req.user.id
      );

    if (!assignmentCheck.allowed) {
      await connection.rollback();

      return res.status(403).json({
        success: false,
        message:
          assignmentCheck.message,
      });
    }

    if (
      crmCase.case_status ===
      'closed'
    ) {
      await connection.rollback();

      return res.status(400).json({
        success: false,
        message:
          'The CRM case is already closed.',
      });
    }

    if (
      crmCase.delivery_confirmation ===
      'pending'
    ) {
      await connection.rollback();

      return res.status(400).json({
        success: false,
        message:
          'Update the delivery confirmation before resolving the case.',
      });
    }

    const [stepRows] =
      await connection.execute(
        `
          SELECT COUNT(*) AS incomplete

          FROM crm_after_sales_steps

          WHERE crm_case_id = ?
            AND step_status NOT IN (
              'completed',
              'skipped'
            )
        `,
        [caseId]
      );

    if (
      Number(
        stepRows[0].incomplete
      ) > 0
    ) {
      await connection.rollback();

      return res.status(400).json({
        success: false,
        message:
          'Complete or skip all four after-sales steps before resolving the case.',
      });
    }

    const [feedbackRows] =
      await connection.execute(
        `
          SELECT id
          FROM crm_feedback
          WHERE crm_case_id = ?
          LIMIT 1
        `,
        [caseId]
      );

    if (feedbackRows.length === 0) {
      await connection.rollback();

      return res.status(400).json({
        success: false,
        message:
          'Record the customer satisfaction result before resolving the case.',
      });
    }

    await connection.execute(
      `
        UPDATE crm_cases
        SET
          case_status = 'resolved',
          resolution_notes = ?,
          next_follow_up_at = NULL,
          resolved_at = NOW()
        WHERE id = ?
      `,
      [
        resolutionNotes,
        caseId,
      ]
    );

    await connection.commit();

    return res.json({
      success: true,
      message:
        'CRM case resolved successfully.',
      caseStatus: 'resolved',
      resolvedAt: new Date(),
    });
  } catch (error) {
    if (connection) {
      try {
        await connection.rollback();
      } catch (rollbackError) {
        console.error(
          'Resolve CRM rollback error:',
          rollbackError
        );
      }
    }

    console.error(
      'Resolve revised CRM case error:',
      error
    );

    return res.status(500).json({
      success: false,
      message:
        'Unable to resolve the CRM case.',
    });
  } finally {
    if (connection) {
      connection.release();
    }
  }
};

// PATCH /api/crm/cases/:id/close
exports.closeCase = async (
  req,
  res
) => {
  let connection;

  try {
    const caseId =
      parsePositiveInteger(
        req.params.id
      );

    if (!caseId) {
      return res.status(400).json({
        success: false,
        message:
          'Invalid CRM case.',
      });
    }

    connection =
      await pool.getConnection();

    await connection.beginTransaction();

    const crmCase =
      await getLockedCase(
        connection,
        caseId
      );

    if (!crmCase) {
      await connection.rollback();

      return res.status(404).json({
        success: false,
        message:
          'CRM case not found.',
      });
    }

    const assignmentCheck =
      requireAssignedUser(
        crmCase,
        req.user.id
      );

    if (!assignmentCheck.allowed) {
      await connection.rollback();

      return res.status(403).json({
        success: false,
        message:
          assignmentCheck.message,
      });
    }

    if (
      crmCase.case_status ===
      'closed'
    ) {
      await connection.rollback();

      return res.status(400).json({
        success: false,
        message:
          'The CRM case is already closed.',
      });
    }

    if (
      crmCase.case_status !==
      'resolved'
    ) {
      await connection.rollback();

      return res.status(400).json({
        success: false,
        message:
          'Only resolved CRM cases can be closed.',
      });
    }

    await connection.execute(
      `
        UPDATE crm_cases
        SET
          case_status = 'closed',
          next_follow_up_at = NULL,
          closed_at = NOW()
        WHERE id = ?
      `,
      [caseId]
    );

    await connection.commit();

    return res.json({
      success: true,
      message:
        'CRM case closed successfully.',
      caseStatus: 'closed',
      closedAt: new Date(),
    });
  } catch (error) {
    if (connection) {
      try {
        await connection.rollback();
      } catch (rollbackError) {
        console.error(
          'Close CRM rollback error:',
          rollbackError
        );
      }
    }

    console.error(
      'Close revised CRM case error:',
      error
    );

    return res.status(500).json({
      success: false,
      message:
        'Unable to close the CRM case.',
    });
  } finally {
    if (connection) {
      connection.release();
    }
  }
};
