const db = require('../config/db');

function periodo(req, res) {
    const { inicio, fim } = req.query;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(inicio || '') || !/^\d{4}-\d{2}-\d{2}$/.test(fim || '')) {
        res.status(400).json({ erro: 'Informe data de início e fim (inicio=AAAA-MM-DD&fim=AAAA-MM-DD)' });
        return null;
    }
    return { inicio, fim };
}

function numero(v) {
    const n = Number(String(v ?? '').replace(',', '.'));
    return Number.isFinite(n) ? n : NaN;
}

/**
 * Lucro real do período:
 *   receita das vendas (já com frete e desconto)
 *   - custo das mercadorias vendidas
 *   - taxas de pagamento (valor da venda - valor que realmente caiu, só das vendas conciliadas)
 *   - despesas lançadas
 *   + outras entradas lançadas
 */
exports.resumo = async (req, res) => {
    try {
        const p = periodo(req, res);
        if (!p) return;

        const [[vendas]] = await db.query(`
            SELECT COUNT(*) AS total_pedidos, COALESCE(SUM(valor_total), 0) AS receita
            FROM pedidos
            WHERE status != 'cancelado' AND DATE(criado_em) BETWEEN ? AND ?
        `, [p.inicio, p.fim]);

        const [[custo]] = await db.query(`
            SELECT COALESCE(SUM(pr.preco_custo * pi.quantidade), 0) AS cmv
            FROM pedido_itens pi
            JOIN pedidos pd ON pd.id = pi.pedido_id
            JOIN produtos pr ON pr.id = pi.produto_id
            WHERE pd.status != 'cancelado' AND DATE(pd.criado_em) BETWEEN ? AND ?
        `, [p.inicio, p.fim]);

        const [[pag]] = await db.query(`
            SELECT
                COALESCE(SUM(CASE WHEN pp.conciliado THEN pp.valor - pp.valor_recebido ELSE 0 END), 0) AS taxas,
                COALESCE(SUM(CASE WHEN pp.conciliado THEN pp.valor ELSE 0 END), 0) AS valor_conciliado,
                COALESCE(SUM(CASE WHEN pp.conciliado THEN pp.valor_recebido ELSE 0 END), 0) AS valor_recebido,
                COALESCE(SUM(CASE WHEN pp.conciliado THEN 0 ELSE 1 END), 0) AS qtd_pendentes,
                COALESCE(SUM(CASE WHEN pp.conciliado THEN 0 ELSE pp.valor END), 0) AS valor_pendente
            FROM pedido_pagamentos pp
            JOIN pedidos pd ON pd.id = pp.pedido_id
            WHERE pd.status != 'cancelado' AND DATE(pd.criado_em) BETWEEN ? AND ?
        `, [p.inicio, p.fim]);

        const [[lanc]] = await db.query(`
            SELECT
                COALESCE(SUM(CASE WHEN tipo = 'despesa' THEN valor ELSE 0 END), 0) AS despesas,
                COALESCE(SUM(CASE WHEN tipo = 'receita' THEN valor ELSE 0 END), 0) AS outras_entradas,
                COALESCE(SUM(CASE WHEN conciliado THEN 0 ELSE 1 END), 0) AS lancamentos_pendentes
            FROM lancamentos WHERE data BETWEEN ? AND ?
        `, [p.inicio, p.fim]);

        const receita = Number(vendas.receita);
        const cmv = Number(custo.cmv);
        const taxas = Number(pag.taxas);
        const despesas = Number(lanc.despesas);
        const outras = Number(lanc.outras_entradas);
        const lucroBruto = receita - cmv;

        res.json({
            periodo: p,
            total_pedidos: vendas.total_pedidos,
            receita,
            cmv,
            lucro_bruto: lucroBruto,
            taxas,
            despesas,
            outras_entradas: outras,
            lucro_real: lucroBruto - taxas - despesas + outras,
            margem_real: receita > 0 ? ((lucroBruto - taxas - despesas + outras) / receita) * 100 : 0,
            conciliacao: {
                qtd_pendentes: Number(pag.qtd_pendentes),
                valor_pendente: Number(pag.valor_pendente),
                valor_conciliado: Number(pag.valor_conciliado),
                valor_recebido: Number(pag.valor_recebido),
                lancamentos_pendentes: Number(lanc.lancamentos_pendentes)
            }
        });
    } catch (err) {
        res.status(500).json({ erro: 'Erro ao calcular o lucro real', detalhe: err.message });
    }
};

