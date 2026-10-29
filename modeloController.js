const db = require('../config/db');
const { parseAtributos, rotuloDe } = require('../utils/variacoes');

/**
 * Modelos base = variações do catálogo (ex: "iPhone 17 Pro Max 256GB Laranja"),
 * sempre ligadas a um PRODUTO PAI (veja paiController, que cadastra e edita).
 * NÃO existem no estoque: o produto real só é criado quando há uma entrada
 * (Compra, Upgrade/troca ou Entrada manual) que referencia a variação.
 *
 * Esta lista plana é a que as telas de Compra, Upgrade e Entrada manual consomem.
 */

exports.listar = async (req, res) => {
    try {
        const { busca } = req.query;
        let sql = `
            SELECT mb.*, pp.nome AS pai_nome,
                   (SELECT COALESCE(SUM(p.quantidade), 0) FROM produtos p
                    WHERE p.modelo_base_id = mb.id AND p.ativo = TRUE) AS estoque
            FROM modelos_base mb
            LEFT JOIN produtos_pai pp ON pp.id = mb.produto_pai_id
            WHERE mb.ativo = TRUE AND (mb.produto_pai_id IS NULL OR pp.ativo = TRUE)
        `;
        const params = [];
        if (busca) {
            sql += ' AND (mb.nome LIKE ? OR mb.modelo LIKE ? OR pp.nome LIKE ?)';
            params.push(`%${busca}%`, `%${busca}%`, `%${busca}%`);
        }
        sql += ' ORDER BY pp.nome, mb.id';
        const [rows] = await db.query(sql, params);
        res.json(rows.map(r => ({
            ...r,
            atributos: parseAtributos(r.atributos),
            rotulo: rotuloDe(r, r.pai_nome),
            estoque: Number(r.estoque || 0)
        })));
    } catch (err) {
        res.status(500).json({ erro: 'Erro ao listar variações', detalhe: err.message });
    }
};

// Remove uma variação do catálogo (não mexe em produtos que já nasceram dela)
exports.remover = async (req, res) => {
    try {
        await db.query('UPDATE modelos_base SET ativo = FALSE WHERE id = ?', [req.params.id]);
        res.json({ mensagem: 'Variação removida' });
    } catch (err) {
        res.status(500).json({ erro: 'Erro ao remover variação', detalhe: err.message });
    }
};
