// Auditoria: grava no banco TUDO o que cada pessoa faz no sistema.
// - Toda ação que altera algo (POST/PUT/PATCH/DELETE) é registrada automaticamente, com
//   quem fez, quando, de onde e (nas edições) o valor ANTES e DEPOIS de cada campo.
// - Também registra login (e tentativas que falharam), saída, acessos negados,
//   telas abertas e impressões (estes últimos avisados pelo próprio frontend).
// Nada aqui pode derrubar uma requisição: se o log falhar, o sistema segue normalmente.

const db = require('../config/db');

const SECRETO = /senha|password|token|hash|secret/i;
const METODOS_ESCRITA = ['POST', 'PUT', 'PATCH', 'DELETE'];

// ---------- utilidades ----------

function agoraBrasilia() {
    // "2026-10-29 20:15:03" no horário de Brasília, independente do fuso do servidor
    return new Date().toLocaleString('sv-SE', { timeZone: 'America/Sao_Paulo' });
}

function limpar(v, nivel = 0) {
    if (v === null || v === undefined) return v;
    if (v instanceof Date) return v.toISOString();
    if (typeof v === 'string') return v.length > 400 ? v.slice(0, 400) + '…' : v;
    if (typeof v !== 'object') return v;
    if (nivel > 5) return '[...]';
    if (Array.isArray(v)) return v.slice(0, 60).map(x => limpar(x, nivel + 1));
    const o = {};
    for (const [k, x] of Object.entries(v)) o[k] = SECRETO.test(k) ? '***' : limpar(x, nivel + 1);
    return o;
}

