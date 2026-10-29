const db = require('../config/db');

// Monta um texto curto tipo "Pix + Cartão de crédito 3x" a partir da lista
// de formas de pagamento, só para exibição rápida nas listagens/relatórios.
function resumoFormasPagamento(pagamentos) {
    if (!pagamentos || pagamentos.length === 0) return null;
    return pagamentos
        .map(p => (p.parcelas && p.parcelas > 1) ? `${p.forma_pagamento} ${p.parcelas}x` : p.forma_pagamento)
        .join(' + ');
}

// Erro de regra de negócio (devolve 400 com a mensagem para a tela mostrar)
function erroNegocio(mensagem) {
    const e = new Error(mensagem);
    e.statusCode = 400;
    return e;
}

function responderErro(res, err, mensagemPadrao) {
    if (err.statusCode) return res.status(err.statusCode).json({ erro: err.message });
    return res.status(500).json({ erro: mensagemPadrao, detalhe: err.message });
}

// Quanto o aparelho da troca abate do pedido: preço de compra - desconto.
// (se vier só valor_abatido, como nas versões antigas da tela, usa ele)
function calcularValorTroca(troca) {
    if (!troca || !troca.nome) return 0;
    if (troca.preco_compra !== undefined && troca.preco_compra !== null && troca.preco_compra !== '') {
        return Math.max(0, Number(troca.preco_compra) - Number(troca.desconto || 0));
    }
    return Number(troca.valor_abatido || 0);
}

// Cadastra o aparelho recebido na troca no estoque e vincula ao pedido.
async function registrarTroca(connection, pedidoId, troca, usuarioId) {
    const valorAbatido = calcularValorTroca(troca);
    const precoCompra = (troca.preco_compra !== undefined && troca.preco_compra !== null && troca.preco_compra !== '')
        ? Number(troca.preco_compra) : null;

    if (troca.imei) {
        const [dup] = await connection.query(
            'SELECT id FROM produtos WHERE imei = ? AND ativo = TRUE AND quantidade > 0', [troca.imei]
        );
        if (dup.length > 0) {
            throw erroNegocio(`Já existe um aparelho em estoque com o IMEI ${troca.imei}`);
        }
    }

    // Aparelho escolhido a partir de um PRODUTO PAI: guarda o vínculo com a variação do catálogo
    let modeloBaseId = null;
    if (troca.modelo_base_id) {
        const [bases] = await connection.query(
            'SELECT id FROM modelos_base WHERE id = ? AND ativo = TRUE', [troca.modelo_base_id]
        );
        if (bases.length > 0) modeloBaseId = bases[0].id;
    }

    const [produtoTrocaResult] = await connection.query(
        `INSERT INTO produtos
            (nome, categoria, marca, modelo, imei, imei2, numero_serie, bateria, garantia, condicao,
             quantidade, preco_custo, preco_venda, preco_venda_atacado, origem, observacoes, modelo_base_id)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?, 'troca', ?, ?)`,
        [
            troca.nome,
            troca.categoria || 'aparelho_seminovo',
            troca.marca || null,
            troca.modelo || null,
            troca.imei || null,
            troca.imei2 || null,
            troca.numero_serie || null,
            (troca.bateria === undefined || troca.bateria === null || troca.bateria === '') ? null : Number(troca.bateria),
            troca.garantia || null,
            troca.condicao || 'seminovo_bom',
            valorAbatido,
            troca.preco_venda_sugerido || 0,
            troca.preco_venda_atacado || null,
            troca.observacoes || null,
            modeloBaseId
        ]
    );

    await connection.query(
        'INSERT INTO pedido_trocas (pedido_id, produto_id, valor_abatido, preco_compra, desconto) VALUES (?, ?, ?, ?, ?)',
        [pedidoId, produtoTrocaResult.insertId, valorAbatido, precoCompra, Number(troca.desconto || 0)]
    );

    await connection.query(
        `INSERT INTO estoque_movimentos (produto_id, tipo, quantidade, referencia, usuario_id)
         VALUES (?, 'entrada_troca', 1, ?, ?)`,
        [produtoTrocaResult.insertId, `Troca no Pedido #${pedidoId}`, usuarioId || null]
    );

    return valorAbatido;
}

