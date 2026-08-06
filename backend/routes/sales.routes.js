const express = require('express');

const router = express.Router();

const salesController = require(
  '../controllers/sales.controller'
);

const verifyToken = require(
  '../middleware/auth'
);

function requireSalesReadAccess(
  req,
  res,
  next
) {
  const isHead = req.user?.role === 'head';

  const isSalesSpecialist =
    req.user?.role === 'specialist' &&
    req.user?.departmentCode === 'sales';

  if (!isHead && !isSalesSpecialist) {
    return res.status(403).json({
      success: false,
      message:
        'You do not have access to the Sales module.',
    });
  }

  next();
}

function requireSalesWriteAccess(
  req,
  res,
  next
) {
  const isSalesSpecialist =
    req.user?.role === 'specialist' &&
    req.user?.departmentCode === 'sales';

  if (!isSalesSpecialist) {
    return res.status(403).json({
      success: false,
      message:
        'Only Sales Specialists can create or submit orders.',
    });
  }

  next();
}

router.use(verifyToken);

router.get(
  '/products',
  requireSalesReadAccess,
  salesController.getProducts
);

router.get(
  '/customers',
  requireSalesReadAccess,
  salesController.getCustomers
);

router.get(
  '/orders',
  requireSalesReadAccess,
  salesController.getOrders
);

router.get(
  '/orders/:id',
  requireSalesReadAccess,
  salesController.getOrderById
);

router.post(
  '/orders',
  requireSalesWriteAccess,
  salesController.createOrder
);

router.patch(
  '/orders/:id/submit',
  requireSalesWriteAccess,
  salesController.submitOrder
);

module.exports = router;