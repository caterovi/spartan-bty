const crypto = require('crypto');
const pool = require('../config/db');
const {
  deriveOrderWorkflow,
} = require('../utils/orderWorkflow');

const {
  cleanText,
  isValidHttpUrl,
} = require('../utils/validation');

const CREATE_STATUSES = [
  'draft',
  'for_confirmation',
];

const ORDER_STATUSES = [
  'draft',
  'for_confirmation',
  'confirmed',
  'rejected',
  'cancelled',
];

function normalizeContactNumber(value) {
  return cleanText(value).replace(/[+ ()-]/g, '');
}

function getPhilippineDateCode() {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Manila',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date());

  const values = {};

  for (const part of parts) {
    values[part.type] = part.value;
  }

  return `${values.year}${values.month}${values.day}`;
}

function generateOrderNumber() {
  const dateCode = getPhilippineDateCode();

  const randomCode = crypto
    .randomBytes(3)
    .toString('hex')
    .toUpperCase();

  return `BTY-${dateCode}-${randomCode}`;
}

function getOrderWorkflow(row) {
  return deriveOrderWorkflow({
    orderSource: row.order_source,
    salesReviewStatus: row.sales_review_status,
    salesReviewedAt: row.sales_reviewed_at,
    orderStatus: row.order_status,
    createdAt: row.created_at,
    submittedAt: row.submitted_at,
    confirmedAt: row.confirmed_at,
    rejectedAt: row.rejected_at,
    cancelledAt: row.cancelled_at,
    waybillNumber:
      row.workflow_waybill_number,
    waybillLink:
      row.workflow_waybill_link,
    sentToCustomerAt:
      row.sent_to_customer_at,
    fulfillmentStatus:
      row.fulfillment_status,
    fulfillmentCreatedAt:
      row.fulfillment_created_at,
    fulfillmentUpdatedAt:
      row.fulfillment_updated_at,
    packingStartedAt:
      row.packing_started_at,
    packedAt: row.packed_at,
    readyForShipmentAt:
      row.ready_for_shipment_at,
    shippedOutAt: row.shipped_out_at,
    deliveredAt: row.delivered_at,
    returnedAt: row.returned_at,
    crmCaseId: row.crm_case_id,
    crmCaseStatus: row.crm_case_status,
    crmCurrentStep: row.crm_current_step,
    crmHandledBy: row.crm_handled_by,
    crmCreatedAt: row.crm_created_at,
  });
}

