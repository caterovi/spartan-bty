const pool = require('../config/db');
const {
  deriveOrderWorkflow,
} = require('../utils/orderWorkflow');

const MIN_QUERY_LENGTH = 2;
const CATEGORY_LIMIT = 6;
const TOTAL_LIMIT = 30;

function cleanText(value) {
  return String(value || '')
    .trim()
    .slice(0, 100);
}

function label(value) {
  return String(value || '')
    .replaceAll('_', ' ')
    .replace(/\b\w/g, (letter) =>
      letter.toUpperCase()
    );
}

function getAccess(user) {
  const role = user?.role;
  const department = user?.departmentCode;
  const isHead = role === 'head';

  return {
    isHead,
    customers:
      isHead ||
      (role === 'specialist' &&
        ['sales', 'cdm', 'crm'].includes(
          department
        )),
    orders:
      isHead ||
      (role === 'specialist' &&
        ['sales', 'cdm', 'fulfillment'].includes(
          department
        )),
    products:
      isHead ||
      (role === 'specialist' &&
        ['sales', 'supply_chain'].includes(
          department
        )),
    inventory:
      isHead ||
      (role === 'specialist' &&
        ['supply_chain', 'fulfillment'].includes(
          department
        )),
    crm:
      isHead ||
      (role === 'specialist' &&
        department === 'crm'),
    marketing:
      isHead ||
      (role === 'specialist' &&
        department === 'marketing'),
    users: role === 'system_configuration',
  };
}

function action(labelText, path, navigationState) {
  return {
    label: labelText,
    path,
    navigationState,
  };
}

function getQuickActions(user) {
  if (user?.role === 'head') {
    return [
      action('Needs Attention', '/dashboard', {
        section: 'needs-attention',
      }),
      action('Pending CDM', '/cdm', {
        statusFilter: 'pending',
      }),
      action('Low Stock', '/supply-chain', {
        stockFilter: 'low_stock',
      }),
      action('Pending Fulfillment', '/fulfillment', {
        statusFilter: 'pending_packing',
      }),
      action('CRM Follow-ups', '/crm', {
        attentionFilter: 'due',
      }),
      action('Reports', '/reports'),
    ];
  }

  if (user?.role === 'system_configuration') {
    return [
      action('User Management', '/users'),
      action('Add User', '/users', {
        openCreateUser: true,
      }),
      action('Settings', '/settings'),
    ];
  }

  const actionsByDepartment = {
    sales: [
      action('Create Order', '/sales', {
        openCreateOrder: true,
      }),
      action('Draft Orders', '/sales', {
        statusFilter: 'draft',
      }),
      action('For Confirmation', '/sales', {
        statusFilter: 'for_confirmation',
      }),
    ],
    cdm: [
      action('Awaiting Confirmation', '/cdm', {
        statusFilter: 'pending',
      }),
      action('Missing Waybill', '/cdm', {
        statusFilter: 'missing_waybill',
      }),
      action('Ready to Send', '/cdm', {
        statusFilter: 'ready_to_send',
      }),
    ],
    supply_chain: [
      action('Record Stock Movement', '/supply-chain', {
        openStockMovement: true,
      }),
      action('Low Stock', '/supply-chain', {
        stockFilter: 'low_stock',
      }),
      action('Out of Stock', '/supply-chain', {
        stockFilter: 'out_of_stock',
      }),
      action('Quality Checks', '/supply-chain', {
        view: 'quality_checks',
      }),
    ],
    fulfillment: [
      action('Pending Packing', '/fulfillment', {
        statusFilter: 'pending_packing',
      }),
      action('Packing in Progress', '/fulfillment', {
        statusFilter: 'packing',
      }),
      action('Ready for Shipment', '/fulfillment', {
        statusFilter: 'ready_for_shipment',
      }),
      action('Shipped Out', '/fulfillment', {
        statusFilter: 'shipped_out',
      }),
    ],
    crm: [
      action('Unassigned Cases', '/crm', {
        assignmentFilter: 'unassigned',
      }),
      action('My Follow-ups', '/crm', {
        assignmentFilter: 'mine',
      }),
      action('Due Today', '/crm', {
        attentionFilter: 'due_today',
      }),
      action('Overdue', '/crm', {
        attentionFilter: 'overdue',
      }),
    ],
    marketing: [
      action('Pending Tasks', '/marketing', {
        statusFilter: 'assigned',
      }),
      action('In Progress', '/marketing', {
        statusFilter: 'in_progress',
      }),
      action('Revisions', '/marketing', {
        statusFilter: 'for_revision',
      }),
    ],
  };

  return actionsByDepartment[
    user?.departmentCode
  ] || [];
}

