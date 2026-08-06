const pool = require('../config/db');

const CDM_STATUSES = [
  'pending',
  'confirmed',
  'rejected',
];

function cleanText(value) {
  return String(value || '').trim();
}

function isValidHttpUrl(value) {
  if (!value) {
    return true;
  }

  try {
    const parsedUrl = new URL(value);

    return ['http:', 'https:'].includes(
      parsedUrl.protocol
    );
  } catch {
    return false;
  }
}

function formatOrder(row) {
  return {
    id: row.id,
    orderNumber: row.order_number,

    customer: {
      id: row.customer_id,
      fullName: row.customer_name,
      contactNumber: row.contact_number,
      address: row.address,
    },

    encodedBy: {
      id: row.encoded_by,
      fullName:
        row.encoded_by_name || 'Former user',
    },

    handledBy: row.handled_by
      ? {
          id: row.handled_by,
          fullName:
            row.handled_by_name ||
            'Former user',
        }
      : null,

    conversationLink:
      row.conversation_link,

    skinConcern: row.skin_concern,
    tags: row.tags,
    notes: row.notes,

    totalAmount: Number(
      row.total_amount || 0
    ),

    orderStatus: row.order_status,

    confirmationStatus:
      row.confirmation_status || 'pending',

    confirmationNotes:
      row.confirmation_notes,

    waybillNumber:
      row.waybill_number,

    waybillLink:
      row.waybill_link,

    itemCount: Number(
      row.item_count || 0
    ),

    totalUnits: Number(
      row.total_units || 0
    ),

    dateEncoded: row.date_encoded,
    submittedAt: row.submitted_at,
    confirmedAt:
      row.cdm_confirmed_at ||
      row.order_confirmed_at,

    rejectedAt:
      row.cdm_rejected_at ||
      row.order_rejected_at,

    waybillGeneratedAt:
      row.waybill_generated_at,

    sentToCustomerAt:
      row.sent_to_customer_at,

    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

// GET /api/cdm/orders
exports.getOrders = async (req, res) => {
  try {
    const search = cleanText(
      req.query.search
    );

    const status = cleanText(
      req.query.status
    );

    if (
      status &&
      !CDM_STATUSES.includes(status)
    ) {
      return res.status(400).json({
        success: false,
        message: 'Invalid CDM status.',
      });
    }

    const conditions = [
      `
        o.order_status IN (
          'for_confirmation',
          'confirmed',
          'rejected'
        )
      `,
    ];

    const values = [];

    if (status === 'pending') {
      conditions.push(`
        o.order_status = 'for_confirmation'
      `);
    }

    if (status === 'confirmed') {
      conditions.push(`
        o.order_status = 'confirmed'
      `);
    }

    if (status === 'rejected') {
      conditions.push(`
        o.order_status = 'rejected'
      `);
    }

    if (search) {
      const keyword = `%${search}%`;

      conditions.push(`
        (
          o.order_number LIKE ?
          OR c.full_name LIKE ?
          OR c.contact_number LIKE ?
          OR cp.waybill_number LIKE ?
        )
      `);

      values.push(
        keyword,
        keyword,
        keyword,
        keyword
      );
    }

    const [rows] = await pool.execute(
      `
        SELECT
          o.id,
          o.order_number,
          o.customer_id,
          o.encoded_by,
          o.conversation_link,
          o.skin_concern,
          o.tags,
          o.notes,
          o.total_amount,
          o.order_status,
          o.date_encoded,
          o.submitted_at,
          o.confirmed_at
            AS order_confirmed_at,
          o.rejected_at
            AS order_rejected_at,
          o.created_at,
          o.updated_at,

          c.full_name
            AS customer_name,
          c.contact_number,
          c.address,

          encoded_user.full_name
            AS encoded_by_name,

          cp.handled_by,
          cp.confirmation_status,
          cp.confirmation_notes,
          cp.waybill_number,
          cp.waybill_link,
          cp.confirmed_at
            AS cdm_confirmed_at,
          cp.rejected_at
            AS cdm_rejected_at,
          cp.waybill_generated_at,
          cp.sent_to_customer_at,

          handled_user.full_name
            AS handled_by_name,

          COUNT(oi.id)
            AS item_count,

          COALESCE(
            SUM(oi.quantity),
            0
          ) AS total_units

        FROM orders o

        INNER JOIN customers c
          ON c.id = o.customer_id

        LEFT JOIN users encoded_user
          ON encoded_user.id =
             o.encoded_by

        LEFT JOIN cdm_order_processing cp
          ON cp.order_id = o.id

        LEFT JOIN users handled_user
          ON handled_user.id =
             cp.handled_by

        LEFT JOIN order_items oi
          ON oi.order_id = o.id

        WHERE ${conditions.join(' AND ')}

        GROUP BY
          o.id,
          o.order_number,
          o.customer_id,
          o.encoded_by,
          o.conversation_link,
          o.skin_concern,
          o.tags,
          o.notes,
          o.total_amount,
          o.order_status,
          o.date_encoded,
          o.submitted_at,
          o.confirmed_at,
          o.rejected_at,
          o.created_at,
          o.updated_at,

          c.full_name,
          c.contact_number,
          c.address,

          encoded_user.full_name,

          cp.handled_by,
          cp.confirmation_status,
          cp.confirmation_notes,
          cp.waybill_number,
          cp.waybill_link,
          cp.confirmed_at,
          cp.rejected_at,
          cp.waybill_generated_at,
          cp.sent_to_customer_at,

          handled_user.full_name

        ORDER BY
          CASE
            WHEN o.order_status =
              'for_confirmation'
              THEN 1
            WHEN o.order_status =
              'confirmed'
              THEN 2
            ELSE 3
          END,
          o.submitted_at DESC,
          o.date_encoded DESC
      `,
      values
    );

    return res.json({
      success: true,
      orders: rows.map(formatOrder),
    });
  } catch (error) {
    console.error(
      'Get CDM orders error:',
      error
    );

    return res.status(500).json({
      success: false,
      message:
        'Unable to retrieve CDM orders.',
    });
  }
};

// GET /api/cdm/orders/:id
exports.getOrderById = async (
  req,
  res
) => {
  try {
    const orderId = Number(
      req.params.id
    );

    if (
      !Number.isInteger(orderId) ||
      orderId <= 0
    ) {
      return res.status(400).json({
        success: false,
        message: 'Invalid order.',
      });
    }

    const [orderRows] =
      await pool.execute(
        `
          SELECT
            o.id,
            o.order_number,
            o.customer_id,
            o.encoded_by,
            o.conversation_link,
            o.skin_concern,
            o.tags,
            o.notes,
            o.total_amount,
            o.order_status,
            o.date_encoded,
            o.submitted_at,
            o.confirmed_at
              AS order_confirmed_at,
            o.rejected_at
              AS order_rejected_at,
            o.created_at,
            o.updated_at,

            c.full_name
              AS customer_name,
            c.contact_number,
            c.address,

            encoded_user.full_name
              AS encoded_by_name,

            cp.handled_by,
            cp.confirmation_status,
            cp.confirmation_notes,
            cp.waybill_number,
            cp.waybill_link,
            cp.confirmed_at
              AS cdm_confirmed_at,
            cp.rejected_at
              AS cdm_rejected_at,
            cp.waybill_generated_at,
            cp.sent_to_customer_at,

            handled_user.full_name
              AS handled_by_name,

            0 AS item_count,
            0 AS total_units

          FROM orders o

          INNER JOIN customers c
            ON c.id = o.customer_id

          LEFT JOIN users encoded_user
            ON encoded_user.id =
               o.encoded_by

          LEFT JOIN cdm_order_processing cp
            ON cp.order_id = o.id

          LEFT JOIN users handled_user
            ON handled_user.id =
               cp.handled_by

          WHERE o.id = ?
            AND o.order_status IN (
              'for_confirmation',
              'confirmed',
              'rejected'
            )

          LIMIT 1
        `,
        [orderId]
      );

    if (orderRows.length === 0) {
      return res.status(404).json({
        success: false,
        message:
          'CDM order was not found.',
      });
    }

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
        [orderId]
      );

    const order = formatOrder(
      orderRows[0]
    );

    order.itemCount = itemRows.length;

    order.totalUnits =
      itemRows.reduce(
        (total, item) =>
          total +
          Number(item.quantity),
        0
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
      })
    );

    return res.json({
      success: true,
      order,
    });
  } catch (error) {
    console.error(
      'Get CDM order details error:',
      error
    );

    return res.status(500).json({
      success: false,
      message:
        'Unable to retrieve order details.',
    });
  }
};

