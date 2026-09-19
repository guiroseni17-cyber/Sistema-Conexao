const express = require('express');
const router = express.Router();
const controller = require('../controllers/productController');

router.get('/', controller.listar);
router.get('/:id', controller.buscarPorId);
router.get('/:id/historico', controller.historico);
router.post('/', controller.criar);
router.put('/:id', controller.editar);
router.delete('/:id', controller.remover);

module.exports = router;
