const express = require('express');

const router = express.Router();

const supplyChainController = require(
  '../controllers/supplychain.controller'
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
    'supply_chain',
    'You do not have access to the Supply Chain module.',
  ),
  supplyChainController.getSummary
);

router.get(
  '/items',
  requireDepartmentRead(
    'supply_chain',
    'You do not have access to the Supply Chain module.',
  ),
  supplyChainController.getItems
);

router.get(
  '/items/:id',
  requireDepartmentRead(
    'supply_chain',
    'You do not have access to the Supply Chain module.',
  ),
  supplyChainController.getItemById
);

router.post(
  '/items/:id/movements',
  requireDepartmentWrite(
    'supply_chain',
    'Only Supply Chain Specialists can update inventory records.',
  ),
  supplyChainController.recordMovement
);

router.post(
  '/items/:id/quality-checks',
  requireDepartmentWrite(
    'supply_chain',
    'Only Supply Chain Specialists can update inventory records.',
  ),
  supplyChainController.recordQualityCheck
);

router.patch(
  '/items/:id/settings',
  requireDepartmentWrite(
    'supply_chain',
    'Only Supply Chain Specialists can update inventory records.',
  ),
  supplyChainController.updateItemSettings
);

module.exports = router;