// PATCH /api/cdm/orders/:id/confirm
exports.confirmOrder = async (
  req,
  res
) => {
  let connection;

  try {
    const orderId = Number(
      req.params.id
    );

    const confirmationNotes =
      cleanText(
        req.body.confirmationNotes
      );

    if (
      !Number.isInteger(orderId) ||
      orderId <= 0
    ) {
      return res.status(400).json({
        success: false,
        message: 'Invalid order.',
      });
    }

    connection =
      await pool.getConnection();

    await connection.beginTransaction();

    const [orderRows] =
      await connection.execute(
        `
          SELECT
            id,
            order_status
          FROM orders
          WHERE id = ?
          FOR UPDATE
        `,
        [orderId]
      );

    if (orderRows.length === 0) {
      await connection.rollback();

      return res.status(404).json({
        success: false,
        message: 'Order not found.',
      });
    }

    if (
      orderRows[0].order_status !==
      'for_confirmation'
    ) {
      await connection.rollback();

      return res.status(400).json({
        success: false,
        message:
          'Only orders waiting for confirmation can be confirmed.',
      });
    }

    await connection.execute(
      `
        INSERT INTO cdm_order_processing (
          order_id,
          handled_by,
          confirmation_status,
          confirmation_notes,
          confirmed_at,
          rejected_at
        )
        VALUES (
          ?,
          ?,
          'confirmed',
          ?,
          NOW(),
          NULL
        )
        ON DUPLICATE KEY UPDATE
          handled_by =
            VALUES(handled_by),

          confirmation_status =
            'confirmed',

          confirmation_notes =
            VALUES(
              confirmation_notes
            ),

          confirmed_at = NOW(),
          rejected_at = NULL
      `,
      [
        orderId,
        req.user.id,
        confirmationNotes || null,
      ]
    );

    await connection.execute(
      `
        UPDATE orders
        SET
          order_status = 'confirmed',
          confirmed_at = NOW(),
          rejected_at = NULL
        WHERE id = ?
      `,
      [orderId]
    );

    await connection.commit();

    return res.json({
      success: true,
      message:
        'Order confirmed successfully.',
      orderStatus: 'confirmed',
      confirmationStatus: 'confirmed',
    });
  } catch (error) {
    if (connection) {
      try {
        await connection.rollback();
      } catch (rollbackError) {
        console.error(
          'Confirm rollback error:',
          rollbackError
        );
      }
    }

    console.error(
      'Confirm order error:',
      error
    );

    return res.status(500).json({
      success: false,
      message:
        'Unable to confirm the order.',
    });
  } finally {
    if (connection) {
      connection.release();
    }
  }
};

