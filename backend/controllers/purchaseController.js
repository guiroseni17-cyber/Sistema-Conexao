const db = require('../config/db');

exports.listar = async (req, res) => {
    try {
        const [rows] = await db.query(`
            SELECT c.*, f.nome AS fornecedor_nome
            FROM compras c
            JOIN fornecedores f ON f.id = c.fornecedor_id
            ORDER BY c.criado_em DESC
        `);
        res.json(rows);
    } catch (err) {
        res.status(500).json({ erro: 'Erro ao listar compras', detalhe: err.message });
    }
};

exports.buscarPorId = async (req, res) => {
    try {
        const compraId = req.params.id;
        const [compra] = await db.query(`
            SELECT c.*, f.nome AS fornecedor_nome, f.telefone AS fornecedor_telefone
            FROM compras c JOIN fornecedores f ON f.id = c.fornecedor_id
            WHERE c.id = ?
        `, [compraId]);
        if (compra.length === 0) return res.status(404).json({ erro: 'Compra não encontrada' });

        const [itens] = await db.query(`
            SELECT ci.*, p.nome AS produto_nome, p.modelo, p.imei
            FROM compra_itens ci JOIN produtos p ON p.id = ci.produto_id
            WHERE ci.compra_id = ?
        `, [compraId]);

        res.json({ ...compra[0], itens });
    } catch (err) {
        res.status(500).json({ erro: 'Erro ao buscar compra', detalhe: err.message });
    }
};

/**
 * Registrar uma compra (mercadoria recebida do fornecedor).
 *
 * Corpo esperado:
 * {
 *   fornecedor_id: 3,
 *   observacoes: "Lote de seminovos",
 *   valor_pago: 0,           // quanto já foi pago na hora (opcional)
 *   itens: [
 *     // Reposição de um produto que já existe no estoque:
 *     { produto_id: 12, quantidade: 5, preco_custo_unitario: 900 },
 *
 *     // Produto novo, criado direto pela compra:
 *     { produto_id: null, quantidade: 1, preco_custo_unitario: 1200,
 *       nome: "iPhone 12 128GB", categoria: "aparelho_novo", marca: "Apple",
 *       modelo: "iPhone 12", imei: "123...", condicao: "novo", preco_venda: 1800 }
 *   ]
 * }
 *
 * Cada item já entra direto no estoque (soma quantidade se o produto existe,
 * cria se não existe) e fica registrado no histórico de movimentações.
 */
exports.criar = async (req, res) => {
    const connection = await db.getConnection();
    try {
        await connection.beginTransaction();

        const { fornecedor_id, observacoes, valor_pago, itens } = req.body;

        if (!fornecedor_id || !itens || itens.length === 0) {
            await connection.rollback();
            return res.status(400).json({ erro: 'Fornecedor e ao menos um item comprado são obrigatórios' });
        }

        let valorTotal = 0;
        for (const item of itens) {
            valorTotal += Number(item.quantidade) * Number(item.preco_custo_unitario);
        }
        const valorPago = Number(valor_pago || 0);
        const statusPagamento = valorPago <= 0 ? 'pendente' : (valorPago >= valorTotal ? 'pago' : 'parcial');

        const [compraResult] = await connection.query(
            `INSERT INTO compras (fornecedor_id, usuario_id, status_pagamento, valor_total, valor_pago, observacoes)
             VALUES (?, ?, ?, ?, ?, ?)`,
            [fornecedor_id, req.user?.id || null, statusPagamento, valorTotal, valorPago, observacoes || null]
        );
        const compraId = compraResult.insertId;

        for (const item of itens) {
            let produtoId = item.produto_id || null;
            const quantidade = Number(item.quantidade);
            const precoCusto = Number(item.preco_custo_unitario);

            if (produtoId) {
                // Repondo um produto que já existe: soma a quantidade e
                // atualiza o custo para o valor mais recente pago.
                const [existe] = await connection.query(
                    'SELECT id FROM produtos WHERE id = ? FOR UPDATE', [produtoId]
                );
                if (existe.length === 0) {
                    throw new Error(`Produto id ${produtoId} não encontrado`);
                }
                await connection.query(
                    'UPDATE produtos SET quantidade = quantidade + ?, preco_custo = ? WHERE id = ?',
                    [quantidade, precoCusto, produtoId]
                );
            } else {
                // Produto novo, cadastrado direto pela compra
                if (!item.nome) {
                    throw new Error('Item sem produto existente precisa ter um nome para ser cadastrado');
                }
                const [novoProduto] = await connection.query(
                    `INSERT INTO produtos (nome, categoria, marca, modelo, imei, condicao, quantidade, preco_custo, preco_venda, origem)
                     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'compra')`,
                    [
                        item.nome, item.categoria || 'aparelho_novo', item.marca || null, item.modelo || null,
                        item.imei || null, item.condicao || 'novo', quantidade, precoCusto, item.preco_venda || 0
                    ]
                );
                produtoId = novoProduto.insertId;
            }

            await connection.query(
                'INSERT INTO compra_itens (compra_id, produto_id, quantidade, preco_custo_unitario) VALUES (?, ?, ?, ?)',
                [compraId, produtoId, quantidade, precoCusto]
            );

            await connection.query(
                `INSERT INTO estoque_movimentos (produto_id, tipo, quantidade, referencia, usuario_id)
                 VALUES (?, 'entrada_compra', ?, ?, ?)`,
                [produtoId, quantidade, `Compra #${compraId}`, req.user?.id || null]
            );
        }

        await connection.commit();
        res.status(201).json({
            id: compraId,
            valor_total: valorTotal,
            valor_pago: valorPago,
            status_pagamento: statusPagamento,
            mensagem: 'Compra registrada. Estoque atualizado.'
        });
    } catch (err) {
        await connection.rollback();
        res.status(500).json({ erro: 'Erro ao registrar compra', detalhe: err.message });
    } finally {
        connection.release();
    }
};