// ---------- Conciliação dos pagamentos das vendas ----------

exports.listarPagamentos = async (req, res) => {
    try {
        const p = periodo(req, res);
        if (!p) return;
        const status = req.query.status; // pendentes | conciliados | (vazio = todos)

        let filtro = '';
        // O filtro vale para a venda inteira: o pedido traz todas as suas formas de pagamento
        const pendenteNoPedido = '(SELECT 1 FROM pedido_pagamentos x WHERE x.pedido_id = pd.id AND x.conciliado = FALSE)';
        if (status === 'pendentes') filtro = `AND EXISTS ${pendenteNoPedido}`;
        if (status === 'conciliados') filtro = `AND NOT EXISTS ${pendenteNoPedido}`;

        const [linhas] = await db.query(`
            SELECT pp.id, pp.pedido_id, pp.forma_pagamento, pp.parcelas, pp.valor, pp.observacao,
                   pp.conciliado, pp.valor_recebido,
                   pd.valor_total, pd.valor_troca,
                   DATE_FORMAT(pd.criado_em, '%Y-%m-%d') AS data,
                   c.nome AS cliente_nome
            FROM pedido_pagamentos pp
            JOIN pedidos pd ON pd.id = pp.pedido_id
            JOIN clientes c ON c.id = pd.cliente_id
            WHERE pd.status != 'cancelado' AND DATE(pd.criado_em) BETWEEN ? AND ? ${filtro}
            ORDER BY pd.criado_em DESC, pp.id DESC
            LIMIT 500
        `, [p.inicio, p.fim]);

        res.json(linhas);
    } catch (err) {
        res.status(500).json({ erro: 'Erro ao listar pagamentos', detalhe: err.message });
    }
};

exports.conciliarPagamento = async (req, res) => {
    try {
        const recebido = numero(req.body.valor_recebido);
        if (!Number.isFinite(recebido) || recebido < 0) {
            return res.status(400).json({ erro: 'Informe o valor que realmente caiu na conta.' });
        }
        const [r] = await db.query(
            'UPDATE pedido_pagamentos SET conciliado = TRUE, valor_recebido = ?, conciliado_em = NOW() WHERE id = ?',
            [recebido, req.params.id]
        );
        if (r.affectedRows === 0) return res.status(404).json({ erro: 'Pagamento não encontrado' });
        res.json({ mensagem: 'Pagamento conciliado' });
    } catch (err) {
        res.status(500).json({ erro: 'Erro ao conciliar pagamento', detalhe: err.message });
    }
};

// Marca vários de uma vez como recebidos sem taxa (valor recebido = valor da venda)
exports.conciliarLote = async (req, res) => {
    try {
        const ids = (Array.isArray(req.body.ids) ? req.body.ids : []).map(Number).filter(Number.isInteger);
        if (ids.length === 0) return res.status(400).json({ erro: 'Nenhum pagamento selecionado.' });
        const [r] = await db.query(
            'UPDATE pedido_pagamentos SET conciliado = TRUE, valor_recebido = valor, conciliado_em = NOW() WHERE conciliado = FALSE AND id IN (?)',
            [ids]
        );
        res.json({ mensagem: 'Pagamentos conciliados', total: r.affectedRows });
    } catch (err) {
        res.status(500).json({ erro: 'Erro ao conciliar pagamentos', detalhe: err.message });
    }
};

exports.desfazerConciliacao = async (req, res) => {
    try {
        const [r] = await db.query(
            'UPDATE pedido_pagamentos SET conciliado = FALSE, valor_recebido = NULL, conciliado_em = NULL WHERE id = ?',
            [req.params.id]
        );
        if (r.affectedRows === 0) return res.status(404).json({ erro: 'Pagamento não encontrado' });
        res.json({ mensagem: 'Conciliação desfeita' });
    } catch (err) {
        res.status(500).json({ erro: 'Erro ao desfazer conciliação', detalhe: err.message });
    }
};