function searchParameters(query, extra = {}) {
  return {
    exact: query,
    prefix: `${query}%`,
    partial: `%${query}%`,
    ...extra,
  };
}

async function searchCustomers(query) {
  const [rows] = await pool.execute(
    `
      SELECT
        c.id,
        c.full_name,
        c.contact_number,
        CASE
          WHEN c.full_name = :exact
            OR c.contact_number = :exact
            THEN 0
          WHEN c.full_name LIKE :prefix
            OR c.contact_number LIKE :prefix
            THEN 1
          ELSE 2
        END AS search_rank
      FROM customers c
      WHERE c.full_name LIKE :partial
        OR c.contact_number LIKE :partial
      ORDER BY
        search_rank,
        c.full_name,
        c.id
      LIMIT ${CATEGORY_LIMIT}
    `,
    searchParameters(query)
  );

  return rows.map((row) => ({
    type: 'customer',
    id: row.id,
    title: row.full_name,
    subtitle: row.contact_number,
    status: null,
    module: 'Customer 360',
    path: null,
    referenceId: row.id,
    rank: Number(row.search_rank),
  }));
}

function orderScope(user) {
  if (user?.role === 'head') {
    return {
      condition: '',
      path: null,
      module: null,
    };
  }

  const scopes = {
    sales: {
      condition: '',
      path: '/sales',
      module: 'Sales',
      identifierFields: [
        'o.order_number',
        'c.contact_number',
      ],
      textFields: [
        'o.order_number',
        'c.full_name',
        'c.contact_number',
      ],
    },
    cdm: {
      condition:
        "AND o.order_status IN ('for_confirmation', 'confirmed', 'rejected')",
      path: '/cdm',
      module: 'CDM',
      identifierFields: [
        'o.order_number',
        'c.contact_number',
        'cp.waybill_number',
      ],
      textFields: [
        'o.order_number',
        'c.full_name',
        'c.contact_number',
        'cp.waybill_number',
      ],
    },
    fulfillment: {
      condition: 'AND fo.id IS NOT NULL',
      path: '/fulfillment',
      module: 'Fulfillment',
      identifierFields: [
        'o.order_number',
        'c.contact_number',
        'cp.waybill_number',
        'fo.tracking_number',
      ],
      textFields: [
        'o.order_number',
        'c.full_name',
        'c.contact_number',
        'cp.waybill_number',
        'fo.tracking_number',
      ],
    },
  };

  return scopes[user?.departmentCode];
}

function getHeadOrderDestination(row, workflow) {
  if (row.crm_case_id) {
    return {
      module: 'CRM',
      path: '/crm',
    };
  }

  if (row.fulfillment_id) {
    return {
      module: 'Fulfillment',
      path: '/fulfillment',
    };
  }

  if (
    row.cdm_processing_id ||
    ['for_confirmation', 'confirmed'].includes(
      row.order_status
    )
  ) {
    return {
      module: 'CDM',
      path: '/cdm',
    };
  }

  return {
    module: 'Sales',
    path: '/sales',
  };
}