// PATCH /api/cdm/orders/:id/reject
exports.rejectOrder = async (
  req,
  res
) => {
  let connection;

  try {
    const orderId = Number(
      req.params.id
    );

    const rejectionReason =
      cleanText(
        req.body.rejectionReason
      );

    if (
      !Number.isInteger(orderId) ||
      orderId <= 0
    ) {
      return res.status(400).json({
        success: false,
        message: 'Invalid order.',
      });
    }

    if (!rejectionReason) {
      return res.status(400).json({
        success: false,
        message:
          'A rejection reason is required.',
      });
    }

    connection =
      await pool.getConnection();

    await connection.beginTransaction();

    const [orderRows] =
      await connection.execute(
        `
          SELECT
            id,
            order_status
          FROM orders
          WHERE id = ?
          FOR UPDATE
        `,
        [orderId]
      );

    if (orderRows.length === 0) {
      await connection.rollback();

      return res.status(404).json({
        success: false,
        message: 'Order not found.',
      });
    }

    if (
      orderRows[0].order_status !==
      'for_confirmation'
    ) {
      await connection.rollback();

      return res.status(400).json({
        success: false,
        message:
          'Only orders waiting for confirmation can be rejected.',
      });
    }

    await connection.execute(
      `
        INSERT INTO cdm_order_processing (
          order_id,
          handled_by,
          confirmation_status,
          confirmation_notes,
          confirmed_at,
          rejected_at
        )
        VALUES (
          ?,
          ?,
          'rejected',
          ?,
          NULL,
          NOW()
        )
        ON DUPLICATE KEY UPDATE
          handled_by =
            VALUES(handled_by),

          confirmation_status =
            'rejected',

          confirmation_notes =
            VALUES(
              confirmation_notes
            ),

          confirmed_at = NULL,
          rejected_at = NOW()
      `,
      [
        orderId,
        req.user.id,
        rejectionReason,
      ]
    );

    await connection.execute(
      `
        UPDATE orders
        SET
          order_status = 'rejected',
          rejected_at = NOW(),
          confirmed_at = NULL
        WHERE id = ?
      `,
      [orderId]
    );

    await connection.commit();

    return res.json({
      success: true,
      message:
        'Order rejected successfully.',
      orderStatus: 'rejected',
      confirmationStatus: 'rejected',
    });
  } catch (error) {
    if (connection) {
      try {
        await connection.rollback();
      } catch (rollbackError) {
        console.error(
          'Reject rollback error:',
          rollbackError
        );
      }
    }

    console.error(
      'Reject order error:',
      error
    );

    return res.status(500).json({
      success: false,
      message:
        'Unable to reject the order.',
    });
  } finally {
    if (connection) {
      connection.release();
    }
  }
};

