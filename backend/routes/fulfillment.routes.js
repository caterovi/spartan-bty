const express = require('express');

const router = express.Router();

const fulfillmentController = require(
  '../controllers/fulfillment.controller'
);

const verifyToken = require(
  '../middleware/auth'
);

function requireFulfillmentReadAccess(
  req,
  res,
  next
) {
  const isHead =
    req.user?.role === 'head';

  const isFulfillmentSpecialist =
    req.user?.role === 'specialist' &&
    req.user?.departmentCode ===
      'fulfillment';

  if (
    !isHead &&
    !isFulfillmentSpecialist
  ) {
    return res.status(403).json({
      success: false,
      message:
        'You do not have access to the Fulfillment module.',
    });
  }

  next();
}

function requireFulfillmentWriteAccess(
  req,
  res,
  next
) {
  const isFulfillmentSpecialist =
    req.user?.role === 'specialist' &&
    req.user?.departmentCode ===
      'fulfillment';

  if (!isFulfillmentSpecialist) {
    return res.status(403).json({
      success: false,
      message:
        'Only Fulfillment Specialists can process fulfillment orders.',
    });
  }

  next();
}

router.use(verifyToken);

router.get(
  '/summary',
  requireFulfillmentReadAccess,
  fulfillmentController.getSummary
);

router.get(
  '/orders',
  requireFulfillmentReadAccess,
  fulfillmentController.getOrders
);

router.get(
  '/packaging-items',
  requireFulfillmentReadAccess,
  fulfillmentController.getPackagingItems
);

router.get(
  '/orders/:id',
  requireFulfillmentReadAccess,
  fulfillmentController.getOrderById
);

router.patch(
  '/orders/:id/start-packing',
  requireFulfillmentWriteAccess,
  fulfillmentController.startPacking
);

router.patch(
  '/orders/:id/complete-packing',
  requireFulfillmentWriteAccess,
  fulfillmentController.completePacking
);

router.patch(
  '/orders/:id/ready',
  requireFulfillmentWriteAccess,
  fulfillmentController.markReadyForShipment
);

router.patch(
  '/orders/:id/ship',
  requireFulfillmentWriteAccess,
  fulfillmentController.shipOrder
);

router.patch(
  '/orders/:id/deliver',
  requireFulfillmentWriteAccess,
  fulfillmentController.markDelivered
);

router.patch(
  '/orders/:id/return',
  requireFulfillmentWriteAccess,
  fulfillmentController.markReturnedToSender
);

module.exports = router;