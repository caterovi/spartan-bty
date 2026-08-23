const pool = require('../config/db');

function cleanText(value) {
  return String(value || '').trim();
}

function isValidDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }

  const [year, month, day] = value
    .split('-')
    .map(Number);

  const date = new Date(
    year,
    month - 1,
    day
  );

  return (
    date.getFullYear() === year &&
    date.getMonth() === month - 1 &&
    date.getDate() === day
  );
}

function formatDateValue(date) {
  const year = date.getFullYear();

  const month = String(
    date.getMonth() + 1
  ).padStart(2, '0');

  const day = String(
    date.getDate()
  ).padStart(2, '0');

  return `${year}-${month}-${day}`;
}

function getDefaultDateRange() {
  const now = new Date();

  const startDate = new Date(
    now.getFullYear(),
    now.getMonth(),
    1
  );

  return {
    startDate:
      formatDateValue(startDate),

    endDate:
      formatDateValue(now),
  };
}

function getDateRange(req) {
  const defaults =
    getDefaultDateRange();

  const startDate =
    cleanText(req.query.startDate) ||
    defaults.startDate;

  const endDate =
    cleanText(req.query.endDate) ||
    defaults.endDate;

  if (
    !isValidDate(startDate) ||
    !isValidDate(endDate)
  ) {
    return {
      valid: false,
      message:
        'Dates must use the YYYY-MM-DD format.',
    };
  }

  if (endDate < startDate) {
    return {
      valid: false,
      message:
        'End date cannot be earlier than the start date.',
    };
  }

  return {
    valid: true,
    startDate,
    endDate,
  };
}

function getDateParameters(range) {
  return [
    range.startDate,
    range.endDate,
  ];
}

function quoteIdentifier(value) {
  if (
    !/^[A-Za-z0-9_]+$/.test(value)
  ) {
    throw new Error(
      `Unsafe SQL identifier: ${value}`
    );
  }

  return `\`${value}\``;
}

