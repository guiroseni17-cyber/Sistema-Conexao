const db = require('../config/db');

// Relatório de vendas em um período: faturamento, lucro estimado
// (preço de venda - preço de custo de cada item vendido), formas de
// pagamento mais usadas e produtos mais vendidos.
exports.vendas = async (req, res) => {
    try {
        const { inicio, fim } = req.query;
        if (!inicio || !fim) {
            return res.status(400).json({ erro: 'Informe data de início e fim (inicio=AAAA-MM-DD&fim=AAAA-MM-DD)' });
        }

        const [[resumo]] = await db.query(`
            SELECT
                COUNT(*) AS total_pedidos,
                COALESCE(SUM(valor_total), 0) AS faturamento_bruto,
                COALESCE(SUM(valor_troca), 0) AS total_abatido_trocas,
                COALESCE(SUM(valor_a_pagar), 0) AS total_recebido
            FROM pedidos
            WHERE status != 'cancelado' AND DATE(criado_em) BETWEEN ? AND ?
        `, [inicio, fim]);

        const [[lucro]] = await db.query(`
            SELECT COALESCE(SUM((pi.preco_unitario - pr.preco_custo) * pi.quantidade), 0) AS lucro_estimado
            FROM pedido_itens pi
            JOIN pedidos p ON p.id = pi.pedido_id
            JOIN produtos pr ON pr.id = pi.produto_id
            WHERE p.status != 'cancelado' AND DATE(p.criado_em) BETWEEN ? AND ?
        `, [inicio, fim]);

        const [formasPagamento] = await db.query(`
            SELECT COALESCE(forma_pagamento, 'Não informado') AS forma_pagamento,
                   COUNT(*) AS total_pedidos, COALESCE(SUM(valor_total), 0) AS valor
            FROM pedidos
            WHERE status != 'cancelado' AND DATE(criado_em) BETWEEN ? AND ?
            GROUP BY forma_pagamento ORDER BY valor DESC
        `, [inicio, fim]);

        const [produtosMaisVendidos] = await db.query(`
            SELECT pr.nome, pr.modelo, SUM(pi.quantidade) AS quantidade_vendida,
                   SUM(pi.quantidade * pi.preco_unitario) AS valor_total
            FROM pedido_itens pi
            JOIN pedidos p ON p.id = pi.pedido_id
            JOIN produtos pr ON pr.id = pi.produto_id
            WHERE p.status != 'cancelado' AND DATE(p.criado_em) BETWEEN ? AND ?
            GROUP BY pi.produto_id ORDER BY quantidade_vendida DESC LIMIT 10
        `, [inicio, fim]);

        const [porVendedor] = await db.query(`
            SELECT COALESCE(u.nome, 'Sem vendedor identificado') AS vendedor,
                   COUNT(*) AS total_pedidos, COALESCE(SUM(p.valor_total), 0) AS valor
            FROM pedidos p
            LEFT JOIN usuarios u ON u.id = p.usuario_id
            WHERE p.status != 'cancelado' AND DATE(p.criado_em) BETWEEN ? AND ?
            GROUP BY p.usuario_id ORDER BY valor DESC
        `, [inicio, fim]);

        res.json({
            periodo: { inicio, fim },
            ...resumo,
            lucro_estimado: lucro.lucro_estimado,
            formasPagamento,
            produtosMaisVendidos,
            porVendedor
        });
    } catch (err) {
        res.status(500).json({ erro: 'Erro ao gerar relatório de vendas', detalhe: err.message });
    }
};

// Relatório de compras em um período: total comprado e quanto ainda
// está em aberto com cada fornecedor.
exports.compras = async (req, res) => {
    try {
        const { inicio, fim } = req.query;
        if (!inicio || !fim) {
            return res.status(400).json({ erro: 'Informe data de início e fim (inicio=AAAA-MM-DD&fim=AAAA-MM-DD)' });
        }

        const [[resumo]] = await db.query(`
            SELECT COUNT(*) AS total_compras, COALESCE(SUM(valor_total), 0) AS total_comprado,
                   COALESCE(SUM(valor_pago), 0) AS total_pago
            FROM compras WHERE status = 'ativa' AND DATE(criado_em) BETWEEN ? AND ?
        `, [inicio, fim]);

        const [porFornecedor] = await db.query(`
            SELECT f.nome AS fornecedor, COUNT(*) AS total_compras,
                   COALESCE(SUM(c.valor_total), 0) AS valor_comprado,
                   COALESCE(SUM(c.valor_total - c.valor_pago), 0) AS valor_em_aberto
            FROM compras c JOIN fornecedores f ON f.id = c.fornecedor_id
            WHERE c.status = 'ativa' AND DATE(c.criado_em) BETWEEN ? AND ?
            GROUP BY c.fornecedor_id ORDER BY valor_comprado DESC
        `, [inicio, fim]);

        res.json({
            periodo: { inicio, fim },
            total_compras: resumo.total_compras,
            total_comprado: resumo.total_comprado,
            total_pago: resumo.total_pago,
            total_em_aberto: resumo.total_comprado - resumo.total_pago,
            porFornecedor
        });
    } catch (err) {
        res.status(500).json({ erro: 'Erro ao gerar relatório de compras', detalhe: err.message });
    }
};
