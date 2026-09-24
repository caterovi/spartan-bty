const express = require('express');

const router = express.Router();

const cdmController = require(
  '../controllers/cdm.controller'
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
  '/orders',
  requireDepartmentRead(
    'cdm',
    'You do not have access to the Customer Data Management module.',
  ),
  cdmController.getOrders
);

router.get(
  '/orders/:id',
  requireDepartmentRead(
    'cdm',
    'You do not have access to the Customer Data Management module.',
  ),
  cdmController.getOrderById
);

router.patch(
  '/orders/:id/confirm',
  requireDepartmentWrite(
    'cdm',
    'Only Customer Data Management Specialists can process orders.',
  ),
  cdmController.confirmOrder
);

router.patch(
  '/orders/:id/reject',
  requireDepartmentWrite(
    'cdm',
    'Only Customer Data Management Specialists can process orders.',
  ),
  cdmController.rejectOrder
);

router.patch(
  '/orders/:id/waybill',
  requireDepartmentWrite(
    'cdm',
    'Only Customer Data Management Specialists can process orders.',
  ),
  cdmController.saveWaybill
);

router.patch(
  '/orders/:id/send',
  requireDepartmentWrite(
    'cdm',
    'Only Customer Data Management Specialists can process orders.',
  ),
  cdmController.markSentToCustomer
);

module.exports = router;