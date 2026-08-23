const pool = require('../config/db');

const QUERY_LIMIT = 75;
const HEAD_DISPLAY_LIMIT = 60;
const SPECIALIST_DISPLAY_LIMIT = 40;

const MODULE_DETAILS = {
  sales: {
    label: 'Sales',
    path: '/sales',
  },
  cdm: {
    label: 'CDM',
    path: '/cdm',
  },
  supply_chain: {
    label: 'Supply Chain',
    path: '/supply-chain',
  },
  fulfillment: {
    label: 'Fulfillment',
    path: '/fulfillment',
  },
  crm: {
    label: 'CRM',
    path: '/crm',
  },
  marketing: {
    label: 'Marketing',
    path: '/marketing',
  },
};

function normalizeValue(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, '_');
}

function formatTask(
  moduleCode,
  row,
  actionLabel
) {
  const moduleDetails =
    MODULE_DETAILS[moduleCode];

  return {
    id: `${moduleCode}-${row.reference_id}`,
    module: moduleDetails.label,
    moduleCode,
    title: row.task_title,
    description: row.task_description,
    priority: row.task_priority,
    status: row.task_status,
    category:
      row.task_category || null,
    dueAt: row.due_at || null,
    isOverdue: Boolean(
      Number(row.is_overdue)
    ),
    isDueToday: Boolean(
      Number(row.is_due_today)
    ),
    actionLabel,
    actionPath: moduleDetails.path,
    referenceId: Number(
      row.reference_id
    ),
    createdAt: row.created_at,
  };
}

async function getSalesTasks(isHead) {
  const [rows] = await pool.execute(`
    SELECT
      id AS reference_id,
      CONCAT('Order ', order_number)
        AS task_title,

      CASE
        WHEN order_status = 'rejected'
        THEN 'Review the CDM rejection before deciding the next Sales action.'
        ELSE 'This draft order still needs to be submitted to CDM.'
      END AS task_description,

      order_status AS task_status,

      CASE
        WHEN order_status = 'rejected'
        THEN 'medium'
        ELSE 'normal'
      END AS task_priority,

      NULL AS due_at,
      0 AS is_overdue,
      0 AS is_due_today,
      created_at

    FROM orders

    WHERE order_status IN (
      'draft',
      'rejected'
    )

    ORDER BY
      CASE
        WHEN order_status = 'rejected'
        THEN 1
        ELSE 2
      END,
      created_at ASC

    LIMIT ${QUERY_LIMIT}
  `);

  return rows.map((row) =>
    formatTask(
      'sales',
      row,
      isHead
        ? 'Review Sales'
        : row.task_status === 'draft'
        ? 'Submit Order'
        : 'Review Rejection'
    )
  );
}

async function getCdmTasks(isHead) {
  const [rows] = await pool.execute(`
    SELECT
      o.id AS reference_id,
      CONCAT('Order ', o.order_number)
        AS task_title,

      CASE
        WHEN o.order_status =
          'for_confirmation'
        THEN 'The Sales order is waiting for CDM confirmation.'

        WHEN cp.waybill_number IS NULL
          AND cp.waybill_link IS NULL
        THEN 'The confirmed order needs waybill information.'

        ELSE 'The confirmed order is ready to be sent to Fulfillment.'
      END AS task_description,

      o.order_status AS task_status,

      CASE
        WHEN o.order_status =
          'for_confirmation'
        THEN 'awaiting_confirmation'

        WHEN cp.waybill_number IS NULL
          AND cp.waybill_link IS NULL
        THEN 'missing_waybill'

        ELSE 'awaiting_fulfillment_handoff'
      END AS action_key,

      CASE
        WHEN o.order_status =
          'for_confirmation'
        THEN 'normal'
        ELSE 'medium'
      END AS task_priority,

      NULL AS due_at,
      0 AS is_overdue,
      0 AS is_due_today,
      o.created_at

    FROM orders o

    LEFT JOIN cdm_order_processing cp
      ON cp.order_id = o.id

    WHERE
      o.order_status = 'for_confirmation'

      OR (
        o.order_status = 'confirmed'
        AND cp.confirmation_status =
            'confirmed'
        AND cp.sent_to_customer_at
            IS NULL
      )

    ORDER BY
      CASE
        WHEN o.order_status =
          'for_confirmation'
        THEN 1
        WHEN cp.waybill_number IS NULL
          AND cp.waybill_link IS NULL
        THEN 2
        ELSE 3
      END,
      o.created_at ASC

    LIMIT ${QUERY_LIMIT}
  `);

  const actionLabels = {
    awaiting_confirmation:
      'Confirm Order',
    missing_waybill:
      'Record Waybill',
    awaiting_fulfillment_handoff:
      'Send to Fulfillment',
  };

  return rows.map((row) =>
    formatTask(
      'cdm',
      row,
      isHead
        ? 'Review CDM'
        : actionLabels[row.action_key]
    )
  );
}

