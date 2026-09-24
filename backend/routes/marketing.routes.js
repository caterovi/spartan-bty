const express = require('express');

const router = express.Router();

const marketingController = require(
  '../controllers/marketing.controller'
);

const verifyToken = require(
  '../middleware/auth'
);

const {
  requireDepartmentRead,
  requireDepartmentWrite,
  requireHeadOnly,
} = require(
  '../middleware/departmentAccess'
);

router.use(verifyToken);

router.get(
  '/summary',
  requireDepartmentRead(
    'marketing',
    'You do not have access to the Marketing module.',
  ),
  marketingController.getSummary
);

router.get(
  '/users',
  requireDepartmentRead(
    'marketing',
    'You do not have access to the Marketing module.',
  ),
  marketingController.getMarketingUsers
);

router.get(
  '/products',
  requireDepartmentRead(
    'marketing',
    'You do not have access to the Marketing module.',
  ),
  marketingController.getProducts
);

router.get(
  '/campaigns',
  requireDepartmentRead(
    'marketing',
    'You do not have access to the Marketing module.',
  ),
  marketingController.getCampaigns
);

router.post(
  '/campaigns',
  requireHeadOnly(
    'Only the Head can manage campaigns, assignments, and reviews.',
  ),
  marketingController.createCampaign
);

router.patch(
  '/campaigns/:id',
  requireHeadOnly(
    'Only the Head can manage campaigns, assignments, and reviews.',
  ),
  marketingController.updateCampaign
);

router.get(
  '/tasks',
  requireDepartmentRead(
    'marketing',
    'You do not have access to the Marketing module.',
  ),
  marketingController.getTasks
);

router.post(
  '/tasks',
  requireHeadOnly(
    'Only the Head can manage campaigns, assignments, and reviews.',
  ),
  marketingController.createTask
);

router.get(
  '/tasks/:id',
  requireDepartmentRead(
    'marketing',
    'You do not have access to the Marketing module.',
  ),
  marketingController.getTaskById
);

router.patch(
  '/tasks/:id/assign',
  requireHeadOnly(
    'Only the Head can manage campaigns, assignments, and reviews.',
  ),
  marketingController.assignTask
);

router.patch(
  '/tasks/:id/start',
  requireDepartmentWrite(
    'marketing',
    'Only Marketing Specialists can process assigned Marketing tasks.',
  ),
  marketingController.startTask
);

router.post(
  '/tasks/:id/submissions',
  requireDepartmentWrite(
    'marketing',
    'Only Marketing Specialists can process assigned Marketing tasks.',
  ),
  marketingController.submitTask
);

router.patch(
  '/submissions/:id/review',
  requireHeadOnly(
    'Only the Head can manage campaigns, assignments, and reviews.',
  ),
  marketingController.reviewSubmission
);

router.patch(
  '/tasks/:id/complete',
  requireDepartmentWrite(
    'marketing',
    'Only Marketing Specialists can process assigned Marketing tasks.',
  ),
  marketingController.completeTask
);

router.patch(
  '/tasks/:id/cancel',
  requireHeadOnly(
    'Only the Head can manage campaigns, assignments, and reviews.',
  ),
  marketingController.cancelTask
);

module.exports = router;