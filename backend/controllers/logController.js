const db = require('../config/db');
const { registrarDaRequisicao } = require('../middleware/auditoria');

// Telas que o frontend avisa que foram abertas
const TELAS = {
    'index.html': 'Dashboard', 'agenda.html': 'Agenda', 'pedidos.html': 'Pedidos de venda',
    'novo-pedido.html': 'Novo pedido', 'recibo.html': 'Recibo', 'termo-troca.html': 'Termo de troca',
    'metas.html': 'Meta do mês', 'produtos.html': 'Estoque', 'produtos-pai.html': 'Produtos pai',
    'clientes.html': 'Clientes', 'fornecedores.html': 'Fornecedores', 'compras.html': 'Compras',
    'nova-compra.html': 'Nova compra', 'relatorios.html': 'Relatórios', 'lucro-real.html': 'Lucro real',
    'equipe.html': 'Equipe', 'logs.html': 'Logs', 'minha-conta.html': 'Minha conta'
};

// Eventos que só o navegador sabe (saiu, abriu tela, imprimiu). Qualquer logado pode avisar.
exports.evento = async (req, res) => {
    try {
        const { acao, pagina } = req.body || {};
        const id = /^\d+$/.test(String(req.body?.id || '')) ? Number(req.body.id) : null;
        let extra = null;

        if (acao === 'logout') {
            extra = { area: 'Acesso', acao: 'logout', descricao: 'Saiu do sistema' };
        } else if (acao === 'pagina.abrir' && TELAS[pagina]) {
            let descricao = `Abriu a tela ${TELAS[pagina]}`;
            if (id && pagina === 'novo-pedido.html') descricao = `Abriu o pedido #${id} para edição`;
            else if (id && pagina === 'recibo.html') descricao = `Abriu o recibo do pedido #${id}`;
            else if (id && pagina === 'termo-troca.html') descricao = `Abriu o termo de troca do pedido #${id}`;
            extra = { area: 'Navegação', acao: 'pagina.abrir', descricao, entidade: id ? 'pedido' : null, entidade_id: id };
        } else if (acao === 'recibo.imprimir' && id) {
            extra = { area: 'Impressão', acao: 'recibo.imprimir', descricao: `Imprimiu o recibo do pedido #${id}`, entidade: 'pedido', entidade_id: id };
        } else if (acao === 'termo.imprimir' && id) {
            extra = { area: 'Impressão', acao: 'termo.imprimir', descricao: `Imprimiu o termo de troca do pedido #${id}`, entidade: 'pedido', entidade_id: id };
        }

        if (!extra) return res.status(400).json({ erro: 'Evento inválido' });
        await registrarDaRequisicao(req, { ...extra, metodo: 'POST', rota: '/logs/evento', status_http: 200 });
        res.json({ ok: true });
    } catch (err) {
        res.status(500).json({ erro: 'Erro ao registrar evento' });
    }
};

// Lista os logs (mais recentes primeiro) com filtros. Só administrador.
exports.listar = async (req, res) => {
    try {
        const { de, ate, usuario_id, area, q, navegacao, apenas_falhas, entidade, entidade_id } = req.query;
        const limite = Math.min(Math.max(Number(req.query.limite) || 50, 1), 200);
        const pagina = Math.max(Number(req.query.pagina) || 1, 1);

        const where = [];
        const params = [];
        if (/^\d{4}-\d{2}-\d{2}$/.test(de || '')) { where.push('criado_em >= ?'); params.push(de + ' 00:00:00'); }
        if (/^\d{4}-\d{2}-\d{2}$/.test(ate || '')) { where.push('criado_em <= ?'); params.push(ate + ' 23:59:59'); }
        if (usuario_id) { where.push('usuario_id = ?'); params.push(Number(usuario_id)); }
        if (area) { where.push('area = ?'); params.push(area); }
        else if (navegacao !== '1') where.push("area <> 'Navegação'");
        if (apenas_falhas === '1') where.push('sucesso = 0');
        if (entidade) { where.push('entidade = ?'); params.push(entidade); }
        if (entidade_id) { where.push('entidade_id = ?'); params.push(Number(entidade_id)); }
        if (q && q.trim()) {
            const like = `%${q.trim()}%`;
            if (/^#?\d+$/.test(q.trim())) {
                where.push('(descricao LIKE ? OR usuario_nome LIKE ? OR entidade_id = ?)');
                params.push(like, like, Number(q.trim().replace('#', '')));
            } else {
                where.push('(descricao LIKE ? OR usuario_nome LIKE ? OR acao LIKE ?)');
                params.push(like, like, like);
            }
        }
        const filtro = where.length ? 'WHERE ' + where.join(' AND ') : '';

        const [[{ total }]] = await db.query(`SELECT COUNT(*) AS total FROM logs_atividade ${filtro}`, params);
        const [logs] = await db.query(
            `SELECT id, DATE_FORMAT(criado_em, '%Y-%m-%dT%H:%i:%s') AS criado_em, usuario_id, usuario_nome, usuario_papel,
                    area, acao, descricao, entidade, entidade_id, sucesso, metodo, rota, status_http, ip, dispositivo,
                    (dados IS NOT NULL) AS tem_detalhes
             FROM logs_atividade ${filtro}
             ORDER BY id DESC LIMIT ? OFFSET ?`,
            [...params, limite, (pagina - 1) * limite]
        );
        res.json({ total, pagina, limite, logs });
    } catch (err) {
        res.status(500).json({ erro: 'Erro ao buscar logs', detalhe: err.message });
    }
};

// Detalhes de um registro (valores antes/depois, o que foi enviado, etc.)
exports.detalhe = async (req, res) => {
    try {
        const [rows] = await db.query('SELECT dados FROM logs_atividade WHERE id = ?', [req.params.id]);
        if (!rows.length) return res.status(404).json({ erro: 'Registro não encontrado' });
        let dados = null;
        try { dados = rows[0].dados ? JSON.parse(rows[0].dados) : null; } catch (e) { dados = { texto: rows[0].dados }; }
        res.json({ dados });
    } catch (err) {
        res.status(500).json({ erro: 'Erro ao buscar detalhes', detalhe: err.message });
    }
};
