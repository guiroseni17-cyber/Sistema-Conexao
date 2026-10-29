const express = require('express');
const router = express.Router();
const { apenasAdmin } = require('../middleware/auth');
const controller = require('../controllers/modeloController');

// O cadastro/edição de variações é feito em /api/pais (produto pai + variações)
router.get('/', controller.listar);
router.delete('/:id', apenasAdmin, controller.remover);

module.exports = router;
