const express = require('express');
const router = express.Router();
const { apenasAdmin } = require('../middleware/auth');
const controller = require('../controllers/logController');

// Qualquer pessoa logada avisa eventos do navegador (saiu, abriu tela, imprimiu)
router.post('/evento', controller.evento);

// Ver os logs: só administradores. Não existe rota para editar ou apagar log.
router.get('/', apenasAdmin, controller.listar);
router.get('/:id', apenasAdmin, controller.detalhe);

module.exports = router;
