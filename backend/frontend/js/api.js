const API_BASE = '/api';

function getToken() {
    return localStorage.getItem('foneninja_token');
}

function getUsuarioLogado() {
    const dados = localStorage.getItem('foneninja_usuario');
    return dados ? JSON.parse(dados) : null;
}

function logout() {
    registrarEvento('logout');
    localStorage.removeItem('foneninja_token');
    localStorage.removeItem('foneninja_usuario');
    window.location.href = 'login.html';
}

// Toda página do sistema (exceto login.html) exige estar logado.
// Se não tiver token salvo, manda direto para o login.
(function protegerPagina() {
    const paginaAtual = window.location.pathname.split('/').pop();
    if (paginaAtual !== 'login.html' && !getToken()) {
        window.location.href = 'login.html';
    }
})();

async function apiRequest(path, options = {}) {
    const token = getToken();
    const response = await fetch(`${API_BASE}${path}`, {
        headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {})
        },
        ...options
    });

    // Sessão expirada ou inválida: manda de volta para o login
    if (response.status === 401) {
        logout();
        throw new Error('Sessão expirada. Faça login novamente.');
    }

    const data = await response.json();
    if (!response.ok) {
        throw new Error(data.erro || 'Erro na requisição');
    }
    return data;
}

const api = {
    auth: {
        login: (email, senha) => apiRequest('/auth/login', { method: 'POST', body: JSON.stringify({ email, senha }) })
    },
    produtos: {
        listar: (params = '') => apiRequest(`/produtos${params}`),
        buscar: (id) => apiRequest(`/produtos/${id}`),
        historico: (id) => apiRequest(`/produtos/${id}/historico`),
        criar: (dados) => apiRequest('/produtos', { method: 'POST', body: JSON.stringify(dados) }),
        editar: (id, dados) => apiRequest(`/produtos/${id}`, { method: 'PUT', body: JSON.stringify(dados) }),
        remover: (id) => apiRequest(`/produtos/${id}`, { method: 'DELETE' })
    },
    // Lista plana de variações (já com pai_nome, rotulo e estoque) — usada nos seletores de Compra, Upgrade e Entrada manual
    modelos: {
        listar: (params = '') => apiRequest(`/modelos${params}`),
        remover: (id) => apiRequest(`/modelos/${id}`, { method: 'DELETE' })
    },
    // Produtos pai com as variações dentro (tela "Produtos pai")
    pais: {
        listar: (params = '') => apiRequest(`/pais${params}`),
        buscar: (id) => apiRequest(`/pais/${id}`),
        criar: (dados) => apiRequest('/pais', { method: 'POST', body: JSON.stringify(dados) }),
        editar: (id, dados) => apiRequest(`/pais/${id}`, { method: 'PUT', body: JSON.stringify(dados) }),
        remover: (id) => apiRequest(`/pais/${id}`, { method: 'DELETE' }),
        adicionarVariacoes: (id, variacoes) => apiRequest(`/pais/${id}/variacoes`, { method: 'POST', body: JSON.stringify({ variacoes }) }),
        editarVariacao: (id, varId, dados) => apiRequest(`/pais/${id}/variacoes/${varId}`, { method: 'PUT', body: JSON.stringify(dados) }),
        removerVariacao: (id, varId) => apiRequest(`/pais/${id}/variacoes/${varId}`, { method: 'DELETE' })
    },
    clientes: {
        listar: (params = '') => apiRequest(`/clientes${params}`),
        buscar: (id) => apiRequest(`/clientes/${id}`),
        criar: (dados) => apiRequest('/clientes', { method: 'POST', body: JSON.stringify(dados) }),
        editar: (id, dados) => apiRequest(`/clientes/${id}`, { method: 'PUT', body: JSON.stringify(dados) })
    },
    fornecedores: {
        listar: (params = '') => apiRequest(`/fornecedores${params}`),
        buscar: (id) => apiRequest(`/fornecedores/${id}`),
        criar: (dados) => apiRequest('/fornecedores', { method: 'POST', body: JSON.stringify(dados) }),
        editar: (id, dados) => apiRequest(`/fornecedores/${id}`, { method: 'PUT', body: JSON.stringify(dados) }),
        remover: (id) => apiRequest(`/fornecedores/${id}`, { method: 'DELETE' })
    },
    pedidos: {
        listar: () => apiRequest('/pedidos'),
        proximoNumero: () => apiRequest('/pedidos/proximo-numero'),
        buscar: (id) => apiRequest(`/pedidos/${id}`),
        criar: (dados) => apiRequest('/pedidos', { method: 'POST', body: JSON.stringify(dados) }),
        editar: (id, dados) => apiRequest(`/pedidos/${id}`, { method: 'PUT', body: JSON.stringify(dados) }),
        cancelar: (id) => apiRequest(`/pedidos/${id}/cancelar`, { method: 'PUT' }),
        concluir: (id) => apiRequest(`/pedidos/${id}/concluir`, { method: 'PUT' }),
        agenda: (inicio, fim) => apiRequest(`/pedidos/agenda?inicio=${inicio}&fim=${fim}`),
        dashboard: () => apiRequest('/pedidos/dashboard')
    },
    compras: {
        listar: () => apiRequest('/compras'),
        buscar: (id) => apiRequest(`/compras/${id}`),
        criar: (dados) => apiRequest('/compras', { method: 'POST', body: JSON.stringify(dados) }),
        registrarPagamento: (id, valor) => apiRequest(`/compras/${id}/pagamento`, { method: 'PUT', body: JSON.stringify({ valor }) }),
        cancelar: (id) => apiRequest(`/compras/${id}/cancelar`, { method: 'PUT' })
    },
    relatorios: {
        vendas: (inicio, fim) => apiRequest(`/relatorios/vendas?inicio=${inicio}&fim=${fim}`),
        compras: (inicio, fim) => apiRequest(`/relatorios/compras?inicio=${inicio}&fim=${fim}`)
        
    },
     metas: {
        listar: (mes = '') => apiRequest(`/metas${mes ? `?mes=${mes}` : ''}`),
        salvar: (mes, metas) => apiRequest(`/metas/${mes}`, { method: 'PUT', body: JSON.stringify({ metas }) })
   
     },
    financeiro: {
        resumo: (inicio, fim) => apiRequest(`/financeiro/resumo?inicio=${inicio}&fim=${fim}`),
        pagamentos: (inicio, fim, status = '') => apiRequest(`/financeiro/pagamentos?inicio=${inicio}&fim=${fim}&status=${status}`),
        conciliar: (id, valor_recebido) => apiRequest(`/financeiro/pagamentos/${id}/conciliar`, { method: 'PUT', body: JSON.stringify({ valor_recebido }) }),
        conciliarLote: (ids) => apiRequest('/financeiro/pagamentos/lote', { method: 'PUT', body: JSON.stringify({ ids }) }),
        desfazer: (id) => apiRequest(`/financeiro/pagamentos/${id}/desfazer`, { method: 'PUT' }),
        lancamentos: (inicio, fim) => apiRequest(`/financeiro/lancamentos?inicio=${inicio}&fim=${fim}`),
        criarLancamento: (dados) => apiRequest('/financeiro/lancamentos', { method: 'POST', body: JSON.stringify(dados) }),
        conciliarLancamento: (id, conciliado) => apiRequest(`/financeiro/lancamentos/${id}`, { method: 'PUT', body: JSON.stringify({ conciliado }) }),
        excluirLancamento: (id) => apiRequest(`/financeiro/lancamentos/${id}`, { method: 'DELETE' })
    },
    usuarios: {
        listar: () => apiRequest('/usuarios'),
        vendedores: () => apiRequest('/usuarios/vendedores'),
        criar: (dados) => apiRequest('/usuarios', { method: 'POST', body: JSON.stringify(dados) }),
        alternarAtivo: (id) => apiRequest(`/usuarios/${id}/alternar-ativo`, { method: 'PUT' }),
        trocarSenha: (dados) => apiRequest('/usuarios/senha', { method: 'PUT', body: JSON.stringify(dados) })
    }
};

