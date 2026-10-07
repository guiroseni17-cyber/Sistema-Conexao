const express = require('express');
const router = express.Router();
const controller = require('../controllers/modeloController');

router.get('/', controller.listar);
router.post('/lote', controller.criarLote);
router.delete('/:id', controller.remover);

module.exports = router;
