const express = require('express');
const router = express.Router();
const controller = require('../controllers/paiController');

router.get('/', controller.listar);
router.get('/:id', controller.buscarPorId);
router.post('/', controller.criar);
router.put('/:id', controller.editar);
router.delete('/:id', controller.remover);

router.post('/:id/variacoes', controller.adicionarVariacoes);
router.put('/:id/variacoes/:varId', controller.editarVariacao);
router.delete('/:id/variacoes/:varId', controller.removerVariacao);

module.exports = router;
