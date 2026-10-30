const db = require('../config/db');
const { normalizarCategoria, usaEstoqueMinimo } = require('../utils/categorias');

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
            sql += ' AND (p.nome LIKE ? OR p.modelo LIKE ? OR p.imei LIKE ? OR p.imei2 LIKE ? OR p.numero_serie LIKE ?)';
            params.push(`%${busca}%`, `%${busca}%`, `%${busca}%`, `%${busca}%`, `%${busca}%`);
        }
        if (categoria) {
            sql += ' AND p.categoria = ?';
            params.push(categoria);
        }
        sql += ' ORDER BY (p.quantidade > 0) DESC, p.criado_em DESC';

        const [rows] = await db.query(sql, params);
        // Preço de custo é informação só do administrador
        if (req.user?.papel !== 'admin') rows.forEach(r => delete r.preco_custo);
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
        if (req.user?.papel !== 'admin') delete rows[0].preco_custo;
        res.json(rows[0]);
    } catch (err) {
        res.status(500).json({ erro: 'Erro ao buscar produto', detalhe: err.message });
    }
};

// Lê e valida os campos de um aparelho/produto (mesmos campos do formulário de upgrade):
// preço de compra, desconto, garantia, bateria, IMEI 1/2, serial e preço de venda varejo/atacado.
// O custo no estoque = preço de compra − desconto.
function lerCamposDoProduto(b) {
    const vazio = v => v === undefined || v === null || String(v).trim() === '';
    const texto = v => (vazio(v) ? null : String(v).trim());

    let custo = vazio(b.preco_custo) ? 0 : Number(b.preco_custo);
    if (!vazio(b.preco_compra)) {
        const compra = Number(b.preco_compra);
        const desconto = Number(b.desconto) || 0;
        if (isNaN(compra) || compra < 0) return { erro: 'Preço de compra inválido' };
        if (desconto < 0 || desconto > compra) return { erro: 'O desconto não pode ser maior que o preço de compra' };
        custo = compra - desconto;
    }

    let bateria = null;
    if (!vazio(b.bateria)) {
        bateria = Number(b.bateria);
        if (isNaN(bateria) || bateria < 0 || bateria > 100) return { erro: 'A bateria deve ser um valor entre 0 e 100%' };
    }

    const imei = texto(b.imei);
    const imei2 = texto(b.imei2);
    if (imei && imei2 && imei === imei2) return { erro: 'IMEI 1 e IMEI 2 não podem ser iguais' };

    return {
        custo, bateria, imei, imei2,
        numero_serie: texto(b.numero_serie),
        garantia: texto(b.garantia),
        atacado: vazio(b.preco_venda_atacado) ? null : Number(b.preco_venda_atacado)
    };
}

// Algum dos IMEIs já está em outro produto ativo?
async function imeiJaCadastrado(imei, imei2, ignorarId) {
    const imeis = [imei, imei2].filter(Boolean);
    if (!imeis.length) return false;
    let sql = 'SELECT id FROM produtos WHERE ativo = TRUE AND (imei IN (?) OR imei2 IN (?))';
    const params = [imeis, imeis];
    if (ignorarId) { sql += ' AND id != ?'; params.push(ignorarId); }
    const [dup] = await db.query(sql, params);
    return dup.length > 0;
}

