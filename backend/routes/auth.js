const express = require('express');
const router = express.Router();
const controller = require('../controllers/authController');
const { autenticar } = require('../middleware/auth');

router.post('/login', controller.login);
router.get('/me', autenticar, controller.me);

module.exports = router;
