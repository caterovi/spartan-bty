const pool = require('../config/db');
const {
  getMyTasks,
} = require('../utils/myTasks');

function numberValue(value) {
  return Number(value || 0);
}

function normalizeRole(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, '_');
}

function getDepartmentCode(user) {
  return String(
    user?.departmentCode ||
      user?.department?.code ||
      ''
  )
    .trim()
    .toLowerCase();
}

function quoteIdentifier(value) {
  if (!/^[A-Za-z0-9_]+$/.test(value)) {
    throw new Error(
      `Unsafe SQL identifier: ${value}`
    );
  }

  return `\`${value}\``;
}

async function tableExists(tableName) {
  const [rows] = await pool.execute(
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

async function getTableColumns(tableName) {
  const [rows] = await pool.execute(
    `
      SELECT COLUMN_NAME
      FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = ?
      ORDER BY ORDINAL_POSITION
    `,
    [tableName]
  );

  return rows.map(
    (row) => row.COLUMN_NAME
  );
}

function pickColumn(
  availableColumns,
  candidates
) {
  return (
    candidates.find((column) =>
      availableColumns.includes(column)
    ) || null
  );
}

async function getInventorySnapshot() {
  const exists = await tableExists(
    'inventory_items'
  );

  if (!exists) {
    return {
      totalItems: 0,
      totalBalance: 0,
      lowStockItems: 0,
      outOfStockItems: 0,
    };
  }

  const [rows] = await pool.execute(`
    SELECT
      COUNT(*) AS total_items,

      COALESCE(
        SUM(current_quantity),
        0
      ) AS total_balance,

      SUM(
        CASE
          WHEN current_quantity > 0
            AND reorder_level > 0
            AND current_quantity <=
                reorder_level
          THEN 1
          ELSE 0
        END
      ) AS low_stock_items,

      SUM(
        CASE
          WHEN current_quantity <= 0
          THEN 1
          ELSE 0
        END
      ) AS out_of_stock_items

    FROM inventory_items

    WHERE status = 'active'
  `);

  return {
    totalItems: numberValue(
      rows[0].total_items
    ),

    totalBalance: numberValue(
      rows[0].total_balance
    ),

    lowStockItems: numberValue(
      rows[0].low_stock_items
    ),

    outOfStockItems: numberValue(
      rows[0].out_of_stock_items
    ),
  };
}

async function getInventoryMovements() {
  const movementExists =
    await tableExists(
      'inventory_movements'
    );

  const itemExists =
    await tableExists(
      'inventory_items'
    );

  if (
    !movementExists ||
    !itemExists
  ) {
    return [];
  }

  const movementColumns =
    await getTableColumns(
      'inventory_movements'
    );

  const itemColumns =
    await getTableColumns(
      'inventory_items'
    );

  const itemForeignKey = pickColumn(
    movementColumns,
    [
      'inventory_item_id',
      'item_id',
    ]
  );

  const movementTypeColumn =
    pickColumn(
      movementColumns,
      [
        'movement_type',
        'transaction_type',
        'type',
      ]
    );

  const quantityColumn = pickColumn(
    movementColumns,
    [
      'quantity',
      'movement_quantity',
      'amount',
    ]
  );

  const balanceAfterColumn =
    pickColumn(
      movementColumns,
      [
        'balance_after',
        'current_balance_after',
        'remaining_balance',
      ]
    );

  const dateColumn = pickColumn(
    movementColumns,
    [
      'movement_date',
      'created_at',
      'date_created',
    ]
  );

  const notesColumn = pickColumn(
    movementColumns,
    [
      'notes',
      'remarks',
      'description',
    ]
  );

  const itemNameColumn = pickColumn(
    itemColumns,
    [
      'item_name',
      'name',
      'inventory_name',
    ]
  );

  const selectedFields = [
    'movement.id',
  ];

  if (movementTypeColumn) {
    selectedFields.push(
      `movement.${quoteIdentifier(
        movementTypeColumn
      )} AS movement_type`
    );
  }

  if (quantityColumn) {
    selectedFields.push(
      `movement.${quoteIdentifier(
        quantityColumn
      )} AS quantity`
    );
  }

  if (balanceAfterColumn) {
    selectedFields.push(
      `movement.${quoteIdentifier(
        balanceAfterColumn
      )} AS balance_after`
    );
  }

  if (dateColumn) {
    selectedFields.push(
      `movement.${quoteIdentifier(
        dateColumn
      )} AS movement_date`
    );
  }

  if (notesColumn) {
    selectedFields.push(
      `movement.${quoteIdentifier(
        notesColumn
      )} AS notes`
    );
  }

  let joinClause = '';
  let itemNameExpression =
    "'Inventory Item' AS item_name";

  if (
    itemForeignKey &&
    itemNameColumn
  ) {
    joinClause = `
      LEFT JOIN inventory_items item
        ON item.id =
           movement.${quoteIdentifier(
             itemForeignKey
           )}
    `;

    itemNameExpression = `
      item.${quoteIdentifier(
        itemNameColumn
      )} AS item_name
    `;
  }

  const orderColumn = dateColumn
    ? `movement.${quoteIdentifier(
        dateColumn
      )}`
    : 'movement.id';

  const [rows] = await pool.execute(`
    SELECT
      ${selectedFields.join(',\n')},
      ${itemNameExpression}

    FROM inventory_movements movement

    ${joinClause}

    ORDER BY ${orderColumn} DESC
    LIMIT 10
  `);

  return rows.map((row) => ({
    id: row.id,

    itemName:
      row.item_name ||
      'Inventory Item',

    movementType:
      row.movement_type ||
      'unspecified',

    quantity: numberValue(
      row.quantity
    ),

    balanceAfter:
      row.balance_after ===
        undefined ||
      row.balance_after === null
        ? null
        : Number(
            row.balance_after
          ),

    notes: row.notes || null,

    movementDate:
      row.movement_date || null,
  }));
}

async function getCdmSnapshot() {
  const [
    ordersExist,
    processingExists,
  ] = await Promise.all([
    tableExists('orders'),
    tableExists(
      'cdm_order_processing'
    ),
  ]);

  if (!ordersExist) {
    return {
      totalRecords: 0,
      pendingRecords: 0,
      completedRecords: 0,
      confirmedRecords: 0,
      rejectedRecords: 0,
      statusDistribution: [],
      recentRecords: [],
    };
  }

  const [summaryRows] =
    await pool.execute(`
      SELECT
        COUNT(*) AS total_records,

        SUM(
          CASE
            WHEN order_status =
              'for_confirmation'
            THEN 1
            ELSE 0
          END
        ) AS pending_records,

        SUM(
          CASE
            WHEN order_status IN (
              'confirmed',
              'rejected'
            )
            THEN 1
            ELSE 0
          END
        ) AS completed_records,

        SUM(
          CASE
            WHEN order_status =
              'confirmed'
            THEN 1
            ELSE 0
          END
        ) AS confirmed_records,

        SUM(
          CASE
            WHEN order_status =
              'rejected'
            THEN 1
            ELSE 0
          END
        ) AS rejected_records

      FROM orders

      WHERE order_status IN (
        'for_confirmation',
        'confirmed',
        'rejected'
      )
    `);

  const [statusRows] =
    await pool.execute(`
      SELECT
        CASE
          WHEN order_status =
            'for_confirmation'
          THEN 'pending'

          ELSE order_status
        END AS record_status,

        COUNT(*) AS total

      FROM orders

      WHERE order_status IN (
        'for_confirmation',
        'confirmed',
        'rejected'
      )

      GROUP BY
        CASE
          WHEN order_status =
            'for_confirmation'
          THEN 'pending'

          ELSE order_status
        END

      ORDER BY total DESC
    `);

  let recentRecords = [];

  if (processingExists) {
    const [recentRows] =
      await pool.execute(`
        SELECT
          orders.id,
          orders.order_number,

          customers.full_name
            AS customer_name,

          CASE
            WHEN orders.order_status =
              'for_confirmation'
            THEN 'pending'

            ELSE orders.order_status
          END AS record_status,

          cdm.waybill_number,

          COALESCE(
            cdm.sent_to_customer_at,
            cdm.confirmed_at,
            cdm.rejected_at,
            orders.submitted_at,
            orders.date_encoded
          ) AS record_date

        FROM orders

        INNER JOIN customers
          ON customers.id =
             orders.customer_id

        LEFT JOIN
          cdm_order_processing cdm
          ON cdm.order_id =
             orders.id

        WHERE orders.order_status IN (
          'for_confirmation',
          'confirmed',
          'rejected'
        )

        ORDER BY
          COALESCE(
            cdm.sent_to_customer_at,
            cdm.confirmed_at,
            cdm.rejected_at,
            orders.submitted_at,
            orders.date_encoded
          ) DESC

        LIMIT 10
      `);

    recentRecords =
      recentRows.map((row) => ({
        id: row.id,

        orderNumber:
          row.order_number,

        customerName:
          row.customer_name,

        status:
          row.record_status,

        waybillNumber:
          row.waybill_number ||
          null,

        recordDate:
          row.record_date ||
          null,
      }));
  }

  const summary = summaryRows[0];

  return {
    totalRecords: numberValue(
      summary.total_records
    ),

    pendingRecords: numberValue(
      summary.pending_records
    ),

    completedRecords: numberValue(
      summary.completed_records
    ),

    confirmedRecords: numberValue(
      summary.confirmed_records
    ),

    rejectedRecords: numberValue(
      summary.rejected_records
    ),

    statusDistribution:
      statusRows.map((row) => ({
        status:
          row.record_status,

        total: numberValue(
          row.total
        ),
      })),

    recentRecords,
  };
}

async function getSalesDashboard() {
  const [summaryRows] =
    await pool.execute(`
      SELECT
        COUNT(*) AS total_orders,

        SUM(
          CASE
            WHEN order_status =
              'draft'
            THEN 1
            ELSE 0
          END
        ) AS draft_orders,

        SUM(
          CASE
            WHEN order_status =
              'for_confirmation'
            THEN 1
            ELSE 0
          END
        ) AS for_confirmation,

        SUM(
          CASE
            WHEN order_status =
              'confirmed'
            THEN 1
            ELSE 0
          END
        ) AS confirmed_orders,

        SUM(
          CASE
            WHEN order_status =
              'rejected'
            THEN 1
            ELSE 0
          END
        ) AS rejected_orders,

        SUM(
          CASE
            WHEN order_status =
              'cancelled'
            THEN 1
            ELSE 0
          END
        ) AS cancelled_orders,

        SUM(
          CASE
            WHEN DATE(date_encoded) =
              CURRENT_DATE
            THEN 1
            ELSE 0
          END
        ) AS orders_today,

        COALESCE(
          SUM(
            CASE
              WHEN order_status =
                'confirmed'
              THEN total_amount
              ELSE 0
            END
          ),
          0
        ) AS confirmed_revenue

      FROM orders
    `);

  const [recentRows] =
    await pool.execute(`
      SELECT
        orders.id,
        orders.order_number,
        orders.total_amount,
        orders.order_status,
        orders.date_encoded,

        customers.full_name
          AS customer_name,

        users.full_name
          AS encoded_by_name

      FROM orders

      INNER JOIN customers
        ON customers.id =
           orders.customer_id

      LEFT JOIN users
        ON users.id =
           orders.encoded_by

      ORDER BY
        orders.date_encoded DESC

      LIMIT 10
    `);

  const summary = summaryRows[0];

  return {
    summary: {
      totalOrders: numberValue(
        summary.total_orders
      ),

      draftOrders: numberValue(
        summary.draft_orders
      ),

      forConfirmation:
        numberValue(
          summary.for_confirmation
        ),

      confirmedOrders:
        numberValue(
          summary.confirmed_orders
        ),

      rejectedOrders:
        numberValue(
          summary.rejected_orders
        ),

      cancelledOrders:
        numberValue(
          summary.cancelled_orders
        ),

      ordersToday: numberValue(
        summary.orders_today
      ),

      confirmedRevenue:
        numberValue(
          summary.confirmed_revenue
        ),
    },

    recent: recentRows.map(
      (row) => ({
        id: row.id,

        orderNumber:
          row.order_number,

        customerName:
          row.customer_name,

        encodedBy:
          row.encoded_by_name ||
          null,

        totalAmount:
          numberValue(
            row.total_amount
          ),

        status:
          row.order_status,

        dateEncoded:
          row.date_encoded,
      })
    ),
  };
}

function createMonthBuckets(
  monthCount = 6
) {
  const buckets = [];
  const now = new Date();

  for (
    let offset = monthCount - 1;
    offset >= 0;
    offset -= 1
  ) {
    const date = new Date(
      now.getFullYear(),
      now.getMonth() - offset,
      1
    );

    const year =
      date.getFullYear();

    const month = String(
      date.getMonth() + 1
    ).padStart(2, '0');

    buckets.push({
      key: `${year}-${month}`,

      label:
        date.toLocaleString(
          'en-US',
          {
            month: 'short',
          }
        ),

      orderCount: 0,
      salesValue: 0,
    });
  }

  return buckets;
}

async function getSalesAnalytics() {
  const ordersExists =
    await tableExists('orders');

  if (!ordersExists) {
    return {
      salesTrend:
        createMonthBuckets(6),

      orderStatusDistribution:
        [],

      topProducts: [],
    };
  }

  const orderColumns =
    await getTableColumns(
      'orders'
    );

  const statusColumn = pickColumn(
    orderColumns,
    [
      'order_status',
      'status',
    ]
  );

  const amountColumn = pickColumn(
    orderColumns,
    [
      'total_amount',
      'order_total',
      'total',
    ]
  );

  const confirmedDateColumn =
    pickColumn(
      orderColumns,
      ['confirmed_at']
    );

  const encodedDateColumn =
    pickColumn(
      orderColumns,
      [
        'date_encoded',
        'created_at',
      ]
    );

  let orderStatusDistribution =
    [];

  if (statusColumn) {
    const statusIdentifier =
      quoteIdentifier(
        statusColumn
      );

    const [statusRows] =
      await pool.execute(`
        SELECT
          ${statusIdentifier}
            AS order_status,

          COUNT(*) AS total

        FROM orders

        GROUP BY
          ${statusIdentifier}

        ORDER BY total DESC
      `);

    orderStatusDistribution =
      statusRows.map((row) => ({
        status:
          row.order_status ||
          'unspecified',

        total: numberValue(
          row.total
        ),
      }));
  }

  const salesTrend =
    createMonthBuckets(6);

  let dateExpression = null;

  if (
    confirmedDateColumn &&
    encodedDateColumn
  ) {
    dateExpression = `
      COALESCE(
        orders.${quoteIdentifier(
          confirmedDateColumn
        )},
        orders.${quoteIdentifier(
          encodedDateColumn
        )}
      )
    `;
  } else if (
    confirmedDateColumn
  ) {
    dateExpression = `
      orders.${quoteIdentifier(
        confirmedDateColumn
      )}
    `;
  } else if (
    encodedDateColumn
  ) {
    dateExpression = `
      orders.${quoteIdentifier(
        encodedDateColumn
      )}
    `;
  }

  if (
    statusColumn &&
    amountColumn &&
    dateExpression
  ) {
    const statusIdentifier = `
      orders.${quoteIdentifier(
        statusColumn
      )}
    `;

    const amountIdentifier = `
      orders.${quoteIdentifier(
        amountColumn
      )}
    `;

    const firstMonthDate =
      `${salesTrend[0].key}-01`;

    const [trendRows] =
      await pool.execute(
        `
          SELECT
            DATE_FORMAT(
              ${dateExpression},
              '%Y-%m'
            ) AS month_key,

            COUNT(*) AS order_count,

            COALESCE(
              SUM(
                ${amountIdentifier}
              ),
              0
            ) AS sales_value

          FROM orders

          WHERE
            ${statusIdentifier} =
              'confirmed'

            AND ${dateExpression} >= ?

          GROUP BY month_key

          ORDER BY month_key ASC
        `,
        [firstMonthDate]
      );

    const trendMap = new Map(
      trendRows.map((row) => [
        row.month_key,
        {
          orderCount:
            numberValue(
              row.order_count
            ),

          salesValue:
            numberValue(
              row.sales_value
            ),
        },
      ])
    );

    salesTrend.forEach(
      (bucket) => {
        const matchingValue =
          trendMap.get(bucket.key);

        if (matchingValue) {
          bucket.orderCount =
            matchingValue.orderCount;

          bucket.salesValue =
            matchingValue.salesValue;
        }
      }
    );
  }

  let topProducts = [];

  const [
    orderItemsExists,
    productsExists,
  ] = await Promise.all([
    tableExists('order_items'),
    tableExists('products'),
  ]);

  if (
    orderItemsExists &&
    productsExists &&
    statusColumn
  ) {
    const [
      orderItemColumns,
      productColumns,
    ] = await Promise.all([
      getTableColumns(
        'order_items'
      ),

      getTableColumns(
        'products'
      ),
    ]);

    const orderIdColumn =
      pickColumn(
        orderItemColumns,
        ['order_id']
      );

    const productIdColumn =
      pickColumn(
        orderItemColumns,
        ['product_id']
      );

    const quantityColumn =
      pickColumn(
        orderItemColumns,
        [
          'quantity',
          'units',
        ]
      );

    const lineTotalColumn =
      pickColumn(
        orderItemColumns,
        [
          'line_total',
          'subtotal',
          'total_amount',
        ]
      );

    const unitPriceColumn =
      pickColumn(
        orderItemColumns,
        [
          'unit_price',
          'price',
        ]
      );

    const productNameColumn =
      pickColumn(
        productColumns,
        [
          'product_name',
          'name',
          'product_title',
        ]
      );

    if (
      orderIdColumn &&
      productIdColumn &&
      quantityColumn &&
      productNameColumn
    ) {
      const quantityExpression = `
        order_items.${quoteIdentifier(
          quantityColumn
        )}
      `;

      let salesValueExpression =
        '0';

      if (lineTotalColumn) {
        salesValueExpression = `
          COALESCE(
            SUM(
              order_items.${quoteIdentifier(
                lineTotalColumn
              )}
            ),
            0
          )
        `;
      } else if (
        unitPriceColumn
      ) {
        salesValueExpression = `
          COALESCE(
            SUM(
              ${quantityExpression}
              *
              order_items.${quoteIdentifier(
                unitPriceColumn
              )}
            ),
            0
          )
        `;
      }

      const [productRows] =
        await pool.execute(`
          SELECT
            products.id,

            products.${quoteIdentifier(
              productNameColumn
            )} AS product_name,

            COALESCE(
              SUM(
                ${quantityExpression}
              ),
              0
            ) AS units_sold,

            ${salesValueExpression}
              AS sales_value

          FROM order_items

          INNER JOIN orders
            ON orders.id =
               order_items.${quoteIdentifier(
                 orderIdColumn
               )}

          INNER JOIN products
            ON products.id =
               order_items.${quoteIdentifier(
                 productIdColumn
               )}

          WHERE
            orders.${quoteIdentifier(
              statusColumn
            )} = 'confirmed'

          GROUP BY
            products.id,
            products.${quoteIdentifier(
              productNameColumn
            )}

          ORDER BY
            units_sold DESC,
            sales_value DESC

          LIMIT 5
        `);

      topProducts =
        productRows.map(
          (row) => ({
            id: row.id,

            productName:
              row.product_name ||
              'Unnamed Product',

            unitsSold:
              numberValue(
                row.units_sold
              ),

            salesValue:
              numberValue(
                row.sales_value
              ),
          })
        );
    }
  }

  return {
    salesTrend,
    orderStatusDistribution,
    topProducts,
  };
}

async function getFulfillmentDashboard() {
  const exists = await tableExists(
    'fulfillment_orders'
  );

  if (!exists) {
    return {
      summary: {
        totalRecords: 0,
        pendingPacking: 0,
        packing: 0,
        packed: 0,
        readyForShipment: 0,
        shippedOut: 0,
        delivered: 0,
        returned: 0,
        cancelled: 0,
      },

      recent: [],
    };
  }

  const [summaryRows] =
    await pool.execute(`
      SELECT
        COUNT(*) AS total_records,

        SUM(
          CASE
            WHEN fulfillment_status =
              'pending_packing'
            THEN 1
            ELSE 0
          END
        ) AS pending_packing,

        SUM(
          CASE
            WHEN fulfillment_status =
              'packing'
            THEN 1
            ELSE 0
          END
        ) AS packing,

        SUM(
          CASE
            WHEN fulfillment_status =
              'packed'
            THEN 1
            ELSE 0
          END
        ) AS packed,

        SUM(
          CASE
            WHEN fulfillment_status =
              'ready_for_shipment'
            THEN 1
            ELSE 0
          END
        ) AS ready_for_shipment,

        SUM(
          CASE
            WHEN fulfillment_status =
              'shipped_out'
            THEN 1
            ELSE 0
          END
        ) AS shipped_out,

        SUM(
          CASE
            WHEN fulfillment_status =
              'delivered'
            THEN 1
            ELSE 0
          END
        ) AS delivered,

        SUM(
          CASE
            WHEN fulfillment_status =
              'returned_to_sender'
            THEN 1
            ELSE 0
          END
        ) AS returned,

        SUM(
          CASE
            WHEN fulfillment_status =
              'cancelled'
            THEN 1
            ELSE 0
          END
        ) AS cancelled

      FROM fulfillment_orders
    `);

  const [recentRows] =
    await pool.execute(`
      SELECT
        fulfillment.id,
        fulfillment.fulfillment_status,
        fulfillment.third_party_logistics,
        fulfillment.tracking_number,
        fulfillment.delivered_at,
        fulfillment.returned_at,
        fulfillment.updated_at,

        orders.order_number,

        customers.full_name
          AS customer_name,

        users.full_name
          AS handled_by_name

      FROM fulfillment_orders
        fulfillment

      INNER JOIN orders
        ON orders.id =
           fulfillment.order_id

      INNER JOIN customers
        ON customers.id =
           orders.customer_id

      LEFT JOIN users
        ON users.id =
           fulfillment.handled_by

      ORDER BY
        fulfillment.updated_at DESC

      LIMIT 10
    `);

  const summary = summaryRows[0];

  return {
    summary: {
      totalRecords: numberValue(
        summary.total_records
      ),

      pendingPacking:
        numberValue(
          summary.pending_packing
        ),

      packing: numberValue(
        summary.packing
      ),

      packed: numberValue(
        summary.packed
      ),

      readyForShipment:
        numberValue(
          summary.ready_for_shipment
        ),

      shippedOut: numberValue(
        summary.shipped_out
      ),

      delivered: numberValue(
        summary.delivered
      ),

      returned: numberValue(
        summary.returned
      ),

      cancelled: numberValue(
        summary.cancelled
      ),
    },

    recent: recentRows.map(
      (row) => ({
        id: row.id,

        orderNumber:
          row.order_number,

        customerName:
          row.customer_name,

        status:
          row.fulfillment_status,

        courier:
          row.third_party_logistics ||
          null,

        trackingNumber:
          row.tracking_number ||
          null,

        handledBy:
          row.handled_by_name ||
          null,

        deliveredAt:
          row.delivered_at,

        returnedAt:
          row.returned_at,

        updatedAt:
          row.updated_at,
      })
    ),
  };
}

async function getCrmDashboard(
  userId = null
) {
  const userCondition = userId
    ? 'WHERE cc.handled_by = ?'
    : '';

  const values = userId
    ? [userId]
    : [];

  const [summaryRows] =
    await pool.execute(
      `
        SELECT
          COUNT(*) AS total_cases,

          SUM(
            CASE
              WHEN cc.handled_by IS NULL
              THEN 1
              ELSE 0
            END
          ) AS unassigned,

          SUM(
            CASE
              WHEN cc.case_status IN (
                'pending_follow_up',
                'assigned',
                'in_progress',
                'awaiting_customer'
              )
              THEN 1
              ELSE 0
            END
          ) AS open_cases,

          SUM(
            CASE
              WHEN cc.case_status =
                'resolved'
              THEN 1
              ELSE 0
            END
          ) AS resolved,

          SUM(
            CASE
              WHEN cc.case_status =
                'closed'
              THEN 1
              ELSE 0
            END
          ) AS closed,

          SUM(
            CASE
              WHEN cc.next_follow_up_at
                    IS NOT NULL

                AND cc.next_follow_up_at <=
                    NOW()

                AND cc.case_status NOT IN (
                  'resolved',
                  'closed'
                )
              THEN 1
              ELSE 0
            END
          ) AS overdue_cases,

          ROUND(
            AVG(
              feedback.satisfaction_rating
            ),
            2
          ) AS average_rating

        FROM crm_cases cc

        LEFT JOIN crm_feedback feedback
          ON feedback.crm_case_id =
             cc.id

        ${userCondition}
      `,
      values
    );

  const [recentRows] =
    await pool.execute(
      `
        SELECT
          cc.id,
          cc.case_status,
          cc.current_step,
          cc.concern_category,
          cc.next_follow_up_at,
          cc.updated_at,

          orders.order_number,

          customers.full_name
            AS customer_name,

          handler.full_name
            AS assigned_user_name,

          feedback.satisfaction_rating

        FROM crm_cases cc

        INNER JOIN orders
          ON orders.id =
             cc.order_id

        INNER JOIN customers
          ON customers.id =
             orders.customer_id

        LEFT JOIN users handler
          ON handler.id =
             cc.handled_by

        LEFT JOIN crm_feedback feedback
          ON feedback.crm_case_id =
             cc.id

        ${userCondition}

        ORDER BY
          cc.updated_at DESC

        LIMIT 10
      `,
      values
    );

  const summary = summaryRows[0];

  return {
    summary: {
      totalCases: numberValue(
        summary.total_cases
      ),

      unassigned: numberValue(
        summary.unassigned
      ),

      openCases: numberValue(
        summary.open_cases
      ),

      resolved: numberValue(
        summary.resolved
      ),

      closed: numberValue(
        summary.closed
      ),

      overdueCases:
        numberValue(
          summary.overdue_cases
        ),

      averageRating:
        summary.average_rating ===
          null
          ? null
          : Number(
              summary.average_rating
            ),
    },

    recent: recentRows.map(
      (row) => ({
        id: row.id,

        orderNumber:
          row.order_number,

        customerName:
          row.customer_name,

        assignedUser:
          row.assigned_user_name ||
          null,

        status:
          row.case_status,

        currentStep:
          numberValue(
            row.current_step
          ),

        concernCategory:
          row.concern_category,

        nextFollowUpAt:
          row.next_follow_up_at,

        satisfactionRating:
          row.satisfaction_rating ===
            null
            ? null
            : Number(
                row.satisfaction_rating
              ),

        updatedAt:
          row.updated_at,
      })
    ),
  };
}

async function getMarketingDashboard(
  userId = null
) {
  const userCondition = userId
    ? 'WHERE assigned_to = ?'
    : '';

  const values = userId
    ? [userId]
    : [];

  const [summaryRows] =
    await pool.execute(
      `
        SELECT
          COUNT(*) AS total_tasks,

          SUM(
            CASE
              WHEN task_status =
                'pending'
              THEN 1
              ELSE 0
            END
          ) AS pending,

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
              WHEN task_status =
                'cancelled'
              THEN 1
              ELSE 0
            END
          ) AS cancelled,

          SUM(
            CASE
              WHEN due_date < NOW()
                AND task_status NOT IN (
                  'completed',
                  'cancelled'
                )
              THEN 1
              ELSE 0
            END
          ) AS overdue

        FROM marketing_tasks

        ${userCondition}
      `,
      values
    );

  const [recentRows] =
    await pool.execute(
      `
        SELECT
          tasks.id,
          tasks.task_title,
          tasks.content_type,
          tasks.priority,
          tasks.due_date,
          tasks.task_status,
          tasks.updated_at,

          campaigns.campaign_name,

          assigned.full_name
            AS assigned_user_name

        FROM marketing_tasks tasks

        LEFT JOIN marketing_campaigns
          campaigns

          ON campaigns.id =
             tasks.campaign_id

        LEFT JOIN users assigned
          ON assigned.id =
             tasks.assigned_to

        ${
          userId
            ? 'WHERE tasks.assigned_to = ?'
            : ''
        }

        ORDER BY
          tasks.updated_at DESC

        LIMIT 10
      `,
      values
    );

  const summary = summaryRows[0];

  return {
    summary: {
      totalTasks: numberValue(
        summary.total_tasks
      ),

      pending: numberValue(
        summary.pending
      ),

      assigned: numberValue(
        summary.assigned
      ),

      inProgress: numberValue(
        summary.in_progress
      ),

      submitted: numberValue(
        summary.submitted
      ),

      forRevision: numberValue(
        summary.for_revision
      ),

      approved: numberValue(
        summary.approved
      ),

      completed: numberValue(
        summary.completed
      ),

      cancelled: numberValue(
        summary.cancelled
      ),

      overdue: numberValue(
        summary.overdue
      ),
    },

    recent: recentRows.map(
      (row) => ({
        id: row.id,

        taskTitle:
          row.task_title,

        campaignName:
          row.campaign_name ||
          null,

        contentType:
          row.content_type,

        priority:
          row.priority,

        status:
          row.task_status,

        assignedUser:
          row.assigned_user_name ||
          null,

        dueDate:
          row.due_date,

        updatedAt:
          row.updated_at,
      })
    ),
  };
}

async function getSystemConfigurationDashboard() {
  const [summaryRows] =
    await pool.execute(`
      SELECT
        COUNT(*) AS total_users,

        SUM(
          CASE
            WHEN status = 'active'
            THEN 1
            ELSE 0
          END
        ) AS active_users,

        SUM(
          CASE
            WHEN status <> 'active'
            THEN 1
            ELSE 0
          END
        ) AS inactive_users,

        SUM(
          CASE
            WHEN role = 'head'
            THEN 1
            ELSE 0
          END
        ) AS head_users,

        SUM(
          CASE
            WHEN role = 'specialist'
            THEN 1
            ELSE 0
          END
        ) AS specialist_users,

        SUM(
          CASE
            WHEN DATE(created_at) =
              CURRENT_DATE
            THEN 1
            ELSE 0
          END
        ) AS created_today

      FROM users
    `);

  const [departmentRows] =
    await pool.execute(`
      SELECT
        departments.code,
        departments.name,

        COUNT(users.id)
          AS user_count

      FROM departments

      LEFT JOIN users
        ON users.department_id =
           departments.id

        AND users.status =
          'active'

      GROUP BY
        departments.id,
        departments.code,
        departments.name

      ORDER BY
        departments.name ASC
    `);

  const [recentRows] =
    await pool.execute(`
      SELECT
        users.id,
        users.full_name,
        users.email,
        users.role,
        users.status,
        users.created_at,

        departments.name
          AS department_name,

        departments.code
          AS department_code

      FROM users

      LEFT JOIN departments
        ON departments.id =
           users.department_id

      ORDER BY
        users.created_at DESC

      LIMIT 10
    `);

  const summary = summaryRows[0];

  return {
    summary: {
      totalUsers: numberValue(
        summary.total_users
      ),

      activeUsers: numberValue(
        summary.active_users
      ),

      inactiveUsers:
        numberValue(
          summary.inactive_users
        ),

      headUsers: numberValue(
        summary.head_users
      ),

      specialistUsers:
        numberValue(
          summary.specialist_users
        ),

      createdToday:
        numberValue(
          summary.created_today
        ),
    },

    departmentDistribution:
      departmentRows.map(
        (row) => ({
          departmentCode:
            row.code,

          departmentName:
            row.name,

          userCount:
            numberValue(
              row.user_count
            ),
        })
      ),

    recentUsers: recentRows.map(
      (row) => ({
        id: row.id,

        fullName:
          row.full_name,

        email: row.email,

        role: row.role,

        status: row.status,

        departmentName:
          row.department_name ||
          null,

        departmentCode:
          row.department_code ||
          null,

        createdAt:
          row.created_at,
      })
    ),
  };
}

async function getHeadDashboard() {
  const [
    sales,
    salesAnalytics,
    cdm,
    inventory,
    inventoryMovements,
    fulfillment,
    crm,
    marketing,
  ] = await Promise.all([
    getSalesDashboard(),
    getSalesAnalytics(),
    getCdmSnapshot(),
    getInventorySnapshot(),
    getInventoryMovements(),
    getFulfillmentDashboard(),
    getCrmDashboard(),
    getMarketingDashboard(),
  ]);

  const healthyStockItems =
    Math.max(
      inventory.totalItems -
        inventory.lowStockItems -
        inventory.outOfStockItems,
      0
    );

  return {
    view: 'head',

    summary: {
      sales:
        sales.summary,

      cdm: {
        totalRecords:
          cdm.totalRecords,

        pendingRecords:
          cdm.pendingRecords,

        completedRecords:
          cdm.completedRecords,
      },

      inventory,

      fulfillment:
        fulfillment.summary,

      crm:
        crm.summary,

      marketing:
        marketing.summary,
    },

    analytics: {
      salesTrend:
        salesAnalytics.salesTrend,

      orderStatusDistribution:
        salesAnalytics
          .orderStatusDistribution,

      topProducts:
        salesAnalytics.topProducts,

      operationalWorkflow: [
        {
          key: 'confirmed_sales',
          label:
            'Confirmed Sales Orders',

          value:
            sales.summary
              .confirmedOrders,
        },
        {
          key: 'completed_cdm',
          label:
            'Confirmed CDM Orders',

          value:
            cdm.confirmedRecords,
        },
        {
          key:
            'fulfillment_records',

          label:
            'Fulfillment Records',

          value:
            fulfillment.summary
              .totalRecords,
        },
        {
          key: 'delivered_orders',
          label:
            'Delivered Orders',

          value:
            fulfillment.summary
              .delivered,
        },
        {
          key: 'closed_crm',
          label:
            'Closed CRM Cases',

          value:
            crm.summary.closed,
        },
      ],

      cdmStatus:
        cdm.statusDistribution,

      inventoryHealth: [
        {
          status: 'healthy',
          label:
            'Healthy Stock',

          total:
            healthyStockItems,
        },
        {
          status: 'low_stock',
          label:
            'Low Stock',

          total:
            inventory.lowStockItems,
        },
        {
          status: 'out_of_stock',
          label:
            'Out of Stock',

          total:
            inventory.outOfStockItems,
        },
      ],

      fulfillmentStatus: [
  {
    status:
      'pending_packing',

    label:
      'Pending Packing',

    total:
      fulfillment.summary
        .pendingPacking,
  },
  {
    status: 'packing',
    label: 'Packing',

    total:
      fulfillment.summary
        .packing,
  },
  {
    status: 'packed',
    label: 'Packed',

    total:
      fulfillment.summary
        .packed,
  },
  {
    status:
      'ready_for_shipment',

    label:
      'Ready for Shipment',

    total:
      fulfillment.summary
        .readyForShipment,
  },
  {
    status: 'shipped_out',
    label: 'Shipped Out',

    total:
      fulfillment.summary
        .shippedOut,
  },
  {
    status: 'delivered',
    label: 'Delivered',

    total:
      fulfillment.summary
        .delivered,
  },
  {
    status:
      'returned_to_sender',

    label: 'Returned',

    total:
      fulfillment.summary
        .returned,
  },
  {
    status: 'cancelled',
    label: 'Cancelled',

    total:
      fulfillment.summary
        .cancelled,
  },
],

      crmStatus: [
        {
          status: 'open',
          label: 'Open',

          total:
            crm.summary.openCases,
        },
        {
          status: 'unassigned',
          label: 'Unassigned',

          total:
            crm.summary.unassigned,
        },
        {
          status: 'overdue',
          label:
            'Overdue Follow-ups',

          total:
            crm.summary.overdueCases,
        },
        {
          status: 'resolved',
          label: 'Resolved',

          total:
            crm.summary.resolved,
        },
        {
          status: 'closed',
          label: 'Closed',

          total:
            crm.summary.closed,
        },
      ],

      marketingStatus: [
        {
          status: 'pending',
          label: 'Pending',

          total:
            marketing.summary
              .pending,
        },
        {
          status: 'assigned',
          label: 'Assigned',

          total:
            marketing.summary
              .assigned,
        },
        {
          status: 'in_progress',
          label: 'In Progress',

          total:
            marketing.summary
              .inProgress,
        },
        {
          status: 'submitted',
          label: 'For Review',

          total:
            marketing.summary
              .submitted,
        },
        {
          status: 'for_revision',
          label: 'For Revision',

          total:
            marketing.summary
              .forRevision,
        },
        {
          status: 'approved',
          label: 'Approved',

          total:
            marketing.summary
              .approved,
        },
        {
          status: 'completed',
          label: 'Completed',

          total:
            marketing.summary
              .completed,
        },
        {
          status: 'overdue',
          label: 'Overdue',

          total:
            marketing.summary
              .overdue,
        },
        {
          status: 'cancelled',
          label: 'Cancelled',

          total:
            marketing.summary
              .cancelled,
        },
      ],
    },

    attention: {
      ordersForConfirmation:
        sales.summary
          .forConfirmation,

      pendingCdmRecords:
        cdm.pendingRecords,

      lowStockItems:
        inventory.lowStockItems,

      outOfStockItems:
        inventory
          .outOfStockItems,

      pendingPacking:
        fulfillment.summary
          .pendingPacking,

      returnedOrders:
        fulfillment.summary
          .returned,

      unassignedCrmCases:
        crm.summary.unassigned,

      overdueCrmCases:
        crm.summary
          .overdueCases,

      submittedMarketingTasks:
        marketing.summary
          .submitted,

      revisionMarketingTasks:
        marketing.summary
          .forRevision,

      overdueMarketingTasks:
        marketing.summary
          .overdue,
    },

    recent: {
      orders:
        sales.recent,

      cdm:
        cdm.recentRecords,

      inventoryMovements,

      fulfillment:
        fulfillment.recent,

      crm:
        crm.recent,

      marketing:
        marketing.recent,
    },
  };
}

async function getSpecialistDashboard(
  req
) {
  const departmentCode =
    getDepartmentCode(req.user);

  if (departmentCode === 'sales') {
    const sales =
      await getSalesDashboard();

    return {
      view: 'specialist',
      departmentCode,
      departmentName:
        'Sales and Order Management',
      ...sales,
    };
  }

  if (departmentCode === 'cdm') {
    const cdm =
      await getCdmSnapshot();

    return {
      view: 'specialist',
      departmentCode,
      departmentName:
        'Customer Data Management',

      summary: {
        totalRecords:
          cdm.totalRecords,

        pendingRecords:
          cdm.pendingRecords,

        completedRecords:
          cdm.completedRecords,
      },

      statusDistribution:
        cdm.statusDistribution,

      recent:
        cdm.recentRecords,
    };
  }

  if (
    departmentCode ===
    'supply_chain'
  ) {
    const [
      inventory,
      recent,
    ] = await Promise.all([
      getInventorySnapshot(),
      getInventoryMovements(),
    ]);

    return {
      view: 'specialist',
      departmentCode,
      departmentName:
        'Inventory and Supply Chain Management',

      summary: inventory,

      recent,
    };
  }

  if (
    departmentCode ===
    'fulfillment'
  ) {
    const fulfillment =
      await getFulfillmentDashboard();

    return {
      view: 'specialist',
      departmentCode,
      departmentName:
        'Logistics and Fulfillment Management',

      ...fulfillment,
    };
  }

  if (departmentCode === 'crm') {
    const crm =
      await getCrmDashboard(
        req.user.id
      );

    return {
      view: 'specialist',
      departmentCode,
      departmentName:
        'Customer Relationship Management',

      ...crm,
    };
  }

  if (
    departmentCode ===
    'marketing'
  ) {
    const marketing =
      await getMarketingDashboard(
        req.user.id
      );

    return {
      view: 'specialist',
      departmentCode,
      departmentName:
        'Marketing and Workflow Management',

      ...marketing,
    };
  }

  return {
    view: 'specialist',
    departmentCode,

    departmentName:
      'Assigned Department',

    summary: {},

    recent: [],
  };
}

// GET /api/dashboard
exports.getDashboard = async (
  req,
  res
) => {
  try {
    const role = normalizeRole(
      req.user?.role
    );

    let dashboard;

    if (role === 'head') {
      dashboard =
        await getHeadDashboard();
    } else if (
      role === 'specialist'
    ) {
      dashboard =
        await getSpecialistDashboard(
          req
        );
    } else if (
      role ===
      'system_configuration'
    ) {
      dashboard = {
        view:
          'system_configuration',

        ...(await getSystemConfigurationDashboard()),
      };
    } else {
      return res.status(403).json({
        success: false,

        message:
          'You do not have access to the dashboard.',
      });
    }

    dashboard = {
      ...dashboard,
      tasks: await getMyTasks(
        req.user
      ),
    };

    return res.json({
      success: true,
      generatedAt: new Date(),
      dashboard,
    });
  } catch (error) {
    console.error(
      'Get Dashboard error:',
      error
    );

    return res.status(500).json({
      success: false,

      message:
        'Unable to retrieve the dashboard information.',
    });
  }
};
