const db = require('../config/db');

// Listar pedidos (resumo, com nome do cliente e do vendedor)
exports.listar = async (req, res) => {
    try {
        const [rows] = await db.query(`
            SELECT p.*, c.nome AS cliente_nome, u.nome AS vendedor_nome
            FROM pedidos p
            JOIN clientes c ON c.id = p.cliente_id
            LEFT JOIN usuarios u ON u.id = p.usuario_id
            ORDER BY p.criado_em DESC
        `);
        res.json(rows);
    } catch (err) {
        res.status(500).json({ erro: 'Erro ao listar pedidos', detalhe: err.message });
    }
};

// Detalhe completo de um pedido (itens vendidos + troca recebida)
exports.buscarPorId = async (req, res) => {
    try {
        const pedidoId = req.params.id;

        const [pedido] = await db.query(`
            SELECT p.*, c.nome AS cliente_nome, c.telefone AS cliente_telefone, u.nome AS vendedor_nome
            FROM pedidos p
            JOIN clientes c ON c.id = p.cliente_id
            LEFT JOIN usuarios u ON u.id = p.usuario_id
            WHERE p.id = ?
        `, [pedidoId]);

        if (pedido.length === 0) return res.status(404).json({ erro: 'Pedido não encontrado' });

        const [itens] = await db.query(`
            SELECT pi.*, pr.nome AS produto_nome, pr.modelo
            FROM pedido_itens pi JOIN produtos pr ON pr.id = pi.produto_id
            WHERE pi.pedido_id = ?
        `, [pedidoId]);

        const [trocas] = await db.query(`
            SELECT pt.*, pr.nome AS produto_nome, pr.modelo, pr.imei
            FROM pedido_trocas pt JOIN produtos pr ON pr.id = pt.produto_id
            WHERE pt.pedido_id = ?
        `, [pedidoId]);

        res.json({ ...pedido[0], itens, trocas });
    } catch (err) {
        res.status(500).json({ erro: 'Erro ao buscar pedido', detalhe: err.message });
    }
};

/**
 * Criar pedido de venda.
 *
 * Corpo esperado:
 * {
 *   cliente_id: 1,
 *   forma_pagamento: "Pix",
 *   itens: [ { produto_id: 5, quantidade: 1, preco_unitario: 1500 } ],
 *   troca: {   // opcional - aparelho recebido do cliente na troca
 *     nome: "iPhone 11 128GB",
 *     categoria: "aparelho_seminovo",
 *     marca: "Apple",
 *     modelo: "iPhone 11",
 *     imei: "123456789012345",
 *     condicao: "seminovo_bom",
 *     valor_abatido: 800,
 *     preco_venda_sugerido: 1400,
 *     observacoes: "Tela com micro-riscos"
 *   }
 * }
 *
 * Ao finalizar: dá baixa nos itens vendidos e, se houver troca,
 * cria automaticamente o produto recebido direto no estoque.
 */
