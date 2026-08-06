const express = require('express');

const router = express.Router();

const crmController = require(
  '../controllers/crm.controller'
);

const verifyToken = require(
  '../middleware/auth'
);

function requireCrmReadAccess(
  req,
  res,
  next
) {
  const isHead =
    req.user?.role === 'head';

  const isCrmSpecialist =
    req.user?.role ===
      'specialist' &&
    req.user?.departmentCode ===
      'crm';

  if (
    !isHead &&
    !isCrmSpecialist
  ) {
    return res.status(403).json({
      success: false,
      message:
        'You do not have access to the Customer Relationship Management module.',
    });
  }

  next();
}

function requireCrmWriteAccess(
  req,
  res,
  next
) {
  const isCrmSpecialist =
    req.user?.role ===
      'specialist' &&
    req.user?.departmentCode ===
      'crm';

  if (!isCrmSpecialist) {
    return res.status(403).json({
      success: false,
      message:
        'Only CRM Specialists can update CRM records.',
    });
  }

  next();
}

router.use(verifyToken);

router.get(
  '/users',
  requireCrmReadAccess,
  crmController.getCrmUsers
);

router.get(
  '/summary',
  requireCrmReadAccess,
  crmController.getSummary
);

router.get(
  '/cases',
  requireCrmReadAccess,
  crmController.getCases
);

router.get(
  '/cases/:id',
  requireCrmReadAccess,
  crmController.getCaseById
);

router.patch(
  '/cases/:id/assign',
  requireCrmWriteAccess,
  crmController.assignCase
);

router.patch(
  '/cases/:id/concern',
  requireCrmWriteAccess,
  crmController.updateConcern
);

router.patch(
  '/cases/:id/steps/:stepNumber',
  requireCrmWriteAccess,
  crmController.updateAfterSalesStep
);

router.put(
  '/cases/:id/satisfaction',
  requireCrmWriteAccess,
  crmController.saveSatisfaction
);

router.patch(
  '/cases/:id/resolve',
  requireCrmWriteAccess,
  crmController.resolveCase
);

router.patch(
  '/cases/:id/close',
  requireCrmWriteAccess,
  crmController.closeCase
);

module.exports = router;