// Criar produto manualmente (entrada manual, não troca).
// Pode partir de uma variação de PRODUTO PAI (modelo_base_id): os dados vêm do catálogo
// e, se já existir no estoque um item dessa variação sem IMEI, a quantidade é somada nele.
exports.criar = async (req, res) => {
    try {
        let {
            nome, categoria, marca, modelo, condicao,
            quantidade, estoque_minimo, preco_venda, observacoes, modelo_base_id
        } = req.body;

        let base = null;
        if (modelo_base_id) {
            const [bases] = await db.query(
                'SELECT * FROM modelos_base WHERE id = ? AND ativo = TRUE', [modelo_base_id]
            );
            if (bases.length === 0) {
                return res.status(400).json({ erro: 'A variação do produto pai escolhida não existe mais no catálogo' });
            }
            base = bases[0];
            nome = nome || base.nome;
            categoria = categoria || base.categoria;
            marca = marca ?? base.marca;
            modelo = modelo || base.modelo;
            condicao = condicao || base.condicao;
            if (preco_venda === undefined || preco_venda === null || preco_venda === '') preco_venda = base.preco_venda;
        }
        if (preco_venda === undefined || preco_venda === null || preco_venda === '') preco_venda = 0;

        if (!nome) {
            return res.status(400).json({ erro: 'O nome do produto é obrigatório' });
        }

        const c = lerCamposDoProduto(req.body);
        if (c.erro) return res.status(400).json({ erro: c.erro });

        if (await imeiJaCadastrado(c.imei, c.imei2, null)) {
            return res.status(400).json({ erro: 'Já existe um produto ativo cadastrado com esse IMEI' });
        }

        const qtd = Number(quantidade) || 0;
        const referencia = base ? `Entrada manual (produto pai: ${modelo || base.nome})` : 'Cadastro manual do produto';

        // Variação sem IMEI/serial que já está no estoque: repõe em vez de duplicar o item
        if (base && !c.imei && !c.imei2 && !c.numero_serie) {
            const [existente] = await db.query(
                'SELECT id FROM produtos WHERE modelo_base_id = ? AND ativo = TRUE AND imei IS NULL ORDER BY id LIMIT 1',
                [base.id]
            );
            if (existente.length > 0) {
                const produtoId = existente[0].id;
                await db.query(
                    'UPDATE produtos SET quantidade = quantidade + ?, preco_custo = IF(? > 0, ?, preco_custo) WHERE id = ?',
                    [qtd, c.custo, c.custo, produtoId]
                );
                if (qtd > 0) {
                    await db.query(
                        `INSERT INTO estoque_movimentos (produto_id, tipo, quantidade, referencia, usuario_id)
                         VALUES (?, 'ajuste_manual', ?, ?, ?)`,
                        [produtoId, qtd, referencia, req.user?.id || null]
                    );
                }
                return res.status(200).json({
                    id: produtoId,
                    somado: true,
                    mensagem: `Esta variação já estava no estoque: ${qtd} unidade(s) somada(s) ao item existente.`
                });
            }
        }

        const categoriaFinal = normalizarCategoria(categoria);
        // Estoque mínimo só existe para acessório e blindagem
        const minimo = usaEstoqueMinimo(categoriaFinal) ? (estoque_minimo ?? 2) : 0;

        const [result] = await db.query(
            `INSERT INTO produtos
                (nome, categoria, marca, modelo, imei, imei2, numero_serie, bateria, garantia, condicao,
                 quantidade, estoque_minimo, preco_custo, preco_venda, preco_venda_atacado, origem, observacoes, modelo_base_id)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'compra', ?, ?)`,
            [nome, categoriaFinal, marca || null, modelo || null, c.imei, c.imei2, c.numero_serie, c.bateria, c.garantia,
             condicao || 'novo', qtd, minimo, c.custo, preco_venda, c.atacado, observacoes || null, base ? base.id : null]
        );

        if (qtd > 0) {
            await db.query(
                `INSERT INTO estoque_movimentos (produto_id, tipo, quantidade, referencia, usuario_id)
                 VALUES (?, 'ajuste_manual', ?, ?, ?)`,
                [result.insertId, qtd, referencia, req.user?.id || null]
            );
        }

        res.status(201).json({ id: result.insertId, mensagem: 'Produto cadastrado com sucesso' });
    } catch (err) {
        res.status(500).json({ erro: 'Erro ao cadastrar produto', detalhe: err.message });
    }
};

// Editar produto
exports.editar = async (req, res) => {
    try {
        const {
            nome, categoria, marca, modelo, condicao,
            quantidade, estoque_minimo, preco_venda, observacoes
        } = req.body;

        const c = lerCamposDoProduto(req.body);
        if (c.erro) return res.status(400).json({ erro: c.erro });

        if (await imeiJaCadastrado(c.imei, c.imei2, req.params.id)) {
            return res.status(400).json({ erro: 'Já existe outro produto ativo cadastrado com esse IMEI' });
        }

        const [atual] = await db.query('SELECT quantidade FROM produtos WHERE id = ?', [req.params.id]);
        if (atual.length === 0) return res.status(404).json({ erro: 'Produto não encontrado' });
        const diferenca = Number(quantidade) - Number(atual[0].quantidade);

        const categoriaFinal = normalizarCategoria(categoria);
        await db.query(
            `UPDATE produtos SET nome=?, categoria=?, marca=?, modelo=?, imei=?, imei2=?, numero_serie=?, bateria=?,
             garantia=?, condicao=?, quantidade=?, estoque_minimo=?, preco_custo=?, preco_venda=?, preco_venda_atacado=?,
             observacoes=? WHERE id=?`,
            [nome, categoriaFinal, marca || null, modelo || null, c.imei, c.imei2, c.numero_serie, c.bateria,
             c.garantia, condicao || 'novo', quantidade, usaEstoqueMinimo(categoriaFinal) ? (estoque_minimo ?? 2) : 0,
             c.custo, preco_venda, c.atacado, observacoes || null, req.params.id]
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