exports.criar = async (req, res) => {
    const connection = await db.getConnection();
    try {
        await connection.beginTransaction();

        const { cliente_id, forma_pagamento, itens, troca, observacoes } = req.body;

        if (!cliente_id || !itens || itens.length === 0) {
            await connection.rollback();
            return res.status(400).json({ erro: 'Cliente e ao menos um item vendido são obrigatórios' });
        }

        // 1. Calcula valor total dos itens vendidos
        let valorTotal = 0;
        for (const item of itens) {
            valorTotal += item.quantidade * item.preco_unitario;
        }

        const valorTroca = troca ? Number(troca.valor_abatido || 0) : 0;
        const valorAPagar = valorTotal - valorTroca;

        // 2. Cria o pedido (guarda quem da equipe fez a venda)
        const [pedidoResult] = await connection.query(
            `INSERT INTO pedidos (cliente_id, usuario_id, forma_pagamento, valor_total, valor_troca, valor_a_pagar, observacoes)
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [cliente_id, req.user?.id || null, forma_pagamento || null, valorTotal, valorTroca, valorAPagar, observacoes || null]
        );
        const pedidoId = pedidoResult.insertId;

        // 3. Registra os itens vendidos, dá baixa no estoque e grava o
        //    histórico de movimentação (saída por venda)
        for (const item of itens) {
            const [produtoRows] = await connection.query(
                'SELECT quantidade FROM produtos WHERE id = ? FOR UPDATE',
                [item.produto_id]
            );
            if (produtoRows.length === 0) {
                throw new Error(`Produto id ${item.produto_id} não encontrado`);
            }
            if (produtoRows[0].quantidade < item.quantidade) {
                throw new Error(`Estoque insuficiente para o produto id ${item.produto_id}`);
            }

            await connection.query(
                'INSERT INTO pedido_itens (pedido_id, produto_id, quantidade, preco_unitario) VALUES (?, ?, ?, ?)',
                [pedidoId, item.produto_id, item.quantidade, item.preco_unitario]
            );

            await connection.query(
                'UPDATE produtos SET quantidade = quantidade - ? WHERE id = ?',
                [item.quantidade, item.produto_id]
            );

            await connection.query(
                `INSERT INTO estoque_movimentos (produto_id, tipo, quantidade, referencia, usuario_id)
                 VALUES (?, 'saida_venda', ?, ?, ?)`,
                [item.produto_id, -item.quantidade, `Pedido #${pedidoId}`, req.user?.id || null]
            );
        }

        // 4. Se houve troca, cria automaticamente o produto recebido no estoque
        //    (esta é a funcionalidade principal solicitada: entrada automática do aparelho trocado)
        if (troca && troca.nome) {
            const [produtoTrocaResult] = await connection.query(
                `INSERT INTO produtos
                    (nome, categoria, marca, modelo, imei, condicao, quantidade, preco_custo, preco_venda, origem, observacoes)
                 VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?, 'troca', ?)`,
                [
                    troca.nome,
                    troca.categoria || 'aparelho_seminovo',
                    troca.marca || null,
                    troca.modelo || null,
                    troca.imei || null,
                    troca.condicao || 'seminovo_bom',
                    troca.valor_abatido || 0,          // preco_custo = valor que foi abatido na troca
                    troca.preco_venda_sugerido || 0,   // preco_venda sugerido para revenda
                    troca.observacoes || null
                ]
            );

            await connection.query(
                'INSERT INTO pedido_trocas (pedido_id, produto_id, valor_abatido) VALUES (?, ?, ?)',
                [pedidoId, produtoTrocaResult.insertId, valorTroca]
            );

            await connection.query(
                `INSERT INTO estoque_movimentos (produto_id, tipo, quantidade, referencia, usuario_id)
                 VALUES (?, 'entrada_troca', 1, ?, ?)`,
                [produtoTrocaResult.insertId, `Troca no Pedido #${pedidoId}`, req.user?.id || null]
            );
        }

        await connection.commit();
        res.status(201).json({
            id: pedidoId,
            valor_total: valorTotal,
            valor_troca: valorTroca,
            valor_a_pagar: valorAPagar,
            mensagem: troca && troca.nome
                ? 'Pedido criado. Aparelho recebido em troca já cadastrado no estoque.'
                : 'Pedido criado com sucesso.'
        });

    } catch (err) {
        await connection.rollback();
        res.status(500).json({ erro: 'Erro ao criar pedido', detalhe: err.message });
    } finally {
        connection.release();
    }
};

/**
 * Editar pedido (cliente, forma de pagamento, observações e itens vendidos).
 * Reverte o estoque dos itens antigos e aplica o estoque dos itens novos,
 * tudo dentro de uma transação para não deixar o estoque inconsistente.
 *
 * Não mexe na troca (o aparelho recebido já virou um produto normal do
 * estoque - para corrigir os dados dele, edite em Estoque). É possível
 * apenas ajustar o valor abatido na troca (valor_troca) deste pedido.
 */
exports.editar = async (req, res) => {
    const connection = await db.getConnection();
    try {
        await connection.beginTransaction();

        const pedidoId = req.params.id;
        const [pedidoRows] = await connection.query(
            'SELECT * FROM pedidos WHERE id = ? FOR UPDATE', [pedidoId]
        );
        if (pedidoRows.length === 0) {
            await connection.rollback();
            return res.status(404).json({ erro: 'Pedido não encontrado' });
        }
        if (pedidoRows[0].status === 'cancelado') {
            await connection.rollback();
            return res.status(400).json({ erro: 'Pedido cancelado não pode ser editado' });
        }

        const { cliente_id, forma_pagamento, observacoes, itens, valor_troca } = req.body;
        if (!cliente_id || !itens || itens.length === 0) {
            await connection.rollback();
            return res.status(400).json({ erro: 'Cliente e ao menos um item vendido são obrigatórios' });
        }

        // 1. Devolve ao estoque a quantidade dos itens que estavam no pedido
        const [itensAtuais] = await connection.query(
            'SELECT produto_id, quantidade FROM pedido_itens WHERE pedido_id = ?', [pedidoId]
        );
        for (const item of itensAtuais) {
            await connection.query(
                'UPDATE produtos SET quantidade = quantidade + ? WHERE id = ?',
                [item.quantidade, item.produto_id]
            );
        }
        await connection.query('DELETE FROM pedido_itens WHERE pedido_id = ?', [pedidoId]);

        // 2. Aplica os itens novos, validando estoque disponível
        let valorTotal = 0;
        for (const item of itens) {
            const [produtoRows] = await connection.query(
                'SELECT quantidade FROM produtos WHERE id = ? FOR UPDATE', [item.produto_id]
            );
            if (produtoRows.length === 0) {
                throw new Error(`Produto id ${item.produto_id} não encontrado`);
            }
            if (produtoRows[0].quantidade < item.quantidade) {
                throw new Error(`Estoque insuficiente para o produto id ${item.produto_id}`);
            }

            await connection.query(
                'INSERT INTO pedido_itens (pedido_id, produto_id, quantidade, preco_unitario) VALUES (?, ?, ?, ?)',
                [pedidoId, item.produto_id, item.quantidade, item.preco_unitario]
            );
            await connection.query(
                'UPDATE produtos SET quantidade = quantidade - ? WHERE id = ?',
                [item.quantidade, item.produto_id]
            );

            valorTotal += item.quantidade * item.preco_unitario;
        }

        const valorTrocaFinal = Number(valor_troca || 0);
        const valorAPagar = valorTotal - valorTrocaFinal;

        await connection.query(
            `UPDATE pedidos SET cliente_id=?, forma_pagamento=?, observacoes=?, valor_total=?, valor_troca=?, valor_a_pagar=?
             WHERE id=?`,
            [cliente_id, forma_pagamento || null, observacoes || null, valorTotal, valorTrocaFinal, valorAPagar, pedidoId]
        );

        await connection.commit();
        res.json({
            mensagem: 'Pedido atualizado com sucesso',
            valor_total: valorTotal,
            valor_troca: valorTrocaFinal,
            valor_a_pagar: valorAPagar
        });
    } catch (err) {
        await connection.rollback();
        res.status(500).json({ erro: 'Erro ao editar pedido', detalhe: err.message });
    } finally {
        connection.release();
    }
};

