const pool = require('../config/db');

function parsePositiveInteger(value) {
  const parsedValue = Number(value);

  return Number.isInteger(parsedValue) && parsedValue > 0
    ? parsedValue
    : null;
}

function cleanOptionalText(value) {
  const text = String(value || '').trim();
  return text || null;
}

function getPublicImageUrl(value, publicBaseUrl) {
  const imageUrl = cleanOptionalText(value);

  if (!imageUrl) {
    return null;
  }

  if (imageUrl.startsWith('/uploads/')) {
    return `${publicBaseUrl}${imageUrl}`;
  }

  try {
    const parsedUrl = new URL(imageUrl);
    return ['http:', 'https:'].includes(parsedUrl.protocol)
      ? imageUrl
      : null;
  } catch {
    return null;
  }
}

function getAvailability(row) {
  const activeInventoryRecords = Number(
    row.active_inventory_records || 0
  );

  if (activeInventoryRecords === 0) {
    return {
      status: 'unavailable',
      label: 'Availability unavailable',
    };
  }

  if (Number(row.available_quantity || 0) > 0) {
    return {
      status: 'in_stock',
      label: 'In stock',
    };
  }

  return {
    status: 'out_of_stock',
    label: 'Out of stock',
  };
}

function formatPublicProduct(row, publicBaseUrl) {
  const storedPrice = Number(row.default_price);

  return {
    id: Number(row.id),
    sku: row.sku,
    name: row.product_name,
    price:
      Number.isFinite(storedPrice) && storedPrice > 0
        ? storedPrice
        : null,
    description: cleanOptionalText(row.description),
    category: cleanOptionalText(row.storefront_category),
    imageUrl: getPublicImageUrl(row.image_url, publicBaseUrl),
    availability: getAvailability(row),
  };
}

async function inventoryTableExists() {
  const [rows] = await pool.execute(`
    SELECT TABLE_NAME
    FROM information_schema.TABLES
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'inventory_items'
    LIMIT 1
  `);

  return rows.length > 0;
}

async function getProductRows(productId = null) {
  const hasInventory = await inventoryTableExists();
  const productCondition = productId
    ? 'AND p.id = ?'
    : '';
  const values = productId ? [productId] : [];

  if (!hasInventory) {
    return pool.execute(
      `
        SELECT
          p.id,
          p.sku,
          p.product_name,
          p.default_price,
          p.description,
          p.storefront_category,
          p.image_url,
          0 AS active_inventory_records,
          0 AS available_quantity
        FROM products p
        WHERE p.status = 'active'
          ${productCondition}
        ORDER BY p.product_name ASC
      `,
      values
    );
  }

  return pool.execute(
    `
      SELECT
        p.id,
        p.sku,
        p.product_name,
        p.default_price,
        p.description,
        p.storefront_category,
        p.image_url,
        COALESCE(
          SUM(
            CASE
              WHEN ii.status = 'active' THEN 1
              ELSE 0
            END
          ),
          0
        ) AS active_inventory_records,
        COALESCE(
          SUM(
            CASE
              WHEN ii.status = 'active'
              THEN ii.current_quantity
              ELSE 0
            END
          ),
          0
        ) AS available_quantity
      FROM products p
      LEFT JOIN inventory_items ii
        ON ii.product_id = p.id
       AND ii.category = 'finished_product'
      WHERE p.status = 'active'
        ${productCondition}
      GROUP BY
        p.id,
        p.sku,
        p.product_name,
        p.default_price,
        p.description,
        p.storefront_category,
        p.image_url
      ORDER BY p.product_name ASC
    `,
    values
  );
}

// GET /api/storefront/products
exports.getProducts = async (req, res) => {
  try {
    const [rows] = await getProductRows();
    const publicBaseUrl = `${req.protocol}://${req.get('host')}`;
    const products = rows.map((row) =>
      formatPublicProduct(row, publicBaseUrl)
    );
    const categories = [
      ...new Set(
        products
          .map((product) => product.category)
          .filter(Boolean)
      ),
    ].sort((first, second) =>
      first.localeCompare(second)
    );

    res.set('Cache-Control', 'public, max-age=60');

    return res.json({
      success: true,
      products,
      categories,
    });
  } catch (error) {
    console.error('Get storefront products error:', error);

    return res.status(500).json({
      success: false,
      message: 'Unable to retrieve the product catalog.',
    });
  }
};

// GET /api/storefront/products/:id
exports.getProductById = async (req, res) => {
  try {
    const productId = parsePositiveInteger(req.params.id);

    if (!productId) {
      return res.status(400).json({
        success: false,
        message: 'A valid product ID is required.',
      });
    }

    const [rows] = await getProductRows(productId);

    if (rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Product not found.',
      });
    }

    res.set('Cache-Control', 'public, max-age=60');

    return res.json({
      success: true,
      product: formatPublicProduct(
        rows[0],
        `${req.protocol}://${req.get('host')}`
      ),
    });
  } catch (error) {
    console.error('Get storefront product error:', error);

    return res.status(500).json({
      success: false,
      message: 'Unable to retrieve the product.',
    });
  }
};
