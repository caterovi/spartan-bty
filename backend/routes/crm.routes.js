const express = require('express');

const router = express.Router();

const crmController = require(
  '../controllers/crm.controller'
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
  '/users',
  requireDepartmentRead(
    'crm',
    'You do not have access to the Customer Relationship Management module.',
  ),
  crmController.getCrmUsers
);

router.get(
  '/summary',
  requireDepartmentRead(
    'crm',
    'You do not have access to the Customer Relationship Management module.',
  ),
  crmController.getSummary
);

router.get(
  '/cases',
  requireDepartmentRead(
    'crm',
    'You do not have access to the Customer Relationship Management module.',
  ),
  crmController.getCases
);

router.get(
  '/cases/:id',
  requireDepartmentRead(
    'crm',
    'You do not have access to the Customer Relationship Management module.',
  ),
  crmController.getCaseById
);

router.patch(
  '/cases/:id/assign',
  requireDepartmentWrite(
    'crm',
    'Only CRM Specialists can update CRM records.',
  ),
  crmController.assignCase
);

router.patch(
  '/cases/:id/concern',
  requireDepartmentWrite(
    'crm',
    'Only CRM Specialists can update CRM records.',
  ),
  crmController.updateConcern
);

router.patch(
  '/cases/:id/schedule',
  requireDepartmentWrite(
    'crm',
    'Only CRM Specialists can update CRM records.',
  ),
  crmController.scheduleFollowUp
);

router.patch(
  '/cases/:id/steps/:stepNumber',
  requireDepartmentWrite(
    'crm',
    'Only CRM Specialists can update CRM records.',
  ),
  crmController.updateAfterSalesStep
);

router.put(
  '/cases/:id/satisfaction',
  requireDepartmentWrite(
    'crm',
    'Only CRM Specialists can update CRM records.',
  ),
  crmController.saveSatisfaction
);

router.patch(
  '/cases/:id/resolve',
  requireDepartmentWrite(
    'crm',
    'Only CRM Specialists can update CRM records.',
  ),
  crmController.resolveCase
);

router.patch(
  '/cases/:id/close',
  requireDepartmentWrite(
    'crm',
    'Only CRM Specialists can update CRM records.',
  ),
  crmController.closeCase
);

module.exports = router;