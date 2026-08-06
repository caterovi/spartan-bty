const pool = require('../config/db');

const ITEM_CATEGORIES = [
  'finished_product',
  'product_box',
  'air_column_roll',
  't4_box',
  'thank_you_note',
  'other',
];

const MOVEMENT_TYPES = [
  'stock_in',
  'stock_out',
  'distributed',
  'adjustment_in',
  'adjustment_out',
];

const ITEM_STATUSES = [
  'active',
  'inactive',
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

function getStockStatus(
  currentQuantity,
  reorderLevel
) {
  const quantity = Number(currentQuantity || 0);
  const threshold = Number(reorderLevel || 0);

  if (quantity === 0) {
    return 'out_of_stock';
  }

  if (
    threshold > 0 &&
    quantity <= threshold
  ) {
    return 'low_stock';
  }

  return 'in_stock';
}

function formatInventoryItem(row) {
  const currentQuantity = Number(
    row.current_quantity || 0
  );

  const reorderLevel = Number(
    row.reorder_level || 0
  );

  return {
    id: row.id,
    productId: row.product_id,
    productName: row.product_name || null,

    itemCode: row.item_code,
    itemName: row.item_name,
    category: row.category,
    unit: row.unit,

    currentQuantity,
    reorderLevel,

    stockStatus: getStockStatus(
      currentQuantity,
      reorderLevel
    ),

    status: row.status,

    totalStockIn: Number(
      row.total_stock_in || 0
    ),

    totalStockOut: Number(
      row.total_stock_out || 0
    ),

    totalDistributed: Number(
      row.total_distributed || 0
    ),

    totalChecked: Number(
      row.total_checked || 0
    ),

    totalApproved: Number(
      row.total_approved || 0
    ),

    totalRejected: Number(
      row.total_rejected || 0
    ),

    qualityCheckAllowed: [
      'finished_product',
      'thank_you_note',
    ].includes(row.category),

    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

const inventorySelect = `
  SELECT
    ii.id,
    ii.product_id,
    ii.item_code,
    ii.item_name,
    ii.category,
    ii.unit,
    ii.current_quantity,
    ii.reorder_level,
    ii.status,
    ii.created_at,
    ii.updated_at,

    p.product_name,

    COALESCE(
      movements.total_stock_in,
      0
    ) AS total_stock_in,

    COALESCE(
      movements.total_stock_out,
      0
    ) AS total_stock_out,

    COALESCE(
      movements.total_distributed,
      0
    ) AS total_distributed,

    COALESCE(
      quality.total_checked,
      0
    ) AS total_checked,

    COALESCE(
      quality.total_approved,
      0
    ) AS total_approved,

    COALESCE(
      quality.total_rejected,
      0
    ) AS total_rejected

  FROM inventory_items ii

  LEFT JOIN products p
    ON p.id = ii.product_id

  LEFT JOIN (
    SELECT
      inventory_item_id,

      SUM(
        CASE
          WHEN movement_type IN (
            'stock_in',
            'adjustment_in'
          )
          THEN quantity
          ELSE 0
        END
      ) AS total_stock_in,

      SUM(
        CASE
          WHEN movement_type IN (
            'stock_out',
            'adjustment_out'
          )
          THEN quantity
          ELSE 0
        END
      ) AS total_stock_out,

      SUM(
        CASE
          WHEN movement_type = 'distributed'
          THEN quantity
          ELSE 0
        END
      ) AS total_distributed

    FROM inventory_movements

    GROUP BY inventory_item_id
  ) movements
    ON movements.inventory_item_id = ii.id

  LEFT JOIN (
    SELECT
      inventory_item_id,

      SUM(checked_quantity)
        AS total_checked,

      SUM(approved_quantity)
        AS total_approved,

      SUM(rejected_quantity)
        AS total_rejected

    FROM inventory_quality_checks

    GROUP BY inventory_item_id
  ) quality
    ON quality.inventory_item_id = ii.id
`;

// GET /api/supply-chain/summary
exports.getSummary = async (req, res) => {
  try {
    const [rows] = await pool.execute(`
      SELECT
        COUNT(*) AS total_items,

        SUM(
          CASE
            WHEN category =
              'finished_product'
            THEN 1
            ELSE 0
          END
        ) AS finished_product_items,

        SUM(
          CASE
            WHEN category !=
              'finished_product'
            THEN 1
            ELSE 0
          END
        ) AS packaging_items,

        SUM(
          CASE
            WHEN current_quantity = 0
            THEN 1
            ELSE 0
          END
        ) AS out_of_stock_items,

        SUM(
          CASE
            WHEN reorder_level > 0
              AND current_quantity > 0
              AND current_quantity <=
                  reorder_level
            THEN 1
            ELSE 0
          END
        ) AS low_stock_items

      FROM inventory_items

      WHERE status = 'active'
    `);

    const [movementRows] =
      await pool.execute(`
        SELECT
          COUNT(*) AS total_movements,

          SUM(
            CASE
              WHEN movement_type IN (
                'stock_in',
                'adjustment_in'
              )
              THEN quantity
              ELSE 0
            END
          ) AS total_quantity_in,

          SUM(
            CASE
              WHEN movement_type IN (
                'stock_out',
                'adjustment_out'
              )
              THEN quantity
              ELSE 0
            END
          ) AS total_quantity_out,

          SUM(
            CASE
              WHEN movement_type =
                'distributed'
              THEN quantity
              ELSE 0
            END
          ) AS total_distributed

        FROM inventory_movements
      `);

    const summary = rows[0];
    const movements = movementRows[0];

    return res.json({
      success: true,

      summary: {
        totalItems: Number(
          summary.total_items || 0
        ),

        finishedProductItems: Number(
          summary.finished_product_items || 0
        ),

        packagingItems: Number(
          summary.packaging_items || 0
        ),

        outOfStockItems: Number(
          summary.out_of_stock_items || 0
        ),

        lowStockItems: Number(
          summary.low_stock_items || 0
        ),

        totalMovements: Number(
          movements.total_movements || 0
        ),

        totalQuantityIn: Number(
          movements.total_quantity_in || 0
        ),

        totalQuantityOut: Number(
          movements.total_quantity_out || 0
        ),

        totalDistributed: Number(
          movements.total_distributed || 0
        ),
      },
    });
  } catch (error) {
    console.error(
      'Get inventory summary error:',
      error
    );

    return res.status(500).json({
      success: false,
      message:
        'Unable to retrieve the inventory summary.',
    });
  }
};

// GET /api/supply-chain/items
exports.getItems = async (req, res) => {
  try {
    const search = cleanText(
      req.query.search
    );

    const category = cleanText(
      req.query.category
    );

    const status = cleanText(
      req.query.status
    );

    const stockStatus = cleanText(
      req.query.stockStatus
    );

    if (
      category &&
      !ITEM_CATEGORIES.includes(category)
    ) {
      return res.status(400).json({
        success: false,
        message:
          'Invalid inventory category.',
      });
    }

    if (
      status &&
      !ITEM_STATUSES.includes(status)
    ) {
      return res.status(400).json({
        success: false,
        message:
          'Invalid inventory item status.',
      });
    }

    if (
      stockStatus &&
      ![
        'in_stock',
        'low_stock',
        'out_of_stock',
      ].includes(stockStatus)
    ) {
      return res.status(400).json({
        success: false,
        message:
          'Invalid stock status.',
      });
    }

    const conditions = [];
    const values = [];

    if (search) {
      const keyword = `%${search}%`;

      conditions.push(`
        (
          ii.item_code LIKE ?
          OR ii.item_name LIKE ?
          OR p.product_name LIKE ?
        )
      `);

      values.push(
        keyword,
        keyword,
        keyword
      );
    }

    if (category) {
      conditions.push(
        'ii.category = ?'
      );

      values.push(category);
    }

    if (status) {
      conditions.push(
        'ii.status = ?'
      );

      values.push(status);
    }

    if (
      stockStatus === 'out_of_stock'
    ) {
      conditions.push(
        'ii.current_quantity = 0'
      );
    }

    if (
      stockStatus === 'low_stock'
    ) {
      conditions.push(`
        ii.current_quantity > 0
        AND ii.reorder_level > 0
        AND ii.current_quantity <=
            ii.reorder_level
      `);
    }

    if (
      stockStatus === 'in_stock'
    ) {
      conditions.push(`
        ii.current_quantity > 0
        AND (
          ii.reorder_level = 0
          OR ii.current_quantity >
             ii.reorder_level
        )
      `);
    }

    const whereClause =
      conditions.length > 0
        ? `WHERE ${conditions.join(
            ' AND '
          )}`
        : '';

    const [rows] = await pool.execute(
      `
        ${inventorySelect}

        ${whereClause}

        ORDER BY
          FIELD(
            ii.category,
            'finished_product',
            'product_box',
            'air_column_roll',
            't4_box',
            'thank_you_note',
            'other'
          ),
          ii.item_name ASC
      `,
      values
    );

    return res.json({
      success: true,
      items: rows.map(
        formatInventoryItem
      ),
    });
  } catch (error) {
    console.error(
      'Get inventory items error:',
      error
    );

    return res.status(500).json({
      success: false,
      message:
        'Unable to retrieve inventory items.',
    });
  }
};

// GET /api/supply-chain/items/:id
exports.getItemById = async (
  req,
  res
) => {
  try {
    const itemId = parsePositiveInteger(
      req.params.id
    );

    if (!itemId) {
      return res.status(400).json({
        success: false,
        message:
          'Invalid inventory item.',
      });
    }

    const [itemRows] =
      await pool.execute(
        `
          ${inventorySelect}

          WHERE ii.id = ?

          LIMIT 1
        `,
        [itemId]
      );

    if (itemRows.length === 0) {
      return res.status(404).json({
        success: false,
        message:
          'Inventory item not found.',
      });
    }

    const [movementRows] =
      await pool.execute(
        `
          SELECT
            im.id,
            im.inventory_item_id,
            im.recorded_by,
            im.movement_type,
            im.quantity,
            im.balance_before,
            im.balance_after,
            im.reference_type,
            im.reference_id,
            im.notes,
            im.created_at,

            u.full_name
              AS recorded_by_name

          FROM inventory_movements im

          LEFT JOIN users u
            ON u.id = im.recorded_by

          WHERE im.inventory_item_id = ?

          ORDER BY im.created_at DESC

          LIMIT 100
        `,
        [itemId]
      );

    const [qualityRows] =
      await pool.execute(
        `
          SELECT
            iq.id,
            iq.inventory_item_id,
            iq.checked_by,
            iq.checked_quantity,
            iq.approved_quantity,
            iq.rejected_quantity,
            iq.notes,
            iq.checked_at,
            iq.created_at,

            u.full_name
              AS checked_by_name

          FROM inventory_quality_checks iq

          LEFT JOIN users u
            ON u.id = iq.checked_by

          WHERE iq.inventory_item_id = ?

          ORDER BY iq.checked_at DESC

          LIMIT 100
        `,
        [itemId]
      );

    return res.json({
      success: true,

      item: {
        ...formatInventoryItem(
          itemRows[0]
        ),

        movements: movementRows.map(
          (movement) => ({
            id: movement.id,

            movementType:
              movement.movement_type,

            quantity: Number(
              movement.quantity
            ),

            balanceBefore: Number(
              movement.balance_before
            ),

            balanceAfter: Number(
              movement.balance_after
            ),

            referenceType:
              movement.reference_type,

            referenceId:
              movement.reference_id,

            notes: movement.notes,

            recordedBy: {
              id: movement.recorded_by,

              fullName:
                movement.recorded_by_name ||
                'Former user',
            },

            createdAt:
              movement.created_at,
          })
        ),

        qualityChecks:
          qualityRows.map((check) => ({
            id: check.id,

            checkedQuantity: Number(
              check.checked_quantity
            ),

            approvedQuantity: Number(
              check.approved_quantity
            ),

            rejectedQuantity: Number(
              check.rejected_quantity
            ),

            notes: check.notes,

            checkedBy: {
              id: check.checked_by,

              fullName:
                check.checked_by_name ||
                'Former user',
            },

            checkedAt: check.checked_at,
            createdAt: check.created_at,
          })),
      },
    });
  } catch (error) {
    console.error(
      'Get inventory item details error:',
      error
    );

    return res.status(500).json({
      success: false,
      message:
        'Unable to retrieve inventory item details.',
    });
  }
};

// POST /api/supply-chain/items/:id/movements
exports.recordMovement = async (
  req,
  res
) => {
  let connection;

  try {
    const itemId = parsePositiveInteger(
      req.params.id
    );

    const movementType = cleanText(
      req.body.movementType
    );

    const quantity =
      parsePositiveInteger(
        req.body.quantity
      );

    const notes = cleanText(
      req.body.notes
    );

    const referenceType = cleanText(
      req.body.referenceType
    );

    const referenceId =
      req.body.referenceId === null ||
      req.body.referenceId === undefined ||
      req.body.referenceId === ''
        ? null
        : parsePositiveInteger(
            req.body.referenceId
          );

    if (!itemId) {
      return res.status(400).json({
        success: false,
        message:
          'Invalid inventory item.',
      });
    }

    if (
      !MOVEMENT_TYPES.includes(
        movementType
      )
    ) {
      return res.status(400).json({
        success: false,
        message:
          'Invalid inventory movement type.',
      });
    }

    if (!quantity) {
      return res.status(400).json({
        success: false,
        message:
          'Quantity must be a positive whole number.',
      });
    }

    if (
      ['adjustment_in', 'adjustment_out']
        .includes(movementType) &&
      !notes
    ) {
      return res.status(400).json({
        success: false,
        message:
          'Notes are required for inventory adjustments.',
      });
    }

    connection =
      await pool.getConnection();

    await connection.beginTransaction();

    const [itemRows] =
      await connection.execute(
        `
          SELECT
            id,
            item_name,
            category,
            current_quantity,
            status

          FROM inventory_items

          WHERE id = ?

          FOR UPDATE
        `,
        [itemId]
      );

    if (itemRows.length === 0) {
      await connection.rollback();

      return res.status(404).json({
        success: false,
        message:
          'Inventory item not found.',
      });
    }

    const item = itemRows[0];

    if (item.status !== 'active') {
      await connection.rollback();

      return res.status(400).json({
        success: false,
        message:
          'Inventory movements cannot be recorded for an inactive item.',
      });
    }

    if (
      movementType === 'distributed' &&
      item.category !==
        'thank_you_note'
    ) {
      await connection.rollback();

      return res.status(400).json({
        success: false,
        message:
          'Distributed movement is intended for thank-you notes.',
      });
    }

    const balanceBefore = Number(
      item.current_quantity
    );

    const isAddition = [
      'stock_in',
      'adjustment_in',
    ].includes(movementType);

    const balanceAfter = isAddition
      ? balanceBefore + quantity
      : balanceBefore - quantity;

    if (balanceAfter < 0) {
      await connection.rollback();

      return res.status(400).json({
        success: false,
        message: `Insufficient stock. Current balance is ${balanceBefore}.`,
      });
    }

    const [movementResult] =
      await connection.execute(
        `
          INSERT INTO inventory_movements (
            inventory_item_id,
            recorded_by,
            movement_type,
            quantity,
            balance_before,
            balance_after,
            reference_type,
            reference_id,
            notes
          )
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `,
        [
          itemId,
          req.user.id,
          movementType,
          quantity,
          balanceBefore,
          balanceAfter,
          referenceType || null,
          referenceId,
          notes || null,
        ]
      );

    await connection.execute(
      `
        UPDATE inventory_items
        SET current_quantity = ?
        WHERE id = ?
      `,
      [balanceAfter, itemId]
    );

    await connection.commit();

    return res.status(201).json({
      success: true,
      message:
        'Inventory movement recorded successfully.',

      movement: {
        id: movementResult.insertId,
        itemId,
        movementType,
        quantity,
        balanceBefore,
        balanceAfter,
        referenceType:
          referenceType || null,
        referenceId,
        notes: notes || null,
      },
    });
  } catch (error) {
    if (connection) {
      try {
        await connection.rollback();
      } catch (rollbackError) {
        console.error(
          'Movement rollback error:',
          rollbackError
        );
      }
    }

    console.error(
      'Record inventory movement error:',
      error
    );

    return res.status(500).json({
      success: false,
      message:
        'Unable to record the inventory movement.',
    });
  } finally {
    if (connection) {
      connection.release();
    }
  }
};

// POST /api/supply-chain/items/:id/quality-checks
exports.recordQualityCheck = async (
  req,
  res
) => {
  let connection;

  try {
    const itemId = parsePositiveInteger(
      req.params.id
    );

    const checkedQuantity =
      parsePositiveInteger(
        req.body.checkedQuantity
      );

    const approvedQuantity = Number(
      req.body.approvedQuantity
    );

    const rejectedQuantity = Number(
      req.body.rejectedQuantity
    );

    const notes = cleanText(
      req.body.notes
    );

    if (!itemId) {
      return res.status(400).json({
        success: false,
        message:
          'Invalid inventory item.',
      });
    }

    if (!checkedQuantity) {
      return res.status(400).json({
        success: false,
        message:
          'Checked quantity must be a positive whole number.',
      });
    }

    if (
      !Number.isInteger(
        approvedQuantity
      ) ||
      approvedQuantity < 0
    ) {
      return res.status(400).json({
        success: false,
        message:
          'Approved quantity must be zero or a positive whole number.',
      });
    }

    if (
      !Number.isInteger(
        rejectedQuantity
      ) ||
      rejectedQuantity < 0
    ) {
      return res.status(400).json({
        success: false,
        message:
          'Rejected quantity must be zero or a positive whole number.',
      });
    }

    if (
      approvedQuantity +
        rejectedQuantity !==
      checkedQuantity
    ) {
      return res.status(400).json({
        success: false,
        message:
          'Approved and rejected quantities must equal the checked quantity.',
      });
    }

    connection =
      await pool.getConnection();

    await connection.beginTransaction();

    const [itemRows] =
      await connection.execute(
        `
          SELECT
            id,
            item_name,
            category,
            current_quantity,
            status

          FROM inventory_items

          WHERE id = ?

          FOR UPDATE
        `,
        [itemId]
      );

    if (itemRows.length === 0) {
      await connection.rollback();

      return res.status(404).json({
        success: false,
        message:
          'Inventory item not found.',
      });
    }

    const item = itemRows[0];

    if (item.status !== 'active') {
      await connection.rollback();

      return res.status(400).json({
        success: false,
        message:
          'Quality checks cannot be recorded for an inactive item.',
      });
    }

    if (
      ![
        'finished_product',
        'thank_you_note',
      ].includes(item.category)
    ) {
      await connection.rollback();

      return res.status(400).json({
        success: false,
        message:
          'Quality checking is available only for products and thank-you notes.',
      });
    }

    const [qualityResult] =
      await connection.execute(
        `
          INSERT INTO inventory_quality_checks (
            inventory_item_id,
            checked_by,
            checked_quantity,
            approved_quantity,
            rejected_quantity,
            notes
          )
          VALUES (?, ?, ?, ?, ?, ?)
        `,
        [
          itemId,
          req.user.id,
          checkedQuantity,
          approvedQuantity,
          rejectedQuantity,
          notes || null,
        ]
      );

    const balanceBefore = Number(
      item.current_quantity
    );

    const balanceAfter =
      balanceBefore +
      approvedQuantity;

    if (approvedQuantity > 0) {
      await connection.execute(
        `
          INSERT INTO inventory_movements (
            inventory_item_id,
            recorded_by,
            movement_type,
            quantity,
            balance_before,
            balance_after,
            reference_type,
            reference_id,
            notes
          )
          VALUES (
            ?,
            ?,
            'stock_in',
            ?,
            ?,
            ?,
            'quality_check',
            ?,
            ?
          )
        `,
        [
          itemId,
          req.user.id,
          approvedQuantity,
          balanceBefore,
          balanceAfter,
          qualityResult.insertId,
          notes ||
            'Approved quantity from quality check.',
        ]
      );

      await connection.execute(
        `
          UPDATE inventory_items
          SET current_quantity = ?
          WHERE id = ?
        `,
        [balanceAfter, itemId]
      );
    }

    await connection.commit();

    return res.status(201).json({
      success: true,

      message:
        'Quality check recorded successfully.',

      qualityCheck: {
        id: qualityResult.insertId,
        itemId,
        checkedQuantity,
        approvedQuantity,
        rejectedQuantity,
        balanceBefore,
        balanceAfter,
        notes: notes || null,
      },
    });
  } catch (error) {
    if (connection) {
      try {
        await connection.rollback();
      } catch (rollbackError) {
        console.error(
          'Quality-check rollback error:',
          rollbackError
        );
      }
    }

    console.error(
      'Record quality check error:',
      error
    );

    return res.status(500).json({
      success: false,
      message:
        'Unable to record the quality check.',
    });
  } finally {
    if (connection) {
      connection.release();
    }
  }
};

// PATCH /api/supply-chain/items/:id/settings
exports.updateItemSettings = async (
  req,
  res
) => {
  try {
    const itemId = parsePositiveInteger(
      req.params.id
    );

    const reorderLevel = Number(
      req.body.reorderLevel
    );

    const status = cleanText(
      req.body.status
    );

    if (!itemId) {
      return res.status(400).json({
        success: false,
        message:
          'Invalid inventory item.',
      });
    }

    if (
      !Number.isInteger(reorderLevel) ||
      reorderLevel < 0
    ) {
      return res.status(400).json({
        success: false,
        message:
          'Reorder level must be zero or a positive whole number.',
      });
    }

    if (
      !ITEM_STATUSES.includes(status)
    ) {
      return res.status(400).json({
        success: false,
        message:
          'Invalid inventory item status.',
      });
    }

    const [result] = await pool.execute(
      `
        UPDATE inventory_items
        SET
          reorder_level = ?,
          status = ?
        WHERE id = ?
      `,
      [
        reorderLevel,
        status,
        itemId,
      ]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({
        success: false,
        message:
          'Inventory item not found.',
      });
    }

    return res.json({
      success: true,
      message:
        'Inventory item settings updated successfully.',

      settings: {
        reorderLevel,
        status,
      },
    });
  } catch (error) {
    console.error(
      'Update inventory settings error:',
      error
    );

    return res.status(500).json({
      success: false,
      message:
        'Unable to update inventory item settings.',
    });
  }
};