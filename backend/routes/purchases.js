const express = require('express');
const router = express.Router();
const { apenasAdmin } = require('../middleware/auth');
const controller = require('../controllers/purchaseController');

// Área restrita: só administradores
router.use(apenasAdmin);

router.get('/', controller.listar);
router.get('/:id', controller.buscarPorId);
router.post('/', controller.criar);
router.put('/:id/pagamento', controller.registrarPagamento);
router.put('/:id/cancelar', controller.cancelar);

module.exports = router;
