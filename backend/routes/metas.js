const express = require('express');
const router = express.Router();
const controller = require('../controllers/metaController');
const { apenasAdmin } = require('../middleware/auth');

router.get('/', controller.listar);
router.put('/:mes', apenasAdmin, controller.salvar);

module.exports = router;
