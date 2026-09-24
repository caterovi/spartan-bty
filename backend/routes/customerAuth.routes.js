const express = require('express');

const customerAuthController = require(
  '../controllers/customerAuth.controller'
);
const verifyCustomerToken = require(
  '../middleware/customerAuth'
);
const {
  customerLoginAccountLimiter,
  customerLoginIpLimiter,
  customerSignupLimiter,
} = require('../middleware/customerAuthRateLimiter');

const router = express.Router();

router.post(
  '/signup',
  customerSignupLimiter,
  customerAuthController.signup
);
router.post(
  '/login',
  customerLoginIpLimiter,
  customerLoginAccountLimiter,
  customerAuthController.login
);
router.post('/refresh', customerAuthController.refresh);
router.get('/me', verifyCustomerToken, customerAuthController.me);

module.exports = router;