async function getSupplyChainTasks(isHead) {
  const [rows] = await pool.execute(`
    SELECT
      id AS reference_id,
      item_name AS task_title,

      CONCAT(
        'Current stock: ',
        current_quantity,
        ' ',
        unit,
        '. Reorder level: ',
        reorder_level,
        ' ',
        unit,
        '.'
      ) AS task_description,

      CASE
        WHEN current_quantity <= 0
        THEN 'out_of_stock'
        ELSE 'low_stock'
      END AS task_status,

      CASE
        WHEN current_quantity <= 0
        THEN 'high'
        ELSE 'medium'
      END AS task_priority,

      NULL AS due_at,
      0 AS is_overdue,
      0 AS is_due_today,
      created_at

    FROM inventory_items

    WHERE status = 'active'
      AND (
        current_quantity <= 0
        OR (
          reorder_level > 0
          AND current_quantity <=
              reorder_level
        )
      )

    ORDER BY
      CASE
        WHEN current_quantity <= 0
        THEN 1
        ELSE 2
      END,
      current_quantity ASC,
      item_name ASC

    LIMIT ${QUERY_LIMIT}
  `);

  return rows.map((row) =>
    formatTask(
      'supply_chain',
      row,
      isHead
        ? 'Review Inventory'
        : 'Review Stock'
    )
  );
}

async function getFulfillmentTasks(isHead) {
  const [rows] = await pool.execute(`
    SELECT
      fo.id AS reference_id,
      CONCAT('Order ', o.order_number)
        AS task_title,

      CASE fo.fulfillment_status
        WHEN 'pending_packing'
        THEN 'This order is waiting for packing to begin.'
        WHEN 'packing'
        THEN 'Packing has started and still needs to be completed.'
        WHEN 'packed'
        THEN 'Packing is complete; mark the order ready for shipment.'
        WHEN 'ready_for_shipment'
        THEN 'The order is ready to be shipped.'
        ELSE 'The shipped order needs a delivered or returned update.'
      END AS task_description,

      fo.fulfillment_status
        AS task_status,

      CASE
        WHEN fo.fulfillment_status =
          'shipped_out'
        THEN 'medium'
        ELSE 'normal'
      END AS task_priority,

      NULL AS due_at,
      0 AS is_overdue,
      0 AS is_due_today,
      fo.created_at

    FROM fulfillment_orders fo

    INNER JOIN orders o
      ON o.id = fo.order_id

    WHERE fo.fulfillment_status IN (
      'pending_packing',
      'packing',
      'packed',
      'ready_for_shipment',
      'shipped_out'
    )

    ORDER BY
      CASE fo.fulfillment_status
        WHEN 'shipped_out' THEN 1
        WHEN 'packing' THEN 2
        WHEN 'pending_packing' THEN 3
        WHEN 'packed' THEN 4
        ELSE 5
      END,
      fo.created_at ASC

    LIMIT ${QUERY_LIMIT}
  `);

  const actionLabels = {
    pending_packing: 'Start Packing',
    packing: 'Complete Packing',
    packed: 'Mark Ready',
    ready_for_shipment: 'Ship Order',
    shipped_out: 'Update Delivery',
  };

  return rows.map((row) =>
    formatTask(
      'fulfillment',
      row,
      isHead
        ? 'Review Fulfillment'
        : actionLabels[row.task_status]
    )
  );
}

