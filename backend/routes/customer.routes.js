const express = require('express');

const customerController = require(
  '../controllers/customer.controller'
);
const verifyToken = require('../middleware/auth');

const router = express.Router();

function requireCustomerReadAccess(req, res, next) {
  const isHead = req.user?.role === 'head';
  const allowedDepartments = ['sales', 'cdm', 'crm'];
  const isAllowedSpecialist =
    req.user?.role === 'specialist' &&
    allowedDepartments.includes(req.user?.departmentCode);

  if (!isHead && !isAllowedSpecialist) {
    return res.status(403).json({
      success: false,
      message: 'You do not have access to Customer 360.',
    });
  }

  next();
}

router.use(verifyToken);
router.use(requireCustomerReadAccess);

router.get('/search', customerController.searchCustomers);
router.get('/:id/360', customerController.getCustomer360);

module.exports = router;
