const express = require('express');

const router = express.Router();

const cdmController = require(
  '../controllers/cdm.controller'
);

const verifyToken = require(
  '../middleware/auth'
);

function requireCdmReadAccess(
  req,
  res,
  next
) {
  const isHead =
    req.user?.role === 'head';

  const isCdmSpecialist =
    req.user?.role === 'specialist' &&
    req.user?.departmentCode === 'cdm';

  if (!isHead && !isCdmSpecialist) {
    return res.status(403).json({
      success: false,
      message:
        'You do not have access to the Customer Data Management module.',
    });
  }

  next();
}

function requireCdmWriteAccess(
  req,
  res,
  next
) {
  const isCdmSpecialist =
    req.user?.role === 'specialist' &&
    req.user?.departmentCode === 'cdm';

  if (!isCdmSpecialist) {
    return res.status(403).json({
      success: false,
      message:
        'Only Customer Data Management Specialists can process orders.',
    });
  }

  next();
}

router.use(verifyToken);

router.get(
  '/orders',
  requireCdmReadAccess,
  cdmController.getOrders
);

router.get(
  '/orders/:id',
  requireCdmReadAccess,
  cdmController.getOrderById
);

router.patch(
  '/orders/:id/confirm',
  requireCdmWriteAccess,
  cdmController.confirmOrder
);

router.patch(
  '/orders/:id/reject',
  requireCdmWriteAccess,
  cdmController.rejectOrder
);

router.patch(
  '/orders/:id/waybill',
  requireCdmWriteAccess,
  cdmController.saveWaybill
);

router.patch(
  '/orders/:id/send',
  requireCdmWriteAccess,
  cdmController.markSentToCustomer
);

module.exports = router;