async function searchOrders(query, user) {
  const scope = user?.role === 'head'
    ? {
        condition: '',
        path: null,
        module: null,
        identifierFields: [
          'o.order_number',
          'c.contact_number',
          'cp.waybill_number',
          'fo.tracking_number',
        ],
        textFields: [
          'o.order_number',
          'c.full_name',
          'c.contact_number',
          'cp.waybill_number',
          'fo.tracking_number',
        ],
      }
    : orderScope(user);

  if (!scope) return [];

  const exactConditions =
    scope.identifierFields
      .map((field) => `${field} = :exact`)
      .join('\n            OR ');

  const prefixConditions =
    scope.textFields
      .map(
        (field) =>
          `${field} LIKE :prefix`
      )
      .join('\n            OR ');

  const partialConditions =
    scope.textFields
      .map(
        (field) =>
          `${field} LIKE :partial`
      )
      .join('\n        OR ');

  const [rows] = await pool.execute(
    `
      SELECT
        o.id,
        o.order_number,
        o.order_status,
        o.created_at,
        o.submitted_at,
        o.confirmed_at,
        o.rejected_at,
        o.cancelled_at,
        c.id AS customer_id,
        c.full_name AS customer_name,
        cp.id AS cdm_processing_id,
        cp.waybill_number,
        cp.waybill_link,
        cp.sent_to_customer_at,
        fo.id AS fulfillment_id,
        fo.fulfillment_status,
        fo.tracking_number,
        fo.created_at AS fulfillment_created_at,
        fo.updated_at AS fulfillment_updated_at,
        fo.packing_started_at,
        fo.packed_at,
        fo.ready_for_shipment_at,
        fo.shipped_out_at,
        fo.delivered_at,
        fo.returned_at,
        cc.id AS crm_case_id,
        cc.case_status AS crm_case_status,
        cc.current_step AS crm_current_step,
        cc.handled_by AS crm_handled_by,
        cc.created_at AS crm_created_at,
        CASE
          WHEN ${exactConditions}
            THEN 0
          WHEN ${prefixConditions}
            THEN 1
          ELSE 2
        END AS search_rank
      FROM orders o
      INNER JOIN customers c
        ON c.id = o.customer_id
      LEFT JOIN cdm_order_processing cp
        ON cp.order_id = o.id
      LEFT JOIN fulfillment_orders fo
        ON fo.order_id = o.id
      LEFT JOIN crm_cases cc
        ON cc.order_id = o.id
      WHERE (
        ${partialConditions}
      )
      ${scope.condition}
      ORDER BY
        search_rank,
        o.order_number,
        o.id
      LIMIT ${CATEGORY_LIMIT}
    `,
    searchParameters(query)
  );

  return rows.map((row) => {
    const includeCrmWorkflow =
      user?.role === 'head';

    const workflow = deriveOrderWorkflow({
      orderStatus: row.order_status,
      createdAt: row.created_at,
      submittedAt: row.submitted_at,
      confirmedAt: row.confirmed_at,
      rejectedAt: row.rejected_at,
      cancelledAt: row.cancelled_at,
      waybillNumber: row.waybill_number,
      waybillLink: row.waybill_link,
      sentToCustomerAt: row.sent_to_customer_at,
      fulfillmentStatus: row.fulfillment_status,
      fulfillmentCreatedAt: row.fulfillment_created_at,
      fulfillmentUpdatedAt: row.fulfillment_updated_at,
      packingStartedAt: row.packing_started_at,
      packedAt: row.packed_at,
      readyForShipmentAt: row.ready_for_shipment_at,
      shippedOutAt: row.shipped_out_at,
      deliveredAt: row.delivered_at,
      returnedAt: row.returned_at,
      crmCaseId: includeCrmWorkflow
        ? row.crm_case_id
        : null,
      crmCaseStatus: includeCrmWorkflow
        ? row.crm_case_status
        : null,
      crmCurrentStep: includeCrmWorkflow
        ? row.crm_current_step
        : null,
      crmHandledBy: includeCrmWorkflow
        ? row.crm_handled_by
        : null,
      crmCreatedAt: includeCrmWorkflow
        ? row.crm_created_at
        : null,
    });

    const destination = scope.path
      ? scope
      : getHeadOrderDestination(
          row,
          workflow
        );

    const currentStatus =
      (includeCrmWorkflow &&
        row.crm_case_status) ||
      (scope.path === '/fulfillment' &&
        row.fulfillment_status) ||
      row.order_status;

    return {
      type: 'order',
      id: row.id,
      title: row.order_number,
      subtitle:
        `${row.customer_name} · ` +
        `${workflow.currentStage}`,
      status: currentStatus,
      module: destination.module,
      path: destination.path,
      referenceId:
        destination.path === '/fulfillment'
          ? row.fulfillment_id
          : row.id,
      rank: Number(row.search_rank),
      workflow: {
        currentStage:
          workflow.currentStage,
        nextAction: workflow.nextAction,
      },
      navigationState: {
        globalSearchQuery: query,
        orderId: row.id,
        fulfillmentOrderId:
          row.fulfillment_id || null,
      },
    };
  });
}

