const crypto = require('crypto');
const pool = require('../config/db');

const MAX_CART_ITEMS = 50;
const MAX_QUANTITY = 999;

function parsePositiveInteger(value) {
  const number = Number(value);
  return Number.isInteger(number) && number > 0 ? number : null;
}

function generateOrderNumber() {
  const dateCode = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Manila',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
    .format(new Date())
    .replaceAll('-', '');

  return `WEB-${dateCode}-${crypto
    .randomBytes(4)
    .toString('hex')
    .toUpperCase()}`;
}

function isValidIdempotencyKey(value) {
  return /^[A-Za-z0-9_-]{16,100}$/.test(String(value || ''));
}

function getCustomerStatus(row) {
  if (row.sales_review_status === 'rejected') {
    return {
      code: 'sales_rejected',
      label: 'Not accepted by Sales',
    };
  }

  if (
    row.order_source === 'storefront' &&
    row.sales_review_status === 'pending'
  ) {
    return {
      code: 'sales_review',
      label: 'Waiting for Sales review',
    };
  }

  const fulfillmentLabels = {
    pending_packing: 'Preparing for packing',
    packing: 'Packing in progress',
    packed: 'Packed',
    ready_for_shipment: 'Ready for shipment',
    shipped_out: 'Shipped',
    delivered: 'Delivered',
    returned_to_sender: 'Returned to sender',
    cancelled: 'Cancelled',
  };

  if (row.fulfillment_status) {
    return {
      code: row.fulfillment_status,
      label:
        fulfillmentLabels[row.fulfillment_status] ||
        'Fulfillment in progress',
    };
  }

  const orderLabels = {
    draft: 'Draft',
    for_confirmation: 'Awaiting confirmation',
    confirmed: 'Confirmed',
    rejected: 'Not confirmed',
    cancelled: 'Cancelled',
  };

  return {
    code: row.order_status,
    label: orderLabels[row.order_status] || 'Processing',
  };
}

function publicOrder(row, items = undefined) {
  const result = {
    id: Number(row.id),
    orderNumber: row.order_number,
    totalAmount: Number(row.total_amount),
    status: getCustomerStatus(row),
    statusMessage: row.public_status_message || null,
    delivery: {
      fullName: row.delivery_name_snapshot,
      contactNumber: row.delivery_contact_snapshot,
      address: row.delivery_address_snapshot,
    },
    placedAt: row.date_encoded,
    updatedAt: row.updated_at,
  };

  if (items) result.items = items;
  return result;
}

async function getOrCreateCart(connection, customerId) {
  await connection.execute(
    `
      INSERT INTO customer_carts (customer_id)
      VALUES (?)
      ON DUPLICATE KEY UPDATE customer_id = VALUES(customer_id)
    `,
    [customerId]
  );

  const [rows] = await connection.execute(
    `
      SELECT id
      FROM customer_carts
      WHERE customer_id = ?
      LIMIT 1
    `,
    [customerId]
  );

  return Number(rows[0].id);
}

async function loadProductAvailability(connection, productId, lock = false) {
  const [productRows] = await connection.execute(
    `
      SELECT id, sku, product_name, default_price, status, image_url
      FROM products
      WHERE id = ?
      LIMIT 1
      ${lock ? 'FOR UPDATE' : ''}
    `,
    [productId]
  );

  if (productRows.length === 0) return null;

  const [inventoryRows] = await connection.execute(
    `
      SELECT id, current_quantity, status
      FROM inventory_items
      WHERE product_id = ?
        AND category = 'finished_product'
      ${lock ? 'FOR UPDATE' : ''}
    `,
    [productId]
  );

  const activeInventory = inventoryRows.filter(
    (item) => item.status === 'active'
  );

  return {
    ...productRows[0],
    inventoryRecords: activeInventory.length,
    availableQuantity: activeInventory.reduce(
      (total, item) => total + Number(item.current_quantity || 0),
      0
    ),
  };
}