// Registra um pagamento (total ou parcial) para o fornecedor
exports.registrarPagamento = async (req, res) => {
    try {
        const { valor } = req.body;
        const compraId = req.params.id;
        const valorPagoAgora = Number(valor || 0);
        if (valorPagoAgora <= 0) {
            return res.status(400).json({ erro: 'Informe um valor de pagamento maior que zero' });
        }

        const [rows] = await db.query('SELECT valor_total, valor_pago FROM compras WHERE id = ?', [compraId]);
        if (rows.length === 0) return res.status(404).json({ erro: 'Compra não encontrada' });

        const novoValorPago = Number(rows[0].valor_pago) + valorPagoAgora;
        const status = novoValorPago >= Number(rows[0].valor_total) ? 'pago' : 'parcial';

        await db.query('UPDATE compras SET valor_pago = ?, status_pagamento = ? WHERE id = ?', [novoValorPago, status, compraId]);
        res.json({ mensagem: 'Pagamento registrado', valor_pago: novoValorPago, status_pagamento: status });
    } catch (err) {
        res.status(500).json({ erro: 'Erro ao registrar pagamento', detalhe: err.message });
    }
};

// Cancela a compra: retira do estoque o que ela havia adicionado.
// Se o estoque já não tiver quantidade suficiente (produto já foi vendido),
// a operação é bloqueada para não deixar o estoque negativo.
exports.cancelar = async (req, res) => {
    const connection = await db.getConnection();
    try {
        await connection.beginTransaction();
        const compraId = req.params.id;

        const [compraRows] = await connection.query('SELECT status FROM compras WHERE id = ? FOR UPDATE', [compraId]);
        if (compraRows.length === 0) {
            await connection.rollback();
            return res.status(404).json({ erro: 'Compra não encontrada' });
        }
        if (compraRows[0].status === 'cancelada') {
            await connection.rollback();
            return res.status(400).json({ erro: 'Compra já está cancelada' });
        }

        const [itens] = await connection.query('SELECT produto_id, quantidade FROM compra_itens WHERE compra_id = ?', [compraId]);
        for (const item of itens) {
            const [produto] = await connection.query('SELECT quantidade FROM produtos WHERE id = ? FOR UPDATE', [item.produto_id]);
            if (produto.length && produto[0].quantidade < item.quantidade) {
                throw new Error(`Não é possível cancelar: parte do produto id ${item.produto_id} já foi vendida`);
            }
            await connection.query('UPDATE produtos SET quantidade = quantidade - ? WHERE id = ?', [item.quantidade, item.produto_id]);
            await connection.query(
                `INSERT INTO estoque_movimentos (produto_id, tipo, quantidade, referencia, usuario_id)
                 VALUES (?, 'ajuste_manual', ?, ?, ?)`,
                [item.produto_id, -item.quantidade, `Cancelamento da Compra #${compraId}`, req.user?.id || null]
            );
        }

        await connection.query('UPDATE compras SET status = "cancelada" WHERE id = ?', [compraId]);
        await connection.commit();
        res.json({ mensagem: 'Compra cancelada e estoque estornado.' });
    } catch (err) {
        await connection.rollback();
        res.status(500).json({ erro: 'Erro ao cancelar compra', detalhe: err.message });
    } finally {
        connection.release();
    }
};