async function searchProducts(query, user) {
  const supplyDestination =
    user?.role === 'head' ||
    user?.departmentCode ===
      'supply_chain';

  const [rows] = await pool.execute(
    `
      SELECT
        p.id,
        p.sku,
        p.product_name,
        p.status,
        CASE
          WHEN p.sku = :exact
            OR p.product_name = :exact
            THEN 0
          WHEN p.sku LIKE :prefix
            OR p.product_name LIKE :prefix
            THEN 1
          ELSE 2
        END AS search_rank
      FROM products p
      WHERE p.sku LIKE :partial
        OR p.product_name LIKE :partial
      ORDER BY
        search_rank,
        p.product_name,
        p.id
      LIMIT ${CATEGORY_LIMIT}
    `,
    searchParameters(query)
  );

  return rows.map((row) => ({
    type: 'product',
    id: row.id,
    title: row.product_name,
    subtitle: row.sku,
    status: row.status,
    module: supplyDestination
      ? 'Supply Chain'
      : 'Sales Products',
    path: supplyDestination
      ? '/supply-chain'
      : '/sales',
    referenceId: row.id,
    rank: Number(row.search_rank),
    navigationState: {
      globalSearchQuery: query,
      productId: row.id,
    },
  }));
}

async function searchInventory(query, user) {
  const fulfillmentOnly =
    user?.role === 'specialist' &&
    user?.departmentCode === 'fulfillment';

  const [rows] = await pool.execute(
    `
      SELECT
        ii.id,
        ii.item_code,
        ii.item_name,
        ii.category,
        ii.current_quantity,
        ii.reorder_level,
        ii.status,
        p.sku,
        CASE
          WHEN ii.item_code = :exact
            OR p.sku = :exact
            OR ii.item_name = :exact
            THEN 0
          WHEN ii.item_code LIKE :prefix
            OR p.sku LIKE :prefix
            OR ii.item_name LIKE :prefix
            OR ii.category LIKE :prefix
            THEN 1
          ELSE 2
        END AS search_rank
      FROM inventory_items ii
      LEFT JOIN products p
        ON p.id = ii.product_id
      WHERE (
        ii.item_code LIKE :partial
        OR ii.item_name LIKE :partial
        OR ii.category LIKE :partial
        OR p.sku LIKE :partial
      )
      ${
        fulfillmentOnly
          ? `AND ii.status = 'active'
             AND ii.category IN (
               'product_box',
               'air_column_roll',
               't4_box',
               'thank_you_note',
               'other'
             )`
          : ''
      }
      ORDER BY
        search_rank,
        ii.item_name,
        ii.id
      LIMIT ${CATEGORY_LIMIT}
    `,
    searchParameters(query)
  );

  return rows.map((row) => {
    let stockState = row.status;

    if (row.status === 'active') {
      if (Number(row.current_quantity) === 0) {
        stockState = 'out_of_stock';
      } else if (
        Number(row.reorder_level) > 0 &&
        Number(row.current_quantity) <=
          Number(row.reorder_level)
      ) {
        stockState = 'low_stock';
      } else {
        stockState = 'in_stock';
      }
    }

    return {
      type: 'inventory',
      id: row.id,
      title: row.item_name,
      subtitle:
        `${row.item_code} · ` +
        `${label(row.category)} · ` +
        `${Number(row.current_quantity)} available`,
      status: stockState,
      module: fulfillmentOnly
        ? 'Fulfillment Availability'
        : 'Supply Chain',
      path: fulfillmentOnly
        ? '/fulfillment'
        : '/supply-chain',
      referenceId: row.id,
      rank: Number(row.search_rank),
      navigationState: {
        globalSearchQuery: query,
        inventoryItemId: row.id,
      },
    };
  });
}

async function searchCrmCases(query) {
  const [rows] = await pool.execute(
    `
      SELECT
        cc.id,
        cc.order_id,
        cc.case_status,
        cc.current_step,
        cc.next_follow_up_at,
        cc.handled_by,
        o.order_number,
        c.full_name AS customer_name,
        fo.fulfillment_status,
        CASE
          WHEN CAST(cc.id AS CHAR) = :exact
            OR o.order_number = :exact
            OR c.contact_number = :exact
            THEN 0
          WHEN CAST(cc.id AS CHAR) LIKE :prefix
            OR o.order_number LIKE :prefix
            OR c.full_name LIKE :prefix
            OR c.contact_number LIKE :prefix
            THEN 1
          ELSE 2
        END AS search_rank,
        CASE
          WHEN cc.next_follow_up_at IS NULL
            THEN 'not_scheduled'
          WHEN cc.next_follow_up_at < NOW()
            THEN 'overdue'
          WHEN DATE(cc.next_follow_up_at) = CURDATE()
            THEN 'due_today'
          ELSE 'scheduled'
        END AS follow_up_state
      FROM crm_cases cc
      INNER JOIN orders o
        ON o.id = cc.order_id
      INNER JOIN customers c
        ON c.id = o.customer_id
      LEFT JOIN fulfillment_orders fo
        ON fo.order_id = o.id
      WHERE CAST(cc.id AS CHAR) LIKE :partial
        OR o.order_number LIKE :partial
        OR c.full_name LIKE :partial
        OR c.contact_number LIKE :partial
      ORDER BY
        search_rank,
        cc.id DESC
      LIMIT ${CATEGORY_LIMIT}
    `,
    searchParameters(query)
  );

  return rows.map((row) => ({
    type: 'crm_case',
    id: row.id,
    title: `CRM Case #${row.id}`,
    subtitle:
      `${row.order_number} · ` +
      `${row.customer_name} · Step ${row.current_step} · ` +
      `${label(row.follow_up_state)}`,
    status: row.case_status,
    module: 'CRM',
    path: '/crm',
    referenceId: row.id,
    rank: Number(row.search_rank),
    meta: {
      followUpState: row.follow_up_state,
      fulfillmentStatus:
        row.fulfillment_status,
    },
    navigationState: {
      globalSearchQuery: query,
      crmCaseId: row.id,
      orderId: row.order_id,
    },
  }));
}