// ---------- Despesas e outras entradas ----------

function lerLancamento(body) {
    const tipo = body.tipo === 'receita' ? 'receita' : 'despesa';
    const descricao = String(body.descricao || '').trim().slice(0, 150);
    const valor = numero(body.valor);
    const data = /^\d{4}-\d{2}-\d{2}$/.test(body.data || '') ? body.data : null;
    if (!descricao) return { erro: 'Informe a descrição.' };
    if (!Number.isFinite(valor) || valor <= 0) return { erro: 'Informe um valor maior que zero.' };
    if (!data) return { erro: 'Informe a data.' };
    return {
        dados: {
            tipo, descricao, valor, data,
            categoria: String(body.categoria || '').trim().slice(0, 60) || null,
            conta: String(body.conta || '').trim().slice(0, 60) || null,
            conciliado: body.conciliado ? 1 : 0
        }
    };
}

exports.listarLancamentos = async (req, res) => {
    try {
        const p = periodo(req, res);
        if (!p) return;
        const [linhas] = await db.query(`
            SELECT id, tipo, descricao, categoria, valor, conta, conciliado,
                   DATE_FORMAT(data, '%Y-%m-%d') AS data
            FROM lancamentos WHERE data BETWEEN ? AND ?
            ORDER BY data DESC, id DESC
        `, [p.inicio, p.fim]);
        res.json(linhas);
    } catch (err) {
        res.status(500).json({ erro: 'Erro ao listar lançamentos', detalhe: err.message });
    }
};

exports.criarLancamento = async (req, res) => {
    try {
        const l = lerLancamento(req.body);
        if (l.erro) return res.status(400).json({ erro: l.erro });
        const d = l.dados;
        const [r] = await db.query(
            'INSERT INTO lancamentos (tipo, descricao, categoria, valor, data, conta, conciliado, usuario_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
            [d.tipo, d.descricao, d.categoria, d.valor, d.data, d.conta, d.conciliado, req.user?.id || null]
        );
        res.status(201).json({ id: r.insertId, mensagem: 'Lançamento salvo' });
    } catch (err) {
        res.status(500).json({ erro: 'Erro ao salvar lançamento', detalhe: err.message });
    }
};

exports.atualizarLancamento = async (req, res) => {
    try {
        // Só marcar/desmarcar conciliado (ex.: bateu com o extrato do banco)
        if (Object.keys(req.body).length === 1 && 'conciliado' in req.body) {
            const [r] = await db.query('UPDATE lancamentos SET conciliado = ? WHERE id = ?', [req.body.conciliado ? 1 : 0, req.params.id]);
            if (r.affectedRows === 0) return res.status(404).json({ erro: 'Lançamento não encontrado' });
            return res.json({ mensagem: 'Lançamento atualizado' });
        }
        const l = lerLancamento(req.body);
        if (l.erro) return res.status(400).json({ erro: l.erro });
        const d = l.dados;
        const [r] = await db.query(
            'UPDATE lancamentos SET tipo=?, descricao=?, categoria=?, valor=?, data=?, conta=?, conciliado=? WHERE id=?',
            [d.tipo, d.descricao, d.categoria, d.valor, d.data, d.conta, d.conciliado, req.params.id]
        );
        if (r.affectedRows === 0) return res.status(404).json({ erro: 'Lançamento não encontrado' });
        res.json({ mensagem: 'Lançamento atualizado' });
    } catch (err) {
        res.status(500).json({ erro: 'Erro ao atualizar lançamento', detalhe: err.message });
    }
};

exports.excluirLancamento = async (req, res) => {
    try {
        const [r] = await db.query('DELETE FROM lancamentos WHERE id = ?', [req.params.id]);
        if (r.affectedRows === 0) return res.status(404).json({ erro: 'Lançamento não encontrado' });
        res.json({ mensagem: 'Lançamento excluído' });
    } catch (err) {
        res.status(500).json({ erro: 'Erro ao excluir lançamento', detalhe: err.message });
    }
};