// Cancelar pedido - estorna ao estoque os itens vendidos.
// O aparelho recebido em troca (se houver) NÃO é removido automaticamente do
// estoque, pois ele já pode ter sido movimentado separadamente; confira manualmente.
exports.cancelar = async (req, res) => {
    const connection = await db.getConnection();
    try {
        await connection.beginTransaction();

        const pedidoId = req.params.id;
        const [pedidoRows] = await connection.query(
            'SELECT status FROM pedidos WHERE id = ? FOR UPDATE', [pedidoId]
        );
        if (pedidoRows.length === 0) {
            await connection.rollback();
            return res.status(404).json({ erro: 'Pedido não encontrado' });
        }
        if (pedidoRows[0].status === 'cancelado') {
            await connection.rollback();
            return res.status(400).json({ erro: 'Pedido já está cancelado' });
        }

        const [itens] = await connection.query(
            'SELECT produto_id, quantidade FROM pedido_itens WHERE pedido_id = ?', [pedidoId]
        );
        for (const item of itens) {
            await connection.query(
                'UPDATE produtos SET quantidade = quantidade + ? WHERE id = ?',
                [item.quantidade, item.produto_id]
            );
            await connection.query(
                `INSERT INTO estoque_movimentos (produto_id, tipo, quantidade, referencia, usuario_id)
                 VALUES (?, 'estorno_venda', ?, ?, ?)`,
                [item.produto_id, item.quantidade, `Cancelamento do Pedido #${pedidoId}`, req.user?.id || null]
            );
        }

        await connection.query('UPDATE pedidos SET status = "cancelado" WHERE id = ?', [pedidoId]);
        await connection.commit();

        res.json({
            mensagem: 'Pedido cancelado. Os itens vendidos foram devolvidos ao estoque. Se houve troca, confira manualmente o aparelho recebido no estoque.'
        });
    } catch (err) {
        await connection.rollback();
        res.status(500).json({ erro: 'Erro ao cancelar pedido', detalhe: err.message });
    } finally {
        connection.release();
    }
};

// Dados para o dashboard
exports.dashboard = async (req, res) => {
    try {
        const [[totalProdutos]] = await db.query('SELECT COUNT(*) AS total, SUM(quantidade) AS total_unidades FROM produtos WHERE ativo = TRUE');
        const [[totalPedidosHoje]] = await db.query(`SELECT COUNT(*) AS total, COALESCE(SUM(valor_total),0) AS faturamento FROM pedidos WHERE DATE(criado_em) = CURDATE() AND status != 'cancelado'`);
        const [[totalClientes]] = await db.query('SELECT COUNT(*) AS total FROM clientes');
        const [estoqueBaixo] = await db.query('SELECT * FROM produtos WHERE ativo = TRUE AND quantidade <= estoque_minimo ORDER BY quantidade ASC LIMIT 5');
        const [ultimosPedidos] = await db.query(`
            SELECT p.id, p.valor_total, p.criado_em, c.nome AS cliente_nome
            FROM pedidos p JOIN clientes c ON c.id = p.cliente_id
            ORDER BY p.criado_em DESC LIMIT 5
        `);
        const [[comprasAPagar]] = await db.query(
            `SELECT COALESCE(SUM(valor_total - valor_pago), 0) AS total
             FROM compras WHERE status = 'ativa' AND status_pagamento != 'pago'`
        );

        res.json({
            totalProdutos: totalProdutos.total || 0,
            totalUnidadesEstoque: totalProdutos.total_unidades || 0,
            pedidosHoje: totalPedidosHoje.total || 0,
            faturamentoHoje: totalPedidosHoje.faturamento || 0,
            totalClientes: totalClientes.total || 0,
            estoqueBaixo,
            ultimosPedidos,
            comprasAPagar: comprasAPagar.total || 0
        });
    } catch (err) {
        res.status(500).json({ erro: 'Erro ao carregar dashboard', detalhe: err.message });
    }
};
