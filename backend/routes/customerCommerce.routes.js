const express = require('express');
const verifyCustomerToken = require('../middleware/customerAuth');
const controller = require('../controllers/customerCommerce.controller');

const router = express.Router();
router.use(verifyCustomerToken);

router.get('/cart', controller.getCart);
router.post('/cart/items', controller.addCartItem);
router.patch('/cart/items/:productId', controller.updateCartItem);
router.delete('/cart/items/:productId', controller.removeCartItem);
router.post('/orders', controller.placeOrder);
router.get('/orders', controller.getOrders);
router.get('/orders/:id', controller.getOrderById);

module.exports = router;