// Agrupa a lista plana de /api/modelos em [{ id, nome, marca, categoria, variacoes: [...] }]
// (usado pelos seletores "Produto pai → Variação")
function agruparPorPai(variacoes) {
    const mapa = new Map();
    variacoes.forEach(v => {
        const chave = v.produto_pai_id || `solto-${v.id}`;
        if (!mapa.has(chave)) {
            mapa.set(chave, { id: v.produto_pai_id || null, nome: v.pai_nome || v.nome, marca: v.marca, categoria: v.categoria, variacoes: [] });
        }
        mapa.get(chave).variacoes.push(v);
    });
    return [...mapa.values()].sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
}

// Evita que texto digitado (nome, observação...) quebre ou injete HTML na página
function esc(texto) {
    return String(texto ?? '').replace(/[&<>"']/g, c => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[c]));
}

function formatarMoeda(valor) {
    return Number(valor || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function formatarData(dataStr) {
    return new Date(dataStr).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

// Site para consultar se o aparelho está impedido pelo IMEI
const URL_CONSULTA_IMEI = 'https://www.consultaaparelhoimpedido.com.br/public-web/home?cid=1823914';

// Abre o site da consulta em outra aba e, se houver IMEI, já deixa copiado para você só colar lá
function consultarImei(imei, botao) {
    const numero = String(imei || '').replace(/\D/g, '');
    if (numero && navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(numero).then(() => {
            if (!botao) return;
            const original = botao.textContent;
            botao.textContent = 'IMEI copiado ✓';
            setTimeout(() => { botao.textContent = original; }, 2500);
        }).catch(() => {});
    }
    window.open(URL_CONSULTA_IMEI, '_blank', 'noopener');
}

document.addEventListener('DOMContentLoaded', () => {
    const elemUsuario = document.getElementById('usuario-logado');
    const usuario = getUsuarioLogado();
    if (elemUsuario && usuario) {
        elemUsuario.textContent = usuario.nome + (usuario.papel === 'admin' ? ' · admin' : '');
    }
    // Esconde links que são só para admin quando quem está logado é vendedor
    if (usuario && usuario.papel !== 'admin') {
        document.querySelectorAll('.somente-admin').forEach(el => el.style.display = 'none');
    }
});

// ---------- Metas do mês ----------
function mesAtualLocal() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function nomeDoMes(mes, comAno = true) {
    return new Date(mes + '-15T12:00:00').toLocaleDateString('pt-BR', comAno ? { month: 'long', year: 'numeric' } : { month: 'long' });
}

function formatarValorMeta(meta, valor) {
    return meta.tipo === 'valor' ? formatarMoeda(valor) : String(Math.round(valor));
}

// Desenha os cartões de progresso (usado no Dashboard e na tela "Meta do mês")
function renderizarCartoesMeta(metas) {
    if (!metas.length) return '<div class="empty-state" style="grid-column:1/-1;">Nenhuma meta definida para este mês.</div>';
    return metas.map(m => {
        const pct = m.percentual;
        const largura = pct === null ? 0 : Math.min(pct, 100);
        const batida = pct !== null && pct >= 100;
        const falta = Math.max(m.alvo - m.realizado, 0);
        const rodape = m.alvo <= 0 ? 'Defina a meta para acompanhar'
            : batida ? 'Meta batida! 🎉'
            : `Faltam ${formatarValorMeta(m, falta)}`;
        return `
            <div class="meta-card ${batida ? 'meta-batida' : ''}">
                <div class="meta-topo"><span class="meta-nome">${esc(m.nome)}</span><span class="meta-pct">${pct === null ? '—' : pct + '%'}</span></div>
                <div class="meta-numeros"><strong>${formatarValorMeta(m, m.realizado)}</strong> de ${m.alvo > 0 ? formatarValorMeta(m, m.alvo) : 'sem meta'}</div>
                <div class="meta-barra"><div class="meta-barra-fill" style="width:${largura}%"></div></div>
                <div class="meta-rodape">${rodape}</div>
            </div>`;
    }).join('');
}

// Coloca "Meta do mês" no menu de todas as páginas (logo abaixo de Relatórios)
document.addEventListener('DOMContentLoaded', () => {
    const relatorios = document.querySelector('.sidebar a[href="relatorios.html"]');
    if (!relatorios || document.querySelector('.sidebar a[href="metas.html"]')) return;
    const link = document.createElement('a');
    link.href = 'metas.html';
    link.className = 'nav-item' + (window.location.pathname.endsWith('metas.html') ? ' active' : '');
    link.innerHTML = '<span class="icon">🎯</span> Meta do mês';
    relatorios.insertAdjacentElement('afterend', link);
});


// ---------- Permissões por tipo de login ----------
// Vendedor só entra nestas páginas (Dashboard, Agenda, Pedidos de venda, Meta, Estoque).
// Todo o resto é só para administrador. A API também bloqueia (isto aqui é só a parte visual).
const PAGINAS_VENDEDOR = [
    'index.html', 'agenda.html', 'pedidos.html', 'novo-pedido.html', 'recibo.html', 'termo-troca.html',
    'metas.html', 'produtos.html', 'minha-conta.html', 'login.html'
];

(function protegerPorPapel() {
    const usuario = getUsuarioLogado();
    if (!usuario || usuario.papel === 'admin') return;
    const pagina = window.location.pathname.split('/').pop() || 'index.html';
    if (!PAGINAS_VENDEDOR.includes(pagina)) window.location.replace('index.html');
})();

document.addEventListener('DOMContentLoaded', () => {
    const usuario = getUsuarioLogado();
    if (!usuario || usuario.papel === 'admin') return;

    // Esconde do menu (e da barra do recibo) o que vendedor não pode abrir
    document.querySelectorAll('.sidebar a.nav-item, .rec-nav a').forEach(a => {
        const destino = (a.getAttribute('href') || '').split('?')[0];
        if (destino && destino !== '#' && !PAGINAS_VENDEDOR.includes(destino)) a.style.display = 'none';
    });

    // Esconde títulos de seção que ficaram sem nenhum item (ex.: "Cadastros")
    document.querySelectorAll('.sidebar .nav-section-label').forEach(rotulo => {
        let el = rotulo.nextElementSibling, algumVisivel = false;
        while (el && !el.classList.contains('nav-section-label') && !el.classList.contains('sidebar-footer')) {
            if (el.style.display !== 'none') algumVisivel = true;
            el = el.nextElementSibling;
        }
        if (!algumVisivel) rotulo.style.display = 'none';
    });
});


// ---------- Logs: avisos do navegador para o servidor ----------
// Avisa o servidor de algo que só o navegador sabe (saiu, abriu tela, imprimiu).
// Nunca atrapalha o uso: se falhar, ignora.
function registrarEvento(acao, extra = {}) {
    try {
        const token = getToken();
        if (!token) return;
        fetch(`${API_BASE}/logs/evento`, {
            method: 'POST',
            keepalive: true,
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
            body: JSON.stringify({ acao, ...extra })
        }).catch(() => {});
    } catch (e) { /* ignora */ }
}

api.logs = {
    listar: (params = '') => apiRequest(`/logs${params}`),
    detalhe: (id) => apiRequest(`/logs/${id}`)
};

// Registra cada tela aberta (só se a pessoa realmente tem acesso a ela)
(function avisarTelaAberta() {
    const pagina = window.location.pathname.split('/').pop() || 'index.html';
    if (pagina === 'login.html' || !getToken()) return;
    const usuario = getUsuarioLogado();
    if (usuario && usuario.papel !== 'admin' && !PAGINAS_VENDEDOR.includes(pagina)) return;
    registrarEvento('pagina.abrir', { pagina, id: new URLSearchParams(window.location.search).get('id') || undefined });
})();

// ---------- Menu "Administração" (só administrador) ----------
// Junta Lucro real, Equipe e Logs num menu suspenso na barra de cima.
document.addEventListener('DOMContentLoaded', () => {
    const usuario = getUsuarioLogado();
    const barra = document.querySelector('.sidebar');
    if (!usuario || usuario.papel !== 'admin' || !barra || barra.querySelector('.nav-grupo')) return;

    const itens = [
        ['lucro-real.html', '💰', 'Lucro real'],
        ['equipe.html', '🧑‍💼', 'Equipe'],
        ['logs.html', '📜', 'Logs']
    ];
    // Tira os links soltos (se a página ainda tiver) e põe tudo dentro do menu
    itens.forEach(([href]) => barra.querySelectorAll(`a.nav-item[href="${href}"]`).forEach(a => a.remove()));

    const pagina = window.location.pathname.split('/').pop() || 'index.html';
    const ativo = itens.some(([href]) => href === pagina);

    const grupo = document.createElement('div');
    grupo.className = 'nav-grupo' + (ativo ? ' aberto-ativo' : '');
    grupo.innerHTML = `
        <button type="button" class="nav-item nav-grupo-btn${ativo ? ' active' : ''}" aria-haspopup="true" aria-expanded="false">
            <span class="icon">🛡</span> Administração <span class="seta">▾</span>
        </button>
        <div class="nav-submenu">
            ${itens.map(([href, icone, nome]) =>
                `<a href="${href}" class="nav-item${href === pagina ? ' active' : ''}"><span class="icon">${icone}</span> ${nome}</a>`).join('')}
        </div>`;

    const rodape = barra.querySelector('.sidebar-footer');
    barra.insertBefore(grupo, rodape);

    const botao = grupo.querySelector('.nav-grupo-btn');
    const fechar = () => { grupo.classList.remove('aberto'); botao.setAttribute('aria-expanded', 'false'); };
    botao.addEventListener('click', (e) => {
        e.stopPropagation();
        const abrir = !grupo.classList.contains('aberto');
        if (abrir) {
            // Se o botão está perto da borda direita, abre o menu para a esquerda
            grupo.classList.toggle('alinha-direita', botao.getBoundingClientRect().left + 230 > window.innerWidth);
        }
        grupo.classList.toggle('aberto', abrir);
        botao.setAttribute('aria-expanded', String(abrir));
    });
    document.addEventListener('click', (e) => { if (!grupo.contains(e.target)) fechar(); });
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') fechar(); });
});