// Próximo número de pedido (o mesmo id que o pedido vai receber ao ser salvo)
exports.proximoNumero = async (req, res) => {
    const connection = await db.getConnection();
    try {
        let proximo = null;
        try {
            // No MySQL 8 essa informação fica em cache; zerar o cache deixa o número exato
            await connection.query('SET SESSION information_schema_stats_expiry = 0');
            const [rows] = await connection.query(
                `SELECT AUTO_INCREMENT AS proximo FROM information_schema.TABLES
                 WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'pedidos'`
            );
            proximo = rows[0] && rows[0].proximo;
        } catch (e) {
            proximo = null;
        }
        if (!proximo) {
            const [[r]] = await connection.query('SELECT COALESCE(MAX(id), 0) + 1 AS proximo FROM pedidos');
            proximo = r.proximo;
        }
        res.json({ proximo: Number(proximo) });
    } catch (err) {
        res.status(500).json({ erro: 'Erro ao buscar próximo número', detalhe: err.message });
    } finally {
        connection.release();
    }
};

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
            SELECT p.*, c.nome AS cliente_nome, c.telefone AS cliente_telefone,
                   c.cpf_cnpj AS cliente_cpf_cnpj, c.email AS cliente_email,
                   c.endereco AS cliente_endereco, c.celular AS cliente_celular,
                   c.numero AS cliente_numero, c.complemento AS cliente_complemento, c.bairro AS cliente_bairro,
                   c.cidade AS cliente_cidade, c.estado AS cliente_estado,
                   c.cep AS cliente_cep, u.nome AS vendedor_nome
            FROM pedidos p
            JOIN clientes c ON c.id = p.cliente_id
            LEFT JOIN usuarios u ON u.id = p.usuario_id
            WHERE p.id = ?
        `, [pedidoId]);

        if (pedido.length === 0) return res.status(404).json({ erro: 'Pedido não encontrado' });

        const [itens] = await db.query(`
            SELECT pi.*, pr.nome AS produto_nome, pr.modelo, pr.imei
            FROM pedido_itens pi JOIN produtos pr ON pr.id = pi.produto_id
            WHERE pi.pedido_id = ?
        `, [pedidoId]);

        const [trocas] = await db.query(`
            SELECT pt.*, pr.nome AS produto_nome, pr.modelo, pr.marca, pr.categoria, pr.condicao, pr.imei, pr.imei2,
                   pr.numero_serie, pr.bateria, pr.garantia, pr.preco_venda, pr.preco_venda_atacado, pr.observacoes
            FROM pedido_trocas pt JOIN produtos pr ON pr.id = pt.produto_id
            WHERE pt.pedido_id = ?
        `, [pedidoId]);

        const [pagamentos] = await db.query(
            'SELECT * FROM pedido_pagamentos WHERE pedido_id = ? ORDER BY id ASC', [pedidoId]
        );

        res.json({ ...pedido[0], itens, trocas, pagamentos });
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
 *   pagamentos: [
 *     { forma_pagamento: "Pix", valor: 700, parcelas: 1 },
 *     { forma_pagamento: "Cartão de crédito", valor: 800, parcelas: 3 }
 *   ],
 *   itens: [ { produto_id: 5, quantidade: 1, preco_unitario: 1500 } ],
 *   troca: {
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
 */
exports.criar = async (req, res) => {
    const connection = await db.getConnection();
    try {
        await connection.beginTransaction();

        const { cliente_id, pagamentos, itens, troca, trocas, observacoes, data_pedido, agendado, vendedor_id } = req.body;

        if (!cliente_id || !itens || itens.length === 0) {
            await connection.rollback();
            return res.status(400).json({ erro: 'Cliente e ao menos um item vendido são obrigatórios' });
        }

        let valorTotal = 0;
        for (const item of itens) {
            valorTotal += item.quantidade * item.preco_unitario;
        }

        // Aceita vários aparelhos na troca ("trocas") ou um só ("troca", formato antigo)
        const listaTrocas = (Array.isArray(trocas) ? trocas : [troca]).filter(t => t && t.nome);
        const valorTroca = listaTrocas.reduce((soma, t) => soma + calcularValorTroca(t), 0);
        const valorAPagar = valorTotal - valorTroca;
        const formaPagamentoResumo = resumoFormasPagamento(pagamentos);

        const [pedidoResult] = await connection.query(
            `INSERT INTO pedidos (cliente_id, usuario_id, status, forma_pagamento, valor_total, valor_troca, valor_a_pagar, observacoes${data_pedido ? ', criado_em' : ''})
             VALUES (?, ?, ?, ?, ?, ?, ?, ?${data_pedido ? ', ?' : ''})`,
            data_pedido
                ? [cliente_id, Number(vendedor_id) || req.user?.id || null, agendado ? 'aberto' : 'finalizado', formaPagamentoResumo, valorTotal, valorTroca, valorAPagar, observacoes || null, data_pedido]
                : [cliente_id, Number(vendedor_id) || req.user?.id || null, 'finalizado', formaPagamentoResumo, valorTotal, valorTroca, valorAPagar, observacoes || null]
        );
        const pedidoId = pedidoResult.insertId;

        if (pagamentos && pagamentos.length > 0) {
            for (const p of pagamentos) {
                await connection.query(
                    'INSERT INTO pedido_pagamentos (pedido_id, forma_pagamento, parcelas, valor, observacao) VALUES (?, ?, ?, ?, ?)',
                    [pedidoId, p.forma_pagamento, p.parcelas || 1, p.valor || 0, String(p.observacao || '').trim().slice(0, 255) || null]
                );
            }
        }

        for (const item of itens) {
            const [produtoRows] = await connection.query(
                'SELECT quantidade FROM produtos WHERE id = ? FOR UPDATE',
                [item.produto_id]
            );
            if (produtoRows.length === 0) {
                throw erroNegocio(`Produto id ${item.produto_id} não encontrado`);
            }
            if (produtoRows[0].quantidade < item.quantidade) {
                throw erroNegocio(`Estoque insuficiente para o produto id ${item.produto_id}`);
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

        for (const t of listaTrocas) {
            await registrarTroca(connection, pedidoId, t, req.user?.id);
        }

        await connection.commit();
        res.status(201).json({
            id: pedidoId,
            valor_total: valorTotal,
            valor_troca: valorTroca,
            valor_a_pagar: valorAPagar,
            mensagem: (agendado ? 'Pedido agendado com sucesso. ' : 'Pedido criado com sucesso. ') +
                (listaTrocas.length === 1 ? 'Aparelho recebido em troca já cadastrado no estoque.'
                    : listaTrocas.length > 1 ? 'Aparelhos recebidos em troca já cadastrados no estoque.' : '')
        });

    } catch (err) {
        await connection.rollback();
        responderErro(res, err, 'Erro ao criar pedido');
    } finally {
        connection.release();
    }
};

/**
 * Editar pedido (cliente, formas de pagamento, observações e itens vendidos).
 * Reverte o estoque dos itens antigos e aplica o estoque dos itens novos,
 * tudo dentro de uma transação para não deixar o estoque inconsistente.
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

        const { cliente_id, pagamentos, observacoes, itens, valor_troca, vendedor_id } = req.body;
        if (!cliente_id || !itens || itens.length === 0) {
            await connection.rollback();
            return res.status(400).json({ erro: 'Cliente e ao menos um item vendido são obrigatórios' });
        }

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

        let valorTotal = 0;
        for (const item of itens) {
            const [produtoRows] = await connection.query(
                'SELECT quantidade FROM produtos WHERE id = ? FOR UPDATE', [item.produto_id]
            );
            if (produtoRows.length === 0) {
                throw erroNegocio(`Produto id ${item.produto_id} não encontrado`);
            }
            if (produtoRows[0].quantidade < item.quantidade) {
                throw erroNegocio(`Estoque insuficiente para o produto id ${item.produto_id}`);
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

        // Histórico de estoque: registra só a diferença líquida por produto
        // (positivo = passou a vender mais, negativo = devolveu ao estoque)
        const saldo = {};
        itensAtuais.forEach(i => {
            saldo[i.produto_id] = (saldo[i.produto_id] || 0) - Number(i.quantidade);
        });
        itens.forEach(i => {
            saldo[i.produto_id] = (saldo[i.produto_id] || 0) + Number(i.quantidade);
        });
        for (const [produtoId, diff] of Object.entries(saldo)) {
            if (diff === 0) continue;
            await connection.query(
                `INSERT INTO estoque_movimentos (produto_id, tipo, quantidade, referencia, usuario_id)
                 VALUES (?, ?, ?, ?, ?)`,
                [
                    produtoId,
                    diff > 0 ? 'saida_venda' : 'estorno_venda',
                    -diff,
                    `Edição do Pedido #${pedidoId}`,
                    req.user?.id || null
                ]
            );
        }

        let valorTrocaFinal = Number(valor_troca || 0);

        // Aparelhos de upgrade adicionados durante a edição (somam aos que já estavam no pedido)
        const { troca, trocas } = req.body;
        const novasTrocas = (Array.isArray(trocas) ? trocas : [troca]).filter(t => t && t.nome);
        for (const t of novasTrocas) {
            valorTrocaFinal += await registrarTroca(connection, pedidoId, t, req.user?.id);
        }
        const valorAPagar = valorTotal - valorTrocaFinal;
        const formaPagamentoResumo = resumoFormasPagamento(pagamentos);

        await connection.query(
            `UPDATE pedidos SET cliente_id=?, usuario_id=COALESCE(?, usuario_id), forma_pagamento=?, observacoes=?, valor_total=?, valor_troca=?, valor_a_pagar=?
             WHERE id=?`,
            [cliente_id, Number(vendedor_id) || null, formaPagamentoResumo, observacoes || null, valorTotal, valorTrocaFinal, valorAPagar, pedidoId]
        );

        await connection.query('DELETE FROM pedido_pagamentos WHERE pedido_id = ?', [pedidoId]);
        if (pagamentos && pagamentos.length > 0) {
            for (const p of pagamentos) {
                await connection.query(
                    'INSERT INTO pedido_pagamentos (pedido_id, forma_pagamento, parcelas, valor, observacao) VALUES (?, ?, ?, ?, ?)',
                    [pedidoId, p.forma_pagamento, p.parcelas || 1, p.valor || 0, String(p.observacao || '').trim().slice(0, 255) || null]
                );
            }
        }

        await connection.commit();
        res.json({
            mensagem: 'Pedido atualizado com sucesso',
            valor_total: valorTotal,
            valor_troca: valorTrocaFinal,
            valor_a_pagar: valorAPagar
        });
    } catch (err) {
        await connection.rollback();
        responderErro(res, err, 'Erro ao editar pedido');
    } finally {
        connection.release();
    }
};

// Cancelar pedido - estorna ao estoque os itens vendidos.
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
        const [estoqueBaixo] = await db.query(`SELECT * FROM produtos WHERE ativo = TRUE AND categoria = 'acessorio' AND estoque_minimo > 0 AND quantidade <= estoque_minimo ORDER BY quantidade ASC LIMIT 5`);
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
