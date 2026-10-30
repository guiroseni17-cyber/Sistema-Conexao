const db = require('../config/db');
const { parseAtributos, limparAtributos, montarNome, rotuloDe, renomearVariacao } = require('../utils/variacoes');

/**
 * Produtos pai = o "cabeçalho" do catálogo (ex: "iPhone 17 Pro Max").
 * Cada pai tem N variações (Armazenamento x Cor...), guardadas em modelos_base.
 * Nada aqui é estoque: o produto real só nasce quando uma Compra, uma Troca (upgrade)
 * ou uma Entrada manual dá entrada em uma variação.
 */

const { CATEGORIAS, normalizarCategoria } = require('../utils/categorias');
const CONDICOES = ['novo', 'seminovo_excelente', 'seminovo_bom', 'seminovo_regular'];
const MAX_VARIACOES = 500;

function erroNegocio(msg) {
    const e = new Error(msg);
    e.negocio = true;
    return e;
}

function responderErro(res, err, mensagemPadrao) {
    if (err.negocio) return res.status(400).json({ erro: err.message });
    return res.status(500).json({ erro: mensagemPadrao, detalhe: err.message });
}

function formatarVariacao(v, paiNome) {
    return {
        ...v,
        atributos: parseAtributos(v.atributos),
        rotulo: rotuloDe(v, paiNome),
        estoque: Number(v.estoque || 0)
    };
}

const SQL_ESTOQUE = `(SELECT COALESCE(SUM(p.quantidade), 0) FROM produtos p
                      WHERE p.modelo_base_id = mb.id AND p.ativo = TRUE) AS estoque`;

async function carregarPais(where = '', params = []) {
    const [pais] = await db.query(
        `SELECT pp.* FROM produtos_pai pp WHERE pp.ativo = TRUE ${where} ORDER BY pp.nome`, params
    );
    if (pais.length === 0) return [];

    const [variacoes] = await db.query(
        `SELECT mb.*, ${SQL_ESTOQUE}
         FROM modelos_base mb
         WHERE mb.ativo = TRUE AND mb.produto_pai_id IN (?)
         ORDER BY mb.id`,
        [pais.map(p => p.id)]
    );

    const porPai = new Map(pais.map(p => [p.id, []]));
    variacoes.forEach(v => porPai.get(v.produto_pai_id).push(v));

    return pais.map(p => {
        const lista = porPai.get(p.id).map(v => formatarVariacao(v, p.nome));
        return {
            ...p,
            variacoes: lista,
            total_variacoes: lista.length,
            estoque_total: lista.reduce((s, v) => s + v.estoque, 0)
        };
    });
}

// Insere variações em lote para um pai. Ignora as que já existem nesse pai.
async function inserirVariacoes(connection, pai, variacoes) {
    if (!Array.isArray(variacoes) || variacoes.length === 0) {
        throw erroNegocio('Selecione ao menos uma variação para cadastrar');
    }
    if (variacoes.length > MAX_VARIACOES) {
        throw erroNegocio(`Máximo de ${MAX_VARIACOES} variações por vez`);
    }

    const [existentes] = await connection.query(
        'SELECT nome FROM modelos_base WHERE produto_pai_id = ? AND ativo = TRUE', [pai.id]
    );
    const jaExiste = new Set(existentes.map(r => String(r.nome).trim().toLowerCase()));

    const linhas = [];
    const ignoradas = [];
    for (const v of variacoes) {
        const atributos = limparAtributos(v.atributos);
        if (atributos.length === 0) continue;
        const nome = montarNome(pai.nome, atributos);
        if (nome.length > 150) throw erroNegocio(`Nome muito longo (máx. 150 caracteres): ${nome}`);
        const chave = nome.toLowerCase();
        if (jaExiste.has(chave)) { ignoradas.push(nome); continue; }
        jaExiste.add(chave);
        const preco = Number(v.preco_venda) > 0 ? Number(v.preco_venda) : Number(pai.preco_venda || 0);
        linhas.push([nome, pai.categoria, pai.condicao, pai.marca || null, pai.nome, preco, pai.id, JSON.stringify(atributos)]);
    }

    if (linhas.length > 0) {
        await connection.query(
            `INSERT INTO modelos_base (nome, categoria, condicao, marca, modelo, preco_venda, produto_pai_id, atributos)
             VALUES ?`, [linhas]
        );
    }
    return { criadas: linhas.length, ignoradas };
}