// PATCH /api/cdm/orders/:id/waybill
exports.saveWaybill = async (
  req,
  res
) => {
  try {
    const orderId = Number(
      req.params.id
    );

    const waybillNumber =
      cleanText(
        req.body.waybillNumber
      );

    const waybillLink =
      cleanText(
        req.body.waybillLink
      );

    if (
      !Number.isInteger(orderId) ||
      orderId <= 0
    ) {
      return res.status(400).json({
        success: false,
        message: 'Invalid order.',
      });
    }

    if (
      !waybillNumber &&
      !waybillLink
    ) {
      return res.status(400).json({
        success: false,
        message:
          'Enter a waybill number or waybill link.',
      });
    }

    if (
      !isValidHttpUrl(waybillLink)
    ) {
      return res.status(400).json({
        success: false,
        message:
          'Waybill link must be a valid HTTP or HTTPS link.',
      });
    }

    const [orderRows] =
      await pool.execute(
        `
          SELECT
            id,
            order_status
          FROM orders
          WHERE id = ?
          LIMIT 1
        `,
        [orderId]
      );

    if (orderRows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Order not found.',
      });
    }

    if (
      orderRows[0].order_status !==
      'confirmed'
    ) {
      return res.status(400).json({
        success: false,
        message:
          'A waybill can only be added to a confirmed order.',
      });
    }

    const [result] =
      await pool.execute(
        `
          UPDATE cdm_order_processing
          SET
            handled_by = ?,
            waybill_number = ?,
            waybill_link = ?,
            waybill_generated_at =
              NOW()
          WHERE order_id = ?
            AND confirmation_status =
              'confirmed'
        `,
        [
          req.user.id,
          waybillNumber || null,
          waybillLink || null,
          orderId,
        ]
      );

    if (result.affectedRows === 0) {
      return res.status(400).json({
        success: false,
        message:
          'The CDM confirmation record is unavailable.',
      });
    }

    return res.json({
      success: true,
      message:
        'Waybill information saved successfully.',
      waybillNumber:
        waybillNumber || null,
      waybillLink:
        waybillLink || null,
    });
  } catch (error) {
    console.error(
      'Save waybill error:',
      error
    );

    return res.status(500).json({
      success: false,
      message:
        'Unable to save waybill information.',
    });
  }
};

// PATCH /api/cdm/orders/:id/send
exports.markSentToCustomer = async (
  req,
  res
) => {
  try {
    const orderId = Number(
      req.params.id
    );

    if (
      !Number.isInteger(orderId) ||
      orderId <= 0
    ) {
      return res.status(400).json({
        success: false,
        message: 'Invalid order.',
      });
    }

    const [rows] = await pool.execute(
      `
        SELECT
          o.order_status,
          cp.id,
          cp.waybill_number,
          cp.waybill_link

        FROM orders o

        LEFT JOIN cdm_order_processing cp
          ON cp.order_id = o.id

        WHERE o.id = ?
        LIMIT 1
      `,
      [orderId]
    );

    if (rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Order not found.',
      });
    }

    if (
      rows[0].order_status !==
      'confirmed'
    ) {
      return res.status(400).json({
        success: false,
        message:
          'Only confirmed orders can be sent to the customer.',
      });
    }

    if (
      !rows[0].waybill_number &&
      !rows[0].waybill_link
    ) {
      return res.status(400).json({
        success: false,
        message:
          'Add waybill information before marking the order as sent.',
      });
    }

    await pool.execute(
      `
        UPDATE cdm_order_processing
        SET
          handled_by = ?,
          sent_to_customer_at = NOW()
        WHERE order_id = ?
      `,
      [req.user.id, orderId]
    );

    return res.json({
      success: true,
      message:
        'Waybill marked as sent to the customer.',
      sentToCustomerAt: new Date(),
    });
  } catch (error) {
    console.error(
      'Mark sent error:',
      error
    );

    return res.status(500).json({
      success: false,
      message:
        'Unable to update the sent status.',
    });
  }
};