async function tableExists(
  tableName
) {
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

async function getTableColumns(
  tableName
) {
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

function numberValue(value) {
  return Number(value || 0);
}

async function getInventorySnapshot() {
  const inventoryExists =
    await tableExists(
      'inventory_items'
    );

  if (!inventoryExists) {
    return {
      totalItems: 0,
      totalBalance: 0,
      lowStockItems: 0,
      outOfStockItems: 0,
    };
  }

  const columns =
    await getTableColumns(
      'inventory_items'
    );

  const balanceColumn =
    pickColumn(columns, [
      'current_quantity',
      'current_balance',
      'current_stock',
      'stock_quantity',
      'quantity',
      'balance',
    ]);

  const statusColumn =
    pickColumn(columns, [
      'status',
    ]);

  const activeItemsWhere =
    statusColumn
      ? `WHERE ${quoteIdentifier(
          statusColumn
        )} = 'active'`
      : '';

  const thresholdColumn =
    pickColumn(columns, [
      'low_stock_threshold',
      'reorder_level',
      'minimum_stock',
      'minimum_level',
    ]);

  if (!balanceColumn) {
    const [rows] =
      await pool.execute(`
        SELECT COUNT(*) AS total_items
        FROM inventory_items
        ${activeItemsWhere}
      `);

    return {
      totalItems: numberValue(
        rows[0].total_items
      ),

      totalBalance: 0,
      lowStockItems: 0,
      outOfStockItems: 0,
    };
  }

  const balanceIdentifier =
    quoteIdentifier(
      balanceColumn
    );

  const lowStockExpression =
    thresholdColumn
      ? `
        SUM(
          CASE
            WHEN ${balanceIdentifier} > 0
              AND ${balanceIdentifier} <=
                ${quoteIdentifier(
                  thresholdColumn
                )}
            THEN 1
            ELSE 0
          END
        )
      `
      : '0';

  const [rows] =
    await pool.execute(`
      SELECT
        COUNT(*) AS total_items,

        COALESCE(
          SUM(${balanceIdentifier}),
          0
        ) AS total_balance,

        ${lowStockExpression}
          AS low_stock_items,

        SUM(
          CASE
            WHEN ${balanceIdentifier} <= 0
            THEN 1
            ELSE 0
          END
        ) AS out_of_stock_items

      FROM inventory_items

      ${activeItemsWhere}
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

// GET /api/reports/overview
exports.getOverview = async (
  req,
  res
) => {
  try {
    const range = getDateRange(req);

    if (!range.valid) {
      return res.status(400).json({
        success: false,
        message: range.message,
      });
    }

    const dateValues =
      getDateParameters(range);

    const [
      salesRows,
      fulfillmentRows,
      crmRows,
      crmFeedbackRows,
      marketingRows,
      cdmRows,
      inventory,
    ] = await Promise.all([
      pool.execute(
        `
          SELECT
            (
              SELECT COUNT(*)
              FROM orders
              WHERE date_encoded >= ?
                AND date_encoded <
                  DATE_ADD(
                    ?,
                    INTERVAL 1 DAY
                  )
            ) AS total_orders,

            (
              SELECT COUNT(*)
              FROM orders
              WHERE order_status =
                    'confirmed'
                AND confirmed_at >= ?
                AND confirmed_at <
                  DATE_ADD(
                    ?,
                    INTERVAL 1 DAY
                  )
            ) AS confirmed_orders,

            (
              SELECT COALESCE(
                SUM(total_amount),
                0
              )
              FROM orders
              WHERE order_status =
                    'confirmed'
                AND confirmed_at >= ?
                AND confirmed_at <
                  DATE_ADD(
                    ?,
                    INTERVAL 1 DAY
                  )
            ) AS confirmed_revenue
        `,
        [
          ...dateValues,
          ...dateValues,
          ...dateValues,
        ]
      ),

      pool.execute(
        `
          SELECT
            COUNT(*) AS total_records,

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
            ) AS returned

          FROM fulfillment_orders

          WHERE created_at >= ?
            AND created_at <
              DATE_ADD(
                ?,
                INTERVAL 1 DAY
              )
        `,
        dateValues
      ),

      pool.execute(
        `
          SELECT
            COUNT(*) AS total_cases,

            SUM(
              CASE
                WHEN case_status =
                  'closed'
                THEN 1
                ELSE 0
              END
            ) AS closed_cases

          FROM crm_cases cc

          WHERE cc.created_at >= ?
            AND cc.created_at <
              DATE_ADD(
                ?,
                INTERVAL 1 DAY
              )
        `,
        dateValues
      ),

      pool.execute(
        `
          SELECT
            ROUND(
              AVG(satisfaction_rating),
              2
            ) AS average_rating

          FROM crm_feedback

          WHERE submitted_at >= ?
            AND submitted_at <
              DATE_ADD(
                ?,
                INTERVAL 1 DAY
              )
        `,
        dateValues
      ),

      pool.execute(
        `
          SELECT
            COUNT(*) AS total_tasks,

            SUM(
              CASE
                WHEN task_status =
                  'completed'
                THEN 1
                ELSE 0
              END
            ) AS completed_tasks,

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
            ) AS overdue_tasks

          FROM marketing_tasks

          WHERE created_at >= ?
            AND created_at <
              DATE_ADD(
                ?,
                INTERVAL 1 DAY
              )
        `,
        dateValues
      ),

      pool.execute(
        `
          SELECT COUNT(*) AS total_records

          FROM orders

          WHERE order_status IN (
            'for_confirmation',
            'confirmed',
            'rejected'
          )

            AND COALESCE(
              submitted_at,
              date_encoded
            ) >= ?

            AND COALESCE(
              submitted_at,
              date_encoded
            ) <
              DATE_ADD(
                ?,
                INTERVAL 1 DAY
              )
        `,
        dateValues
      ),

      getInventorySnapshot(),
    ]);

    const sales = salesRows[0][0];
    const fulfillment =
      fulfillmentRows[0][0];
    const crm = crmRows[0][0];
    const crmFeedback =
      crmFeedbackRows[0][0];
    const marketing =
      marketingRows[0][0];
    const cdm = cdmRows[0][0];

    return res.json({
      success: true,

      dateRange: {
        startDate: range.startDate,
        endDate: range.endDate,
      },

      overview: {
        sales: {
          totalOrders: numberValue(
            sales.total_orders
          ),

          confirmedOrders:
            numberValue(
              sales.confirmed_orders
            ),

          confirmedRevenue:
            numberValue(
              sales.confirmed_revenue
            ),
        },

        cdm: {
          totalRecords: numberValue(
            cdm.total_records
          ),
        },

        inventory,

        fulfillment: {
          totalRecords: numberValue(
            fulfillment.total_records
          ),

          delivered: numberValue(
            fulfillment.delivered
          ),

          returned: numberValue(
            fulfillment.returned
          ),
        },

        crm: {
          totalCases: numberValue(
            crm.total_cases
          ),

          closedCases: numberValue(
            crm.closed_cases
          ),

          averageRating:
            crmFeedback.average_rating ===
              null
              ? null
              : Number(
                  crmFeedback.average_rating
                ),
        },

        marketing: {
          totalTasks: numberValue(
            marketing.total_tasks
          ),

          completedTasks:
            numberValue(
              marketing.completed_tasks
            ),

          overdueTasks: numberValue(
            marketing.overdue_tasks
          ),
        },
      },
    });
  } catch (error) {
    console.error(
      'Get reports overview error:',
      error
    );

    return res.status(500).json({
      success: false,
      message:
        'Unable to retrieve the management overview.',
    });
  }
};

// GET /api/reports/sales
exports.getSalesReport = async (
  req,
  res
) => {
  try {
    const range = getDateRange(req);

    if (!range.valid) {
      return res.status(400).json({
        success: false,
        message: range.message,
      });
    }

    const dateValues =
      getDateParameters(range);

    const [
      summaryRows,
      statusRows,
      dailyRows,
      productRows,
      recentRows,
    ] = await Promise.all([
      pool.execute(
        `
          SELECT
            COUNT(*) AS total_orders,

            COALESCE(
              SUM(total_amount),
              0
            ) AS total_order_value,

            COALESCE(
              (
                SELECT SUM(
                  confirmed_order
                    .total_amount
                )

                FROM orders
                  confirmed_order

                WHERE
                  confirmed_order
                    .order_status =
                    'confirmed'

                  AND confirmed_order
                    .confirmed_at >= ?

                  AND confirmed_order
                    .confirmed_at <
                    DATE_ADD(
                      ?,
                      INTERVAL 1 DAY
                    )
              ),
              0
            ) AS confirmed_revenue,

            COALESCE(
              AVG(total_amount),
              0
            ) AS average_order_value

          FROM orders

          WHERE date_encoded >= ?
            AND date_encoded <
              DATE_ADD(
                ?,
                INTERVAL 1 DAY
              )
        `,
        [
          ...dateValues,
          ...dateValues,
        ]
      ),

      pool.execute(
        `
          SELECT
            order_status,
            COUNT(*) AS total

          FROM orders

          WHERE date_encoded >= ?
            AND date_encoded <
              DATE_ADD(
                ?,
                INTERVAL 1 DAY
              )

          GROUP BY order_status
          ORDER BY total DESC
        `,
        dateValues
      ),

      pool.execute(
        `
          SELECT
            daily.report_date,

            SUM(daily.order_count)
              AS order_count,

            SUM(daily.confirmed_revenue)
              AS confirmed_revenue

          FROM (
            SELECT
              DATE(date_encoded)
                AS report_date,

              COUNT(*) AS order_count,
              0 AS confirmed_revenue

            FROM orders

            WHERE date_encoded >= ?
              AND date_encoded <
                DATE_ADD(
                  ?,
                  INTERVAL 1 DAY
                )

            GROUP BY DATE(date_encoded)

            UNION ALL

            SELECT
              DATE(confirmed_at)
                AS report_date,

              0 AS order_count,

              COALESCE(
                SUM(total_amount),
                0
              ) AS confirmed_revenue

            FROM orders

            WHERE order_status =
                  'confirmed'

              AND confirmed_at >= ?
              AND confirmed_at <
                DATE_ADD(
                  ?,
                  INTERVAL 1 DAY
                )

            GROUP BY DATE(confirmed_at)
          ) daily

          GROUP BY daily.report_date
          ORDER BY report_date ASC
        `,
        [
          ...dateValues,
          ...dateValues,
        ]
      ),

      pool.execute(
        `
          SELECT
            p.id,
            p.sku,
            p.product_name,

            SUM(oi.quantity)
              AS units_sold,

            SUM(oi.line_total)
              AS sales_amount

          FROM order_items oi

          INNER JOIN orders o
            ON o.id = oi.order_id

          INNER JOIN products p
            ON p.id = oi.product_id

          WHERE o.order_status =
              'confirmed'

            AND o.confirmed_at >= ?

            AND o.confirmed_at <
              DATE_ADD(
                ?,
                INTERVAL 1 DAY
              )

          GROUP BY
            p.id,
            p.sku,
            p.product_name

          ORDER BY units_sold DESC
          LIMIT 10
        `,
        dateValues
      ),

      pool.execute(
        `
          SELECT
            o.id,
            o.order_number,
            o.total_amount,
            o.order_status,
            o.date_encoded,

            c.full_name
              AS customer_name,

            u.full_name
              AS encoded_by_name

          FROM orders o

          INNER JOIN customers c
            ON c.id = o.customer_id

          LEFT JOIN users u
            ON u.id = o.encoded_by

          WHERE o.date_encoded >= ?
            AND o.date_encoded <
              DATE_ADD(
                ?,
                INTERVAL 1 DAY
              )

          ORDER BY o.date_encoded DESC
          LIMIT 50
        `,
        dateValues
      ),
    ]);

    const summary = summaryRows[0][0];

    return res.json({
      success: true,

      dateRange: {
        startDate: range.startDate,
        endDate: range.endDate,
      },

      summary: {
        totalOrders: numberValue(
          summary.total_orders
        ),

        totalOrderValue: numberValue(
          summary.total_order_value
        ),

        confirmedRevenue:
          numberValue(
            summary.confirmed_revenue
          ),

        averageOrderValue:
          numberValue(
            summary.average_order_value
          ),
      },

      statusDistribution:
        statusRows[0].map(
          (row) => ({
            status:
              row.order_status,
            total:
              numberValue(row.total),
          })
        ),

      dailySales:
        dailyRows[0].map(
          (row) => ({
            date: row.report_date,
            orderCount:
              numberValue(
                row.order_count
              ),

            confirmedRevenue:
              numberValue(
                row.confirmed_revenue
              ),
          })
        ),

      topProducts:
        productRows[0].map(
          (row) => ({
            id: row.id,
            sku: row.sku,

            productName:
              row.product_name,

            unitsSold:
              numberValue(
                row.units_sold
              ),

            salesAmount:
              numberValue(
                row.sales_amount
              ),
          })
        ),

      recentOrders:
        recentRows[0].map(
          (row) => ({
            id: row.id,

            orderNumber:
              row.order_number,

            customerName:
              row.customer_name,

            encodedBy:
              row.encoded_by_name,

            totalAmount:
              numberValue(
                row.total_amount
              ),

            orderStatus:
              row.order_status,

            dateEncoded:
              row.date_encoded,
          })
        ),
    });
  } catch (error) {
    console.error(
      'Get Sales report error:',
      error
    );

    return res.status(500).json({
      success: false,
      message:
        'Unable to retrieve the Sales report.',
    });
  }
};

// GET /api/reports/cdm
exports.getCdmReport = async (
  req,
  res
) => {
  try {
    const range = getDateRange(req);

    if (!range.valid) {
      return res.status(400).json({
        success: false,
        message: range.message,
      });
    }

    const dateValues =
      getDateParameters(range);

    const [
      summaryRows,
      statusRows,
      recentRows,
    ] = await Promise.all([
      pool.execute(
        `
          SELECT
            COUNT(*) AS total_records,

            SUM(
              CASE
                WHEN o.order_status =
                  'for_confirmation'
                THEN 1
                ELSE 0
              END
            ) AS pending_records,

            SUM(
              CASE
                WHEN o.order_status IN (
                  'confirmed',
                  'rejected'
                )
                THEN 1
                ELSE 0
              END
            ) AS completed_records

          FROM orders o

          WHERE o.order_status IN (
            'for_confirmation',
            'confirmed',
            'rejected'
          )

            AND COALESCE(
              o.submitted_at,
              o.date_encoded
            ) >= ?

            AND COALESCE(
              o.submitted_at,
              o.date_encoded
            ) <
              DATE_ADD(
                ?,
                INTERVAL 1 DAY
              )
        `,
        dateValues
      ),

      pool.execute(
        `
          SELECT
            CASE
              WHEN o.order_status =
                'for_confirmation'
              THEN 'pending'

              ELSE o.order_status
            END AS record_status,

            COUNT(*) AS total

          FROM orders o

          WHERE o.order_status IN (
            'for_confirmation',
            'confirmed',
            'rejected'
          )

            AND COALESCE(
              o.submitted_at,
              o.date_encoded
            ) >= ?

            AND COALESCE(
              o.submitted_at,
              o.date_encoded
            ) <
              DATE_ADD(
                ?,
                INTERVAL 1 DAY
              )

          GROUP BY
            CASE
              WHEN o.order_status =
                'for_confirmation'
              THEN 'pending'

              ELSE o.order_status
            END

          ORDER BY total DESC
        `,
        dateValues
      ),

      pool.execute(
        `
          SELECT
            o.id,
            o.id AS order_id,
            o.order_number,

            c.full_name
              AS customer_name,

            CASE
              WHEN o.order_status =
                'for_confirmation'
              THEN 'pending'

              ELSE o.order_status
            END AS record_status,

            cp.waybill_number,

            COALESCE(
              cp.sent_to_customer_at,
              cp.confirmed_at,
              cp.rejected_at,
              o.submitted_at,
              o.date_encoded
            ) AS record_date

          FROM orders o

          INNER JOIN customers c
            ON c.id = o.customer_id

          LEFT JOIN cdm_order_processing cp
            ON cp.order_id = o.id

          WHERE o.order_status IN (
            'for_confirmation',
            'confirmed',
            'rejected'
          )

            AND COALESCE(
              o.submitted_at,
              o.date_encoded
            ) >= ?

            AND COALESCE(
              o.submitted_at,
              o.date_encoded
            ) <
              DATE_ADD(
                ?,
                INTERVAL 1 DAY
              )

          ORDER BY record_date DESC
          LIMIT 50
        `,
        dateValues
      ),
    ]);

    const summary =
      summaryRows[0][0];

    return res.json({
      success: true,

      dateRange: {
        startDate: range.startDate,
        endDate: range.endDate,
      },

      summary: {
        totalRecords: numberValue(
          summary.total_records
        ),

        pendingRecords: numberValue(
          summary.pending_records
        ),

        completedRecords: numberValue(
          summary.completed_records
        ),
      },

      statusDistribution:
        statusRows[0].map((row) => ({
          status: row.record_status,
          total: numberValue(
            row.total
          ),
        })),

      recentRecords:
        recentRows[0].map((row) => ({
          id: row.id,
          orderId: row.order_id,
          orderNumber: row.order_number,
          customerName: row.customer_name,
          status: row.record_status,

          waybillNumber:
            row.waybill_number || null,

          recordDate: row.record_date,
        })),
    });
  } catch (error) {
    console.error(
      'Get CDM report error:',
      error
    );

    return res.status(500).json({
      success: false,
      message:
        'Unable to retrieve the Customer Data Management report.',
    });
  }
};

// GET /api/reports/inventory
exports.getInventoryReport = async (
  req,
  res
) => {
  try {
    const range = getDateRange(req);

    if (!range.valid) {
      return res.status(400).json({
        success: false,
        message: range.message,
      });
    }

    const itemExists =
      await tableExists(
        'inventory_items'
      );

    if (!itemExists) {
      return res.json({
        success: true,

        dateRange: {
          startDate: range.startDate,
          endDate: range.endDate,
        },

        summary: {
          totalItems: 0,
          totalBalance: 0,
          lowStockItems: 0,
          outOfStockItems: 0,
          stockIn: 0,
          stockOut: 0,
          distributed: 0,
        },

        categoryDistribution: [],
        items: [],
        qualityChecks: [],
      });
    }

    const columns =
      await getTableColumns(
        'inventory_items'
      );

    const nameColumn =
      pickColumn(columns, [
        'item_name',
        'name',
        'inventory_name',
      ]);

    const categoryColumn =
      pickColumn(columns, [
        'item_category',
        'category',
        'item_type',
      ]);

    const balanceColumn =
      pickColumn(columns, [
        'current_quantity',
        'current_balance',
        'current_stock',
        'stock_quantity',
        'quantity',
        'balance',
      ]);

    const statusColumn =
      pickColumn(columns, [
        'status',
      ]);

    const activeItemsWhere =
      statusColumn
        ? `WHERE ${quoteIdentifier(
            statusColumn
          )} = 'active'`
        : '';

    const thresholdColumn =
      pickColumn(columns, [
        'low_stock_threshold',
        'reorder_level',
        'minimum_stock',
        'minimum_level',
      ]);

    const unitColumn =
      pickColumn(columns, [
        'unit',
        'unit_name',
        'measurement_unit',
      ]);

    const snapshot =
      await getInventorySnapshot();

    let stockIn = 0;
    let stockOut = 0;
    let distributed = 0;

    const movementExists =
      await tableExists(
        'inventory_movements'
      );

    if (movementExists) {
      const movementColumns =
        await getTableColumns(
          'inventory_movements'
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

      const quantityColumn =
        pickColumn(
          movementColumns,
          [
            'quantity',
            'movement_quantity',
            'amount',
          ]
        );

      const movementDateColumn =
        pickColumn(
          movementColumns,
          [
            'movement_date',
            'created_at',
            'date_created',
          ]
        );

      if (
        movementTypeColumn &&
        quantityColumn
      ) {
        const typeIdentifier =
          quoteIdentifier(
            movementTypeColumn
          );

        const quantityIdentifier =
          quoteIdentifier(
            quantityColumn
          );

        const movementWhere =
          movementDateColumn
            ? `
              WHERE
                ${quoteIdentifier(
                  movementDateColumn
                )} >= ?

                AND
                ${quoteIdentifier(
                  movementDateColumn
                )} <
                  DATE_ADD(
                    ?,
                    INTERVAL 1 DAY
                  )
            `
            : '';

        const [movementRows] =
          await pool.execute(
            `
              SELECT
                COALESCE(
                  SUM(
                    CASE
                      WHEN LOWER(
                        REPLACE(
                          ${typeIdentifier},
                          ' ',
                          '_'
                        )
                      ) IN (
                        'stock_in',
                        'adjustment_in',
                        'in',
                        'incoming',
                        'addition'
                      )
                      THEN ABS(
                        ${quantityIdentifier}
                      )
                      ELSE 0
                    END
                  ),
                  0
                ) AS stock_in,

                COALESCE(
                  SUM(
                    CASE
                      WHEN LOWER(
                        REPLACE(
                          ${typeIdentifier},
                          ' ',
                          '_'
                        )
                      ) IN (
                        'stock_out',
                        'adjustment_out',
                        'out',
                        'outgoing',
                        'deduction'
                      )
                      THEN ABS(
                        ${quantityIdentifier}
                      )
                      ELSE 0
                    END
                  ),
                  0
                ) AS stock_out,

                COALESCE(
                  SUM(
                    CASE
                      WHEN LOWER(
                        REPLACE(
                          ${typeIdentifier},
                          ' ',
                          '_'
                        )
                      ) = 'distributed'
                      THEN ABS(
                        ${quantityIdentifier}
                      )
                      ELSE 0
                    END
                  ),
                  0
                ) AS distributed

              FROM inventory_movements

              ${movementWhere}
            `,
            movementDateColumn
              ? getDateParameters(range)
              : []
          );

        stockIn = numberValue(
          movementRows[0].stock_in
        );

        stockOut = numberValue(
          movementRows[0].stock_out
        );

        distributed = numberValue(
          movementRows[0].distributed
        );
      }
    }

    let categoryDistribution = [];

    if (categoryColumn) {
      const categoryIdentifier =
        quoteIdentifier(
          categoryColumn
        );

      const [categoryRows] =
        await pool.execute(`
          SELECT
            ${categoryIdentifier}
              AS category,

            COUNT(*) AS item_count,

            ${
              balanceColumn
                ? `
                  COALESCE(
                    SUM(
                      ${quoteIdentifier(
                        balanceColumn
                      )}
                    ),
                    0
                  )
                `
                : '0'
            } AS total_balance

          FROM inventory_items

          ${activeItemsWhere}

          GROUP BY
            ${categoryIdentifier}

          ORDER BY item_count DESC
        `);

      categoryDistribution =
        categoryRows.map((row) => ({
          category:
            row.category ||
            'unspecified',

          itemCount: numberValue(
            row.item_count
          ),

          totalBalance: numberValue(
            row.total_balance
          ),
        }));
    }

    const itemFields = [
      'id',
    ];

    if (nameColumn) {
      itemFields.push(
        `${quoteIdentifier(
          nameColumn
        )} AS item_name`
      );
    }

    if (categoryColumn) {
      itemFields.push(
        `${quoteIdentifier(
          categoryColumn
        )} AS item_category`
      );
    }

    if (balanceColumn) {
      itemFields.push(
        `${quoteIdentifier(
          balanceColumn
        )} AS current_balance`
      );
    }

    if (thresholdColumn) {
      itemFields.push(
        `${quoteIdentifier(
          thresholdColumn
        )} AS low_stock_threshold`
      );
    }

    if (unitColumn) {
      itemFields.push(
        `${quoteIdentifier(
          unitColumn
        )} AS unit_name`
      );
    }

    const [itemRows] =
      await pool.execute(`
        SELECT
          ${itemFields.join(',\n')}

        FROM inventory_items

        ${activeItemsWhere}

        ORDER BY
          ${
            balanceColumn
              ? quoteIdentifier(
                  balanceColumn
                )
              : 'id'
          } ASC
      `);

    let qualityChecks = [];

    const qualityExists =
      await tableExists(
        'inventory_quality_checks'
      );

    if (qualityExists) {
      const qualityColumns =
        await getTableColumns(
          'inventory_quality_checks'
        );

      const checkedQuantityColumn =
        pickColumn(
          qualityColumns,
          ['checked_quantity']
        );

      const approvedQuantityColumn =
        pickColumn(
          qualityColumns,
          ['approved_quantity']
        );

      const rejectedQuantityColumn =
        pickColumn(
          qualityColumns,
          ['rejected_quantity']
        );

      const qualityDateColumn =
        pickColumn(
          qualityColumns,
          [
            'checked_at',
            'created_at',
            'date_checked',
          ]
        );

      if (
        checkedQuantityColumn &&
        approvedQuantityColumn &&
        rejectedQuantityColumn
      ) {
        const qualityWhere =
          qualityDateColumn
            ? `
              WHERE
                ${quoteIdentifier(
                  qualityDateColumn
                )} >= ?

                AND
                ${quoteIdentifier(
                  qualityDateColumn
                )} <
                  DATE_ADD(
                    ?,
                    INTERVAL 1 DAY
                  )
            `
            : '';

        const [qualityRows] =
          await pool.execute(
            `
              SELECT
                COALESCE(
                  SUM(${quoteIdentifier(
                    checkedQuantityColumn
                  )}),
                  0
                ) AS checked_quantity,

                COALESCE(
                  SUM(${quoteIdentifier(
                    approvedQuantityColumn
                  )}),
                  0
                ) AS approved_quantity,

                COALESCE(
                  SUM(${quoteIdentifier(
                    rejectedQuantityColumn
                  )}),
                  0
                ) AS rejected_quantity

              FROM inventory_quality_checks

              ${qualityWhere}
            `,
            qualityDateColumn
              ? getDateParameters(range)
              : []
          );

        const quality = qualityRows[0];

        qualityChecks = [
          {
            result: 'checked',
            total: numberValue(
              quality.checked_quantity
            ),
          },
          {
            result: 'approved',
            total: numberValue(
              quality.approved_quantity
            ),
          },
          {
            result: 'rejected',
            total: numberValue(
              quality.rejected_quantity
            ),
          },
        ];
      }
    }

    return res.json({
      success: true,

      dateRange: {
        startDate: range.startDate,
        endDate: range.endDate,
      },

      summary: {
        ...snapshot,
        stockIn,
        stockOut,
        distributed,
      },

      categoryDistribution,

      items: itemRows.map(
        (row) => ({
          id: row.id,

          itemName:
            row.item_name ||
            `Inventory Item #${row.id}`,

          itemCategory:
            row.item_category ||
            'unspecified',

          currentBalance:
            numberValue(
              row.current_balance
            ),

          lowStockThreshold:
            row.low_stock_threshold ===
              undefined ||
            row.low_stock_threshold ===
              null
              ? null
              : Number(
                  row.low_stock_threshold
                ),

          unit:
            row.unit_name || null,
        })
      ),

      qualityChecks,
    });
  } catch (error) {
    console.error(
      'Get Inventory report error:',
      error
    );

    return res.status(500).json({
      success: false,
      message:
        'Unable to retrieve the Inventory and Supply Chain report.',
    });
  }
};

