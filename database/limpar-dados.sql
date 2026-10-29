-- =====================================================================
-- Strock Phone — LIMPAR DADOS (zera estoque e clientes)
--
-- ATENÇÃO: isto APAGA PARA SEMPRE. Faça um backup do banco antes.
--
-- Como pedidos e compras dependem de clientes e produtos, eles também
-- precisam ser apagados (senão ficariam "órfãos" e quebrariam o sistema).
--
-- O que é APAGADO:
--   clientes, produtos (estoque), movimentações de estoque,
--   pedidos (com itens, trocas e pagamentos), compras (com itens)
--
-- O que é MANTIDO:
--   usuários/logins (equipe), fornecedores, produtos pai e variações
--   (catálogo), metas do mês
--
-- Os números voltam a começar do 1 (pedido #1, cliente #1...).
-- Rode tudo de uma vez, na aba de consulta (Query) do MySQL no Railway.
-- =====================================================================

SET FOREIGN_KEY_CHECKS = 0;

TRUNCATE TABLE estoque_movimentos;
TRUNCATE TABLE pedido_pagamentos;
TRUNCATE TABLE pedido_trocas;
TRUNCATE TABLE pedido_itens;
TRUNCATE TABLE pedidos;
TRUNCATE TABLE compra_itens;
TRUNCATE TABLE compras;
TRUNCATE TABLE produtos;
TRUNCATE TABLE clientes;

SET FOREIGN_KEY_CHECKS = 1;

-- Conferência (todos devem retornar 0):
SELECT
    (SELECT COUNT(*) FROM clientes) AS clientes,
    (SELECT COUNT(*) FROM produtos) AS produtos,
    (SELECT COUNT(*) FROM pedidos)  AS pedidos,
    (SELECT COUNT(*) FROM compras)  AS compras;
