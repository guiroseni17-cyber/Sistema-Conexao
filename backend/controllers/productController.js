const db = require('../config/db');

// Listar todos os produtos (com filtro opcional por busca/categoria)
exports.listar = async (req, res) => {
    try {
        const { busca, categoria } = req.query;
        let sql = `
            SELECT p.*, pt.pedido_id AS troca_pedido_id, c.nome AS troca_cliente_nome
            FROM produtos p
            LEFT JOIN pedido_trocas pt ON pt.produto_id = p.id
            LEFT JOIN pedidos ped ON ped.id = pt.pedido_id
            LEFT JOIN clientes c ON c.id = ped.cliente_id
            WHERE p.ativo = TRUE
        `;
        const params = [];

        if (busca) {
            sql += ' AND (p.nome LIKE ? OR p.modelo LIKE ? OR p.imei LIKE ?)';
            params.push(`%${busca}%`, `%${busca}%`, `%${busca}%`);
        }
        if (categoria) {
            sql += ' AND p.categoria = ?';
            params.push(categoria);
        }
        sql += ' ORDER BY (p.quantidade > 0) DESC, p.criado_em DESC';

        const [rows] = await db.query(sql, params);
        res.json(rows);
    } catch (err) {
        res.status(500).json({ erro: 'Erro ao listar produtos', detalhe: err.message });
    }
};

// Buscar um produto por id
exports.buscarPorId = async (req, res) => {
    try {
        const [rows] = await db.query('SELECT * FROM produtos WHERE id = ?', [req.params.id]);
        if (rows.length === 0) return res.status(404).json({ erro: 'Produto não encontrado' });
        res.json(rows[0]);
    } catch (err) {
        res.status(500).json({ erro: 'Erro ao buscar produto', detalhe: err.message });
    }
};

// Criar produto manualmente (compra normal, não troca)
exports.criar = async (req, res) => {
    try {
        const {
            nome, categoria, marca, modelo, imei, condicao,
            quantidade, estoque_minimo, preco_custo, preco_venda, observacoes
        } = req.body;

        if (!nome || preco_venda === undefined) {
            return res.status(400).json({ erro: 'Nome e preço de venda são obrigatórios' });
        }

        if (imei) {
            const [dup] = await db.query(
                'SELECT id FROM produtos WHERE imei = ? AND ativo = TRUE', [imei]
            );
            if (dup.length > 0) {
                return res.status(400).json({ erro: 'Já existe um produto ativo cadastrado com esse IMEI' });
            }
        }

        const [result] = await db.query(
            `INSERT INTO produtos (nome, categoria, marca, modelo, imei, condicao, quantidade, estoque_minimo, preco_custo, preco_venda, origem, observacoes)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'compra', ?)`,
            [nome, categoria || 'aparelho_novo', marca, modelo, imei, condicao || 'novo',
             quantidade || 0, estoque_minimo ?? 2, preco_custo || 0, preco_venda, observacoes]
        );

        if (Number(quantidade) > 0) {
            await db.query(
                `INSERT INTO estoque_movimentos (produto_id, tipo, quantidade, referencia, usuario_id)
                 VALUES (?, 'ajuste_manual', ?, 'Cadastro manual do produto', ?)`,
                [result.insertId, Number(quantidade), req.user?.id || null]
            );
        }

        res.status(201).json({ id: result.insertId, mensagem: 'Produto cadastrado com sucesso' });
    } catch (err) {
        res.status(500).json({ erro: 'Erro ao cadastrar produto', detalhe: err.message });
    }
};

/**
 * Cadastro em lote de variações (ex: iPhone 17 Pro Max 256GB Laranja, ...).
 *
 * Corpo esperado:
 * {
 *   nomes: ["iPhone 17 Pro Max 256GB Laranja", "iPhone 17 Pro Max 256GB Azul"],
 *   categoria: "aparelho_novo", condicao: "novo", marca: "Apple",
 *   modelo: "iPhone 17 Pro Max",   // produto pai
 *   preco_venda: 0                 // opcional, vale para todos
 * }
 *
 * Os produtos entram com estoque 0 (a quantidade chega pelas Compras) e
 * estoque mínimo 0 (sem alerta). Nomes que já existem são ignorados.
 */
