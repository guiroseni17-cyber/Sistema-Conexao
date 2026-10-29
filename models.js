const express = require('express');
const router = express.Router();
const controller = require('../controllers/modeloController');

// O cadastro/edição de variações é feito em /api/pais (produto pai + variações)
router.get('/', controller.listar);
router.delete('/:id', controller.remover);

module.exports = router;
