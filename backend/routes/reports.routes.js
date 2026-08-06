const express = require('express');

const router = express.Router();

const reportsController = require(
  '../controllers/reports.controller'
);

const verifyToken = require(
  '../middleware/auth'
);

function getDepartmentCode(user) {
  return (
    user?.departmentCode ||
    user?.department?.code ||
    ''
  );
}

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

function requireHead(
  req,
  res,
  next
) {
  if (req.user?.role !== 'head') {
    return res.status(403).json({
      success: false,
      message:
        'Only the Head can view the overall management report.',
    });
  }

  next();
}

function requireDepartment(
  departmentCode
) {
  return (
    req,
    res,
    next
  ) => {
    const isHead =
      req.user?.role === 'head';

    const isDepartmentSpecialist =
      req.user?.role ===
        'specialist' &&
      getDepartmentCode(
        req.user
      ) === departmentCode;

    if (
      !isHead &&
      !isDepartmentSpecialist
    ) {
      return res.status(403).json({
        success: false,
        message:
          'You do not have access to this department report.',
      });
    }

    next();
  };
}

router.use(verifyToken);
router.use(requireReportsAccess);

router.get(
  '/overview',
  requireHead,
  reportsController.getOverview
);

router.get(
  '/sales',
  requireDepartment('sales'),
  reportsController.getSalesReport
);

router.get(
  '/cdm',
  requireDepartment('cdm'),
  reportsController.getCdmReport
);

router.get(
  '/inventory',
  requireDepartment(
    'supply_chain'
  ),
  reportsController.getInventoryReport
);

router.get(
  '/fulfillment',
  requireDepartment(
    'fulfillment'
  ),
  reportsController.getFulfillmentReport
);

router.get(
  '/crm',
  requireDepartment('crm'),
  reportsController.getCrmReport
);

router.get(
  '/marketing',
  requireDepartment(
    'marketing'
  ),
  reportsController.getMarketingReport
);

module.exports = router;