function availabilityFor(product, requestedQuantity = 1) {
  if (!product || product.status !== 'active') {
    return {
      ok: false,
      status: 'unavailable',
      message: 'This product is no longer active.',
    };
  }

  if (Number(product.default_price) <= 0) {
    return {
      ok: false,
      status: 'unavailable',
      message: 'This product does not have a valid public price.',
    };
  }

  if (product.inventoryRecords === 0) {
    return {
      ok: false,
      status: 'unavailable',
      message: 'Product availability has not been configured.',
    };
  }

  if (product.availableQuantity < requestedQuantity) {
    return {
      ok: false,
      status: 'out_of_stock',
      message: 'The requested quantity is not currently available.',
    };
  }

  return { ok: true, status: 'in_stock', message: 'In stock' };
}

async function getCartPayload(customerId) {
  const [rows] = await pool.execute(
    `
      SELECT
        cci.product_id,
        cci.quantity,
        p.sku,
        p.product_name,
        p.default_price,
        p.status AS product_status,
        p.image_url,
        COALESCE(SUM(
          CASE
            WHEN ii.status = 'active' THEN ii.current_quantity
            ELSE 0
          END
        ), 0) AS available_quantity,
        COALESCE(SUM(
          CASE WHEN ii.status = 'active' THEN 1 ELSE 0 END
        ), 0) AS inventory_records
      FROM customer_carts cc
      INNER JOIN customer_cart_items cci ON cci.cart_id = cc.id
      INNER JOIN products p ON p.id = cci.product_id
      LEFT JOIN inventory_items ii
        ON ii.product_id = p.id
       AND ii.category = 'finished_product'
      WHERE cc.customer_id = ?
      GROUP BY
        cci.product_id,
        cci.quantity,
        p.sku,
        p.product_name,
        p.default_price,
        p.status,
        p.image_url
      ORDER BY cci.created_at ASC
    `,
    [customerId]
  );

  const items = rows.map((row) => {
    const product = {
      status: row.product_status,
      default_price: row.default_price,
      inventoryRecords: Number(row.inventory_records),
      availableQuantity: Number(row.available_quantity),
    };
    const availability = availabilityFor(product, Number(row.quantity));
    const unitPrice = Number(row.default_price);

    return {
      productId: Number(row.product_id),
      sku: row.sku,
      name: row.product_name,
      imageUrl: row.image_url || null,
      quantity: Number(row.quantity),
      unitPrice: unitPrice > 0 ? unitPrice : null,
      lineTotal: unitPrice > 0 ? unitPrice * Number(row.quantity) : null,
      availability: {
        status: availability.status,
        label: availability.ok ? 'In stock' : availability.message,
      },
    };
  });

  return {
    items,
    itemCount: items.reduce((sum, item) => sum + item.quantity, 0),
    totalAmount: items.reduce(
      (sum, item) => sum + Number(item.lineTotal || 0),
      0
    ),
    readyToOrder:
      items.length > 0 &&
      items.every(
        (item) => item.availability.status === 'in_stock'
      ),
  };
}

exports.getCart = async (req, res) => {
  try {
    const cart = await getCartPayload(Number(req.customer.customerId));
    return res.json({ success: true, cart });
  } catch (error) {
    console.error('Get customer cart error:', error);
    return res.status(500).json({
      success: false,
      message: 'Unable to load your cart.',
    });
  }
};