async function searchMarketing(query, user) {
  const specialist =
    user?.role === 'specialist';

  const parameters = searchParameters(
    query,
    {
      userId: user?.id,
    }
  );

  const [campaignRows, taskRows] =
    await Promise.all([
      pool.execute(
        `
          SELECT
            mc.id,
            mc.campaign_code,
            mc.campaign_name,
            mc.campaign_status,
            p.product_name,
            CASE
              WHEN mc.campaign_code = :exact
                OR mc.campaign_name = :exact
                THEN 0
              WHEN mc.campaign_code LIKE :prefix
                OR mc.campaign_name LIKE :prefix
                OR p.product_name LIKE :prefix
                THEN 1
              ELSE 2
            END AS search_rank
          FROM marketing_campaigns mc
          LEFT JOIN products p
            ON p.id = mc.product_id
          WHERE (
            mc.campaign_code LIKE :partial
            OR mc.campaign_name LIKE :partial
            OR p.product_name LIKE :partial
          )
          ${
            specialist
              ? `AND EXISTS (
                   SELECT 1
                   FROM marketing_tasks visible_task
                   WHERE visible_task.campaign_id = mc.id
                     AND visible_task.assigned_to = :userId
                 )`
              : ''
          }
          ORDER BY
            search_rank,
            mc.campaign_name,
            mc.id
          LIMIT ${CATEGORY_LIMIT}
        `,
        parameters
      ),
      pool.execute(
        `
          SELECT
            mt.id,
            mt.task_title,
            mt.content_type,
            mt.priority,
            mt.task_status,
            mc.campaign_name,
            CASE
              WHEN CAST(mt.id AS CHAR) = :exact
                OR mt.task_title = :exact
                THEN 0
              WHEN CAST(mt.id AS CHAR) LIKE :prefix
                OR mt.task_title LIKE :prefix
                OR mc.campaign_name LIKE :prefix
                OR mt.content_type LIKE :prefix
                THEN 1
              ELSE 2
            END AS search_rank
          FROM marketing_tasks mt
          LEFT JOIN marketing_campaigns mc
            ON mc.id = mt.campaign_id
          WHERE (
            CAST(mt.id AS CHAR) LIKE :partial
            OR mt.task_title LIKE :partial
            OR mc.campaign_name LIKE :partial
            OR mt.content_type LIKE :partial
          )
          ${
            specialist
              ? 'AND mt.assigned_to = :userId'
              : ''
          }
          ORDER BY
            search_rank,
            mt.task_title,
            mt.id
          LIMIT ${CATEGORY_LIMIT}
        `,
        parameters
      ),
    ]);

  return [
    ...campaignRows[0].map((row) => ({
      type: 'marketing_campaign',
      id: row.id,
      title: row.campaign_name,
      subtitle:
        row.product_name ||
        row.campaign_code,
      status: row.campaign_status,
      module: 'Marketing Campaigns',
      path: '/marketing',
      referenceId: row.id,
      rank: Number(row.search_rank),
      navigationState: {
        globalSearchQuery: query,
        campaignId: row.id,
      },
    })),
    ...taskRows[0].map((row) => ({
      type: 'marketing_task',
      id: row.id,
      title: row.task_title,
      subtitle:
        `${row.campaign_name || 'Marketing'} · ` +
        `${label(row.content_type)}`,
      status: row.task_status,
      module: 'Marketing Tasks',
      path: '/marketing',
      referenceId: row.id,
      rank: Number(row.search_rank),
      meta: {
        priority: row.priority,
      },
      navigationState: {
        globalSearchQuery: query,
        marketingTaskId: row.id,
      },
    })),
  ];
}

