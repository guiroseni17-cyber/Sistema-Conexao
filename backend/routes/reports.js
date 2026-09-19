const express = require('express');
const router = express.Router();
const controller = require('../controllers/reportController');

router.get('/vendas', controller.vendas);
router.get('/compras', controller.compras);

module.exports = router;
