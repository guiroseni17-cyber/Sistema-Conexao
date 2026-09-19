const express = require('express');
const router = express.Router();
const controller = require('../controllers/supplierController');

router.get('/', controller.listar);
router.get('/:id', controller.buscarPorId);
router.post('/', controller.criar);
router.put('/:id', controller.editar);
router.delete('/:id', controller.remover);

module.exports = router;