// GET /api/pais?busca=17
exports.listar = async (req, res) => {
    try {
        const { busca } = req.query;
        let where = '';
        const params = [];
        if (busca) {
            where = `AND (pp.nome LIKE ? OR pp.marca LIKE ? OR EXISTS (
                SELECT 1 FROM modelos_base mb WHERE mb.produto_pai_id = pp.id AND mb.ativo = TRUE AND mb.nome LIKE ?))`;
            params.push(`%${busca}%`, `%${busca}%`, `%${busca}%`);
        }
        res.json(await carregarPais(where, params));
    } catch (err) {
        res.status(500).json({ erro: 'Erro ao listar produtos pai', detalhe: err.message });
    }
};

exports.buscarPorId = async (req, res) => {
    try {
        const lista = await carregarPais('AND pp.id = ?', [req.params.id]);
        if (lista.length === 0) return res.status(404).json({ erro: 'Produto pai não encontrado' });
        res.json(lista[0]);
    } catch (err) {
        res.status(500).json({ erro: 'Erro ao buscar produto pai', detalhe: err.message });
    }
};

// POST /api/pais  { nome, categoria, condicao, marca, preco_venda, variacoes: [{ atributos: [{nome, valor}], preco_venda? }] }
exports.criar = async (req, res) => {
    const connection = await db.getConnection();
    try {
        const { nome, categoria, condicao, marca, preco_venda, variacoes } = req.body;
        const nomePai = String(nome || '').trim();
        if (!nomePai) throw erroNegocio('Informe o nome do produto pai');
        if (nomePai.length > 150) throw erroNegocio('Nome do produto pai muito longo (máx. 150 caracteres)');

        await connection.beginTransaction();

        const [dup] = await connection.query(
            'SELECT id FROM produtos_pai WHERE ativo = TRUE AND nome = ?', [nomePai]
        );
        if (dup.length > 0) {
            throw erroNegocio(`Já existe um produto pai chamado "${nomePai}". Abra ele na lista e use "+ Adicionar variações".`);
        }

        const pai = {
            nome: nomePai,
            categoria: normalizarCategoria(categoria),
            condicao: CONDICOES.includes(condicao) ? condicao : 'novo',
            marca: String(marca || '').trim() || null,
            preco_venda: Number(preco_venda) > 0 ? Number(preco_venda) : 0
        };
        const [r] = await connection.query(
            'INSERT INTO produtos_pai (nome, categoria, condicao, marca, preco_venda) VALUES (?, ?, ?, ?, ?)',
            [pai.nome, pai.categoria, pai.condicao, pai.marca, pai.preco_venda]
        );
        pai.id = r.insertId;

        const resultado = await inserirVariacoes(connection, pai, variacoes);

        await connection.commit();
        res.status(201).json({
            id: pai.id,
            criadas: resultado.criadas,
            mensagem: `Produto pai "${pai.nome}" cadastrado com ${resultado.criadas} variação(ões). ` +
                'Elas só entram no estoque quando você dá entrada (Compra, Upgrade ou Entrada manual).'
        });
    } catch (err) {
        await connection.rollback();
        responderErro(res, err, 'Erro ao cadastrar produto pai');
    } finally {
        connection.release();
    }
};

// POST /api/pais/:id/variacoes  { variacoes: [{ atributos, preco_venda? }] }
exports.adicionarVariacoes = async (req, res) => {
    const connection = await db.getConnection();
    try {
        await connection.beginTransaction();
        const [rows] = await connection.query(
            'SELECT * FROM produtos_pai WHERE id = ? AND ativo = TRUE FOR UPDATE', [req.params.id]
        );
        if (rows.length === 0) {
            await connection.rollback();
            return res.status(404).json({ erro: 'Produto pai não encontrado' });
        }
        const resultado = await inserirVariacoes(connection, rows[0], req.body.variacoes);
        await connection.commit();
        res.status(201).json({
            criadas: resultado.criadas,
            ignoradas: resultado.ignoradas,
            mensagem: `${resultado.criadas} variação(ões) adicionada(s)` +
                (resultado.ignoradas.length ? `, ${resultado.ignoradas.length} já existiam` : '') + '.'
        });
    } catch (err) {
        await connection.rollback();
        responderErro(res, err, 'Erro ao adicionar variações');
    } finally {
        connection.release();
    }
};