// GET /api/sales/products
exports.getProducts = async (req, res) => {
  try {
    const [rows] = await pool.execute(`
      SELECT
        id,
        sku,
        product_name,
        default_price,
        status,
        created_at,
        updated_at
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
        defaultPrice: Number(product.default_price),
        status: product.status,
      })),
    });
  } catch (error) {
    console.error('Get products error:', error);

    return res.status(500).json({
      success: false,
      message: 'Unable to retrieve products.',
    });
  }
};

// GET /api/sales/customers?search=
exports.getCustomers = async (req, res) => {
  try {
    const search = cleanText(req.query.search);
    const keyword = `%${search}%`;

    const [rows] = await pool.execute(
      `
        SELECT
          id,
          full_name,
          contact_number,
          address,
          created_at,
          updated_at
        FROM customers
        WHERE (
          ? = ''
          OR full_name LIKE ?
          OR contact_number LIKE ?
        )
        ORDER BY full_name ASC
        LIMIT 50
      `,
      [search, keyword, keyword]
    );

    return res.json({
      success: true,
      customers: rows.map((customer) => ({
        id: customer.id,
        fullName: customer.full_name,
        contactNumber: customer.contact_number,
        address: customer.address,
        createdAt: customer.created_at,
        updatedAt: customer.updated_at,
      })),
    });
  } catch (error) {
    console.error('Get customers error:', error);

    return res.status(500).json({
      success: false,
      message: 'Unable to retrieve customers.',
    });
  }
};

// GET /api/sales/orders
exports.getOrders = async (req, res) => {
  try {
    const search = cleanText(req.query.search);
    const status = cleanText(req.query.status);

    if (
      status &&
      !ORDER_STATUSES.includes(status)
    ) {
      return res.status(400).json({
        success: false,
        message: 'Invalid order status.',
      });
    }

    const conditions = [];
    const values = [];

    if (status) {
      conditions.push('o.order_status = ?');
      values.push(status);
    }

    if (search) {
      conditions.push(`
        (
          o.order_number LIKE ?
          OR c.full_name LIKE ?
          OR c.contact_number LIKE ?
        )
      `);

      const keyword = `%${search}%`;

      values.push(keyword, keyword, keyword);
    }

    const whereClause =
      conditions.length > 0
        ? `WHERE ${conditions.join(' AND ')}`
        : '';

    const [rows] = await pool.execute(
      `
        SELECT
          o.id,
          o.order_number,
          o.customer_id,
          o.encoded_by,
          o.order_source,
          o.sales_review_status,
          o.delivery_name_snapshot,
          o.delivery_contact_snapshot,
          o.delivery_address_snapshot,
          o.public_status_message,
          o.sales_reviewed_by,
          o.sales_reviewed_at,
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
          o.cancelled_at,
          o.created_at,
          o.updated_at,

          c.full_name AS customer_name,
          c.contact_number,
          c.address,

          u.full_name AS encoded_by_name,

          MAX(cp.waybill_number)
            AS workflow_waybill_number,
          MAX(cp.waybill_link)
            AS workflow_waybill_link,
          MAX(cp.sent_to_customer_at)
            AS sent_to_customer_at,

          MAX(fo.fulfillment_status)
            AS fulfillment_status,
          MAX(fo.created_at)
            AS fulfillment_created_at,
          MAX(fo.updated_at)
            AS fulfillment_updated_at,
          MAX(fo.packing_started_at)
            AS packing_started_at,
          MAX(fo.packed_at)
            AS packed_at,
          MAX(fo.ready_for_shipment_at)
            AS ready_for_shipment_at,
          MAX(fo.shipped_out_at)
            AS shipped_out_at,
          MAX(fo.delivered_at)
            AS delivered_at,
          MAX(fo.returned_at)
            AS returned_at,

          MAX(cc.id) AS crm_case_id,
          MAX(cc.case_status)
            AS crm_case_status,
          MAX(cc.current_step)
            AS crm_current_step,
          MAX(cc.handled_by)
            AS crm_handled_by,
          MAX(cc.created_at)
            AS crm_created_at,

          COUNT(oi.id) AS item_count,
          COALESCE(SUM(oi.quantity), 0) AS total_units

        FROM orders o

        INNER JOIN customers c
          ON c.id = o.customer_id

        LEFT JOIN users u
          ON u.id = o.encoded_by

        LEFT JOIN cdm_order_processing cp
          ON cp.order_id = o.id

        LEFT JOIN fulfillment_orders fo
          ON fo.order_id = o.id

        LEFT JOIN crm_cases cc
          ON cc.order_id = o.id

        LEFT JOIN order_items oi
          ON oi.order_id = o.id

        ${whereClause}

        GROUP BY
          o.id,
          o.order_number,
          o.customer_id,
          o.encoded_by,
          o.order_source,
          o.sales_review_status,
          o.delivery_name_snapshot,
          o.delivery_contact_snapshot,
          o.delivery_address_snapshot,
          o.public_status_message,
          o.sales_reviewed_by,
          o.sales_reviewed_at,
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
          o.cancelled_at,
          o.created_at,
          o.updated_at,
          c.full_name,
          c.contact_number,
          c.address,
          u.full_name

        ORDER BY o.date_encoded DESC
      `,
      values
    );

    return res.json({
      success: true,
      orders: rows.map((order) => ({
        id: order.id,
        orderNumber: order.order_number,

        customer: {
          id: order.customer_id,
          fullName: order.customer_name,
          contactNumber: order.contact_number,
          address: order.address,
        },

        encodedBy: {
          id: order.encoded_by,
          fullName:
            order.encoded_by_name ||
            (order.order_source === 'storefront'
              ? 'Online storefront'
              : 'Former user'),
        },

        orderSource: order.order_source || 'staff',
        salesReviewStatus:
          order.sales_review_status || 'not_required',
        deliverySnapshot: {
          fullName: order.delivery_name_snapshot,
          contactNumber: order.delivery_contact_snapshot,
          address: order.delivery_address_snapshot,
        },
        publicStatusMessage: order.public_status_message,
        salesReviewedAt: order.sales_reviewed_at,

        conversationLink:
          order.conversation_link,

        skinConcern: order.skin_concern,
        tags: order.tags,
        notes: order.notes,

        totalAmount: Number(
          order.total_amount
        ),

        orderStatus: order.order_status,

        itemCount: Number(order.item_count),
        totalUnits: Number(order.total_units),

        dateEncoded: order.date_encoded,
        submittedAt: order.submitted_at,
        confirmedAt: order.confirmed_at,
        rejectedAt: order.rejected_at,
        cancelledAt: order.cancelled_at,
        createdAt: order.created_at,
        updatedAt: order.updated_at,
        workflow: getOrderWorkflow(order),
      })),
    });
  } catch (error) {
    console.error('Get orders error:', error);

    return res.status(500).json({
      success: false,
      message: 'Unable to retrieve orders.',
    });
  }
};

// GET /api/sales/orders/:id
exports.getOrderById = async (req, res) => {
  try {
    const orderId = Number(req.params.id);

    if (
      !Number.isInteger(orderId) ||
      orderId <= 0
    ) {
      return res.status(400).json({
        success: false,
        message: 'Invalid order.',
      });
    }

    const [orderRows] = await pool.execute(
      `
        SELECT
          o.id,
          o.order_number,
          o.customer_id,
          o.encoded_by,
          o.order_source,
          o.sales_review_status,
          o.delivery_name_snapshot,
          o.delivery_contact_snapshot,
          o.delivery_address_snapshot,
          o.public_status_message,
          o.sales_reviewed_by,
          o.sales_reviewed_at,
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
          o.cancelled_at,
          o.created_at,
          o.updated_at,

          c.full_name AS customer_name,
          c.contact_number,
          c.address,

          u.full_name AS encoded_by_name,

          cp.waybill_number
            AS workflow_waybill_number,
          cp.waybill_link
            AS workflow_waybill_link,
          cp.sent_to_customer_at,

          fo.fulfillment_status,
          fo.created_at
            AS fulfillment_created_at,
          fo.updated_at
            AS fulfillment_updated_at,
          fo.packing_started_at,
          fo.packed_at,
          fo.ready_for_shipment_at,
          fo.shipped_out_at,
          fo.delivered_at,
          fo.returned_at,

          cc.id AS crm_case_id,
          cc.case_status
            AS crm_case_status,
          cc.current_step
            AS crm_current_step,
          cc.handled_by
            AS crm_handled_by,
          cc.created_at
            AS crm_created_at

        FROM orders o

        INNER JOIN customers c
          ON c.id = o.customer_id

        LEFT JOIN users u
          ON u.id = o.encoded_by

        LEFT JOIN cdm_order_processing cp
          ON cp.order_id = o.id

        LEFT JOIN fulfillment_orders fo
          ON fo.order_id = o.id

        LEFT JOIN crm_cases cc
          ON cc.order_id = o.id

        WHERE o.id = ?
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

    const [itemRows] = await pool.execute(
      `
        SELECT
          oi.id,
          oi.product_id,
          oi.quantity,
          oi.unit_price,
          oi.line_total,
          oi.created_at,
          oi.updated_at,

          p.sku,
          p.product_name

        FROM order_items oi

        INNER JOIN products p
          ON p.id = oi.product_id

        WHERE oi.order_id = ?

        ORDER BY p.product_name ASC
      `,
      [orderId]
    );

    const [reviewRows] = await pool.execute(
      `
        SELECT
          sre.action,
          sre.reason,
          sre.created_at,
          u.full_name AS reviewed_by_name
        FROM sales_order_review_events sre
        LEFT JOIN users u ON u.id = sre.reviewed_by
        WHERE sre.order_id = ?
        ORDER BY sre.created_at ASC, sre.id ASC
      `,
      [orderId]
    );

    const order = orderRows[0];

    return res.json({
      success: true,

      order: {
        id: order.id,
        orderNumber: order.order_number,

        customer: {
          id: order.customer_id,
          fullName: order.customer_name,
          contactNumber: order.contact_number,
          address: order.address,
        },

        encodedBy: {
          id: order.encoded_by,
          fullName:
            order.encoded_by_name ||
            (order.order_source === 'storefront'
              ? 'Online storefront'
              : 'Former user'),
        },

        orderSource: order.order_source || 'staff',
        salesReviewStatus:
          order.sales_review_status || 'not_required',
        deliverySnapshot: {
          fullName: order.delivery_name_snapshot,
          contactNumber: order.delivery_contact_snapshot,
          address: order.delivery_address_snapshot,
        },
        publicStatusMessage: order.public_status_message,
        salesReviewedAt: order.sales_reviewed_at,

        conversationLink:
          order.conversation_link,

        skinConcern: order.skin_concern,
        tags: order.tags,
        notes: order.notes,

        totalAmount: Number(
          order.total_amount
        ),

        orderStatus: order.order_status,

        dateEncoded: order.date_encoded,
        submittedAt: order.submitted_at,
        confirmedAt: order.confirmed_at,
        rejectedAt: order.rejected_at,
        cancelledAt: order.cancelled_at,
        createdAt: order.created_at,
        updatedAt: order.updated_at,
        workflow: getOrderWorkflow(order),

        items: itemRows.map((item) => ({
          id: item.id,
          productId: item.product_id,
          sku: item.sku,
          productName: item.product_name,
          quantity: Number(item.quantity),
          unitPrice: Number(item.unit_price),
          lineTotal: Number(item.line_total),
        })),

        salesReviewHistory: reviewRows.map((event) => ({
          action: event.action,
          reason: event.reason,
          reviewedBy: event.reviewed_by_name || 'Former user',
          createdAt: event.created_at,
        })),
      },
    });
  } catch (error) {
    console.error(
      'Get order details error:',
      error
    );

    return res.status(500).json({
      success: false,
      message: 'Unable to retrieve order details.',
    });
  }
};

// POST /api/sales/orders
exports.createOrder = async (req, res) => {
  let connection;

  try {
    const customerIdValue =
      req.body.customerId;

    const customerId =
      customerIdValue === null ||
      customerIdValue === undefined ||
      customerIdValue === ''
        ? null
        : Number(customerIdValue);

    const newCustomer =
      req.body.customer || {};

    const conversationLink = cleanText(
      req.body.conversationLink
    );

    const skinConcern = cleanText(
      req.body.skinConcern
    );

    const tags = cleanText(req.body.tags);
    const notes = cleanText(req.body.notes);

    const orderStatus =
      cleanText(req.body.orderStatus) ||
      'draft';

    const items = Array.isArray(req.body.items)
      ? req.body.items
      : [];

    if (
      !CREATE_STATUSES.includes(orderStatus)
    ) {
      return res.status(400).json({
        success: false,
        message:
          'New orders can only be saved as Draft or For Confirmation.',
      });
    }

    if (
      !isValidHttpUrl(
        conversationLink
      )
    ) {
      return res.status(400).json({
        success: false,
        message:
          'Conversation link must be a valid HTTP or HTTPS link.',
      });
    }

    if (items.length === 0) {
      return res.status(400).json({
        success: false,
        message:
          'At least one product is required.',
      });
    }

    const normalizedItems = [];
    const productIds = [];
    const usedProductIds = new Set();

    for (const item of items) {
      const productId = Number(
        item.productId
      );

      const quantity = Number(item.quantity);
      const unitPrice = Number(
        item.unitPrice
      );

      if (
        !Number.isInteger(productId) ||
        productId <= 0
      ) {
        return res.status(400).json({
          success: false,
          message:
            'Each order item must have a valid product.',
        });
      }

      if (
        usedProductIds.has(productId)
      ) {
        return res.status(400).json({
          success: false,
          message:
            'The same product cannot be added more than once.',
        });
      }

      if (
        !Number.isInteger(quantity) ||
        quantity <= 0
      ) {
        return res.status(400).json({
          success: false,
          message:
            'Product quantity must be a positive whole number.',
        });
      }

      if (
        !Number.isFinite(unitPrice) ||
        unitPrice <= 0
      ) {
        return res.status(400).json({
          success: false,
          message:
            'Product unit price must be greater than zero.',
        });
      }

      usedProductIds.add(productId);
      productIds.push(productId);

      const unitPriceCents = Math.round(
        unitPrice * 100
      );

      const lineTotalCents =
        unitPriceCents * quantity;

      normalizedItems.push({
        productId,
        quantity,
        unitPrice:
          unitPriceCents / 100,
        lineTotal:
          lineTotalCents / 100,
      });
    }

    connection = await pool.getConnection();
    await connection.beginTransaction();

    let finalCustomerId = customerId;
    let customerReused = false;

    if (finalCustomerId) {
      const [customerRows] =
        await connection.execute(
          `
            SELECT id
            FROM customers
            WHERE id = ?
            LIMIT 1
          `,
          [finalCustomerId]
        );

      if (customerRows.length === 0) {
        await connection.rollback();

        return res.status(400).json({
          success: false,
          message:
            'The selected customer does not exist.',
        });
      }
    } else {
      const fullName = cleanText(
        newCustomer.fullName
      );

      const contactNumber = cleanText(
        newCustomer.contactNumber
      );

      const address = cleanText(
        newCustomer.address
      );

      if (
        !fullName ||
        !contactNumber ||
        !address
      ) {
        await connection.rollback();

        return res.status(400).json({
          success: false,
          message:
            'Customer name, contact number, and address are required.',
        });
      }

      const normalizedContact =
        normalizeContactNumber(contactNumber);

      if (!normalizedContact) {
        await connection.rollback();

        return res.status(400).json({
          success: false,
          message: 'Enter a valid customer contact number.',
        });
      }

      const [matchingCustomers] =
        await connection.execute(
          `
            SELECT
              id,
              full_name,
              contact_number,
              address
            FROM customers
            WHERE REPLACE(
              REPLACE(
                REPLACE(
                  REPLACE(
                    REPLACE(contact_number, ' ', ''),
                    '-',
                    ''
                  ),
                  '(',
                  ''
                ),
                ')',
                ''
              ),
              '+',
              ''
            ) = ?
            ORDER BY id ASC
            LIMIT 2
            FOR UPDATE
          `,
          [normalizedContact]
        );

      if (matchingCustomers.length > 1) {
        await connection.rollback();

        return res.status(409).json({
          success: false,
          message:
            'More than one customer uses this contact number. Select the correct existing customer instead.',
          possibleCustomers: matchingCustomers.map(
            (customer) => ({
              id: customer.id,
              fullName: customer.full_name,
              contactNumber: customer.contact_number,
              address: customer.address,
            })
          ),
        });
      }

      if (matchingCustomers.length === 1) {
        finalCustomerId = matchingCustomers[0].id;
        customerReused = true;
      }

      if (!finalCustomerId) {
        const [customerResult] =
          await connection.execute(
            `
              INSERT INTO customers (
                full_name,
                contact_number,
                address
              )
              VALUES (?, ?, ?)
            `,
            [
              fullName,
              contactNumber,
              address,
            ]
          );

        finalCustomerId = customerResult.insertId;
      }
    }

    const placeholders = productIds
      .map(() => '?')
      .join(', ');

    const [productRows] =
      await connection.execute(
        `
          SELECT
            id,
            product_name,
            status
          FROM products
          WHERE id IN (${placeholders})
            AND status = 'active'
        `,
        productIds
      );

    if (
      productRows.length !==
      productIds.length
    ) {
      await connection.rollback();

      return res.status(400).json({
        success: false,
        message:
          'One or more selected products are unavailable or inactive.',
      });
    }

    const totalAmount = normalizedItems.reduce(
      (total, item) =>
        total + item.lineTotal,
      0
    );

    const orderNumber =
      generateOrderNumber();

    const submittedAt =
      orderStatus === 'for_confirmation'
        ? new Date()
        : null;

    const [orderResult] =
      await connection.execute(
        `
          INSERT INTO orders (
            order_number,
            customer_id,
            encoded_by,
            conversation_link,
            skin_concern,
            tags,
            notes,
            total_amount,
            order_status,
            submitted_at
          )
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `,
        [
          orderNumber,
          finalCustomerId,
          req.user.id,
          conversationLink || null,
          skinConcern || null,
          tags || null,
          notes || null,
          totalAmount,
          orderStatus,
          submittedAt,
        ]
      );

    for (const item of normalizedItems) {
      await connection.execute(
        `
          INSERT INTO order_items (
            order_id,
            product_id,
            quantity,
            unit_price,
            line_total
          )
          VALUES (?, ?, ?, ?, ?)
        `,
        [
          orderResult.insertId,
          item.productId,
          item.quantity,
          item.unitPrice,
          item.lineTotal,
        ]
      );
    }

    await connection.commit();

    return res.status(201).json({
      success: true,

      message:
        orderStatus === 'for_confirmation'
          ? 'Order created and submitted for confirmation.'
          : 'Order saved as draft.',

      order: {
        id: orderResult.insertId,
        orderNumber,
        customerId: finalCustomerId,
        totalAmount,
        orderStatus,
      },

      customerReused,
    });
  } catch (error) {
    if (connection) {
      try {
        await connection.rollback();
      } catch (rollbackError) {
        console.error(
          'Order rollback error:',
          rollbackError
        );
      }
    }

    console.error('Create order error:', error);

    return res.status(500).json({
      success: false,
      message: 'Unable to create the order.',
    });
  } finally {
    if (connection) {
      connection.release();
    }
  }
};

// PATCH /api/sales/orders/:id/submit
exports.submitOrder = async (req, res) => {
  let connection;

  try {
    const orderId = Number(req.params.id);

    if (
      !Number.isInteger(orderId) ||
      orderId <= 0
    ) {
      return res.status(400).json({
        success: false,
        message: 'Invalid order.',
      });
    }

    connection = await pool.getConnection();
    await connection.beginTransaction();

    const [orderRows] =
      await connection.execute(
        `
          SELECT
            id,
            order_status,
            order_source,
            sales_review_status,
            total_amount
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

    const order = orderRows[0];

    if (order.order_source === 'storefront') {
      await connection.rollback();

      return res.status(409).json({
        success: false,
        message:
          'Online orders must use the audited Sales review action before CDM submission.',
      });
    }

    if (order.order_status !== 'draft') {
      await connection.rollback();

      return res.status(400).json({
        success: false,
        message:
          'Only draft orders can be submitted.',
      });
    }

    const [itemRows] =
      await connection.execute(
        `
          SELECT COUNT(*) AS item_count
          FROM order_items
          WHERE order_id = ?
        `,
        [orderId]
      );

    if (
      Number(itemRows[0].item_count) === 0 ||
      Number(order.total_amount) <= 0
    ) {
      await connection.rollback();

      return res.status(400).json({
        success: false,
        message:
          'The order must contain valid products before submission.',
      });
    }

    await connection.execute(
      `
        UPDATE orders
        SET
          order_status = 'for_confirmation',
          submitted_at = NOW()
        WHERE id = ?
      `,
      [orderId]
    );

    await connection.commit();

    return res.json({
      success: true,
      message:
        'Order submitted to Customer Data Management.',
      orderStatus: 'for_confirmation',
    });
  } catch (error) {
    if (connection) {
      try {
        await connection.rollback();
      } catch (rollbackError) {
        console.error(
          'Submit rollback error:',
          rollbackError
        );
      }
    }

    console.error('Submit order error:', error);

    return res.status(500).json({
      success: false,
      message: 'Unable to submit the order.',
    });
  } finally {
    if (connection) {
      connection.release();
    }
  }
};

// PATCH /api/sales/orders/:id/storefront-review
exports.reviewStorefrontOrder = async (req, res) => {
  let connection;

  try {
    const orderId = Number(req.params.id);
    const action = cleanText(req.body.action);
    const reason = cleanText(req.body.reason);
    const corrections = req.body.corrections || {};

    if (!Number.isInteger(orderId) || orderId <= 0) {
      return res.status(400).json({ success: false, message: 'Invalid order.' });
    }

    if (!['submit', 'reject'].includes(action)) {
      return res.status(400).json({
        success: false,
        message: 'Choose whether to submit or reject the online order.',
      });
    }

    if (reason.length > 500 || (action === 'reject' && reason.length < 5)) {
      return res.status(400).json({
        success: false,
        message: 'Enter a clear customer-facing reason of 5 to 500 characters.',
      });
    }

    connection = await pool.getConnection();
    await connection.beginTransaction();

    const [orderRows] = await connection.execute(
      `
        SELECT
          id,
          order_number,
          order_source,
          sales_review_status,
          order_status,
          delivery_name_snapshot,
          delivery_contact_snapshot,
          delivery_address_snapshot,
          total_amount
        FROM orders
        WHERE id = ?
        LIMIT 1
        FOR UPDATE
      `,
      [orderId]
    );

    if (orderRows.length === 0) {
      await connection.rollback();
      return res.status(404).json({ success: false, message: 'Order not found.' });
    }

    const order = orderRows[0];
    if (
      order.order_source !== 'storefront' ||
      order.sales_review_status !== 'pending' ||
      order.order_status !== 'draft'
    ) {
      await connection.rollback();
      return res.status(409).json({
        success: false,
        message: 'This online order is no longer waiting for Sales review.',
      });
    }

    const [itemRows] = await connection.execute(
      `
        SELECT
          oi.id,
          oi.product_id,
          oi.quantity,
          oi.unit_price,
          oi.line_total,
          p.product_name,
          p.status
        FROM order_items oi
        INNER JOIN products p ON p.id = oi.product_id
        WHERE oi.order_id = ?
        ORDER BY oi.id
        FOR UPDATE
      `,
      [orderId]
    );

    if (itemRows.length === 0) {
      await connection.rollback();
      return res.status(409).json({
        success: false,
        message: 'The online order has no products and cannot be submitted.',
      });
    }

    const beforeSnapshot = {
      delivery: {
        fullName: order.delivery_name_snapshot,
        contactNumber: order.delivery_contact_snapshot,
        address: order.delivery_address_snapshot,
      },
      totalAmount: Number(order.total_amount),
      items: itemRows.map((item) => ({
        productId: Number(item.product_id),
        quantity: Number(item.quantity),
        unitPrice: Number(item.unit_price),
      })),
    };

    if (action === 'reject') {
      await connection.execute(
        `
          UPDATE orders
          SET
            sales_review_status = 'rejected',
            order_status = 'cancelled',
            sales_reviewed_by = ?,
            sales_reviewed_at = NOW(),
            cancelled_at = NOW(),
            public_status_message = ?
          WHERE id = ?
        `,
        [req.user.id, reason, orderId]
      );
      await connection.execute(
        `
          INSERT INTO sales_order_review_events (
            order_id, reviewed_by, action, reason,
            before_snapshot, after_snapshot
          ) VALUES (?, ?, 'rejected', ?, ?, ?)
        `,
        [
          orderId,
          req.user.id,
          reason,
          JSON.stringify(beforeSnapshot),
          JSON.stringify({ ...beforeSnapshot, status: 'rejected' }),
        ]
      );
      await connection.commit();
      return res.json({
        success: true,
        message: 'Online order rejected with a customer-facing reason.',
        orderStatus: 'cancelled',
        salesReviewStatus: 'rejected',
      });
    }

    const correctedDelivery = {
      fullName: cleanText(
        corrections.delivery?.fullName || order.delivery_name_snapshot
      ),
      contactNumber: cleanText(
        corrections.delivery?.contactNumber ||
          order.delivery_contact_snapshot
      ),
      address: cleanText(
        corrections.delivery?.address || order.delivery_address_snapshot
      ),
    };

    if (
      !correctedDelivery.fullName ||
      !correctedDelivery.contactNumber ||
      !correctedDelivery.address ||
      correctedDelivery.fullName.length > 150 ||
      correctedDelivery.contactNumber.length > 30 ||
      correctedDelivery.address.length > 1000
    ) {
      await connection.rollback();
      return res.status(400).json({
        success: false,
        message: 'The corrected delivery details are incomplete or too long.',
      });
    }

    let reviewedItems = itemRows.map((item) => ({
      ...item,
      reviewedQuantity: Number(item.quantity),
    }));
    const submittedQuantities = corrections.itemQuantities;

    if (submittedQuantities !== undefined) {
      if (
        !Array.isArray(submittedQuantities) ||
        submittedQuantities.length !== itemRows.length
      ) {
        await connection.rollback();
        return res.status(400).json({
          success: false,
          message: 'Corrections must include every existing order item.',
        });
      }

      const quantityByProduct = new Map();
      for (const item of submittedQuantities) {
        const productId = Number(item.productId);
        const quantity = Number(item.quantity);
        if (
          !Number.isInteger(productId) ||
          !Number.isInteger(quantity) ||
          quantity <= 0 ||
          quantity > 999 ||
          quantityByProduct.has(productId)
        ) {
          await connection.rollback();
          return res.status(400).json({
            success: false,
            message: 'Corrected quantities must be positive whole numbers.',
          });
        }
        quantityByProduct.set(productId, quantity);
      }

      reviewedItems = itemRows.map((item) => {
        const quantity = quantityByProduct.get(Number(item.product_id));
        return { ...item, reviewedQuantity: quantity };
      });
      if (reviewedItems.some((item) => !item.reviewedQuantity)) {
        await connection.rollback();
        return res.status(400).json({
          success: false,
          message: 'Products cannot be added or removed during Sales correction.',
        });
      }
    }

    const hasCorrections =
      correctedDelivery.fullName !== order.delivery_name_snapshot ||
      correctedDelivery.contactNumber !== order.delivery_contact_snapshot ||
      correctedDelivery.address !== order.delivery_address_snapshot ||
      reviewedItems.some(
        (item) => item.reviewedQuantity !== Number(item.quantity)
      );

    if (hasCorrections && reason.length < 5) {
      await connection.rollback();
      return res.status(400).json({
        success: false,
        message: 'Explain audited corrections in at least 5 characters.',
      });
    }

    for (const item of reviewedItems) {
      if (item.status !== 'active') {
        await connection.rollback();
        return res.status(409).json({
          success: false,
          message: `${item.product_name} is inactive. Reject the order or resolve the product first.`,
        });
      }

      const [inventoryRows] = await connection.execute(
        `
          SELECT id, current_quantity, status
          FROM inventory_items
          WHERE product_id = ? AND category = 'finished_product'
          FOR UPDATE
        `,
        [item.product_id]
      );
      const available = inventoryRows
        .filter((inventory) => inventory.status === 'active')
        .reduce(
          (total, inventory) =>
            total + Number(inventory.current_quantity || 0),
          0
        );

      if (
        inventoryRows.filter((inventory) => inventory.status === 'active')
          .length === 0 ||
        available < item.reviewedQuantity
      ) {
        await connection.rollback();
        return res.status(409).json({
          success: false,
          message: `${item.product_name} is unavailable in the reviewed quantity. Reject the order or correct the quantity.`,
        });
      }
    }

    let totalCents = 0;
    for (const item of reviewedItems) {
      const lineTotalCents =
        Math.round(Number(item.unit_price) * 100) *
        item.reviewedQuantity;
      const lineTotal = lineTotalCents / 100;
      totalCents += lineTotalCents;
      await connection.execute(
        `
          UPDATE order_items
          SET quantity = ?, line_total = ?
          WHERE id = ?
        `,
        [item.reviewedQuantity, lineTotal, item.id]
      );
    }

    const totalAmount = totalCents / 100;

    const publicMessage = hasCorrections
      ? 'Sales reviewed and corrected your order before sending it for confirmation.'
      : 'Sales reviewed your order and sent it for confirmation.';
    await connection.execute(
      `
        UPDATE orders
        SET
          delivery_name_snapshot = ?,
          delivery_contact_snapshot = ?,
          delivery_address_snapshot = ?,
          total_amount = ?,
          sales_review_status = 'approved',
          sales_reviewed_by = ?,
          sales_reviewed_at = NOW(),
          order_status = 'for_confirmation',
          submitted_at = NOW(),
          public_status_message = ?
        WHERE id = ?
      `,
      [
        correctedDelivery.fullName,
        correctedDelivery.contactNumber,
        correctedDelivery.address,
        totalAmount,
        req.user.id,
        publicMessage,
        orderId,
      ]
    );

    const afterSnapshot = {
      delivery: correctedDelivery,
      totalAmount,
      status: 'for_confirmation',
      items: reviewedItems.map((item) => ({
        productId: Number(item.product_id),
        quantity: item.reviewedQuantity,
        unitPrice: Number(item.unit_price),
      })),
    };
    await connection.execute(
      `
        INSERT INTO sales_order_review_events (
          order_id, reviewed_by, action, reason,
          before_snapshot, after_snapshot
        ) VALUES (?, ?, ?, ?, ?, ?)
      `,
      [
        orderId,
        req.user.id,
        hasCorrections ? 'corrected_and_submitted' : 'submitted',
        reason || null,
        JSON.stringify(beforeSnapshot),
        JSON.stringify(afterSnapshot),
      ]
    );

    await connection.commit();
    return res.json({
      success: true,
      message: 'Online order reviewed and submitted to CDM.',
      orderStatus: 'for_confirmation',
      salesReviewStatus: 'approved',
      totalAmount,
    });
  } catch (error) {
    if (connection) {
      try {
        await connection.rollback();
      } catch (rollbackError) {
        console.error('Storefront review rollback error:', rollbackError);
      }
    }
    console.error('Review storefront order error:', error);
    return res.status(500).json({
      success: false,
      message: 'Unable to review the online order.',
    });
  } finally {
    if (connection) connection.release();
  }
};