exports.criarLote = async (req, res) => {
    const connection = await db.getConnection();
    try {
        const { nomes, categoria, condicao, marca, modelo, preco_venda } = req.body;

        if (!Array.isArray(nomes) || nomes.length === 0) {
            return res.status(400).json({ erro: 'Selecione ao menos uma variação para cadastrar' });
        }
        if (nomes.length > 500) {
            return res.status(400).json({ erro: 'Máximo de 500 variações por vez' });
        }

        const categoriasOk = ['aparelho_novo', 'aparelho_seminovo', 'acessorio', 'peca'];
        const condicoesOk = ['novo', 'seminovo_excelente', 'seminovo_bom', 'seminovo_regular'];
        const cat = categoriasOk.includes(categoria) ? categoria : 'aparelho_novo';
        const cond = condicoesOk.includes(condicao) ? condicao : 'novo';
        const preco = Number(preco_venda) > 0 ? Number(preco_venda) : 0;

        // Limpa e remove nomes repetidos dentro do próprio pedido
        const vistos = new Set();
        const limpos = [];
        for (const n of nomes) {
            const nome = String(n || '').trim();
            if (!nome || nome.length > 150) continue;
            const chave = nome.toLowerCase();
            if (vistos.has(chave)) continue;
            vistos.add(chave);
            limpos.push(nome);
        }
        if (limpos.length === 0) {
            return res.status(400).json({ erro: 'Nenhum nome de variação válido foi enviado' });
        }

        await connection.beginTransaction();

        const [existentes] = await connection.query('SELECT nome FROM produtos WHERE ativo = TRUE');
        const jaExiste = new Set(existentes.map(r => String(r.nome).trim().toLowerCase()));

        const novos = limpos.filter(n => !jaExiste.has(n.toLowerCase()));
        const ignorados = limpos.filter(n => jaExiste.has(n.toLowerCase()));

        if (novos.length > 0) {
            const linhas = novos.map(nome => [
                nome, cat, marca || null, modelo || null, cond, 0, 0, 0, preco, 'compra'
            ]);
            await connection.query(
                `INSERT INTO produtos
                    (nome, categoria, marca, modelo, condicao, quantidade, estoque_minimo, preco_custo, preco_venda, origem)
                 VALUES ?`,
                [linhas]
            );
        }

        await connection.commit();
        res.status(201).json({
            criados: novos.length,
            ignorados,
            mensagem: `${novos.length} produto(s) cadastrado(s)` + (ignorados.length ? `, ${ignorados.length} já existiam` : '')
        });
    } catch (err) {
        await connection.rollback();
        res.status(500).json({ erro: 'Erro ao cadastrar variações', detalhe: err.message });
    } finally {
        connection.release();
    }
};

// Editar produto
exports.editar = async (req, res) => {
    try {
        const {
            nome, categoria, marca, modelo, imei, condicao,
            quantidade, estoque_minimo, preco_custo, preco_venda, observacoes
        } = req.body;

        if (imei) {
            const [dup] = await db.query(
                'SELECT id FROM produtos WHERE imei = ? AND ativo = TRUE AND id != ?', [imei, req.params.id]
            );
            if (dup.length > 0) {
                return res.status(400).json({ erro: 'Já existe outro produto ativo cadastrado com esse IMEI' });
            }
        }

        const [atual] = await db.query('SELECT quantidade FROM produtos WHERE id = ?', [req.params.id]);
        if (atual.length === 0) return res.status(404).json({ erro: 'Produto não encontrado' });
        const diferenca = Number(quantidade) - Number(atual[0].quantidade);

        await db.query(
            `UPDATE produtos SET nome=?, categoria=?, marca=?, modelo=?, imei=?, condicao=?,
             quantidade=?, estoque_minimo=?, preco_custo=?, preco_venda=?, observacoes=? WHERE id=?`,
            [nome, categoria, marca, modelo, imei, condicao, quantidade, estoque_minimo ?? 2,
             preco_custo, preco_venda, observacoes, req.params.id]
        );

        // Se a quantidade mudou na edição manual, registra no histórico
        // para não perder o rastro de por que o estoque mudou.
        if (diferenca !== 0) {
            await db.query(
                `INSERT INTO estoque_movimentos (produto_id, tipo, quantidade, referencia, usuario_id)
                 VALUES (?, 'ajuste_manual', ?, 'Ajuste manual via edição do produto', ?)`,
                [req.params.id, diferenca, req.user?.id || null]
            );
        }

        res.json({ mensagem: 'Produto atualizado com sucesso' });
    } catch (err) {
        res.status(500).json({ erro: 'Erro ao atualizar produto', detalhe: err.message });
    }
};

// Inativar produto (exclusão lógica, mantém histórico de pedidos)
exports.remover = async (req, res) => {
    try {
        await db.query('UPDATE produtos SET ativo = FALSE WHERE id = ?', [req.params.id]);
        res.json({ mensagem: 'Produto removido do estoque' });
    } catch (err) {
        res.status(500).json({ erro: 'Erro ao remover produto', detalhe: err.message });
    }
};

// Histórico de todas as entradas/saídas deste produto (compra, venda, troca, ajuste)
exports.historico = async (req, res) => {
    try {
        const [rows] = await db.query(`
            SELECT em.*, u.nome AS usuario_nome
            FROM estoque_movimentos em
            LEFT JOIN usuarios u ON u.id = em.usuario_id
            WHERE em.produto_id = ?
            ORDER BY em.criado_em DESC
        `, [req.params.id]);
        res.json(rows);
    } catch (err) {
        res.status(500).json({ erro: 'Erro ao buscar histórico', detalhe: err.message });
    }
};