async function getCrmTasks(
  isHead,
  userId
) {
  const conditions = isHead
    ? `
        cc.case_status NOT IN (
          'resolved',
          'closed'
        )
      `
    : `
        cc.case_status NOT IN (
          'resolved',
          'closed'
        )
        AND (
          cc.handled_by IS NULL
          OR cc.handled_by = ?
        )
      `;

  const values = isHead
    ? []
    : [userId];

  const [rows] = await pool.execute(
    `
      SELECT
        cc.id AS reference_id,
        CONCAT('Order ', o.order_number)
          AS task_title,

        CASE
          WHEN cc.handled_by IS NULL
          THEN 'This CRM case is unassigned.'

          WHEN NOT EXISTS (
            SELECT 1
            FROM crm_after_sales_steps unfinished
            WHERE unfinished.crm_case_id = cc.id
              AND unfinished.step_status NOT IN (
                'completed',
                'skipped'
              )
          )
            AND feedback.id IS NULL
          THEN 'All four follow-ups are complete. Record customer satisfaction.'

          WHEN NOT EXISTS (
            SELECT 1
            FROM crm_after_sales_steps unfinished
            WHERE unfinished.crm_case_id = cc.id
              AND unfinished.step_status NOT IN (
                'completed',
                'skipped'
              )
          )
          THEN 'All four follow-ups and satisfaction are complete. Resolve the case.'

          WHEN cc.case_status =
            'awaiting_customer'
          THEN 'The case is awaiting the customer and still requires monitoring.'

          WHEN cc.next_follow_up_at IS NULL
          THEN CONCAT(
            'Step ',
            cc.current_step,
            ' is actionable but has no follow-up scheduled.'
          )

          WHEN cc.next_follow_up_at < NOW()
          THEN CONCAT(
            'Step ',
            cc.current_step,
            ' follow-up is overdue.'
          )

          WHEN DATE(
                 cc.next_follow_up_at
               ) = CURRENT_DATE()
          THEN CONCAT(
            'Step ',
            cc.current_step,
            ' follow-up is due today.'
          )

          ELSE CONCAT(
            'Step ',
            cc.current_step,
            ' follow-up is upcoming.'
          )
        END AS task_description,

        cc.case_status AS task_status,

        CASE
          WHEN cc.handled_by IS NULL
          THEN 'unassigned_crm'

          WHEN NOT EXISTS (
            SELECT 1
            FROM crm_after_sales_steps unfinished
            WHERE unfinished.crm_case_id = cc.id
              AND unfinished.step_status NOT IN (
                'completed',
                'skipped'
              )
          )
            AND feedback.id IS NULL
          THEN 'ready_for_satisfaction'

          WHEN NOT EXISTS (
            SELECT 1
            FROM crm_after_sales_steps unfinished
            WHERE unfinished.crm_case_id = cc.id
              AND unfinished.step_status NOT IN (
                'completed',
                'skipped'
              )
          )
          THEN 'ready_for_resolution'

          WHEN cc.case_status =
            'awaiting_customer'
          THEN 'awaiting_customer'

          WHEN cc.next_follow_up_at IS NULL
          THEN 'awaiting_schedule'

          WHEN cc.next_follow_up_at < NOW()
          THEN 'follow_up_overdue'

          WHEN DATE(
            cc.next_follow_up_at
          ) = CURRENT_DATE()
          THEN 'follow_up_due_today'

          ELSE 'follow_up_upcoming'
        END AS task_category,

        CASE
          WHEN cc.handled_by IS NULL
          THEN 'assign_case'

          WHEN NOT EXISTS (
            SELECT 1
            FROM crm_after_sales_steps unfinished
            WHERE unfinished.crm_case_id = cc.id
              AND unfinished.step_status NOT IN (
                'completed',
                'skipped'
              )
          )
            AND feedback.id IS NULL
          THEN 'record_satisfaction'

          WHEN NOT EXISTS (
            SELECT 1
            FROM crm_after_sales_steps unfinished
            WHERE unfinished.crm_case_id = cc.id
              AND unfinished.step_status NOT IN (
                'completed',
                'skipped'
              )
          )
          THEN 'resolve_case'

          WHEN cc.case_status =
            'awaiting_customer'
          THEN 'monitor_customer'

          WHEN cc.next_follow_up_at IS NULL
          THEN 'schedule_follow_up'

          ELSE 'continue_step'
        END AS action_key,

        CASE
          WHEN cc.next_follow_up_at < NOW()
            AND current_step.step_status
                NOT IN (
                  'completed',
                  'skipped'
                )
          THEN 'high'

          WHEN cc.handled_by IS NULL
            OR DATE(
                 cc.next_follow_up_at
               ) = CURRENT_DATE()
            OR cc.next_follow_up_at IS NULL
            OR NOT EXISTS (
              SELECT 1
              FROM crm_after_sales_steps unfinished
              WHERE unfinished.crm_case_id = cc.id
                AND unfinished.step_status NOT IN (
                  'completed',
                  'skipped'
                )
            )
          THEN 'medium'

          ELSE 'normal'
        END AS task_priority,

        cc.next_follow_up_at
          AS due_at,

        CASE
          WHEN cc.next_follow_up_at < NOW()
            AND current_step.step_status
                NOT IN (
                  'completed',
                  'skipped'
                )
          THEN 1
          ELSE 0
        END AS is_overdue,

        CASE
          WHEN DATE(
                 cc.next_follow_up_at
               ) = CURRENT_DATE()
          THEN 1
          ELSE 0
        END AS is_due_today,

        cc.created_at

      FROM crm_cases cc

      INNER JOIN orders o
        ON o.id = cc.order_id

      LEFT JOIN crm_after_sales_steps
        current_step
        ON current_step.crm_case_id =
           cc.id
       AND current_step.step_number =
           cc.current_step

      LEFT JOIN crm_feedback feedback
        ON feedback.crm_case_id = cc.id

      WHERE ${conditions}

      ORDER BY
        is_overdue DESC,
        CASE
          WHEN cc.handled_by IS NULL
          THEN 1
          ELSE 2
        END,
        cc.next_follow_up_at IS NULL,
        cc.next_follow_up_at ASC,
        cc.created_at ASC

      LIMIT ${QUERY_LIMIT}
    `,
    values
  );

  const actionLabels = {
    assign_case: 'Assign Case',
    schedule_follow_up:
      'Schedule Follow-up',
    monitor_customer:
      'Review Customer Follow-up',
    continue_step: 'Continue Follow-up',
    record_satisfaction:
      'Record Satisfaction',
    resolve_case: 'Resolve Case',
  };

  return rows.map((row) =>
    formatTask(
      'crm',
      row,
      isHead
        ? 'Review CRM'
        : actionLabels[row.action_key]
    )
  );
}

