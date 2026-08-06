const express = require('express');

const router = express.Router();

const userController = require('../controllers/user.controller');
const verifyToken = require('../middleware/auth');
const requireRole = require('../middleware/rbac');

router.use(verifyToken);
router.use(requireRole('system_configuration'));

router.get('/departments', userController.getDepartments);

router.get('/', userController.getUsers);
router.post('/', userController.createUser);

router.patch('/:id/status', userController.updateUserStatus);
router.patch(
  '/:id/reset-password',
  userController.resetUserPassword
);
router.patch('/:id', userController.updateUser);

module.exports = router;