function dinheiro(n) {
    return 'R$ ' + Number(n || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function ipDe(req) {
    const xff = req.headers['x-forwarded-for'];
    return String(xff ? xff.split(',')[0] : (req.socket?.remoteAddress || '')).trim().slice(0, 60);
}

const ROTULOS = {
    status: 'status', valor_total: 'total', valor_troca: 'valor da troca', valor_a_pagar: 'a pagar',
    desconto: 'desconto', frete: 'frete', forma_pagamento: 'forma de pagamento', observacoes: 'observações',
    data: 'data', vendedor: 'vendedor', cliente: 'cliente', itens: 'itens', pagamentos: 'pagamentos',
    trocas: 'aparelhos na troca', nome: 'nome', preco_venda: 'preço de venda', preco_custo: 'preço de custo',
    preco_venda_atacado: 'preço atacado', quantidade: 'quantidade', estoque: 'estoque', ativo: 'ativo',
    papel: 'papel', email: 'e-mail', telefone: 'telefone', celular: 'celular', cpf_cnpj: 'CPF/CNPJ',
    imei: 'IMEI', imei2: 'IMEI 2', garantia: 'garantia', marca: 'marca', modelo: 'modelo',
    categoria: 'categoria', condicao: 'condição', numero_serie: 'serial', bateria: 'bateria', conciliado: 'conciliado', valor_recebido: 'valor recebido',
    descricao: 'descrição', valor: 'valor', tipo: 'tipo', endereco: 'endereço', cidade: 'cidade'
};
const rotulo = c => ROTULOS[c] || c.replace(/_/g, ' ');

// ---------- "fotografia" de um registro (para mostrar antes/depois) ----------

const FOTOS = {
    pedidos: async (id) => {
        const [[p]] = await db.query(
            `SELECT p.status, p.valor_total, p.valor_troca, p.valor_a_pagar, p.desconto, p.frete,
                    p.forma_pagamento, p.observacoes, p.criado_em AS data,
                    u.nome AS vendedor, c.nome AS cliente
             FROM pedidos p
             LEFT JOIN usuarios u ON u.id = p.usuario_id
             LEFT JOIN clientes c ON c.id = p.cliente_id
             WHERE p.id = ?`, [id]);
        if (!p) return null;
        const [itens] = await db.query(
            `SELECT pr.nome, pi.quantidade, pi.preco_unitario FROM pedido_itens pi
             LEFT JOIN produtos pr ON pr.id = pi.produto_id WHERE pi.pedido_id = ? ORDER BY pi.id`, [id]);
        const [pags] = await db.query(
            'SELECT forma_pagamento, valor, parcelas FROM pedido_pagamentos WHERE pedido_id = ? ORDER BY id', [id]);
        const [trocas] = await db.query(
            `SELECT pr.nome, pt.valor_abatido FROM pedido_trocas pt
             LEFT JOIN produtos pr ON pr.id = pt.produto_id WHERE pt.pedido_id = ? ORDER BY pt.id`, [id]);
        p.itens = itens.map(i => `${i.quantidade}x ${i.nome} (${dinheiro(i.preco_unitario)})`).join('; ') || '—';
        p.pagamentos = pags.map(x => `${x.forma_pagamento}${Number(x.parcelas) > 1 ? ' ' + x.parcelas + 'x' : ''} ${dinheiro(x.valor)}`).join('; ') || '—';
        p.trocas = trocas.map(t => `${t.nome} (${dinheiro(t.valor_abatido)})`).join('; ') || '—';
        return p;
    },
    usuarios: async (id) => {
        const [[r]] = await db.query('SELECT nome, email, papel, ativo FROM usuarios WHERE id = ?', [id]);
        return r || null;
    }
};

async function foto(tabela, id) {
    try {
        if (!id) return null;
        if (FOTOS[tabela]) return await FOTOS[tabela](id);
        const [[r]] = await db.query('SELECT * FROM ?? WHERE id = ?', [tabela, id]);
        return r || null;
    } catch (e) {
        return null;
    }
}

const IGNORAR_NO_DIFF = ['criado_em', 'atualizado_em', 'conciliado_em'];
function diferencas(antes, depois) {
    if (!antes || !depois) return null;
    const norm = v => (v instanceof Date ? v.toISOString() : v === null || v === undefined ? '' : String(v));
    const lista = [];
    for (const campo of new Set([...Object.keys(antes), ...Object.keys(depois)])) {
        if (IGNORAR_NO_DIFF.includes(campo)) continue;
        if (norm(antes[campo]) !== norm(depois[campo])) {
            lista.push({ campo, de: limpar(antes[campo] ?? null), para: limpar(depois[campo] ?? null) });
        }
    }
    return lista;
}

function textoMudancas(mud, max = 6) {
    if (!mud || !mud.length) return '';
    const fmt = v => (v === null || v === '' || v === undefined) ? '—' : String(v);
    const partes = mud.slice(0, max).map(m => `${rotulo(m.campo)}: ${fmt(m.de)} → ${fmt(m.para)}`);
    if (mud.length > max) partes.push(`+${mud.length - max} alteração(ões)`);
    return partes.join('; ');
}

// ---------- regras: como descrever cada ação ----------
// m = método, re = rota (o 1º grupo é o id), tabela = para tirar antes/depois

const REGRAS = [
    // Pedidos
    { m: 'POST', re: /^\/pedidos$/, area: 'Pedidos', acao: 'pedido.criar', entidade: 'pedido', tabela: 'pedidos',
      desc: c => `${c.depois?.status === 'aberto' ? 'Agendou' : 'Abriu'} o pedido #${c.id}` +
        (c.depois?.cliente ? ` de ${c.depois.cliente}` : '') +
        (c.depois ? ` — total ${dinheiro(c.depois.valor_total)}, vendedor ${c.depois.vendedor || '—'}` : '') },
    { m: 'PUT', re: /^\/pedidos\/(\d+)$/, area: 'Pedidos', acao: 'pedido.editar', entidade: 'pedido', tabela: 'pedidos',
      desc: c => {
          const mud = c.mudancas || [];
          if (!mud.length) return `Salvou o pedido #${c.id} sem alterar nada`;
          const v = mud.find(x => x.campo === 'vendedor');
          if (v && mud.length === 1) return `Trocou o vendedor do pedido #${c.id} de ${v.de || '—'} para ${v.para || '—'}`;
          return `Editou o pedido #${c.id} — ${textoMudancas(mud)}`;
      } },
    { m: 'PUT', re: /^\/pedidos\/(\d+)\/cancelar$/, area: 'Pedidos', acao: 'pedido.cancelar', entidade: 'pedido', tabela: 'pedidos',
      desc: c => `Cancelou o pedido #${c.id}` + (c.antes ? ` de ${c.antes.cliente || '—'} (${dinheiro(c.antes.valor_total)})` : '') },
    { m: 'PUT', re: /^\/pedidos\/(\d+)\/concluir$/, area: 'Pedidos', acao: 'pedido.concluir', entidade: 'pedido', tabela: 'pedidos',
      desc: c => `Fechou (concluiu) o pedido #${c.id}` + (c.antes ? ` de ${c.antes.cliente || '—'} (${dinheiro(c.antes.valor_total)})` : '') },

    // Estoque / produtos
    { m: 'POST', re: /^\/produtos$/, area: 'Estoque', acao: 'produto.criar', entidade: 'produto', tabela: 'produtos',
      desc: c => `Cadastrou o produto "${c.depois?.nome || c.body?.nome || ''}" no estoque (#${c.id})` },
    { m: 'PUT', re: /^\/produtos\/(\d+)$/, area: 'Estoque', acao: 'produto.editar', entidade: 'produto', tabela: 'produtos',
      desc: c => `Editou o produto "${c.depois?.nome || c.antes?.nome || ''}" (#${c.id})` + (c.mudancas?.length ? ` — ${textoMudancas(c.mudancas)}` : ' sem alterar nada') },
    { m: 'DELETE', re: /^\/produtos\/(\d+)$/, area: 'Estoque', acao: 'produto.excluir', entidade: 'produto', tabela: 'produtos',
      desc: c => `Excluiu o produto "${c.antes?.nome || ''}" (#${c.id}) do estoque` },

    // Produtos pai e variações
    { m: 'POST', re: /^\/pais$/, area: 'Produtos pai', acao: 'pai.criar', entidade: 'produto_pai', tabela: 'produtos_pai',
      desc: c => `Criou o produto pai "${c.depois?.nome || c.body?.nome || ''}" (#${c.id})` },
    { m: 'PUT', re: /^\/pais\/(\d+)$/, area: 'Produtos pai', acao: 'pai.editar', entidade: 'produto_pai', tabela: 'produtos_pai',
      desc: c => `Editou o produto pai "${c.depois?.nome || c.antes?.nome || ''}" (#${c.id})` + (c.mudancas?.length ? ` — ${textoMudancas(c.mudancas)}` : '') },
    { m: 'DELETE', re: /^\/pais\/(\d+)$/, area: 'Produtos pai', acao: 'pai.excluir', entidade: 'produto_pai', tabela: 'produtos_pai',
      desc: c => `Excluiu o produto pai "${c.antes?.nome || ''}" (#${c.id})` },
    { m: 'POST', re: /^\/pais\/(\d+)\/variacoes$/, area: 'Produtos pai', acao: 'variacao.criar', entidade: 'produto_pai',
      desc: c => `Adicionou variação(ões) ao produto pai #${c.id}` },
    { m: 'PUT', re: /^\/pais\/\d+\/variacoes\/(\d+)$/, area: 'Produtos pai', acao: 'variacao.editar', entidade: 'variacao', tabela: 'modelos_base',
      desc: c => `Editou a variação "${c.depois?.nome || c.antes?.nome || ''}" (#${c.id})` + (c.mudancas?.length ? ` — ${textoMudancas(c.mudancas)}` : '') },
    { m: 'DELETE', re: /^\/pais\/\d+\/variacoes\/(\d+)$/, area: 'Produtos pai', acao: 'variacao.excluir', entidade: 'variacao', tabela: 'modelos_base',
      desc: c => `Removeu a variação "${c.antes?.nome || ''}" (#${c.id})` },
    { m: 'DELETE', re: /^\/modelos\/(\d+)$/, area: 'Produtos pai', acao: 'modelo.excluir', entidade: 'variacao', tabela: 'modelos_base',
      desc: c => `Removeu o modelo "${c.antes?.nome || ''}" (#${c.id})` },

    // Clientes
    { m: 'POST', re: /^\/clientes$/, area: 'Clientes', acao: 'cliente.criar', entidade: 'cliente', tabela: 'clientes',
      desc: c => `Cadastrou o cliente "${c.depois?.nome || c.body?.nome || ''}" (#${c.id})` },
    { m: 'PUT', re: /^\/clientes\/(\d+)$/, area: 'Clientes', acao: 'cliente.editar', entidade: 'cliente', tabela: 'clientes',
      desc: c => `Editou o cliente "${c.depois?.nome || c.antes?.nome || ''}" (#${c.id})` + (c.mudancas?.length ? ` — ${textoMudancas(c.mudancas)}` : ' sem alterar nada') },

    // Fornecedores
    { m: 'POST', re: /^\/fornecedores$/, area: 'Fornecedores', acao: 'fornecedor.criar', entidade: 'fornecedor', tabela: 'fornecedores',
      desc: c => `Cadastrou o fornecedor "${c.depois?.nome || c.body?.nome || ''}" (#${c.id})` },
    { m: 'PUT', re: /^\/fornecedores\/(\d+)$/, area: 'Fornecedores', acao: 'fornecedor.editar', entidade: 'fornecedor', tabela: 'fornecedores',
      desc: c => `Editou o fornecedor "${c.depois?.nome || c.antes?.nome || ''}" (#${c.id})` + (c.mudancas?.length ? ` — ${textoMudancas(c.mudancas)}` : '') },
    { m: 'DELETE', re: /^\/fornecedores\/(\d+)$/, area: 'Fornecedores', acao: 'fornecedor.excluir', entidade: 'fornecedor', tabela: 'fornecedores',
      desc: c => `Excluiu o fornecedor "${c.antes?.nome || ''}" (#${c.id})` },

    // Compras
    { m: 'POST', re: /^\/compras$/, area: 'Compras', acao: 'compra.criar', entidade: 'compra', tabela: 'compras',
      desc: c => `Registrou a compra #${c.id}` + (c.depois?.valor_total !== undefined ? ` — total ${dinheiro(c.depois.valor_total)}` : '') },
    { m: 'PUT', re: /^\/compras\/(\d+)\/pagamento$/, area: 'Compras', acao: 'compra.pagamento', entidade: 'compra', tabela: 'compras',
      desc: c => `Registrou pagamento da compra #${c.id}` + (c.mudancas?.length ? ` — ${textoMudancas(c.mudancas)}` : '') },
    { m: 'PUT', re: /^\/compras\/(\d+)\/cancelar$/, area: 'Compras', acao: 'compra.cancelar', entidade: 'compra', tabela: 'compras',
      desc: c => `Cancelou a compra #${c.id}` },

    // Equipe
    { m: 'POST', re: /^\/usuarios$/, area: 'Equipe', acao: 'usuario.criar', entidade: 'usuario', tabela: 'usuarios',
      desc: c => `Criou o usuário "${c.depois?.nome || c.body?.nome || ''}" (${c.depois?.papel || c.body?.papel || ''})` },
    { m: 'PUT', re: /^\/usuarios\/(\d+)\/alternar-ativo$/, area: 'Equipe', acao: 'usuario.alternar_ativo', entidade: 'usuario', tabela: 'usuarios',
      desc: c => `${c.depois && Number(c.depois.ativo) ? 'Reativou' : 'Desativou'} o usuário "${c.depois?.nome || c.antes?.nome || ''}"` },
    { m: 'PUT', re: /^\/usuarios\/senha$/, area: 'Equipe', acao: 'usuario.trocar_senha', entidade: 'usuario',
      desc: () => 'Trocou a própria senha' },

    // Metas
    { m: 'PUT', re: /^\/metas\/([\d-]+)$/, area: 'Metas', acao: 'meta.salvar', entidade: 'meta', semId: true,
      desc: c => `Alterou as metas de ${c.param}` },

    // Financeiro / Lucro real
    { m: 'PUT', re: /^\/financeiro\/pagamentos\/lote$/, area: 'Financeiro', acao: 'financeiro.conciliar_lote', entidade: 'pagamento',
      desc: c => `Conciliou ${Array.isArray(c.body?.ids) ? c.body.ids.length : 'vários'} pagamento(s) de uma vez` },
    { m: 'PUT', re: /^\/financeiro\/pagamentos\/(\d+)\/conciliar$/, area: 'Financeiro', acao: 'financeiro.conciliar', entidade: 'pagamento', tabela: 'pedido_pagamentos',
      desc: c => `Conciliou o pagamento #${c.id}` + (c.depois ? ` do pedido #${c.depois.pedido_id} — recebido ${dinheiro(c.depois.valor_recebido)}` : '') },
    { m: 'PUT', re: /^\/financeiro\/pagamentos\/(\d+)\/desfazer$/, area: 'Financeiro', acao: 'financeiro.desfazer', entidade: 'pagamento', tabela: 'pedido_pagamentos',
      desc: c => `Desfez a conciliação do pagamento #${c.id}` + (c.depois ? ` do pedido #${c.depois.pedido_id}` : '') },
    { m: 'POST', re: /^\/financeiro\/lancamentos$/, area: 'Financeiro', acao: 'lancamento.criar', entidade: 'lancamento', tabela: 'lancamentos',
      desc: c => `Lançou ${c.depois?.tipo || 'um lançamento'} "${c.depois?.descricao || c.body?.descricao || ''}" de ${dinheiro(c.depois?.valor ?? c.body?.valor)}` },
    { m: 'PUT', re: /^\/financeiro\/lancamentos\/(\d+)$/, area: 'Financeiro', acao: 'lancamento.editar', entidade: 'lancamento', tabela: 'lancamentos',
      desc: c => `Editou o lançamento "${c.depois?.descricao || c.antes?.descricao || ''}" (#${c.id})` + (c.mudancas?.length ? ` — ${textoMudancas(c.mudancas)}` : '') },
    { m: 'DELETE', re: /^\/financeiro\/lancamentos\/(\d+)$/, area: 'Financeiro', acao: 'lancamento.excluir', entidade: 'lancamento', tabela: 'lancamentos',
      desc: c => `Excluiu o lançamento "${c.antes?.descricao || ''}" de ${dinheiro(c.antes?.valor)} (#${c.id})` }
];

const AREA_POR_PREFIXO = {
    pedidos: 'Pedidos', produtos: 'Estoque', pais: 'Produtos pai', modelos: 'Produtos pai', clientes: 'Clientes',
    fornecedores: 'Fornecedores', compras: 'Compras', usuarios: 'Equipe', metas: 'Metas', financeiro: 'Financeiro',
    relatorios: 'Relatórios'
};

function acharRegra(metodo, rota) {
    for (const r of REGRAS) {
        if (r.m !== metodo) continue;
        const m = rota.match(r.re);
        if (m) return { regra: r, param: m[1] };
    }
    return { regra: null, param: null };
}

// ---------- gravação ----------

async function registrar(dados) {
    try {
        let texto = null;
        if (dados.dados !== undefined && dados.dados !== null) {
            texto = JSON.stringify(dados.dados);
            if (texto.length > 100000) texto = texto.slice(0, 100000);
        }
        await db.query(
            `INSERT INTO logs_atividade
             (criado_em, usuario_id, usuario_nome, usuario_papel, area, acao, descricao, entidade, entidade_id,
              sucesso, metodo, rota, status_http, ip, dispositivo, dados)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [agoraBrasilia(), dados.usuario_id || null, (dados.usuario_nome || null) && String(dados.usuario_nome).slice(0, 120),
             dados.usuario_papel || null, dados.area, String(dados.acao).slice(0, 60), String(dados.descricao).slice(0, 600),
             dados.entidade || null, dados.entidade_id || null, dados.sucesso === false ? 0 : 1,
             dados.metodo || null, dados.rota ? String(dados.rota).slice(0, 255) : null, dados.status_http || null,
             dados.ip || null, dados.dispositivo ? String(dados.dispositivo).slice(0, 200) : null, texto]
        );
    } catch (err) {
        console.error('Aviso: não foi possível gravar o log:', err.message);
    }
}

// Atalho para quando já existe um usuário logado na requisição
function registrarDaRequisicao(req, extra) {
    return registrar({
        usuario_id: req.user?.id, usuario_nome: req.user?.nome, usuario_papel: req.user?.papel,
        ip: ipDe(req), dispositivo: req.headers['user-agent'], ...extra
    });
}

// ---------- middlewares ----------

// Depois do login: registra toda ação que altera dados e todo acesso negado.
function auditoria(req, res, next) {
    const metodo = req.method;
    const rota = req.originalUrl.split('?')[0].replace(/^\/api/, '').replace(/\/+$/, '') || '/';
    if (rota === '/logs/evento') return next(); // essa rota se registra sozinha

    const escrita = METODOS_ESCRITA.includes(metodo);
    const { regra, param } = escrita ? acharRegra(metodo, rota) : { regra: null, param: null };
    const idNum = param && /^\d+$/.test(param) ? Number(param) : null;

    let corpoResposta = null;
    const jsonOriginal = res.json.bind(res);
    res.json = (corpo) => { corpoResposta = corpo; return jsonOriginal(corpo); };

    res.on('finish', () => {
        (async () => {
            const status = res.statusCode;
            const ok = status < 400;

            // Acesso negado (qualquer método)
            if (status === 403) {
                return registrarDaRequisicao(req, {
                    area: 'Acesso', acao: 'acesso.negado', sucesso: false, metodo, rota, status_http: status,
                    descricao: `Tentou acessar ${metodo} ${rota} sem permissão`
                });
            }
            if (!escrita) return;

            const id = idNum || (corpoResposta && Number(corpoResposta.id)) || null;
            let depois = null;
            if (regra?.tabela && ok && metodo !== 'DELETE') depois = await foto(regra.tabela, id);
            const mudancas = diferencas(req._logAntes, depois);
            const ctx = { id: id || '?', param, antes: req._logAntes || null, depois, mudancas, body: req.body, resp: corpoResposta };

            let area, acao, descricao, entidade;
            if (regra) {
                area = regra.area; acao = regra.acao; entidade = regra.entidade;
                try { descricao = regra.desc(ctx); } catch (e) { descricao = `${metodo} ${rota}`; }
            } else {
                const prefixo = rota.split('/')[1] || '';
                area = AREA_POR_PREFIXO[prefixo] || 'Sistema';
                acao = `${metodo.toLowerCase()}.${prefixo || 'rota'}`;
                descricao = `Executou ${metodo} ${rota}`;
            }
            if (!ok) descricao = `FALHOU: ${descricao}${corpoResposta?.erro ? ' — ' + corpoResposta.erro : ''}`;

            const detalhes = { requisicao: limpar(req.body) };
            if (ctx.antes) detalhes.antes = limpar(ctx.antes);
            if (depois) detalhes.depois = limpar(depois);
            if (mudancas && mudancas.length) detalhes.mudancas = mudancas;
            if (!ok && corpoResposta?.erro) detalhes.erro = corpoResposta.erro;
            else if (corpoResposta?.mensagem) detalhes.resposta = corpoResposta.mensagem;

            await registrarDaRequisicao(req, {
                area, acao, descricao, entidade: entidade || null, entidade_id: regra?.semId ? null : id,
                sucesso: ok, metodo, rota, status_http: status, dados: detalhes
            });
        })().catch(() => {});
    });

    // Antes de executar, guarda como o registro estava (para mostrar o "de → para")
    if (regra?.tabela && idNum && (metodo === 'PUT' || metodo === 'DELETE')) {
        foto(regra.tabela, idNum).then(f => { req._logAntes = f; next(); }, () => next());
    } else {
        next();
    }
}

// Login: registra quem entrou e também as tentativas que falharam.
function auditoriaLogin(req, res, next) {
    if (req.method !== 'POST' || !req.path.startsWith('/login')) return next();
    let corpoResposta = null;
    const jsonOriginal = res.json.bind(res);
    res.json = (corpo) => { corpoResposta = corpo; return jsonOriginal(corpo); };
    res.on('finish', () => {
        const ok = res.statusCode === 200 && corpoResposta?.usuario;
        const u = corpoResposta?.usuario;
        registrar({
            usuario_id: u?.id, usuario_nome: u?.nome || req.body?.email || null, usuario_papel: u?.papel,
            area: 'Acesso', acao: ok ? 'login.sucesso' : 'login.falha', sucesso: !!ok,
            descricao: ok ? 'Entrou no sistema' : `Tentativa de login que falhou (e-mail: ${req.body?.email || 'não informado'})`,
            metodo: 'POST', rota: '/auth/login', status_http: res.statusCode, ip: ipDe(req),
            dispositivo: req.headers['user-agent'],
            dados: ok ? undefined : { email: req.body?.email || null }
        });
    });
    next();
}

module.exports = { auditoria, auditoriaLogin, registrar, registrarDaRequisicao };