/**
 * PUT /api/pais/:id  { nome, categoria, condicao, marca, preco_venda, aplicar_preco }
 * Edita o pai num lugar só. Se o nome (ou a marca) mudar, propaga para:
 *  - as variações do catálogo (o nome delas é "pai + atributos");
 *  - os produtos que já estão no estoque e nasceram dessas variações
 *    (só mexe se o nome do produto ainda era o original — não sobrescreve edição manual).
 * Categoria/condição só mudam no catálogo: o estoque guarda a condição real de cada unidade.
 */
exports.editar = async (req, res) => {
    const connection = await db.getConnection();
    try {
        const { nome, categoria, condicao, marca, preco_venda, aplicar_preco } = req.body;
        const novoNome = String(nome || '').trim();
        if (!novoNome) throw erroNegocio('Informe o nome do produto pai');
        if (novoNome.length > 150) throw erroNegocio('Nome do produto pai muito longo (máx. 150 caracteres)');

        await connection.beginTransaction();

        const [rows] = await connection.query(
            'SELECT * FROM produtos_pai WHERE id = ? AND ativo = TRUE FOR UPDATE', [req.params.id]
        );
        if (rows.length === 0) {
            await connection.rollback();
            return res.status(404).json({ erro: 'Produto pai não encontrado' });
        }
        const pai = rows[0];

        const [dup] = await connection.query(
            'SELECT id FROM produtos_pai WHERE ativo = TRUE AND nome = ? AND id != ?', [novoNome, pai.id]
        );
        if (dup.length > 0) throw erroNegocio(`Já existe outro produto pai chamado "${novoNome}"`);

        const cat = categoria ? normalizarCategoria(categoria, pai.categoria) : pai.categoria;
        const cond = CONDICOES.includes(condicao) ? condicao : pai.condicao;
        const novaMarca = String(marca || '').trim() || null;
        const preco = Number(preco_venda) >= 0 && preco_venda !== '' && preco_venda !== null && preco_venda !== undefined
            ? Number(preco_venda) : Number(pai.preco_venda);
        const marcaMudou = (novaMarca || null) !== (pai.marca || null);

        await connection.query(
            'UPDATE produtos_pai SET nome = ?, categoria = ?, condicao = ?, marca = ?, preco_venda = ? WHERE id = ?',
            [novoNome, cat, cond, novaMarca, preco, pai.id]
        );

        const [variacoes] = await connection.query(
            'SELECT * FROM modelos_base WHERE produto_pai_id = ? AND ativo = TRUE', [pai.id]
        );

        let produtosAtualizados = 0;
        for (const v of variacoes) {
            const nomeNovo = renomearVariacao(v, pai.nome, novoNome);

            const sets = ['nome = ?', 'modelo = ?', 'marca = ?', 'categoria = ?', 'condicao = ?'];
            const valores = [nomeNovo, novoNome, novaMarca, cat, cond];
            if (aplicar_preco) { sets.push('preco_venda = ?'); valores.push(preco); }
            await connection.query(`UPDATE modelos_base SET ${sets.join(', ')} WHERE id = ?`, [...valores, v.id]);

            if (nomeNovo !== v.nome || novoNome !== pai.nome || marcaMudou) {
                const setsProd = ['nome = IF(nome = ?, ?, nome)', 'modelo = IF(modelo = ?, ?, modelo)'];
                const valProd = [v.nome, nomeNovo, pai.nome, novoNome];
                if (marcaMudou) { setsProd.push('marca = ?'); valProd.push(novaMarca); }
                const [r] = await connection.query(
                    `UPDATE produtos SET ${setsProd.join(', ')} WHERE modelo_base_id = ? AND ativo = TRUE`,
                    [...valProd, v.id]
                );
                produtosAtualizados += r.affectedRows || 0;
            }
        }

        await connection.commit();
        res.json({
            mensagem: 'Produto pai atualizado.' +
                (novoNome !== pai.nome ? ` ${variacoes.length} variação(ões) renomeada(s).` : ''),
            variacoes_atualizadas: variacoes.length,
            produtos_estoque_tocados: produtosAtualizados
        });
    } catch (err) {
        await connection.rollback();
        responderErro(res, err, 'Erro ao atualizar produto pai');
    } finally {
        connection.release();
    }
};