async function getMarketingTasks(
  isHead,
  userId
) {
  const conditions = isHead
    ? `
        (
          mt.task_status IN (
            'pending',
            'submitted',
            'for_revision'
          )
          OR (
            mt.due_date < NOW()
            AND mt.task_status NOT IN (
              'completed',
              'cancelled'
            )
          )
        )
      `
    : `
        mt.assigned_to = ?
        AND mt.task_status IN (
          'assigned',
          'in_progress',
          'for_revision',
          'approved'
        )
      `;

  const values = isHead
    ? []
    : [userId];

  const [rows] = await pool.execute(
    `
      SELECT
        mt.id AS reference_id,
        mt.task_title,

        CASE mt.task_status
          WHEN 'pending'
          THEN 'This Marketing task is waiting for assignment.'
          WHEN 'assigned'
          THEN 'This assigned Marketing task is ready to start.'
          WHEN 'in_progress'
          THEN 'Work is in progress and still needs submission.'
          WHEN 'submitted'
          THEN 'The submitted output is waiting for review.'
          WHEN 'for_revision'
          THEN 'The submitted output requires revision.'
          WHEN 'approved'
          THEN 'The approved task is ready to be completed.'
          ELSE 'This Marketing task needs attention.'
        END AS task_description,

        mt.task_status,

        CASE
          WHEN mt.due_date < NOW()
          THEN 'high'
          WHEN mt.priority IN (
            'urgent',
            'high'
          )
          THEN 'high'
          WHEN mt.priority = 'medium'
            OR mt.task_status =
               'for_revision'
          THEN 'medium'
          ELSE 'normal'
        END AS task_priority,

        mt.due_date AS due_at,

        CASE
          WHEN mt.due_date < NOW()
          THEN 1
          ELSE 0
        END AS is_overdue,

        CASE
          WHEN DATE(mt.due_date) =
               CURRENT_DATE()
          THEN 1
          ELSE 0
        END AS is_due_today,

        mt.created_at

      FROM marketing_tasks mt

      WHERE ${conditions}

      ORDER BY
        is_overdue DESC,
        FIELD(
          mt.priority,
          'urgent',
          'high',
          'medium',
          'low'
        ),
        mt.due_date IS NULL,
        mt.due_date ASC,
        mt.created_at ASC

      LIMIT ${QUERY_LIMIT}
    `,
    values
  );

  const actionLabels = {
    assigned: 'Start Task',
    in_progress: 'Submit Output',
    for_revision: 'Revise Output',
    approved: 'Complete Task',
  };

  return rows.map((row) =>
    formatTask(
      'marketing',
      row,
      isHead
        ? 'Review Marketing'
        : actionLabels[row.task_status]
    )
  );
}

