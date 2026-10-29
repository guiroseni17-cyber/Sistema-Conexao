const API_BASE = '/api';

function getToken() {
    return localStorage.getItem('foneninja_token');
}

function getUsuarioLogado() {
    const dados = localStorage.getItem('foneninja_usuario');
    return dados ? JSON.parse(dados) : null;
}

function logout() {
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