// PUT /api/pais/:id/variacoes/:varId  { atributos?, preco_venda? }
exports.editarVariacao = async (req, res) => {
    const connection = await db.getConnection();
    try {
        await connection.beginTransaction();
        const { id, varId } = req.params;

        const [paiRows] = await connection.query('SELECT * FROM produtos_pai WHERE id = ? AND ativo = TRUE', [id]);
        const [varRows] = await connection.query(
            'SELECT * FROM modelos_base WHERE id = ? AND produto_pai_id = ? AND ativo = TRUE FOR UPDATE', [varId, id]
        );
        if (paiRows.length === 0 || varRows.length === 0) {
            await connection.rollback();
            return res.status(404).json({ erro: 'Variação não encontrada' });
        }
        const pai = paiRows[0];
        const v = varRows[0];

        let nome = v.nome;
        let atributosJson = v.atributos;
        const atributos = limparAtributos(req.body.atributos);
        if (atributos.length > 0) {
            nome = montarNome(pai.nome, atributos);
            if (nome.length > 150) throw erroNegocio('Nome da variação muito longo (máx. 150 caracteres)');
            const [dup] = await connection.query(
                'SELECT id FROM modelos_base WHERE produto_pai_id = ? AND ativo = TRUE AND nome = ? AND id != ?',
                [pai.id, nome, v.id]
            );
            if (dup.length > 0) throw erroNegocio(`Já existe a variação "${nome}" neste produto pai`);
            atributosJson = JSON.stringify(atributos);
        }

        const preco = (req.body.preco_venda !== undefined && req.body.preco_venda !== '' && Number(req.body.preco_venda) >= 0)
            ? Number(req.body.preco_venda) : Number(v.preco_venda);

        await connection.query(
            'UPDATE modelos_base SET nome = ?, atributos = ?, preco_venda = ? WHERE id = ?',
            [nome, atributosJson, preco, v.id]
        );
        if (nome !== v.nome) {
            await connection.query(
                'UPDATE produtos SET nome = ? WHERE modelo_base_id = ? AND nome = ? AND ativo = TRUE', [nome, v.id, v.nome]
            );
        }

        await connection.commit();
        res.json({ mensagem: 'Variação atualizada.' });
    } catch (err) {
        await connection.rollback();
        responderErro(res, err, 'Erro ao atualizar variação');
    } finally {
        connection.release();
    }
};

exports.removerVariacao = async (req, res) => {
    try {
        await db.query(
            'UPDATE modelos_base SET ativo = FALSE WHERE id = ? AND produto_pai_id = ?', [req.params.varId, req.params.id]
        );
        res.json({ mensagem: 'Variação removida do catálogo. Produtos já no estoque não são afetados.' });
    } catch (err) {
        res.status(500).json({ erro: 'Erro ao remover variação', detalhe: err.message });
    }
};

// Remove o pai e todas as variações do catálogo (estoque e histórico ficam intactos)
exports.remover = async (req, res) => {
    const connection = await db.getConnection();
    try {
        await connection.beginTransaction();
        await connection.query('UPDATE produtos_pai SET ativo = FALSE WHERE id = ?', [req.params.id]);
        await connection.query('UPDATE modelos_base SET ativo = FALSE WHERE produto_pai_id = ?', [req.params.id]);
        await connection.commit();
        res.json({ mensagem: 'Produto pai removido do catálogo. Produtos já no estoque não são afetados.' });
    } catch (err) {
        await connection.rollback();
        res.status(500).json({ erro: 'Erro ao remover produto pai', detalhe: err.message });
    } finally {
        connection.release();
    }
};
