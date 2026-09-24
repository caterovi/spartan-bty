const {
  after,
  before,
  test,
} = require('node:test');
const assert = require('node:assert/strict');
const jwt = require('jsonwebtoken');

process.env.JWT_SECRET = 'test-staff-access-secret';
process.env.JWT_REFRESH_SECRET = 'test-staff-refresh-secret';
process.env.CUSTOMER_JWT_SECRET = 'test-customer-access-secret';
process.env.CUSTOMER_JWT_REFRESH_SECRET =
  'test-customer-refresh-secret';
process.env.FRONTEND_URL = 'http://localhost:5173';

const state = {
  customers: [],
  accounts: [],
  nextCustomerId: 1,
  nextAccountId: 1,
};

function normalizeSql(sql) {
  return String(sql).replace(/\s+/g, ' ').trim().toLowerCase();
}

function normalizeContact(value) {
  return String(value || '').replace(/[+ ()-]/g, '');
}

function accountView(account) {
  const customer = state.customers.find(
    (item) => item.id === account.customer_id
  );

  return {
    ...account,
    full_name: customer.full_name,
    contact_number: customer.contact_number,
    address: customer.address,
  };
}

async function execute(sql, parameters = []) {
  const query = normalizeSql(sql);

  if (
    query.includes('from customer_accounts') &&
    query.includes('where email = ?') &&
    query.includes('for update')
  ) {
    return [
      state.accounts
        .filter((account) => account.email === parameters[0])
        .map((account) => ({ id: account.id })),
    ];
  }

  if (
    query.includes('from customers c') &&
    query.includes("replace(c.contact_number") &&
    query.includes('for update')
  ) {
    return [
      state.customers
        .filter(
          (customer) =>
            normalizeContact(customer.contact_number) === parameters[0]
        )
        .map((customer) => ({ id: customer.id }))
        .slice(0, 1),
    ];
  }

  if (query.startsWith('insert into customers')) {
    const customer = {
      id: state.nextCustomerId++,
      full_name: parameters[0],
      contact_number: parameters[1],
      address: parameters[2],
    };
    state.customers.push(customer);
    return [{ insertId: customer.id }];
  }

  if (query.startsWith('insert into customer_accounts')) {
    const account = {
      id: state.nextAccountId++,
      customer_id: Number(parameters[0]),
      email: parameters[1],
      password_hash: parameters[2],
      status: 'active',
      last_login_at: null,
      created_at: new Date(),
    };
    state.accounts.push(account);
    return [{ insertId: account.id }];
  }

  if (
    query.includes('from customer_accounts ca') &&
    query.includes('where ca.email = ?')
  ) {
    const account = state.accounts.find(
      (item) =>
        item.email === parameters[0] && item.status === 'active'
    );
    return [[...(account ? [accountView(account)] : [])]];
  }

  if (query.startsWith('update customer_accounts set last_login_at')) {
    const account = state.accounts.find(
      (item) => item.id === Number(parameters[0])
    );
    if (account) account.last_login_at = new Date();
    return [{ affectedRows: account ? 1 : 0 }];
  }

  if (
    query.includes('from customer_accounts ca') &&
    query.includes('where ca.id = ?')
  ) {
    const account = state.accounts.find(
      (item) =>
        item.id === Number(parameters[0]) &&
        item.status === 'active' &&
        (parameters.length < 2 ||
          item.customer_id === Number(parameters[1]))
    );
    return [[...(account ? [accountView(account)] : [])]];
  }

  if (
    query.includes('from customer_accounts') &&
    query.includes('where id = ?') &&
    query.includes('and customer_id = ?')
  ) {
    const account = state.accounts.find(
      (item) =>
        item.id === Number(parameters[0]) &&
        item.customer_id === Number(parameters[1]) &&
        item.status === 'active'
    );
    return [[...(account ? [{ id: account.id }] : [])]];
  }

  if (
    query.includes('from users u') &&
    query.includes('left join departments d')
  ) {
    return [[]];
  }

  throw new Error(`Unexpected test SQL: ${query}`);
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
  query: execute,
  end: async () => {},
};

const databaseModulePath = require.resolve('../config/db');
require.cache[databaseModulePath] = {
  id: databaseModulePath,
  filename: databaseModulePath,
  loaded: true,
  exports: fakePool,
};

const app = require('../server');

let server;
let baseUrl;

async function request(path, options = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  });
  const body = await response.json();
  return { response, body };
}

function validSignup(overrides = {}) {
  return {
    fullName: 'Customer One',
    email: 'customer@example.com',
    password: 'SecurePassword123!',
    contactNumber: '09171234567',
    address: 'Imus, Cavite',
    ...overrides,
  };
}

before(async () => {
  await new Promise((resolve) => {
    server = app.listen(0, '127.0.0.1', resolve);
  });
  const address = server.address();
  baseUrl = `http://127.0.0.1:${address.port}`;
});

