const express = require('express');
const router = express.Router();
const { apenasAdmin } = require('../middleware/auth');
const controller = require('../controllers/supplierController');

// Área restrita: só administradores
router.use(apenasAdmin);

router.get('/', controller.listar);
router.get('/:id', controller.buscarPorId);
router.post('/', controller.criar);
router.put('/:id', controller.editar);
router.delete('/:id', controller.remover);

module.exports = router;
