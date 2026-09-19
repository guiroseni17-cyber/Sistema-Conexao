const express = require('express');
const router = express.Router();
const controller = require('../controllers/orderController');

router.get('/dashboard', controller.dashboard);
router.get('/', controller.listar);
router.get('/:id', controller.buscarPorId);
router.post('/', controller.criar);
router.put('/:id', controller.editar);
router.put('/:id/cancelar', controller.cancelar);

module.exports = router;
