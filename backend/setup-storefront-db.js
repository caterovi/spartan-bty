const pool = require('./config/db');

const STOREFRONT_COLUMNS = [
  {
    name: 'description',
    definition: 'description TEXT NULL AFTER default_price',
  },
  {
    name: 'storefront_category',
    definition:
      'storefront_category VARCHAR(80) NULL AFTER description',
  },
  {
    name: 'image_url',
    definition:
      'image_url VARCHAR(2048) NULL AFTER storefront_category',
  },
];

async function columnExists(connection, columnName) {
  const [rows] = await connection.execute(
    `
      SELECT COLUMN_NAME
      FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = 'products'
        AND COLUMN_NAME = ?
      LIMIT 1
    `,
    [columnName]
  );

  return rows.length > 0;
}

async function setupStorefrontDatabase() {
  let connection;

  try {
    connection = await pool.getConnection();

    const [tableRows] = await connection.execute(`
      SELECT TABLE_NAME
      FROM information_schema.TABLES
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = 'products'
      LIMIT 1
    `);

    if (tableRows.length === 0) {
      throw new Error(
        'The products table was not found. Run the Sales database setup first.'
      );
    }

    for (const column of STOREFRONT_COLUMNS) {
      if (!(await columnExists(connection, column.name))) {
        await connection.query(
          `ALTER TABLE products ADD COLUMN ${column.definition}`
        );
        console.log(`Added products.${column.name}.`);
      } else {
        console.log(`products.${column.name} already exists.`);
      }
    }

    const [summaryRows] = await connection.execute(`
      SELECT
        COUNT(*) AS active_products,
        SUM(default_price <= 0) AS missing_prices,
        SUM(description IS NULL OR TRIM(description) = '')
          AS missing_descriptions,
        SUM(
          storefront_category IS NULL
          OR TRIM(storefront_category) = ''
        ) AS missing_categories,
        SUM(image_url IS NULL OR TRIM(image_url) = '')
          AS missing_images
      FROM products
      WHERE status = 'active'
    `);

    console.log(
      'Storefront schema setup completed. No product records were changed.'
    );
    console.log('Catalog data still needed:', summaryRows[0]);
  } catch (error) {
    console.error('Storefront database setup failed:', error.message);
    process.exitCode = 1;
  } finally {
    if (connection) {
      connection.release();
    }

    await pool.end();
  }
}

setupStorefrontDatabase();
