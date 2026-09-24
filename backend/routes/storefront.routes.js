const express = require('express');

const storefrontController = require(
  '../controllers/storefront.controller'
);

const router = express.Router();

// Public, read-only product catalog. No authentication middleware is used.
router.get('/products', storefrontController.getProducts);
router.get('/products/:id', storefrontController.getProductById);

module.exports = router;
