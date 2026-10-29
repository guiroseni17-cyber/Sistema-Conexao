const express = require('express');
const router = express.Router();
const controller = require('../controllers/userController');
const { apenasAdmin } = require('../middleware/auth');

router.get('/vendedores', controller.listarVendedores);
router.get('/', apenasAdmin, controller.listar);
router.post('/', apenasAdmin, controller.criar);
router.put('/:id/alternar-ativo', apenasAdmin, controller.alternarAtivo);
router.put('/senha', controller.trocarSenha);

module.exports = router;