exports.addCartItem = async (req, res) => {
  let connection;

  try {
    const productId = parsePositiveInteger(req.body.productId);
    const quantity = parsePositiveInteger(req.body.quantity);

    if (!productId || !quantity || quantity > MAX_QUANTITY) {
      return res.status(400).json({
        success: false,
        message: 'Choose a valid product and a positive whole-number quantity.',
      });
    }

    connection = await pool.getConnection();
    await connection.beginTransaction();
    const cartId = await getOrCreateCart(
      connection,
      Number(req.customer.customerId)
    );

    const [countRows] = await connection.execute(
      'SELECT COUNT(*) AS item_count FROM customer_cart_items WHERE cart_id = ?',
      [cartId]
    );
    const [existingRows] = await connection.execute(
      `
        SELECT quantity
        FROM customer_cart_items
        WHERE cart_id = ? AND product_id = ?
        LIMIT 1
        FOR UPDATE
      `,
      [cartId, productId]
    );

    if (
      existingRows.length === 0 &&
      Number(countRows[0].item_count) >= MAX_CART_ITEMS
    ) {
      await connection.rollback();
      return res.status(400).json({
        success: false,
        message: `A cart can contain at most ${MAX_CART_ITEMS} products.`,
      });
    }

    const newQuantity =
      Number(existingRows[0]?.quantity || 0) + quantity;
    if (newQuantity > MAX_QUANTITY) {
      await connection.rollback();
      return res.status(400).json({
        success: false,
        message: `Quantity cannot exceed ${MAX_QUANTITY}.`,
      });
    }

    const product = await loadProductAvailability(
      connection,
      productId,
      true
    );
    const availability = availabilityFor(product, newQuantity);

    if (!availability.ok) {
      await connection.rollback();
      return res.status(409).json({
        success: false,
        message: availability.message,
        availability: availability.status,
      });
    }

    await connection.execute(
      `
        INSERT INTO customer_cart_items (cart_id, product_id, quantity)
        VALUES (?, ?, ?)
        ON DUPLICATE KEY UPDATE quantity = VALUES(quantity)
      `,
      [cartId, productId, newQuantity]
    );
    await connection.commit();
    connection.release();
    connection = null;

    return res.status(201).json({
      success: true,
      message: `${product.product_name} was added to your cart.`,
      cart: await getCartPayload(Number(req.customer.customerId)),
    });
  } catch (error) {
    if (connection) await connection.rollback();
    console.error('Add customer cart item error:', error);
    return res.status(500).json({
      success: false,
      message: 'Unable to add the product to your cart.',
    });
  } finally {
    if (connection) connection.release();
  }
};

exports.updateCartItem = async (req, res) => {
  let connection;

  try {
    const productId = parsePositiveInteger(req.params.productId);
    const quantity = parsePositiveInteger(req.body.quantity);

    if (!productId || !quantity || quantity > MAX_QUANTITY) {
      return res.status(400).json({
        success: false,
        message: 'Quantity must be a positive whole number.',
      });
    }

    connection = await pool.getConnection();
    await connection.beginTransaction();
    const product = await loadProductAvailability(
      connection,
      productId,
      true
    );
    const availability = availabilityFor(product, quantity);

    if (!availability.ok) {
      await connection.rollback();
      return res.status(409).json({
        success: false,
        message: availability.message,
        availability: availability.status,
      });
    }

    const [result] = await connection.execute(
      `
        UPDATE customer_cart_items cci
        INNER JOIN customer_carts cc ON cc.id = cci.cart_id
        SET cci.quantity = ?
        WHERE cc.customer_id = ? AND cci.product_id = ?
      `,
      [quantity, Number(req.customer.customerId), productId]
    );

    if (result.affectedRows === 0) {
      await connection.rollback();
      return res.status(404).json({
        success: false,
        message: 'That product is not in your cart.',
      });
    }

    await connection.commit();
    connection.release();
    connection = null;
    return res.json({
      success: true,
      cart: await getCartPayload(Number(req.customer.customerId)),
    });
  } catch (error) {
    if (connection) await connection.rollback();
    console.error('Update customer cart item error:', error);
    return res.status(500).json({
      success: false,
      message: 'Unable to update your cart.',
    });
  } finally {
    if (connection) connection.release();
  }
};

exports.removeCartItem = async (req, res) => {
  try {
    const productId = parsePositiveInteger(req.params.productId);
    if (!productId) {
      return res.status(400).json({ success: false, message: 'Invalid product.' });
    }

    const [result] = await pool.execute(
      `
        DELETE cci
        FROM customer_cart_items cci
        INNER JOIN customer_carts cc ON cc.id = cci.cart_id
        WHERE cc.customer_id = ? AND cci.product_id = ?
      `,
      [Number(req.customer.customerId), productId]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({
        success: false,
        message: 'That product is not in your cart.',
      });
    }

    return res.json({
      success: true,
      cart: await getCartPayload(Number(req.customer.customerId)),
    });
  } catch (error) {
    console.error('Remove customer cart item error:', error);
    return res.status(500).json({
      success: false,
      message: 'Unable to remove the product from your cart.',
    });
  }
};

async function findOrderByIdempotency(customerId, idempotencyKey) {
  const [rows] = await pool.execute(
    `
      SELECT o.*, fo.fulfillment_status
      FROM orders o
      LEFT JOIN fulfillment_orders fo ON fo.order_id = o.id
      WHERE o.customer_id = ? AND o.idempotency_key = ?
      LIMIT 1
    `,
    [customerId, idempotencyKey]
  );
  return rows[0] || null;
}