function sortTasks(tasks) {
  const priorityOrder = {
    high: 1,
    medium: 2,
    normal: 3,
  };

  return [...tasks].sort(
    (first, second) => {
      if (
        first.isOverdue !==
        second.isOverdue
      ) {
        return first.isOverdue
          ? -1
          : 1;
      }

      const priorityDifference =
        (priorityOrder[
          first.priority
        ] || 4) -
        (priorityOrder[
          second.priority
        ] || 4);

      if (priorityDifference !== 0) {
        return priorityDifference;
      }

      const firstDate = new Date(
        first.dueAt ||
          first.createdAt ||
          0
      ).getTime();

      const secondDate = new Date(
        second.dueAt ||
          second.createdAt ||
          0
      ).getTime();

      return firstDate - secondDate;
    }
  );
}

function createTaskResponse(
  tasks,
  displayLimit,
  heading
) {
  const sortedTasks = sortTasks(tasks);

  return {
    heading,
    summary: {
      totalActionable:
        sortedTasks.length,
      overdue: sortedTasks.filter(
        (task) => task.isOverdue
      ).length,
      highPriority:
        sortedTasks.filter(
          (task) =>
            task.priority === 'high'
        ).length,
      dueToday: sortedTasks.filter(
        (task) => task.isDueToday
      ).length,
    },
    items: sortedTasks.slice(
      0,
      displayLimit
    ),
    hasMore:
      sortedTasks.length >
      displayLimit,
  };
}

async function getMyTasks(user) {
  const role = normalizeValue(
    user?.role
  );

  const departmentCode =
    normalizeValue(
      user?.departmentCode ||
        user?.department?.code
    );

  const userId = Number(user?.id);

  if (
    role === 'system_configuration'
  ) {
    return createTaskResponse(
      [],
      SPECIALIST_DISPLAY_LIMIT,
      'My Tasks'
    );
  }

  if (role === 'head') {
    const taskGroups =
      await Promise.all([
        getSalesTasks(true),
        getCdmTasks(true),
        getSupplyChainTasks(true),
        getFulfillmentTasks(true),
        getCrmTasks(true, null),
        getMarketingTasks(true, null),
      ]);

    return createTaskResponse(
      taskGroups.flat(),
      HEAD_DISPLAY_LIMIT,
      'Needs Attention'
    );
  }

  if (
    role !== 'specialist' ||
    !Number.isInteger(userId) ||
    userId <= 0
  ) {
    return createTaskResponse(
      [],
      SPECIALIST_DISPLAY_LIMIT,
      'My Tasks'
    );
  }

  const taskLoaders = {
    sales: () =>
      getSalesTasks(false),
    cdm: () => getCdmTasks(false),
    supply_chain: () =>
      getSupplyChainTasks(false),
    fulfillment: () =>
      getFulfillmentTasks(false),
    crm: () =>
      getCrmTasks(false, userId),
    marketing: () =>
      getMarketingTasks(
        false,
        userId
      ),
  };

  const loadTasks =
    taskLoaders[departmentCode];

  const tasks = loadTasks
    ? await loadTasks()
    : [];

  return createTaskResponse(
    tasks,
    SPECIALIST_DISPLAY_LIMIT,
    'My Tasks'
  );
}

module.exports = {
  getMyTasks,
};
