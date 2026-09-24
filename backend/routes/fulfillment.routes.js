const express = require('express');

const router = express.Router();

const fulfillmentController = require(
  '../controllers/fulfillment.controller'
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
  '/summary',
  requireDepartmentRead(
    'fulfillment',
    'You do not have access to the Fulfillment module.',
  ),
  fulfillmentController.getSummary
);

router.get(
  '/orders',
  requireDepartmentRead(
    'fulfillment',
    'You do not have access to the Fulfillment module.',
  ),
  fulfillmentController.getOrders
);

router.get(
  '/packaging-items',
  requireDepartmentRead(
    'fulfillment',
    'You do not have access to the Fulfillment module.',
  ),
  fulfillmentController.getPackagingItems
);

router.get(
  '/orders/:id',
  requireDepartmentRead(
    'fulfillment',
    'You do not have access to the Fulfillment module.',
  ),
  fulfillmentController.getOrderById
);

router.patch(
  '/orders/:id/start-packing',
  requireDepartmentWrite(
    'fulfillment',
    'Only Fulfillment Specialists can process fulfillment orders.',
  ),
  fulfillmentController.startPacking
);

router.patch(
  '/orders/:id/complete-packing',
  requireDepartmentWrite(
    'fulfillment',
    'Only Fulfillment Specialists can process fulfillment orders.',
  ),
  fulfillmentController.completePacking
);

router.patch(
  '/orders/:id/ready',
  requireDepartmentWrite(
    'fulfillment',
    'Only Fulfillment Specialists can process fulfillment orders.',
  ),
  fulfillmentController.markReadyForShipment
);

router.patch(
  '/orders/:id/ship',
  requireDepartmentWrite(
    'fulfillment',
    'Only Fulfillment Specialists can process fulfillment orders.',
  ),
  fulfillmentController.shipOrder
);

router.patch(
  '/orders/:id/deliver',
  requireDepartmentWrite(
    'fulfillment',
    'Only Fulfillment Specialists can process fulfillment orders.',
  ),
  fulfillmentController.markDelivered
);

router.patch(
  '/orders/:id/return',
  requireDepartmentWrite(
    'fulfillment',
    'Only Fulfillment Specialists can process fulfillment orders.',
  ),
  fulfillmentController.markReturnedToSender
);

module.exports = router;