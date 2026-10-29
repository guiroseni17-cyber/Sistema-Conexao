const express = require('express');
const router = express.Router();
const { apenasAdmin } = require('../middleware/auth');
const controller = require('../controllers/productController');

router.get('/', controller.listar);
router.get('/:id', controller.buscarPorId);
router.get('/:id/historico', controller.historico);
router.post('/', apenasAdmin, controller.criar);
router.put('/:id', apenasAdmin, controller.editar);
router.delete('/:id', apenasAdmin, controller.remover);

module.exports = router;
