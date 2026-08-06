const express = require('express');
const router = express.Router();

const authController = require('../controllers/auth.controller');
const verifyToken = require('../middleware/auth');

router.post('/login', authController.login);
router.post('/refresh', authController.refresh);
router.get('/me', verifyToken, authController.me);
router.patch('/change-password',verifyToken,authController.changePassword);

module.exports = router;