async function searchUsers(query) {
  const [rows] = await pool.execute(
    `
      SELECT
        u.id,
        u.full_name,
        u.username,
        u.email,
        u.role,
        u.status,
        d.name AS department_name,
        CASE
          WHEN u.username = :exact
            OR u.email = :exact
            OR u.full_name = :exact
            THEN 0
          WHEN u.username LIKE :prefix
            OR u.email LIKE :prefix
            OR u.full_name LIKE :prefix
            THEN 1
          ELSE 2
        END AS search_rank
      FROM users u
      LEFT JOIN departments d
        ON d.id = u.department_id
      WHERE u.full_name LIKE :partial
        OR u.username LIKE :partial
        OR u.email LIKE :partial
        OR d.name LIKE :partial
      ORDER BY
        search_rank,
        u.full_name,
        u.id
      LIMIT ${CATEGORY_LIMIT}
    `,
    searchParameters(query)
  );

  return rows.map((row) => ({
    type: 'user',
    id: row.id,
    title: row.full_name,
    subtitle:
      `${row.username} · ` +
      `${row.department_name || label(row.role)}`,
    status: row.status,
    module: 'User Management',
    path: '/users',
    referenceId: row.id,
    rank: Number(row.search_rank),
    navigationState: {
      globalSearchQuery: query,
      userId: row.id,
    },
  }));
}

function taskFor(category, task) {
  return task().then((results) => ({
    category,
    results,
  }));
}

// GET /api/search?q=
exports.globalSearch = async (req, res) => {
  try {
    const query = cleanText(req.query.q);
    const access = getAccess(req.user);
    const quickActions = getQuickActions(
      req.user
    );

    if (query.length < MIN_QUERY_LENGTH) {
      return res.json({
        success: true,
        query,
        minimumQueryLength:
          MIN_QUERY_LENGTH,
        results: [],
        groups: [],
        quickActions,
      });
    }

    const tasks = [];

    if (access.customers) {
      tasks.push(
        taskFor('Customers', () =>
          searchCustomers(query)
        )
      );
    }

    if (access.orders) {
      tasks.push(
        taskFor('Orders', () =>
          searchOrders(query, req.user)
        )
      );
    }

    if (access.products) {
      tasks.push(
        taskFor('Products', () =>
          searchProducts(query, req.user)
        )
      );
    }

    if (access.inventory) {
      tasks.push(
        taskFor('Inventory', () =>
          searchInventory(query, req.user)
        )
      );
    }

    if (access.crm) {
      tasks.push(
        taskFor('CRM Cases', () =>
          searchCrmCases(query)
        )
      );
    }

    if (access.marketing) {
      tasks.push(
        taskFor('Marketing', () =>
          searchMarketing(query, req.user)
        )
      );
    }

    if (access.users) {
      tasks.push(
        taskFor('Users', () =>
          searchUsers(query)
        )
      );
    }

    const groups = (await Promise.all(tasks))
      .map((group) => ({
        ...group,
        results: group.results
          .sort(
            (a, b) =>
              a.rank - b.rank ||
              a.title.localeCompare(
                b.title
              )
          )
          .slice(0, CATEGORY_LIMIT),
      }))
      .filter(
        (group) =>
          group.results.length > 0
      );

    const results = groups
      .flatMap((group) =>
        group.results.map((result) => ({
          ...result,
          group: group.category,
        }))
      )
      .sort(
        (a, b) =>
          a.rank - b.rank ||
          a.title.localeCompare(b.title)
      )
      .slice(0, TOTAL_LIMIT);

    return res.json({
      success: true,
      query,
      minimumQueryLength:
        MIN_QUERY_LENGTH,
      results,
      groups: groups.map((group) => ({
        category: group.category,
        results: results.filter(
          (result) =>
            result.group === group.category
        ),
      })).filter(
        (group) =>
          group.results.length > 0
      ),
      quickActions,
    });
  } catch (error) {
    console.error('Global search error:', error);

    return res.status(500).json({
      success: false,
      message:
        'Unable to complete the search.',
    });
  }
};

exports.searchConfiguration = {
  MIN_QUERY_LENGTH,
  CATEGORY_LIMIT,
  TOTAL_LIMIT,
  getAccess,
  getQuickActions,
};
