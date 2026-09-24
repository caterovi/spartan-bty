const express = require('express');

const router = express.Router();

const reportsController = require(
  '../controllers/reports.controller'
);

const verifyToken = require(
  '../middleware/auth'
);

const {
  requireDepartmentRead,
  requireHeadOnly,
} = require(
  '../middleware/departmentAccess'
);

function requireReportsAccess(
  req,
  res,
  next
) {
  const isHead =
    req.user?.role === 'head';

  const isSpecialist =
    req.user?.role ===
    'specialist';

  if (!isHead && !isSpecialist) {
    return res.status(403).json({
      success: false,
      message:
        'You do not have access to Reports and Analytics.',
    });
  }

  next();
}

router.use(verifyToken);
router.use(requireReportsAccess);

router.get(
  '/overview',
  requireHeadOnly(
    'Only the Head can view the overall management report.',
  ),
  reportsController.getOverview
);

router.get(
  '/sales',
  requireDepartmentRead(
    'sales',
    'You do not have access to this department report.',
  ),
  reportsController.getSalesReport
);

router.get(
  '/cdm',
  requireDepartmentRead(
    'cdm',
    'You do not have access to this department report.',
  ),
  reportsController.getCdmReport
);

router.get(
  '/inventory',
  requireDepartmentRead(
    'supply_chain',
    'You do not have access to this department report.',
  ),
  reportsController.getInventoryReport
);

router.get(
  '/fulfillment',
  requireDepartmentRead(
    'fulfillment',
    'You do not have access to this department report.',
  ),
  reportsController.getFulfillmentReport
);

router.get(
  '/crm',
  requireDepartmentRead(
    'crm',
    'You do not have access to this department report.',
  ),
  reportsController.getCrmReport
);

router.get(
  '/marketing',
  requireDepartmentRead(
    'marketing',
    'You do not have access to this department report.',
  ),
  reportsController.getMarketingReport
);

module.exports = router;