exports.placeOrder = async (req, res) => {
  let connection;
  const customerId = Number(req.customer.customerId);
  const idempotencyKey = req.get('Idempotency-Key');

  try {
    if (!isValidIdempotencyKey(idempotencyKey)) {
      return res.status(400).json({
        success: false,
        message: 'A valid order submission key is required.',
      });
    }

    if (req.body.confirmDeliveryDetails !== true) {
      return res.status(400).json({
        success: false,
        message: 'Confirm your contact and delivery details before ordering.',
      });
    }

    const existingOrder = await findOrderByIdempotency(
      customerId,
      idempotencyKey
    );
    if (existingOrder) {
      return res.json({
        success: true,
        duplicate: true,
        message: 'This order was already placed.',
        order: publicOrder(existingOrder),
      });
    }

    connection = await pool.getConnection();
    await connection.beginTransaction();

    const [customerRows] = await connection.execute(
      `
        SELECT c.id, c.full_name, c.contact_number, c.address
        FROM customers c
        INNER JOIN customer_accounts ca ON ca.customer_id = c.id
        WHERE c.id = ? AND ca.id = ? AND ca.status = 'active'
        LIMIT 1
        FOR UPDATE
      `,
      [customerId, Number(req.customer.id)]
    );
    if (customerRows.length === 0) {
      await connection.rollback();
      return res.status(401).json({
        success: false,
        message: 'Your customer account is unavailable.',
      });
    }

    const [cartRows] = await connection.execute(
      `
        SELECT
          cc.id AS cart_id,
          cci.product_id,
          cci.quantity,
          p.sku,
          p.product_name,
          p.default_price,
          p.status
        FROM customer_carts cc
        INNER JOIN customer_cart_items cci ON cci.cart_id = cc.id
        INNER JOIN products p ON p.id = cci.product_id
        WHERE cc.customer_id = ?
        ORDER BY cci.id
        FOR UPDATE
      `,
      [customerId]
    );
    if (cartRows.length === 0) {
      await connection.rollback();
      return res.status(400).json({ success: false, message: 'Your cart is empty.' });
    }

    const orderItems = [];
    for (const item of cartRows) {
      const quantity = Number(item.quantity);
      if (
        !Number.isInteger(quantity) ||
        quantity <= 0 ||
        quantity > MAX_QUANTITY
      ) {
        await connection.rollback();
        return res.status(400).json({
          success: false,
          message: 'Your cart contains an invalid product quantity.',
        });
      }

      const product = await loadProductAvailability(
        connection,
        Number(item.product_id),
        true
      );
      const availability = availabilityFor(product, quantity);
      if (!availability.ok) {
        await connection.rollback();
        return res.status(409).json({
          success: false,
          message: `${item.product_name}: ${availability.message}`,
          productId: Number(item.product_id),
          availability: availability.status,
        });
      }

      const unitPriceCents = Math.round(Number(product.default_price) * 100);
      orderItems.push({
        productId: Number(item.product_id),
        quantity,
        unitPrice: unitPriceCents / 100,
        lineTotal: (unitPriceCents * quantity) / 100,
      });
    }

    const totalAmount =
      orderItems.reduce(
        (totalCents, item) =>
          totalCents + Math.round(item.lineTotal * 100),
        0
      ) / 100;
    const customer = customerRows[0];
    const orderNumber = generateOrderNumber();
    const [orderResult] = await connection.execute(
      `
        INSERT INTO orders (
          order_number,
          customer_id,
          encoded_by,
          order_source,
          sales_review_status,
          delivery_name_snapshot,
          delivery_contact_snapshot,
          delivery_address_snapshot,
          idempotency_key,
          public_status_message,
          total_amount,
          order_status
        ) VALUES (?, ?, NULL, 'storefront', 'pending', ?, ?, ?, ?, ?, ?, 'draft')
      `,
      [
        orderNumber,
        customerId,
        customer.full_name,
        customer.contact_number,
        customer.address,
        idempotencyKey,
        'Your order is waiting for Sales review.',
        totalAmount,
      ]
    );

    for (const item of orderItems) {
      await connection.execute(
        `
          INSERT INTO order_items (
            order_id, product_id, quantity, unit_price, line_total
          ) VALUES (?, ?, ?, ?, ?)
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

    await connection.execute(
      'DELETE FROM customer_cart_items WHERE cart_id = ?',
      [cartRows[0].cart_id]
    );
    await connection.commit();

    return res.status(201).json({
      success: true,
      duplicate: false,
      message: 'Your order was placed and sent to Sales for review.',
      order: publicOrder({
        id: orderResult.insertId,
        order_number: orderNumber,
        total_amount: totalAmount,
        order_source: 'storefront',
        sales_review_status: 'pending',
        order_status: 'draft',
        public_status_message: 'Your order is waiting for Sales review.',
        delivery_name_snapshot: customer.full_name,
        delivery_contact_snapshot: customer.contact_number,
        delivery_address_snapshot: customer.address,
        date_encoded: new Date(),
        updated_at: new Date(),
      }),
    });
  } catch (error) {
    if (connection) {
      try {
        await connection.rollback();
      } catch (rollbackError) {
        console.error('Place order rollback error:', rollbackError);
      }
    }

    if (error.code === 'ER_DUP_ENTRY' && isValidIdempotencyKey(idempotencyKey)) {
      const existingOrder = await findOrderByIdempotency(
        customerId,
        idempotencyKey
      );
      if (existingOrder) {
        return res.json({
          success: true,
          duplicate: true,
          message: 'This order was already placed.',
          order: publicOrder(existingOrder),
        });
      }
    }

    console.error('Place customer order error:', error);
    return res.status(500).json({
      success: false,
      message: 'Unable to place your order.',
    });
  } finally {
    if (connection) connection.release();
  }
};

const CUSTOMER_ORDER_SELECT = `
  SELECT
    o.id,
    o.order_number,
    o.total_amount,
    o.order_status,
    o.order_source,
    o.sales_review_status,
    o.delivery_name_snapshot,
    o.delivery_contact_snapshot,
    o.delivery_address_snapshot,
    o.public_status_message,
    o.date_encoded,
    o.updated_at,
    fo.fulfillment_status
  FROM orders o
  LEFT JOIN fulfillment_orders fo ON fo.order_id = o.id
`;

exports.getOrders = async (req, res) => {
  try {
    const [rows] = await pool.execute(
      `${CUSTOMER_ORDER_SELECT}
       WHERE o.customer_id = ? AND o.order_source = 'storefront'
       ORDER BY o.date_encoded DESC`,
      [Number(req.customer.customerId)]
    );
    return res.json({
      success: true,
      orders: rows.map((row) => publicOrder(row)),
    });
  } catch (error) {
    console.error('Get customer orders error:', error);
    return res.status(500).json({
      success: false,
      message: 'Unable to load your orders.',
    });
  }
};

exports.getOrderById = async (req, res) => {
  try {
    const orderId = parsePositiveInteger(req.params.id);
    if (!orderId) {
      return res.status(400).json({ success: false, message: 'Invalid order.' });
    }

    const [rows] = await pool.execute(
      `${CUSTOMER_ORDER_SELECT}
       WHERE o.id = ?
         AND o.customer_id = ?
         AND o.order_source = 'storefront'
       LIMIT 1`,
      [orderId, Number(req.customer.customerId)]
    );
    if (rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Order not found.',
      });
    }

    const [itemRows] = await pool.execute(
      `
        SELECT oi.product_id, oi.quantity, oi.unit_price, oi.line_total,
               p.sku, p.product_name
        FROM order_items oi
        INNER JOIN products p ON p.id = oi.product_id
        WHERE oi.order_id = ?
        ORDER BY p.product_name
      `,
      [orderId]
    );
    const items = itemRows.map((item) => ({
      productId: Number(item.product_id),
      sku: item.sku,
      name: item.product_name,
      quantity: Number(item.quantity),
      unitPrice: Number(item.unit_price),
      lineTotal: Number(item.line_total),
    }));

    return res.json({
      success: true,
      order: publicOrder(rows[0], items),
    });
  } catch (error) {
    console.error('Get customer order error:', error);
    return res.status(500).json({
      success: false,
      message: 'Unable to load the order.',
    });
  }
};

module.exports._private = {
  availabilityFor,
  getCustomerStatus,
  isValidIdempotencyKey,
};