after(async () => {
  await new Promise((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });
});

test('customer authentication is isolated from staff access', async (t) => {
  let customerAccessToken;

  await t.test('signup rejects a browser-supplied staff role', async () => {
    const beforeAccounts = state.accounts.length;
    const { response, body } = await request('/api/customer-auth/signup', {
      method: 'POST',
      body: JSON.stringify(validSignup({ role: 'head' })),
    });

    assert.equal(response.status, 400);
    assert.match(body.message, /cannot be assigned/i);
    assert.equal(state.accounts.length, beforeAccounts);
    assert.equal(state.customers.length, 0);
  });

  await t.test('public signup creates only a linked customer account', async () => {
    const { response, body } = await request('/api/customer-auth/signup', {
      method: 'POST',
      body: JSON.stringify(validSignup()),
    });

    assert.equal(response.status, 201);
    assert.equal(body.customer.accountType, 'customer');
    assert.equal(body.customer.customerId, state.customers[0].id);
    assert.equal(body.customer.role, undefined);
    assert.equal(body.customer.departmentId, undefined);
    assert.equal(state.accounts.length, 1);
    assert.equal(state.customers.length, 1);
    assert.notEqual(
      state.accounts[0].password_hash,
      'SecurePassword123!'
    );
    assert.equal(state.accounts[0].role, undefined);
    assert.equal(state.accounts[0].department_id, undefined);

    const decoded = jwt.verify(
      body.accessToken,
      process.env.CUSTOMER_JWT_SECRET,
      {
        issuer: 'spartan-bty',
        audience: 'customer',
      }
    );
    assert.equal(decoded.accountType, 'customer');
    assert.equal(decoded.customerId, state.customers[0].id);
    assert.equal(decoded.role, undefined);
    customerAccessToken = body.accessToken;
  });

  await t.test('customer login is separate and returns a customer token', async () => {
    const { response, body } = await request('/api/customer-auth/login', {
      method: 'POST',
      body: JSON.stringify({
        email: 'customer@example.com',
        password: 'SecurePassword123!',
      }),
    });

    assert.equal(response.status, 200);
    assert.equal(body.customer.accountType, 'customer');
    assert.ok(body.accessToken);

    const failed = await request('/api/customer-auth/login', {
      method: 'POST',
      body: JSON.stringify({
        email: 'customer@example.com',
        password: 'wrong-password',
      }),
    });
    assert.equal(failed.response.status, 401);
  });

  await t.test('customer credentials cannot use the staff login endpoint', async () => {
    const { response } = await request('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({
        username: 'customer@example.com',
        password: 'SecurePassword123!',
      }),
    });

    assert.equal(response.status, 401);
  });

  await t.test('customer profile is derived from the token owner', async () => {
    const { response, body } = await request('/api/customer-auth/me', {
      headers: {
        Authorization: `Bearer ${customerAccessToken}`,
      },
    });

    assert.equal(response.status, 200);
    assert.equal(body.customer.customerId, state.customers[0].id);
    assert.equal(body.customer.email, 'customer@example.com');
    assert.equal(body.customer.role, undefined);
  });

  await t.test('a customer token cannot call staff APIs', async () => {
    for (const path of [
      '/api/dashboard',
      '/api/users',
      '/api/reports/overview',
      '/api/sales/orders',
      '/api/auth/me',
    ]) {
      const { response } = await request(path, {
        headers: {
          Authorization: `Bearer ${customerAccessToken}`,
        },
      });
      assert.ok(
        response.status === 401 || response.status === 403,
        `${path} should reject customer access`
      );
    }
  });

  await t.test('even a staff-audience token with customer type is rejected', async () => {
    const craftedToken = jwt.sign(
      {
        id: 999,
        accountType: 'customer',
        role: 'head',
        customerId: 1,
      },
      process.env.JWT_SECRET,
      {
        expiresIn: '5m',
        issuer: 'spartan-bty',
        audience: 'staff',
      }
    );

    const { response } = await request('/api/dashboard', {
      headers: { Authorization: `Bearer ${craftedToken}` },
    });
    assert.equal(response.status, 403);
  });

  await t.test('a valid staff token cannot call customer profile APIs', async () => {
    const staffToken = jwt.sign(
      {
        id: 1,
        username: 'head.user',
        accountType: 'staff',
        role: 'head',
      },
      process.env.JWT_SECRET,
      {
        expiresIn: '5m',
        issuer: 'spartan-bty',
        audience: 'staff',
      }
    );

    const { response } = await request('/api/customer-auth/me', {
      headers: { Authorization: `Bearer ${staffToken}` },
    });
    assert.equal(response.status, 401);

    const cartResponse = await request('/api/customer/cart', {
      headers: { Authorization: `Bearer ${staffToken}` },
    });
    assert.equal(cartResponse.response.status, 401);
  });
});
