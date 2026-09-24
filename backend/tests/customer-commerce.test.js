const { test } = require('node:test');
const assert = require('node:assert/strict');

const state = {
  customer: {
    id: 11,
    accountId: 21,
    full_name: 'Storefront Customer',
    contact_number: '09170000000',
    address: 'Imus, Cavite',
  },
  product: {
    id: 7,
    sku: 'SKU-7',
    product_name: 'Real Product',
    default_price: 250,
    status: 'active',
    image_url: null,
  },
  inventory: { id: 31, product_id: 7, current_quantity: 10, status: 'active' },
  cartItems: [{ cart_id: 41, product_id: 7, quantity: 2 }],
  orders: [],
  orderItems: [],
  audits: [],
};

function sqlText(sql) {
  return String(sql).replace(/\s+/g, ' ').trim().toLowerCase();
}

async function execute(sql, values = []) {
  const query = sqlText(sql);

  if (query.includes('where o.customer_id = ? and o.idempotency_key = ?')) {
    const order = state.orders.find(
      (item) => item.customer_id === Number(values[0]) && item.idempotency_key === values[1]
    );
    return [[...(order ? [order] : [])]];
  }

  if (query.includes('from customers c inner join customer_accounts')) {
    return [[{
      id: state.customer.id,
      full_name: state.customer.full_name,
      contact_number: state.customer.contact_number,
      address: state.customer.address,
    }]];
  }

  if (query.includes('from customer_carts cc') && query.includes('for update')) {
    return [state.cartItems.map((item) => ({
      cart_id: item.cart_id,
      product_id: item.product_id,
      quantity: item.quantity,
      sku: state.product.sku,
      product_name: state.product.product_name,
      default_price: state.product.default_price,
      status: state.product.status,
    }))];
  }

  if (query.includes('from products') && query.includes('where id = ?')) {
    return [[Number(values[0]) === state.product.id ? { ...state.product } : undefined].filter(Boolean)];
  }

  if (query.includes('from inventory_items') && query.includes("category = 'finished_product'")) {
    return [[Number(values[0]) === state.inventory.product_id ? { ...state.inventory } : undefined].filter(Boolean)];
  }

  if (query.startsWith('insert into orders')) {
    const order = {
      id: state.orders.length + 101,
      order_number: values[0],
      customer_id: Number(values[1]),
      order_source: 'storefront',
      sales_review_status: 'pending',
      delivery_name_snapshot: values[2],
      delivery_contact_snapshot: values[3],
      delivery_address_snapshot: values[4],
      idempotency_key: values[5],
      public_status_message: values[6],
      total_amount: Number(values[7]),
      order_status: 'draft',
      date_encoded: new Date(),
      updated_at: new Date(),
      fulfillment_status: null,
    };
    state.orders.push(order);
    return [{ insertId: order.id }];
  }

  if (query.startsWith('insert into order_items')) {
    state.orderItems.push({
      id: state.orderItems.length + 1,
      order_id: Number(values[0]),
      product_id: Number(values[1]),
      quantity: Number(values[2]),
      unit_price: Number(values[3]),
      line_total: Number(values[4]),
      product_name: state.product.product_name,
      status: state.product.status,
    });
    return [{ insertId: state.orderItems.length }];
  }

  if (query.startsWith('delete from customer_cart_items')) {
    state.cartItems = [];
    return [{ affectedRows: 1 }];
  }

  if (query.includes('where o.id = ?') && query.includes('o.customer_id = ?')) {
    const order = state.orders.find(
      (item) => item.id === Number(values[0]) && item.customer_id === Number(values[1])
    );
    return [[...(order ? [order] : [])]];
  }

  if (query.includes('from orders') && query.includes('where id = ?') && query.includes('for update')) {
    const order = state.orders.find((item) => item.id === Number(values[0]));
    return [[...(order ? [order] : [])]];
  }

  if (query.includes('from order_items oi') && query.includes('for update')) {
    return [state.orderItems.filter((item) => item.order_id === Number(values[0]))];
  }

  if (query.startsWith('update order_items')) {
    const item = state.orderItems.find((entry) => entry.id === Number(values[2]));
    item.quantity = Number(values[0]);
    item.line_total = Number(values[1]);
    return [{ affectedRows: 1 }];
  }

  if (query.startsWith('update orders') && query.includes("sales_review_status = 'approved'")) {
    const order = state.orders.find((item) => item.id === Number(values[6]));
    Object.assign(order, {
      delivery_name_snapshot: values[0],
      delivery_contact_snapshot: values[1],
      delivery_address_snapshot: values[2],
      total_amount: Number(values[3]),
      sales_review_status: 'approved',
      order_status: 'for_confirmation',
      public_status_message: values[5],
    });
    return [{ affectedRows: 1 }];
  }

  if (query.startsWith('insert into sales_order_review_events')) {
    state.audits.push({
      orderId: Number(values[0]),
      reviewedBy: Number(values[1]),
      action: values[2],
      reason: values[3],
    });
    return [{ insertId: state.audits.length }];
  }

  throw new Error(`Unexpected SQL in commerce test: ${query}`);
}

