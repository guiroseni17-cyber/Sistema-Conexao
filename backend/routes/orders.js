const express = require('express');
const router = express.Router();
const controller = require('../controllers/orderController');

router.get('/dashboard', controller.dashboard);
router.get('/agenda', controller.agenda);
router.get('/proximo-numero', controller.proximoNumero);
router.get('/', controller.listar);
router.get('/:id', controller.buscarPorId);
router.post('/', controller.criar);
router.put('/:id', controller.editar);
router.put('/:id/cancelar', controller.cancelar);
router.put('/:id/concluir', controller.concluir);

module.exports = router;
