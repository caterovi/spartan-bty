const express = require('express');

const router = express.Router();

const supplyChainController = require(
  '../controllers/supplychain.controller'
);

const verifyToken = require(
  '../middleware/auth'
);

function requireSupplyChainReadAccess(
  req,
  res,
  next
) {
  const isHead =
    req.user?.role === 'head';

  const isSupplyChainSpecialist =
    req.user?.role === 'specialist' &&
    req.user?.departmentCode ===
      'supply_chain';

  if (
    !isHead &&
    !isSupplyChainSpecialist
  ) {
    return res.status(403).json({
      success: false,
      message:
        'You do not have access to the Supply Chain module.',
    });
  }

  next();
}

function requireSupplyChainWriteAccess(
  req,
  res,
  next
) {
  const isSupplyChainSpecialist =
    req.user?.role === 'specialist' &&
    req.user?.departmentCode ===
      'supply_chain';

  if (!isSupplyChainSpecialist) {
    return res.status(403).json({
      success: false,
      message:
        'Only Supply Chain Specialists can update inventory records.',
    });
  }

  next();
}

router.use(verifyToken);

router.get(
  '/summary',
  requireSupplyChainReadAccess,
  supplyChainController.getSummary
);

router.get(
  '/items',
  requireSupplyChainReadAccess,
  supplyChainController.getItems
);

router.get(
  '/items/:id',
  requireSupplyChainReadAccess,
  supplyChainController.getItemById
);

router.post(
  '/items/:id/movements',
  requireSupplyChainWriteAccess,
  supplyChainController.recordMovement
);

router.post(
  '/items/:id/quality-checks',
  requireSupplyChainWriteAccess,
  supplyChainController.recordQualityCheck
);

router.patch(
  '/items/:id/settings',
  requireSupplyChainWriteAccess,
  supplyChainController.updateItemSettings
);

module.exports = router;