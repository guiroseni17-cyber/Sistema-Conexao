const express = require('express');
const router = express.Router();
const { apenasAdmin } = require('../middleware/auth');
const controller = require('../controllers/financeController');

// Área restrita: só administradores
router.use(apenasAdmin);

router.get('/resumo', controller.resumo);

// Conciliação dos pagamentos das vendas
router.get('/pagamentos', controller.listarPagamentos);
router.put('/pagamentos/lote', controller.conciliarLote);
router.put('/pagamentos/:id/conciliar', controller.conciliarPagamento);
router.put('/pagamentos/:id/desfazer', controller.desfazerConciliacao);

// Despesas / outras entradas
router.get('/lancamentos', controller.listarLancamentos);
router.post('/lancamentos', controller.criarLancamento);
router.put('/lancamentos/:id', controller.atualizarLancamento);
router.delete('/lancamentos/:id', controller.excluirLancamento);

module.exports = router;
