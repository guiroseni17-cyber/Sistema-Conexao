const express = require('express');
const router = express.Router();
const { apenasAdmin } = require('../middleware/auth');
const controller = require('../controllers/reportController');

// Área restrita: só administradores
router.use(apenasAdmin);

router.get('/vendas', controller.vendas);
router.get('/compras', controller.compras);

module.exports = router;
