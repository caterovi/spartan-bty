const express = require('express');

const router = express.Router();

const salesController = require(
  '../controllers/sales.controller'
);

const verifyToken = require(
  '../middleware/auth'
);

const {
  requireDepartmentRead,
  requireDepartmentWrite,
} = require(
  '../middleware/departmentAccess'
);

router.use(verifyToken);

router.get(
  '/products',
  requireDepartmentRead(
    'sales',
    'You do not have access to the Sales module.',
  ),
  salesController.getProducts
);

router.get(
  '/customers',
  requireDepartmentRead(
    'sales',
    'You do not have access to the Sales module.',
  ),
  salesController.getCustomers
);

router.get(
  '/orders',
  requireDepartmentRead(
    'sales',
    'You do not have access to the Sales module.',
  ),
  salesController.getOrders
);

router.get(
  '/orders/:id',
  requireDepartmentRead(
    'sales',
    'You do not have access to the Sales module.',
  ),
  salesController.getOrderById
);

router.post(
  '/orders',
  requireDepartmentWrite(
    'sales',
    'Only Sales Specialists can create or submit orders.',
  ),
  salesController.createOrder
);

router.patch(
  '/orders/:id/submit',
  requireDepartmentWrite(
    'sales',
    'Only Sales Specialists can create or submit orders.',
  ),
  salesController.submitOrder
);

module.exports = router;