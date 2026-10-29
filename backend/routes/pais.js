const express = require('express');
const router = express.Router();
const { apenasAdmin } = require('../middleware/auth');
const controller = require('../controllers/paiController');

router.get('/', controller.listar);
router.get('/:id', controller.buscarPorId);
router.post('/', apenasAdmin, controller.criar);
router.put('/:id', apenasAdmin, controller.editar);
router.delete('/:id', apenasAdmin, controller.remover);

router.post('/:id/variacoes', apenasAdmin, controller.adicionarVariacoes);
router.put('/:id/variacoes/:varId', apenasAdmin, controller.editarVariacao);
router.delete('/:id/variacoes/:varId', apenasAdmin, controller.removerVariacao);

module.exports = router;
