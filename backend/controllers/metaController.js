const db = require('../config/db');

const { CATEGORIAS, normalizarCategoria } = require('../utils/categorias');

// Metas criadas automaticamente na primeira vez que o sistema abre um mês
// (sem nenhum mês anterior para copiar). Você ajusta os valores na tela.
const PADROES = [
    { nome: 'Acessórios', palavras: 'capinha, capa, pelicula, película, carregador', categorias: 'acessorio' },
    { nome: 'Blindagem', palavras: 'blindagem', categorias: 'blindagem' },
    { nome: 'Seguro', palavras: 'seguro', categorias: 'seguro' },
    { nome: 'iPhones vendidos', palavras: 'iphone', categorias: 'iphone' }
];

function validarMes(mes) {
    return /^\d{4}-(0[1-9]|1[0-2])$/.test(String(mes || '')) ? mes : null;
}

function lista(texto) {
    return String(texto || '').split(',').map(x => x.trim()).filter(Boolean);
}

async function mesAtualDoBanco() {
    const [[r]] = await db.query("SELECT DATE_FORMAT(CURDATE(), '%Y-%m') AS mes");
    return r.mes;
}

// Se o mês (atual ou futuro) ainda não tem metas, copia as do último mês que tinha
// (mesmos itens e mesmos valores). Se nunca houve nenhuma, cria as 4 metas padrão com valor 0.
async function prepararMes(mes, atual) {
    if (mes < atual) return;
    const [[{ total }]] = await db.query('SELECT COUNT(*) AS total FROM metas_mensais WHERE mes = ?', [mes]);
    if (total > 0) return;

    const [[ant]] = await db.query('SELECT MAX(mes) AS mes FROM metas_mensais WHERE mes < ?', [mes]);
    if (ant.mes) {
        await db.query(
            `INSERT IGNORE INTO metas_mensais (mes, nome, tipo, alvo, palavras, categorias, ordem)
             SELECT ?, nome, tipo, alvo, palavras, categorias, ordem FROM metas_mensais WHERE mes = ?`,
            [mes, ant.mes]
        );
    } else {
        for (let i = 0; i < PADROES.length; i++) {
            const p = PADROES[i];
            await db.query(
                `INSERT IGNORE INTO metas_mensais (mes, nome, tipo, alvo, palavras, categorias, ordem)
                 VALUES (?, ?, 'quantidade', 0, ?, ?, ?)`,
                [mes, p.nome, p.palavras, p.categorias, i]
            );
        }
    }
}

// Quanto já foi vendido no mês para uma meta: soma os itens de pedidos FINALIZADOS
// cujo produto tenha a categoria e/ou uma das palavras da meta no nome ou modelo.
async function calcularRealizado(meta, mes) {
    const inicio = `${mes}-01`;
    const cond = ["p.status = 'finalizado'", 'p.criado_em >= ?', 'p.criado_em < DATE_ADD(?, INTERVAL 1 MONTH)'];
    const params = [inicio, inicio];

    const categorias = lista(meta.categorias);
    if (categorias.length) {
        cond.push('pr.categoria IN (?)');
        params.push(categorias);
    }

    const palavras = lista(meta.palavras);
    if (palavras.length) {
        cond.push('(' + palavras.map(() => '(pr.nome LIKE ? OR pr.modelo LIKE ?)').join(' OR ') + ')');
        palavras.forEach(w => {
            const termo = `%${w.replace(/[%_\\]/g, '\\$&')}%`;
            params.push(termo, termo);
        });
    }

    const soma = meta.tipo === 'valor' ? 'SUM(pi.quantidade * pi.preco_unitario)' : 'SUM(pi.quantidade)';
    const [[r]] = await db.query(
        `SELECT COALESCE(${soma}, 0) AS total
         FROM pedido_itens pi
         JOIN pedidos p ON p.id = pi.pedido_id
         JOIN produtos pr ON pr.id = pi.produto_id
         WHERE ${cond.join(' AND ')}`,
        params
    );
    return Number(r.total);
}

// GET /api/metas?mes=AAAA-MM  → metas do mês com o realizado e o percentual
exports.listar = async (req, res) => {
    try {
        const atual = await mesAtualDoBanco();
        const mes = validarMes(req.query.mes) || atual;
        await prepararMes(mes, atual);

        const [metas] = await db.query('SELECT * FROM metas_mensais WHERE mes = ? ORDER BY ordem, id', [mes]);
        const resultado = [];
        for (const m of metas) {
            const realizado = await calcularRealizado(m, mes);
            const alvo = Number(m.alvo);
            resultado.push({
                id: m.id,
                nome: m.nome,
                tipo: m.tipo,
                alvo,
                palavras: m.palavras || '',
                categorias: m.categorias || '',
                realizado,
                percentual: alvo > 0 ? Math.round((realizado / alvo) * 100) : null
            });
        }
        res.json({ mes, metas: resultado });
    } catch (err) {
        res.status(500).json({ erro: 'Erro ao carregar as metas', detalhe: err.message });
    }
};

// PUT /api/metas/AAAA-MM  → substitui a lista de metas daquele mês (só admin)
exports.salvar = async (req, res) => {
    const mes = validarMes(req.params.mes);
    if (!mes) return res.status(400).json({ erro: 'Mês inválido (use AAAA-MM)' });

    const recebidas = Array.isArray(req.body.metas) ? req.body.metas : [];
    const nomesUsados = new Set();
    const linhas = [];

    for (let i = 0; i < recebidas.length; i++) {
        const m = recebidas[i];
        const nome = String(m.nome || '').trim().slice(0, 60);
        if (!nome) return res.status(400).json({ erro: `A meta ${i + 1} está sem nome` });
        if (nomesUsados.has(nome.toLowerCase())) return res.status(400).json({ erro: `Já existe uma meta chamada "${nome}"` });
        nomesUsados.add(nome.toLowerCase());

        const alvo = Number(m.alvo);
        if (!Number.isFinite(alvo) || alvo < 0) return res.status(400).json({ erro: `Valor da meta "${nome}" inválido` });

        const categorias = [...new Set(lista(m.categorias).map(c => normalizarCategoria(c, '')).filter(c => CATEGORIAS.includes(c)))];
        const palavras = lista(m.palavras);
        if (categorias.length === 0 && palavras.length === 0) {
            return res.status(400).json({ erro: `Na meta "${nome}", informe ao menos uma palavra ou uma categoria` });
        }

        linhas.push([mes, nome, m.tipo === 'valor' ? 'valor' : 'quantidade', alvo, palavras.join(', '), categorias.join(','), i]);
    }

    const connection = await db.getConnection();
    try {
        await connection.beginTransaction();
        await connection.query('DELETE FROM metas_mensais WHERE mes = ?', [mes]);
        for (const l of linhas) {
            await connection.query(
                'INSERT INTO metas_mensais (mes, nome, tipo, alvo, palavras, categorias, ordem) VALUES (?, ?, ?, ?, ?, ?, ?)',
                l
            );
        }
        await connection.commit();
        res.json({ mensagem: 'Metas salvas' });
    } catch (err) {
        await connection.rollback();
        res.status(500).json({ erro: 'Erro ao salvar as metas', detalhe: err.message });
    } finally {
        connection.release();
    }
};