const connection = {
  execute,
  beginTransaction: async () => {},
  commit: async () => {},
  rollback: async () => {},
  release: () => {},
};
const fakePool = {
  execute,
  getConnection: async () => connection,
};

const dbPath = require.resolve('../config/db');
require.cache[dbPath] = {
  id: dbPath,
  filename: dbPath,
  loaded: true,
  exports: fakePool,
};

const commerce = require('../controllers/customerCommerce.controller');
const sales = require('../controllers/sales.controller');

function responseRecorder() {
  return {
    statusCode: 200,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(body) {
      this.body = body;
      return this;
    },
  };
}

function orderRequest(key, overrides = {}) {
  return {
    customer: { id: state.customer.accountId, customerId: state.customer.id },
    body: {
      confirmDeliveryDetails: true,
      customerId: 999,
      totalAmount: 0.01,
      price: 0.01,
      orderStatus: 'confirmed',
      ...overrides,
    },
    get(header) {
      return header === 'Idempotency-Key' ? key : undefined;
    },
  };
}

test('customer commerce enforces price, ownership, stock, and idempotency', async (t) => {
  const key = 'commerce-test-key-0001';

  await t.test('server price and token customer create the order', async () => {
    const res = responseRecorder();
    await commerce.placeOrder(orderRequest(key), res);

    assert.equal(res.statusCode, 201);
    assert.equal(state.orders.length, 1);
    assert.equal(state.orders[0].customer_id, state.customer.id);
    assert.equal(state.orders[0].total_amount, 500);
    assert.equal(state.orders[0].order_status, 'draft');
    assert.equal(state.orders[0].sales_review_status, 'pending');
    assert.equal(state.orderItems[0].unit_price, 250);
  });

  await t.test('repeated submission returns the original order', async () => {
    const res = responseRecorder();
    await commerce.placeOrder(orderRequest(key), res);

    assert.equal(res.statusCode, 200);
    assert.equal(res.body.duplicate, true);
    assert.equal(state.orders.length, 1);
  });

  await t.test('another customer cannot read the order', async () => {
    const res = responseRecorder();
    await commerce.getOrderById(
      {
        params: { id: state.orders[0].id },
        customer: { customerId: 999 },
      },
      res
    );
    assert.equal(res.statusCode, 404);
  });

  await t.test('unavailable product prevents placement', async () => {
    state.cartItems = [{ cart_id: 41, product_id: 7, quantity: 2 }];
    state.inventory.current_quantity = 0;
    const res = responseRecorder();
    await commerce.placeOrder(orderRequest('commerce-test-key-0002'), res);
    assert.equal(res.statusCode, 409);
    assert.equal(state.orders.length, 1);
    state.inventory.current_quantity = 10;
  });

  await t.test('legacy draft submit cannot bypass audited Sales review', async () => {
    const res = responseRecorder();
    await sales.submitOrder(
      {
        params: { id: state.orders[0].id },
        user: { id: 55, role: 'specialist', departmentCode: 'sales' },
      },
      res
    );
    assert.equal(res.statusCode, 409);
    assert.equal(state.orders[0].order_status, 'draft');
    assert.equal(state.audits.length, 0);
  });

  await t.test('Sales review creates an audit and moves only to CDM queue', async () => {
    const order = state.orders[0];
    const res = responseRecorder();
    await sales.reviewStorefrontOrder(
      {
        params: { id: order.id },
        user: { id: 55, role: 'specialist', departmentCode: 'sales' },
        body: {
          action: 'submit',
          reason: '',
          corrections: {
            delivery: {
              fullName: order.delivery_name_snapshot,
              contactNumber: order.delivery_contact_snapshot,
              address: order.delivery_address_snapshot,
            },
            itemQuantities: [{ productId: 7, quantity: 2 }],
          },
        },
      },
      res
    );

    assert.equal(res.statusCode, 200);
    assert.equal(order.sales_review_status, 'approved');
    assert.equal(order.order_status, 'for_confirmation');
    assert.equal(state.audits.length, 1);
    assert.equal(state.audits[0].action, 'submitted');
  });
});
