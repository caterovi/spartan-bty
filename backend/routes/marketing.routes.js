const express = require('express');

const router = express.Router();

const marketingController = require(
  '../controllers/marketing.controller'
);

const verifyToken = require(
  '../middleware/auth'
);

function requireMarketingReadAccess(
  req,
  res,
  next
) {
  const isHead =
    req.user?.role === 'head';

  const isMarketingSpecialist =
    req.user?.role ===
      'specialist' &&
    req.user?.departmentCode ===
      'marketing';

  if (
    !isHead &&
    !isMarketingSpecialist
  ) {
    return res.status(403).json({
      success: false,

      message:
        'You do not have access to the Marketing module.',
    });
  }

  next();
}

function requireHeadAccess(
  req,
  res,
  next
) {
  if (
    req.user?.role !== 'head'
  ) {
    return res.status(403).json({
      success: false,

      message:
        'Only the Head can manage campaigns, assignments, and reviews.',
    });
  }

  next();
}

function requireMarketingSpecialist(
  req,
  res,
  next
) {
  const allowed =
    req.user?.role ===
      'specialist' &&
    req.user?.departmentCode ===
      'marketing';

  if (!allowed) {
    return res.status(403).json({
      success: false,

      message:
        'Only Marketing Specialists can process assigned Marketing tasks.',
    });
  }

  next();
}

router.use(verifyToken);

router.get(
  '/summary',
  requireMarketingReadAccess,
  marketingController.getSummary
);

router.get(
  '/users',
  requireMarketingReadAccess,
  marketingController.getMarketingUsers
);

router.get(
  '/products',
  requireMarketingReadAccess,
  marketingController.getProducts
);

router.get(
  '/campaigns',
  requireMarketingReadAccess,
  marketingController.getCampaigns
);

router.post(
  '/campaigns',
  requireHeadAccess,
  marketingController.createCampaign
);

router.patch(
  '/campaigns/:id',
  requireHeadAccess,
  marketingController.updateCampaign
);

router.get(
  '/tasks',
  requireMarketingReadAccess,
  marketingController.getTasks
);

router.post(
  '/tasks',
  requireHeadAccess,
  marketingController.createTask
);

router.get(
  '/tasks/:id',
  requireMarketingReadAccess,
  marketingController.getTaskById
);

router.patch(
  '/tasks/:id/assign',
  requireHeadAccess,
  marketingController.assignTask
);

router.patch(
  '/tasks/:id/start',
  requireMarketingSpecialist,
  marketingController.startTask
);

router.post(
  '/tasks/:id/submissions',
  requireMarketingSpecialist,
  marketingController.submitTask
);

router.patch(
  '/submissions/:id/review',
  requireHeadAccess,
  marketingController.reviewSubmission
);

router.patch(
  '/tasks/:id/complete',
  requireMarketingSpecialist,
  marketingController.completeTask
);

router.patch(
  '/tasks/:id/cancel',
  requireHeadAccess,
  marketingController.cancelTask
);

module.exports = router;