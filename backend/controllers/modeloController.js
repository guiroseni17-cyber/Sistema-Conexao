const db = require('../config/db');

/**
 * Modelos base = catálogo de variações (ex: "iPhone 17 Pro Max 256GB Laranja").
 * NÃO existem no estoque: não aparecem na lista de produtos nem na venda.
 * O produto real só é criado quando uma Compra dá entrada no modelo
 * informando o valor de custo (veja purchaseController).
 */

exports.listar = async (req, res) => {
    try {
        const { busca } = req.query;
        let sql = 'SELECT * FROM modelos_base WHERE ativo = TRUE';
        const params = [];
        if (busca) {
            sql += ' AND (nome LIKE ? OR modelo LIKE ?)';
            params.push(`%${busca}%`, `%${busca}%`);
        }
        sql += ' ORDER BY nome';
        const [rows] = await db.query(sql, params);
        res.json(rows);
    } catch (err) {
        res.status(500).json({ erro: 'Erro ao listar modelos base', detalhe: err.message });
    }
};

// Cadastro em lote das combinações geradas (produto pai + atributos)
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

        // Já existe se for um modelo base ativo OU um produto ativo no estoque com o mesmo nome
        const [modelosExist] = await connection.query('SELECT nome FROM modelos_base WHERE ativo = TRUE');
        const [produtosExist] = await connection.query('SELECT nome FROM produtos WHERE ativo = TRUE');
        const jaExiste = new Set(
            [...modelosExist, ...produtosExist].map(r => String(r.nome).trim().toLowerCase())
        );

        const novos = limpos.filter(n => !jaExiste.has(n.toLowerCase()));
        const ignorados = limpos.filter(n => jaExiste.has(n.toLowerCase()));

        if (novos.length > 0) {
            const linhas = novos.map(nome => [nome, cat, cond, marca || null, modelo || null, preco]);
            await connection.query(
                'INSERT INTO modelos_base (nome, categoria, condicao, marca, modelo, preco_venda) VALUES ?',
                [linhas]
            );
        }

        await connection.commit();
        res.status(201).json({
            criados: novos.length,
            ignorados,
            mensagem: `${novos.length} modelo(s) base cadastrado(s)` +
                (ignorados.length ? `, ${ignorados.length} já existiam` : '') +
                '. Eles só entram no estoque quando você lançar uma compra com o custo.'
        });
    } catch (err) {
        await connection.rollback();
        res.status(500).json({ erro: 'Erro ao cadastrar modelos base', detalhe: err.message });
    } finally {
        connection.release();
    }
};

// Remove o modelo do catálogo (não mexe em produtos que já nasceram dele)
exports.remover = async (req, res) => {
    try {
        await db.query('UPDATE modelos_base SET ativo = FALSE WHERE id = ?', [req.params.id]);
        res.json({ mensagem: 'Modelo base removido' });
    } catch (err) {
        res.status(500).json({ erro: 'Erro ao remover modelo base', detalhe: err.message });
    }
};