// GET /api/reports/fulfillment
exports.getFulfillmentReport = async (
  req,
  res
) => {
  try {
    const range = getDateRange(req);

    if (!range.valid) {
      return res.status(400).json({
        success: false,
        message: range.message,
      });
    }

    const dateValues =
      getDateParameters(range);

    const [
      summaryRows,
      statusRows,
      courierRows,
      recentRows,
    ] = await Promise.all([
      pool.execute(
        `
          SELECT
            COUNT(*) AS total_records,

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

            ROUND(
              AVG(
                CASE
                  WHEN shipped_out_at
                    IS NOT NULL

                    AND delivered_at
                    IS NOT NULL

                  THEN TIMESTAMPDIFF(
                    HOUR,
                    shipped_out_at,
                    delivered_at
                  )
                  ELSE NULL
                END
              ),
              2
            ) AS average_delivery_hours

          FROM fulfillment_orders

          WHERE created_at >= ?
            AND created_at <
              DATE_ADD(
                ?,
                INTERVAL 1 DAY
              )
        `,
        dateValues
      ),

      pool.execute(
        `
          SELECT
            fulfillment_status,
            COUNT(*) AS total

          FROM fulfillment_orders

          WHERE created_at >= ?
            AND created_at <
              DATE_ADD(
                ?,
                INTERVAL 1 DAY
              )

          GROUP BY fulfillment_status
          ORDER BY total DESC
        `,
        dateValues
      ),

      pool.execute(
        `
          SELECT
            COALESCE(
              NULLIF(
                TRIM(
                  third_party_logistics
                ),
                ''
              ),
              'Not specified'
            ) AS courier_name,

            COUNT(*) AS total_shipments,

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
            ) AS returned

          FROM fulfillment_orders

          WHERE created_at >= ?
            AND created_at <
              DATE_ADD(
                ?,
                INTERVAL 1 DAY
              )

            AND fulfillment_status IN (
              'shipped_out',
              'delivered',
              'returned_to_sender'
            )

          GROUP BY courier_name
          ORDER BY total_shipments DESC
        `,
        dateValues
      ),

      pool.execute(
        `
          SELECT
            fo.id,
            fo.fulfillment_status,
            fo.third_party_logistics,
            fo.tracking_number,
            fo.packing_started_at,
            fo.packed_at,
            fo.shipped_out_at,
            fo.delivered_at,
            fo.returned_at,
            fo.return_reason,
            fo.created_at,

            o.order_number,
            o.total_amount,

            c.full_name
              AS customer_name,

            u.full_name
              AS handled_by_name

          FROM fulfillment_orders fo

          INNER JOIN orders o
            ON o.id = fo.order_id

          INNER JOIN customers c
            ON c.id = o.customer_id

          LEFT JOIN users u
            ON u.id = fo.handled_by

          WHERE fo.created_at >= ?
            AND fo.created_at <
              DATE_ADD(
                ?,
                INTERVAL 1 DAY
              )

          ORDER BY fo.updated_at DESC
          LIMIT 50
        `,
        dateValues
      ),
    ]);

    const summary =
      summaryRows[0][0];

    return res.json({
      success: true,

      dateRange: {
        startDate: range.startDate,
        endDate: range.endDate,
      },

      summary: {
        totalRecords: numberValue(
          summary.total_records
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

        averageDeliveryHours:
          summary.average_delivery_hours ===
            null
            ? null
            : Number(
                summary.average_delivery_hours
              ),
      },

      statusDistribution:
        statusRows[0].map(
          (row) => ({
            status:
              row.fulfillment_status,

            total:
              numberValue(row.total),
          })
        ),

      courierPerformance:
        courierRows[0].map(
          (row) => ({
            courierName:
              row.courier_name,

            totalShipments:
              numberValue(
                row.total_shipments
              ),

            delivered:
              numberValue(
                row.delivered
              ),

            returned:
              numberValue(
                row.returned
              ),
          })
        ),

      recentRecords:
        recentRows[0].map(
          (row) => ({
            id: row.id,

            orderNumber:
              row.order_number,

            customerName:
              row.customer_name,

            handledBy:
              row.handled_by_name,

            totalAmount:
              numberValue(
                row.total_amount
              ),

            status:
              row.fulfillment_status,

            courier:
              row.third_party_logistics,

            trackingNumber:
              row.tracking_number,

            packingStartedAt:
              row.packing_started_at,

            packedAt:
              row.packed_at,

            shippedOutAt:
              row.shipped_out_at,

            deliveredAt:
              row.delivered_at,

            returnedAt:
              row.returned_at,

            returnReason:
              row.return_reason,

            createdAt:
              row.created_at,
          })
        ),
    });
  } catch (error) {
    console.error(
      'Get Fulfillment report error:',
      error
    );

    return res.status(500).json({
      success: false,
      message:
        'Unable to retrieve the Fulfillment report.',
    });
  }
};

// GET /api/reports/crm
exports.getCrmReport = async (
  req,
  res
) => {
  try {
    const range = getDateRange(req);

    if (!range.valid) {
      return res.status(400).json({
        success: false,
        message: range.message,
      });
    }

    const dateValues =
      getDateParameters(range);

    const [
      summaryRows,
      feedbackSummaryRows,
      statusRows,
      concernRows,
      stepRows,
      ratingRows,
      recentRows,
    ] = await Promise.all([
      pool.execute(
        `
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
                WHEN case_status NOT IN (
                  'resolved',
                  'closed'
                )
                THEN 1
                ELSE 0
              END
            ) AS open_cases,

            SUM(
              CASE
                WHEN next_follow_up_at
                      IS NOT NULL

                  AND next_follow_up_at <=
                      NOW()

                  AND case_status NOT IN (
                    'resolved',
                    'closed'
                  )
                THEN 1
                ELSE 0
              END
            ) AS overdue_cases,

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
            ) AS closed

          FROM crm_cases cc

          WHERE cc.created_at >= ?
            AND cc.created_at <
              DATE_ADD(
                ?,
                INTERVAL 1 DAY
              )
        `,
        dateValues
      ),

      pool.execute(
        `
          SELECT
            ROUND(
              AVG(satisfaction_rating),
              2
            ) AS average_rating

          FROM crm_feedback

          WHERE submitted_at >= ?
            AND submitted_at <
              DATE_ADD(
                ?,
                INTERVAL 1 DAY
              )
        `,
        dateValues
      ),

      pool.execute(
        `
          SELECT
            case_status,
            COUNT(*) AS total

          FROM crm_cases

          WHERE created_at >= ?
            AND created_at <
              DATE_ADD(
                ?,
                INTERVAL 1 DAY
              )

          GROUP BY case_status
          ORDER BY total DESC
        `,
        dateValues
      ),

      pool.execute(
        `
          SELECT
            concern_category,
            COUNT(*) AS total

          FROM crm_cases

          WHERE created_at >= ?
            AND created_at <
              DATE_ADD(
                ?,
                INTERVAL 1 DAY
              )

          GROUP BY concern_category
          ORDER BY total DESC
        `,
        dateValues
      ),

      pool.execute(
        `
          SELECT
            cass.step_number,
            cass.step_status,
            COUNT(*) AS total

          FROM crm_after_sales_steps cass

          INNER JOIN crm_cases cc
            ON cc.id =
               cass.crm_case_id

          WHERE cc.created_at >= ?
            AND cc.created_at <
              DATE_ADD(
                ?,
                INTERVAL 1 DAY
              )

          GROUP BY
            cass.step_number,
            cass.step_status

          ORDER BY
            cass.step_number,
            cass.step_status
        `,
        dateValues
      ),

      pool.execute(
        `
          SELECT
            satisfaction_rating,
            COUNT(*) AS total

          FROM crm_feedback

          WHERE submitted_at >= ?
            AND submitted_at <
              DATE_ADD(
                ?,
                INTERVAL 1 DAY
              )

          GROUP BY satisfaction_rating
          ORDER BY satisfaction_rating ASC
        `,
        dateValues
      ),

      pool.execute(
        `
          SELECT
            cc.id,
            cc.case_status,
            cc.current_step,
            cc.concern_category,
            cc.delivery_confirmation,
            cc.assigned_at,
            cc.resolved_at,
            cc.closed_at,
            cc.created_at,

            o.order_number,

            c.full_name
              AS customer_name,

            handler.full_name
              AS assigned_user_name,

            cf.satisfaction_rating,
            cf.would_repurchase

          FROM crm_cases cc

          INNER JOIN orders o
            ON o.id = cc.order_id

          INNER JOIN customers c
            ON c.id = o.customer_id

          LEFT JOIN users handler
            ON handler.id =
               cc.handled_by

          LEFT JOIN crm_feedback cf
            ON cf.crm_case_id =
               cc.id

          WHERE cc.created_at >= ?
            AND cc.created_at <
              DATE_ADD(
                ?,
                INTERVAL 1 DAY
              )

          ORDER BY cc.updated_at DESC
          LIMIT 50
        `,
        dateValues
      ),
    ]);

    const summary =
      summaryRows[0][0];

    const feedbackSummary =
      feedbackSummaryRows[0][0];

    return res.json({
      success: true,

      dateRange: {
        startDate: range.startDate,
        endDate: range.endDate,
      },

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

        overdueCases: numberValue(
          summary.overdue_cases
        ),

        resolved: numberValue(
          summary.resolved
        ),

        closed: numberValue(
          summary.closed
        ),

        averageRating:
          feedbackSummary
            .average_rating ===
            null
            ? null
            : Number(
                feedbackSummary
                  .average_rating
              ),
      },

      statusDistribution:
        statusRows[0].map(
          (row) => ({
            status: row.case_status,
            total:
              numberValue(row.total),
          })
        ),

      concernDistribution:
        concernRows[0].map(
          (row) => ({
            concernCategory:
              row.concern_category,

            total:
              numberValue(row.total),
          })
        ),

      stepDistribution:
        stepRows[0].map(
          (row) => ({
            stepNumber: numberValue(
              row.step_number
            ),

            stepStatus:
              row.step_status,

            total:
              numberValue(row.total),
          })
        ),

      ratingDistribution:
        ratingRows[0].map(
          (row) => ({
            rating: numberValue(
              row.satisfaction_rating
            ),

            total:
              numberValue(row.total),
          })
        ),

      recentCases:
        recentRows[0].map(
          (row) => ({
            id: row.id,

            orderNumber:
              row.order_number,

            customerName:
              row.customer_name,

            assignedUser:
              row.assigned_user_name,

            caseStatus:
              row.case_status,

            currentStep:
              numberValue(
                row.current_step
              ),

            concernCategory:
              row.concern_category,

            deliveryConfirmation:
              row.delivery_confirmation,

            satisfactionRating:
              row.satisfaction_rating ===
                null
                ? null
                : Number(
                    row.satisfaction_rating
                  ),

            wouldRepurchase:
              row.would_repurchase,

            assignedAt:
              row.assigned_at,

            resolvedAt:
              row.resolved_at,

            closedAt:
              row.closed_at,

            createdAt:
              row.created_at,
          })
        ),
    });
  } catch (error) {
    console.error(
      'Get CRM report error:',
      error
    );

    return res.status(500).json({
      success: false,
      message:
        'Unable to retrieve the Customer Relationship Management report.',
    });
  }
};

