const express = require('express');
const router = express.Router();

const authController = require('../controllers/auth.controller');
const verifyToken = require('../middleware/auth');
const {
  loginAccountLimiter,
  loginIpLimiter,
} = require('../middleware/loginRateLimiter');

// Brute-force protection is applied to the login endpoint ONLY.
router.post(
  '/login',
  loginIpLimiter,
  loginAccountLimiter,
  authController.login
);
router.post('/refresh', authController.refresh);
router.get('/me', verifyToken, authController.me);
router.patch('/change-password',verifyToken,authController.changePassword);

module.exports = router;