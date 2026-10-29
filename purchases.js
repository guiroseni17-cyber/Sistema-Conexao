const express = require('express');
const router = express.Router();
const controller = require('../controllers/purchaseController');

router.get('/', controller.listar);
router.get('/:id', controller.buscarPorId);
router.post('/', controller.criar);
router.put('/:id/pagamento', controller.registrarPagamento);
router.put('/:id/cancelar', controller.cancelar);

module.exports = router;