// GET /api/reports/marketing
exports.getMarketingReport = async (
  req,
  res
) => {
  try {
    const range = getDateRange(req);

    if (!range.valid) {
      return res.status(400).json({
        success: false,
        message: range.message,
      });
    }

    const dateValues =
      getDateParameters(range);

    const [
      campaignRows,
      taskSummaryRows,
      statusRows,
      contentRows,
      priorityRows,
      submissionRows,
      recentRows,
    ] = await Promise.all([
      pool.execute(
        `
          SELECT
            COUNT(*) AS total_campaigns,

            SUM(
              CASE
                WHEN campaign_status =
                  'active'
                THEN 1
                ELSE 0
              END
            ) AS active_campaigns,

            SUM(
              CASE
                WHEN campaign_status =
                  'completed'
                THEN 1
                ELSE 0
              END
            ) AS completed_campaigns

          FROM marketing_campaigns

          WHERE created_at >= ?
            AND created_at <
              DATE_ADD(
                ?,
                INTERVAL 1 DAY
              )
        `,
        dateValues
      ),

      pool.execute(
        `
          SELECT
            COUNT(*) AS total_tasks,

            SUM(
              CASE
                WHEN task_status =
                  'completed'
                THEN 1
                ELSE 0
              END
            ) AS completed_tasks,

            SUM(
              CASE
                WHEN task_status =
                  'for_revision'
                THEN 1
                ELSE 0
              END
            ) AS revision_tasks,

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
            ) AS overdue_tasks

          FROM marketing_tasks

          WHERE created_at >= ?
            AND created_at <
              DATE_ADD(
                ?,
                INTERVAL 1 DAY
              )
        `,
        dateValues
      ),

      pool.execute(
        `
          SELECT
            task_status,
            COUNT(*) AS total

          FROM marketing_tasks

          WHERE created_at >= ?
            AND created_at <
              DATE_ADD(
                ?,
                INTERVAL 1 DAY
              )

          GROUP BY task_status
          ORDER BY total DESC
        `,
        dateValues
      ),

      pool.execute(
        `
          SELECT
            content_type,
            COUNT(*) AS total

          FROM marketing_tasks

          WHERE created_at >= ?
            AND created_at <
              DATE_ADD(
                ?,
                INTERVAL 1 DAY
              )

          GROUP BY content_type
          ORDER BY total DESC
        `,
        dateValues
      ),

      pool.execute(
        `
          SELECT
            priority,
            COUNT(*) AS total

          FROM marketing_tasks

          WHERE created_at >= ?
            AND created_at <
              DATE_ADD(
                ?,
                INTERVAL 1 DAY
              )

          GROUP BY priority
          ORDER BY total DESC
        `,
        dateValues
      ),

      pool.execute(
        `
          SELECT
            review_status,
            COUNT(*) AS total

          FROM marketing_task_submissions

          WHERE submitted_at >= ?
            AND submitted_at <
              DATE_ADD(
                ?,
                INTERVAL 1 DAY
              )

          GROUP BY review_status
          ORDER BY total DESC
        `,
        dateValues
      ),

      pool.execute(
        `
          SELECT
            mt.id,
            mt.task_title,
            mt.content_type,
            mt.priority,
            mt.due_date,
            mt.task_status,
            mt.approved_at,
            mt.completed_at,
            mt.created_at,

            mc.campaign_name,

            assigned.full_name
              AS assigned_user_name,

            creator.full_name
              AS created_by_name,

            COALESCE(
              submission_summary
                .submission_count,
              0
            ) AS submission_count

          FROM marketing_tasks mt

          LEFT JOIN marketing_campaigns mc
            ON mc.id =
               mt.campaign_id

          LEFT JOIN users assigned
            ON assigned.id =
               mt.assigned_to

          LEFT JOIN users creator
            ON creator.id =
               mt.created_by

          LEFT JOIN (
            SELECT
              marketing_task_id,
              COUNT(*) AS submission_count

            FROM marketing_task_submissions

            GROUP BY marketing_task_id
          ) submission_summary
            ON submission_summary
                 .marketing_task_id =
               mt.id

          WHERE mt.created_at >= ?
            AND mt.created_at <
              DATE_ADD(
                ?,
                INTERVAL 1 DAY
              )

          ORDER BY mt.updated_at DESC
          LIMIT 50
        `,
        dateValues
      ),
    ]);

    const campaigns =
      campaignRows[0][0];

    const tasks =
      taskSummaryRows[0][0];

    return res.json({
      success: true,

      dateRange: {
        startDate: range.startDate,
        endDate: range.endDate,
      },

      summary: {
        totalCampaigns:
          numberValue(
            campaigns.total_campaigns
          ),

        activeCampaigns:
          numberValue(
            campaigns.active_campaigns
          ),

        completedCampaigns:
          numberValue(
            campaigns
              .completed_campaigns
          ),

        totalTasks: numberValue(
          tasks.total_tasks
        ),

        completedTasks:
          numberValue(
            tasks.completed_tasks
          ),

        revisionTasks:
          numberValue(
            tasks.revision_tasks
          ),

        overdueTasks:
          numberValue(
            tasks.overdue_tasks
          ),
      },

      statusDistribution:
        statusRows[0].map(
          (row) => ({
            status:
              row.task_status,

            total:
              numberValue(row.total),
          })
        ),

      contentDistribution:
        contentRows[0].map(
          (row) => ({
            contentType:
              row.content_type,

            total:
              numberValue(row.total),
          })
        ),

      priorityDistribution:
        priorityRows[0].map(
          (row) => ({
            priority:
              row.priority,

            total:
              numberValue(row.total),
          })
        ),

      submissionDistribution:
        submissionRows[0].map(
          (row) => ({
            reviewStatus:
              row.review_status,

            total:
              numberValue(row.total),
          })
        ),

      recentTasks:
        recentRows[0].map(
          (row) => ({
            id: row.id,

            taskTitle:
              row.task_title,

            campaignName:
              row.campaign_name,

            contentType:
              row.content_type,

            priority:
              row.priority,

            dueDate:
              row.due_date,

            taskStatus:
              row.task_status,

            assignedUser:
              row.assigned_user_name,

            createdBy:
              row.created_by_name,

            submissionCount:
              numberValue(
                row.submission_count
              ),

            approvedAt:
              row.approved_at,

            completedAt:
              row.completed_at,

            createdAt:
              row.created_at,
          })
        ),
    });
  } catch (error) {
    console.error(
      'Get Marketing report error:',
      error
    );

    return res.status(500).json({
      success: false,
      message:
        'Unable to retrieve the Marketing report.',
    });
  }
};
