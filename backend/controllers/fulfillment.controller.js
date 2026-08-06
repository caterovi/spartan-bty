const pool = require('../config/db');

const FULFILLMENT_STATUSES = [
  'pending_packing',
  'packing',
  'packed',
  'ready_for_shipment',
  'shipped_out',
  'delivered',
  'returned_to_sender',
  'cancelled',
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

function formatFulfillmentOrder(row) {
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

    handledBy: row.handled_by
      ? {
          id: row.handled_by,
          fullName:
            row.handled_by_name ||
            'Former user',
        }
      : null,

    fulfillmentStatus:
      row.fulfillment_status,

    totalAmount: Number(
      row.total_amount || 0
    ),

    itemCount: Number(
      row.item_count || 0
    ),

    totalUnits: Number(
      row.total_units || 0
    ),

    waybillNumber:
      row.waybill_number,

    waybillLink:
      row.waybill_link,

    thirdPartyLogistics:
      row.third_party_logistics,

    trackingNumber:
      row.tracking_number,

    packingNotes:
      row.packing_notes,

    shippingNotes:
      row.shipping_notes,

    returnReason:
      row.return_reason,

    packingStartedAt:
      row.packing_started_at,

    packedAt: row.packed_at,

    readyForShipmentAt:
      row.ready_for_shipment_at,

    shippedOutAt:
      row.shipped_out_at,

    deliveredAt:
      row.delivered_at,

    returnedAt:
      row.returned_at,

    inventoryDeductedAt:
      row.inventory_deducted_at,

    sentToCustomerAt:
      row.sent_to_customer_at,

    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

async function ensureEligibleOrders(
  connection = pool
) {
  await connection.execute(`
    INSERT INTO fulfillment_orders (
      order_id,
      fulfillment_status
    )

    SELECT
      o.id,
      'pending_packing'

    FROM orders o

    INNER JOIN cdm_order_processing cp
      ON cp.order_id = o.id

    WHERE o.order_status = 'confirmed'
      AND cp.confirmation_status =
          'confirmed'
      AND cp.sent_to_customer_at
          IS NOT NULL

    ON DUPLICATE KEY UPDATE
      order_id = VALUES(order_id)
  `);
}

async function addStatusHistory(
  connection,
  fulfillmentOrderId,
  changedBy,
  previousStatus,
  newStatus,
  notes = null
) {
  await connection.execute(
    `
      INSERT INTO fulfillment_status_history (
        fulfillment_order_id,
        changed_by,
        previous_status,
        new_status,
        notes
      )
      VALUES (?, ?, ?, ?, ?)
    `,
    [
      fulfillmentOrderId,
      changedBy,
      previousStatus,
      newStatus,
      notes || null,
    ]
  );
}

async function getLockedFulfillmentOrder(
  connection,
  fulfillmentOrderId
) {
  const [rows] = await connection.execute(
    `
      SELECT
        fo.id,
        fo.order_id,
        fo.fulfillment_status,
        fo.inventory_deducted_at,

        o.order_number,
        o.order_status,

        cp.sent_to_customer_at

      FROM fulfillment_orders fo

      INNER JOIN orders o
        ON o.id = fo.order_id

      INNER JOIN cdm_order_processing cp
        ON cp.order_id = o.id

      WHERE fo.id = ?

      FOR UPDATE
    `,
    [fulfillmentOrderId]
  );

  return rows[0] || null;
}

const fulfillmentOrderSelect = `
  SELECT
    fo.id,
    fo.order_id,
    fo.handled_by,
    fo.fulfillment_status,
    fo.third_party_logistics,
    fo.tracking_number,
    fo.packing_notes,
    fo.shipping_notes,
    fo.return_reason,
    fo.packing_started_at,
    fo.packed_at,
    fo.ready_for_shipment_at,
    fo.shipped_out_at,
    fo.delivered_at,
    fo.returned_at,
    fo.inventory_deducted_at,
    fo.created_at,
    fo.updated_at,

    o.order_number,
    o.customer_id,
    o.total_amount,

    c.full_name
      AS customer_name,
    c.contact_number,
    c.address,

    cp.waybill_number,
    cp.waybill_link,
    cp.sent_to_customer_at,

    handler.full_name
      AS handled_by_name,

    COALESCE(
      order_summary.item_count,
      0
    ) AS item_count,

    COALESCE(
      order_summary.total_units,
      0
    ) AS total_units

  FROM fulfillment_orders fo

  INNER JOIN orders o
    ON o.id = fo.order_id

  INNER JOIN customers c
    ON c.id = o.customer_id

  INNER JOIN cdm_order_processing cp
    ON cp.order_id = o.id

  LEFT JOIN users handler
    ON handler.id = fo.handled_by

  LEFT JOIN (
    SELECT
      order_id,
      COUNT(*) AS item_count,
      SUM(quantity) AS total_units

    FROM order_items

    GROUP BY order_id
  ) order_summary
    ON order_summary.order_id =
       o.id
`;

// GET /api/fulfillment/summary
exports.getSummary = async (req, res) => {
  try {
    await ensureEligibleOrders();

    const [rows] = await pool.execute(`
      SELECT
        COUNT(*) AS total_orders,

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
        ) AS returned_to_sender

      FROM fulfillment_orders
    `);

    const summary = rows[0];

    return res.json({
      success: true,

      summary: {
        totalOrders: Number(
          summary.total_orders || 0
        ),

        pendingPacking: Number(
          summary.pending_packing || 0
        ),

        packing: Number(
          summary.packing || 0
        ),

        packed: Number(
          summary.packed || 0
        ),

        readyForShipment: Number(
          summary.ready_for_shipment || 0
        ),

        shippedOut: Number(
          summary.shipped_out || 0
        ),

        delivered: Number(
          summary.delivered || 0
        ),

        returnedToSender: Number(
          summary.returned_to_sender || 0
        ),
      },
    });
  } catch (error) {
    console.error(
      'Get fulfillment summary error:',
      error
    );

    return res.status(500).json({
      success: false,
      message:
        'Unable to retrieve the fulfillment summary.',
    });
  }
};

// GET /api/fulfillment/orders
exports.getOrders = async (req, res) => {
  try {
    await ensureEligibleOrders();

    const search = cleanText(
      req.query.search
    );

    const status = cleanText(
      req.query.status
    );

    if (
      status &&
      !FULFILLMENT_STATUSES.includes(
        status
      )
    ) {
      return res.status(400).json({
        success: false,
        message:
          'Invalid fulfillment status.',
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
          OR cp.waybill_number LIKE ?
          OR fo.tracking_number LIKE ?
          OR fo.third_party_logistics
             LIKE ?
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
        fo.fulfillment_status = ?
      `);

      values.push(status);
    }

    const whereClause =
      conditions.length > 0
        ? `WHERE ${conditions.join(
            ' AND '
          )}`
        : '';

    const [rows] = await pool.execute(
      `
        ${fulfillmentOrderSelect}

        ${whereClause}

        ORDER BY
          CASE
            WHEN fo.fulfillment_status =
              'pending_packing'
              THEN 1

            WHEN fo.fulfillment_status =
              'packing'
              THEN 2

            WHEN fo.fulfillment_status =
              'packed'
              THEN 3

            WHEN fo.fulfillment_status =
              'ready_for_shipment'
              THEN 4

            WHEN fo.fulfillment_status =
              'shipped_out'
              THEN 5

            WHEN fo.fulfillment_status =
              'returned_to_sender'
              THEN 6

            WHEN fo.fulfillment_status =
              'delivered'
              THEN 7

            ELSE 8
          END,

          fo.updated_at DESC
      `,
      values
    );

    return res.json({
      success: true,

      orders: rows.map(
        formatFulfillmentOrder
      ),
    });
  } catch (error) {
    console.error(
      'Get fulfillment orders error:',
      error
    );

    return res.status(500).json({
      success: false,
      message:
        'Unable to retrieve fulfillment orders.',
    });
  }
};

// GET /api/fulfillment/packaging-items
exports.getPackagingItems = async (
  req,
  res
) => {
  try {
    const [rows] = await pool.execute(`
      SELECT
        id,
        product_id,
        item_code,
        item_name,
        category,
        unit,
        current_quantity,
        reorder_level,
        status

      FROM inventory_items

      WHERE status = 'active'
        AND category IN (
          'product_box',
          'air_column_roll',
          't4_box',
          'thank_you_note',
          'other'
        )

      ORDER BY
        FIELD(
          category,
          'product_box',
          'air_column_roll',
          't4_box',
          'thank_you_note',
          'other'
        ),
        item_name ASC
    `);

    return res.json({
      success: true,

      items: rows.map((row) => ({
        id: row.id,
        productId: row.product_id,
        itemCode: row.item_code,
        itemName: row.item_name,
        category: row.category,
        unit: row.unit,

        currentQuantity: Number(
          row.current_quantity || 0
        ),

        reorderLevel: Number(
          row.reorder_level || 0
        ),

        status: row.status,
      })),
    });
  } catch (error) {
    console.error(
      'Get packaging items error:',
      error
    );

    return res.status(500).json({
      success: false,
      message:
        'Unable to retrieve packaging materials.',
    });
  }
};

// GET /api/fulfillment/orders/:id
exports.getOrderById = async (
  req,
  res
) => {
  try {
    const fulfillmentOrderId =
      parsePositiveInteger(
        req.params.id
      );

    if (!fulfillmentOrderId) {
      return res.status(400).json({
        success: false,
        message:
          'Invalid fulfillment order.',
      });
    }

    await ensureEligibleOrders();

    const [orderRows] =
      await pool.execute(
        `
          ${fulfillmentOrderSelect}

          WHERE fo.id = ?

          LIMIT 1
        `,
        [fulfillmentOrderId]
      );

    if (orderRows.length === 0) {
      return res.status(404).json({
        success: false,
        message:
          'Fulfillment order not found.',
      });
    }

    const order = formatFulfillmentOrder(
      orderRows[0]
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
            p.product_name,

            ii.id AS inventory_item_id,
            ii.current_quantity
              AS inventory_quantity

          FROM order_items oi

          INNER JOIN products p
            ON p.id = oi.product_id

          LEFT JOIN inventory_items ii
            ON ii.product_id =
               oi.product_id
           AND ii.category =
               'finished_product'

          WHERE oi.order_id = ?

          ORDER BY
            p.product_name ASC
        `,
        [order.orderId]
      );

    const [packagingRows] =
      await pool.execute(
        `
          SELECT
            fpu.id,
            fpu.inventory_item_id,
            fpu.quantity_used,

            ii.item_code,
            ii.item_name,
            ii.category,
            ii.unit

          FROM fulfillment_packaging_usage fpu

          INNER JOIN inventory_items ii
            ON ii.id =
               fpu.inventory_item_id

          WHERE fpu.fulfillment_order_id = ?

          ORDER BY
            ii.item_name ASC
        `,
        [fulfillmentOrderId]
      );

    const [historyRows] =
      await pool.execute(
        `
          SELECT
            fsh.id,
            fsh.changed_by,
            fsh.previous_status,
            fsh.new_status,
            fsh.notes,
            fsh.created_at,

            u.full_name
              AS changed_by_name

          FROM fulfillment_status_history fsh

          LEFT JOIN users u
            ON u.id = fsh.changed_by

          WHERE
            fsh.fulfillment_order_id = ?

          ORDER BY
            fsh.created_at DESC,
            fsh.id DESC
        `,
        [fulfillmentOrderId]
      );

    order.items = itemRows.map(
      (item) => ({
        id: item.id,
        productId: item.product_id,
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

        inventoryItemId:
          item.inventory_item_id,

        availableInventory: Number(
          item.inventory_quantity || 0
        ),
      })
    );

    order.packagingUsage =
      packagingRows.map((item) => ({
        id: item.id,

        inventoryItemId:
          item.inventory_item_id,

        itemCode: item.item_code,
        itemName: item.item_name,
        category: item.category,
        unit: item.unit,

        quantityUsed: Number(
          item.quantity_used
        ),
      }));

    order.statusHistory =
      historyRows.map((history) => ({
        id: history.id,

        previousStatus:
          history.previous_status,

        newStatus:
          history.new_status,

        notes: history.notes,

        changedBy: {
          id: history.changed_by,

          fullName:
            history.changed_by_name ||
            'Former user',
        },

        createdAt:
          history.created_at,
      }));

    return res.json({
      success: true,
      order,
    });
  } catch (error) {
    console.error(
      'Get fulfillment order details error:',
      error
    );

    return res.status(500).json({
      success: false,
      message:
        'Unable to retrieve fulfillment order details.',
    });
  }
};

// PATCH /api/fulfillment/orders/:id/start-packing
exports.startPacking = async (
  req,
  res
) => {
  let connection;

  try {
    const fulfillmentOrderId =
      parsePositiveInteger(
        req.params.id
      );

    const packingNotes = cleanText(
      req.body.packingNotes
    );

    if (!fulfillmentOrderId) {
      return res.status(400).json({
        success: false,
        message:
          'Invalid fulfillment order.',
      });
    }

    connection =
      await pool.getConnection();

    await connection.beginTransaction();

    const order =
      await getLockedFulfillmentOrder(
        connection,
        fulfillmentOrderId
      );

    if (!order) {
      await connection.rollback();

      return res.status(404).json({
        success: false,
        message:
          'Fulfillment order not found.',
      });
    }

    if (
      order.fulfillment_status !==
      'pending_packing'
    ) {
      await connection.rollback();

      return res.status(400).json({
        success: false,
        message:
          'Only pending orders can begin packing.',
      });
    }

    await connection.execute(
      `
        UPDATE fulfillment_orders
        SET
          handled_by = ?,
          fulfillment_status =
            'packing',
          packing_notes = ?,
          packing_started_at = NOW()
        WHERE id = ?
      `,
      [
        req.user.id,
        packingNotes || null,
        fulfillmentOrderId,
      ]
    );

    await addStatusHistory(
      connection,
      fulfillmentOrderId,
      req.user.id,
      'pending_packing',
      'packing',
      packingNotes
    );

    await connection.commit();

    return res.json({
      success: true,
      message:
        'Packing started successfully.',
      fulfillmentStatus: 'packing',
    });
  } catch (error) {
    if (connection) {
      try {
        await connection.rollback();
      } catch (rollbackError) {
        console.error(
          'Start packing rollback error:',
          rollbackError
        );
      }
    }

    console.error(
      'Start packing error:',
      error
    );

    return res.status(500).json({
      success: false,
      message:
        'Unable to start packing.',
    });
  } finally {
    if (connection) {
      connection.release();
    }
  }
};

// PATCH /api/fulfillment/orders/:id/complete-packing
exports.completePacking = async (
  req,
  res
) => {
  let connection;

  try {
    const fulfillmentOrderId =
      parsePositiveInteger(
        req.params.id
      );

    const packingNotes = cleanText(
      req.body.packingNotes
    );

    const submittedUsage =
      Array.isArray(
        req.body.packagingUsage
      )
        ? req.body.packagingUsage
        : [];

    if (!fulfillmentOrderId) {
      return res.status(400).json({
        success: false,
        message:
          'Invalid fulfillment order.',
      });
    }

    if (submittedUsage.length === 0) {
      return res.status(400).json({
        success: false,
        message:
          'Select at least one packing material.',
      });
    }

    const usageMap = new Map();

    for (const entry of submittedUsage) {
      const inventoryItemId =
        parsePositiveInteger(
          entry.inventoryItemId
        );

      const quantityUsed =
        parsePositiveInteger(
          entry.quantityUsed
        );

      if (
        !inventoryItemId ||
        !quantityUsed
      ) {
        return res.status(400).json({
          success: false,
          message:
            'Each packing material must have a valid item and quantity.',
        });
      }

      usageMap.set(
        inventoryItemId,
        (usageMap.get(
          inventoryItemId
        ) || 0) + quantityUsed
      );
    }

    const packagingUsage = Array.from(
      usageMap,
      ([inventoryItemId, quantityUsed]) => ({
        inventoryItemId,
        quantityUsed,
      })
    );

    connection =
      await pool.getConnection();

    await connection.beginTransaction();

    const fulfillmentOrder =
      await getLockedFulfillmentOrder(
        connection,
        fulfillmentOrderId
      );

    if (!fulfillmentOrder) {
      await connection.rollback();

      return res.status(404).json({
        success: false,
        message:
          'Fulfillment order not found.',
      });
    }

    if (
      fulfillmentOrder
        .fulfillment_status !==
      'packing'
    ) {
      await connection.rollback();

      return res.status(400).json({
        success: false,
        message:
          'Packing must be started before it can be completed.',
      });
    }

    if (
      fulfillmentOrder
        .inventory_deducted_at
    ) {
      await connection.rollback();

      return res.status(400).json({
        success: false,
        message:
          'Inventory was already deducted for this order.',
      });
    }

    const [productRows] =
      await connection.execute(
        `
          SELECT
            oi.product_id,
            SUM(oi.quantity)
              AS required_quantity,

            p.product_name,

            ii.id
              AS inventory_item_id,

            ii.item_name,
            ii.current_quantity,
            ii.status

          FROM order_items oi

          INNER JOIN products p
            ON p.id = oi.product_id

          LEFT JOIN inventory_items ii
            ON ii.product_id =
               oi.product_id
           AND ii.category =
               'finished_product'

          WHERE oi.order_id = ?

          GROUP BY
            oi.product_id,
            p.product_name,
            ii.id,
            ii.item_name,
            ii.current_quantity,
            ii.status

          FOR UPDATE
        `,
        [fulfillmentOrder.order_id]
      );

    if (productRows.length === 0) {
      await connection.rollback();

      return res.status(400).json({
        success: false,
        message:
          'The order does not contain any products.',
      });
    }

    for (const product of productRows) {
      if (
        !product.inventory_item_id
      ) {
        await connection.rollback();

        return res.status(400).json({
          success: false,
          message:
            `No inventory record exists for ${product.product_name}.`,
        });
      }

      if (product.status !== 'active') {
        await connection.rollback();

        return res.status(400).json({
          success: false,
          message:
            `${product.product_name} is inactive in inventory.`,
        });
      }

      const available = Number(
        product.current_quantity
      );

      const required = Number(
        product.required_quantity
      );

      if (available < required) {
        await connection.rollback();

        return res.status(400).json({
          success: false,
          message:
            `Insufficient stock for ${product.product_name}. Required: ${required}, available: ${available}.`,
        });
      }
    }

    const packagingIds =
      packagingUsage.map(
        (item) =>
          item.inventoryItemId
      );

    const placeholders =
      packagingIds
        .map(() => '?')
        .join(', ');

    const [packagingRows] =
      await connection.execute(
        `
          SELECT
            id,
            item_name,
            category,
            unit,
            current_quantity,
            status

          FROM inventory_items

          WHERE id IN (${placeholders})

          FOR UPDATE
        `,
        packagingIds
      );

    if (
      packagingRows.length !==
      packagingIds.length
    ) {
      await connection.rollback();

      return res.status(400).json({
        success: false,
        message:
          'One or more packing materials were not found.',
      });
    }

    const packagingById = new Map(
      packagingRows.map((item) => [
        Number(item.id),
        item,
      ])
    );

    for (const usage of packagingUsage) {
      const item = packagingById.get(
        Number(
          usage.inventoryItemId
        )
      );

      if (
        item.category ===
        'finished_product'
      ) {
        await connection.rollback();

        return res.status(400).json({
          success: false,
          message:
            `${item.item_name} cannot be selected as a packing material.`,
        });
      }

      if (item.status !== 'active') {
        await connection.rollback();

        return res.status(400).json({
          success: false,
          message:
            `${item.item_name} is inactive.`,
        });
      }

      const available = Number(
        item.current_quantity
      );

      if (
        available <
        usage.quantityUsed
      ) {
        await connection.rollback();

        return res.status(400).json({
          success: false,
          message:
            `Insufficient ${item.item_name}. Required: ${usage.quantityUsed}, available: ${available}.`,
        });
      }
    }

    await connection.execute(
      `
        DELETE FROM
          fulfillment_packaging_usage

        WHERE fulfillment_order_id = ?
      `,
      [fulfillmentOrderId]
    );

    for (const usage of packagingUsage) {
      await connection.execute(
        `
          INSERT INTO fulfillment_packaging_usage (
            fulfillment_order_id,
            inventory_item_id,
            quantity_used
          )
          VALUES (?, ?, ?)
        `,
        [
          fulfillmentOrderId,
          usage.inventoryItemId,
          usage.quantityUsed,
        ]
      );
    }

    /*
     * Deduct ordered finished products.
     */
    for (const product of productRows) {
      const balanceBefore = Number(
        product.current_quantity
      );

      const quantity = Number(
        product.required_quantity
      );

      const balanceAfter =
        balanceBefore - quantity;

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
            'stock_out',
            ?,
            ?,
            ?,
            'fulfillment_order',
            ?,
            ?
          )
        `,
        [
          product.inventory_item_id,
          req.user.id,
          quantity,
          balanceBefore,
          balanceAfter,
          fulfillmentOrderId,
          `Products packed for order ${fulfillmentOrder.order_number}.`,
        ]
      );

      await connection.execute(
        `
          UPDATE inventory_items
          SET current_quantity = ?
          WHERE id = ?
        `,
        [
          balanceAfter,
          product.inventory_item_id,
        ]
      );
    }

    /*
     * Deduct packing materials.
     * Thank-you notes use "distributed"
     * instead of ordinary stock out.
     */
    for (const usage of packagingUsage) {
      const item = packagingById.get(
        Number(
          usage.inventoryItemId
        )
      );

      const balanceBefore = Number(
        item.current_quantity
      );

      const balanceAfter =
        balanceBefore -
        usage.quantityUsed;

      const movementType =
        item.category ===
        'thank_you_note'
          ? 'distributed'
          : 'stock_out';

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
          usage.inventoryItemId,
          req.user.id,
          movementType,
          usage.quantityUsed,
          balanceBefore,
          balanceAfter,
          'fulfillment_order',
          fulfillmentOrderId,
          `${item.item_name} used for order ${fulfillmentOrder.order_number}.`,
        ]
      );

      await connection.execute(
        `
          UPDATE inventory_items
          SET current_quantity = ?
          WHERE id = ?
        `,
        [
          balanceAfter,
          usage.inventoryItemId,
        ]
      );
    }

    await connection.execute(
      `
        UPDATE fulfillment_orders
        SET
          handled_by = ?,
          fulfillment_status =
            'packed',
          packing_notes = ?,
          packed_at = NOW(),
          inventory_deducted_at =
            NOW()
        WHERE id = ?
      `,
      [
        req.user.id,
        packingNotes || null,
        fulfillmentOrderId,
      ]
    );

    await addStatusHistory(
      connection,
      fulfillmentOrderId,
      req.user.id,
      'packing',
      'packed',
      packingNotes
    );

    await connection.commit();

    return res.json({
      success: true,

      message:
        'Packing completed and inventory deducted successfully.',

      fulfillmentStatus: 'packed',
    });
  } catch (error) {
    if (connection) {
      try {
        await connection.rollback();
      } catch (rollbackError) {
        console.error(
          'Complete packing rollback error:',
          rollbackError
        );
      }
    }

    console.error(
      'Complete packing error:',
      error
    );

    return res.status(500).json({
      success: false,
      message:
        'Unable to complete packing.',
    });
  } finally {
    if (connection) {
      connection.release();
    }
  }
};

// PATCH /api/fulfillment/orders/:id/ready
exports.markReadyForShipment = async (
  req,
  res
) => {
  let connection;

  try {
    const fulfillmentOrderId =
      parsePositiveInteger(
        req.params.id
      );

    const notes = cleanText(
      req.body.notes
    );

    if (!fulfillmentOrderId) {
      return res.status(400).json({
        success: false,
        message:
          'Invalid fulfillment order.',
      });
    }

    connection =
      await pool.getConnection();

    await connection.beginTransaction();

    const order =
      await getLockedFulfillmentOrder(
        connection,
        fulfillmentOrderId
      );

    if (!order) {
      await connection.rollback();

      return res.status(404).json({
        success: false,
        message:
          'Fulfillment order not found.',
      });
    }

    if (
      order.fulfillment_status !==
      'packed'
    ) {
      await connection.rollback();

      return res.status(400).json({
        success: false,
        message:
          'Only packed orders can be marked ready for shipment.',
      });
    }

    await connection.execute(
      `
        UPDATE fulfillment_orders
        SET
          handled_by = ?,
          fulfillment_status =
            'ready_for_shipment',
          ready_for_shipment_at =
            NOW()
        WHERE id = ?
      `,
      [
        req.user.id,
        fulfillmentOrderId,
      ]
    );

    await addStatusHistory(
      connection,
      fulfillmentOrderId,
      req.user.id,
      'packed',
      'ready_for_shipment',
      notes
    );

    await connection.commit();

    return res.json({
      success: true,
      message:
        'Order marked as ready for shipment.',
      fulfillmentStatus:
        'ready_for_shipment',
    });
  } catch (error) {
    if (connection) {
      try {
        await connection.rollback();
      } catch (rollbackError) {
        console.error(
          'Ready shipment rollback error:',
          rollbackError
        );
      }
    }

    console.error(
      'Mark ready for shipment error:',
      error
    );

    return res.status(500).json({
      success: false,
      message:
        'Unable to mark the order as ready for shipment.',
    });
  } finally {
    if (connection) {
      connection.release();
    }
  }
};

// PATCH /api/fulfillment/orders/:id/ship
exports.shipOrder = async (
  req,
  res
) => {
  let connection;

  try {
    const fulfillmentOrderId =
      parsePositiveInteger(
        req.params.id
      );

    const thirdPartyLogistics =
      cleanText(
        req.body.thirdPartyLogistics
      );

    const trackingNumber =
      cleanText(
        req.body.trackingNumber
      );

    const shippingNotes =
      cleanText(
        req.body.shippingNotes
      );

    if (!fulfillmentOrderId) {
      return res.status(400).json({
        success: false,
        message:
          'Invalid fulfillment order.',
      });
    }

    if (!thirdPartyLogistics) {
      return res.status(400).json({
        success: false,
        message:
          'Third-party logistics provider is required.',
      });
    }

    if (!trackingNumber) {
      return res.status(400).json({
        success: false,
        message:
          'Tracking number is required.',
      });
    }

    connection =
      await pool.getConnection();

    await connection.beginTransaction();

    const order =
      await getLockedFulfillmentOrder(
        connection,
        fulfillmentOrderId
      );

    if (!order) {
      await connection.rollback();

      return res.status(404).json({
        success: false,
        message:
          'Fulfillment order not found.',
      });
    }

    if (
      order.fulfillment_status !==
      'ready_for_shipment'
    ) {
      await connection.rollback();

      return res.status(400).json({
        success: false,
        message:
          'Only orders ready for shipment can be shipped out.',
      });
    }

    await connection.execute(
      `
        UPDATE fulfillment_orders
        SET
          handled_by = ?,
          fulfillment_status =
            'shipped_out',
          third_party_logistics = ?,
          tracking_number = ?,
          shipping_notes = ?,
          shipped_out_at = NOW()
        WHERE id = ?
      `,
      [
        req.user.id,
        thirdPartyLogistics,
        trackingNumber,
        shippingNotes || null,
        fulfillmentOrderId,
      ]
    );

    await addStatusHistory(
      connection,
      fulfillmentOrderId,
      req.user.id,
      'ready_for_shipment',
      'shipped_out',
      shippingNotes ||
        `${thirdPartyLogistics}: ${trackingNumber}`
    );

    await connection.commit();

    return res.json({
      success: true,
      message:
        'Order marked as shipped out.',
      fulfillmentStatus:
        'shipped_out',
    });
  } catch (error) {
    if (connection) {
      try {
        await connection.rollback();
      } catch (rollbackError) {
        console.error(
          'Ship order rollback error:',
          rollbackError
        );
      }
    }

    console.error(
      'Ship order error:',
      error
    );

    return res.status(500).json({
      success: false,
      message:
        'Unable to ship the order.',
    });
  } finally {
    if (connection) {
      connection.release();
    }
  }
};

// PATCH /api/fulfillment/orders/:id/deliver
exports.markDelivered = async (
  req,
  res
) => {
  let connection;

  try {
    const fulfillmentOrderId =
      parsePositiveInteger(
        req.params.id
      );

    const notes = cleanText(
      req.body.notes
    );

    if (!fulfillmentOrderId) {
      return res.status(400).json({
        success: false,
        message:
          'Invalid fulfillment order.',
      });
    }

    connection =
      await pool.getConnection();

    await connection.beginTransaction();

    const order =
      await getLockedFulfillmentOrder(
        connection,
        fulfillmentOrderId
      );

    if (!order) {
      await connection.rollback();

      return res.status(404).json({
        success: false,
        message:
          'Fulfillment order not found.',
      });
    }

    if (
      order.fulfillment_status !==
      'shipped_out'
    ) {
      await connection.rollback();

      return res.status(400).json({
        success: false,
        message:
          'Only shipped-out orders can be marked delivered.',
      });
    }

    await connection.execute(
      `
        UPDATE fulfillment_orders
        SET
          handled_by = ?,
          fulfillment_status =
            'delivered',
          delivered_at = NOW()
        WHERE id = ?
      `,
      [
        req.user.id,
        fulfillmentOrderId,
      ]
    );

    await addStatusHistory(
      connection,
      fulfillmentOrderId,
      req.user.id,
      'shipped_out',
      'delivered',
      notes
    );

    await connection.commit();

    return res.json({
      success: true,
      message:
        'Order marked as delivered.',
      fulfillmentStatus: 'delivered',
    });
  } catch (error) {
    if (connection) {
      try {
        await connection.rollback();
      } catch (rollbackError) {
        console.error(
          'Delivered rollback error:',
          rollbackError
        );
      }
    }

    console.error(
      'Mark delivered error:',
      error
    );

    return res.status(500).json({
      success: false,
      message:
        'Unable to mark the order as delivered.',
    });
  } finally {
    if (connection) {
      connection.release();
    }
  }
};

// PATCH /api/fulfillment/orders/:id/return
exports.markReturnedToSender = async (
  req,
  res
) => {
  let connection;

  try {
    const fulfillmentOrderId =
      parsePositiveInteger(
        req.params.id
      );

    const returnReason = cleanText(
      req.body.returnReason
    );

    if (!fulfillmentOrderId) {
      return res.status(400).json({
        success: false,
        message:
          'Invalid fulfillment order.',
      });
    }

    if (!returnReason) {
      return res.status(400).json({
        success: false,
        message:
          'Return-to-sender reason is required.',
      });
    }

    connection =
      await pool.getConnection();

    await connection.beginTransaction();

    const order =
      await getLockedFulfillmentOrder(
        connection,
        fulfillmentOrderId
      );

    if (!order) {
      await connection.rollback();

      return res.status(404).json({
        success: false,
        message:
          'Fulfillment order not found.',
      });
    }

    if (
      order.fulfillment_status !==
      'shipped_out'
    ) {
      await connection.rollback();

      return res.status(400).json({
        success: false,
        message:
          'Only shipped-out orders can be marked returned to sender.',
      });
    }

    await connection.execute(
      `
        UPDATE fulfillment_orders
        SET
          handled_by = ?,
          fulfillment_status =
            'returned_to_sender',
          return_reason = ?,
          returned_at = NOW()
        WHERE id = ?
      `,
      [
        req.user.id,
        returnReason,
        fulfillmentOrderId,
      ]
    );

    await addStatusHistory(
      connection,
      fulfillmentOrderId,
      req.user.id,
      'shipped_out',
      'returned_to_sender',
      returnReason
    );

    await connection.commit();

    return res.json({
      success: true,
      message:
        'Order marked as returned to sender.',
      fulfillmentStatus:
        'returned_to_sender',
    });
  } catch (error) {
    if (connection) {
      try {
        await connection.rollback();
      } catch (rollbackError) {
        console.error(
          'RTS rollback error:',
          rollbackError
        );
      }
    }

    console.error(
      'Mark returned error:',
      error
    );

    return res.status(500).json({
      success: false,
      message:
        'Unable to mark the order as returned to sender.',
    });
  } finally {
    if (connection) {
      connection.release();
    }
  }
};