// =====================================================
// Produtos pai: lista com as variações dentro de cada um
// =====================================================
const rotulosCategoria = {
    aparelho_novo: 'Aparelho novo',
    aparelho_seminovo: 'Aparelho seminovo',
    acessorio: 'Acessório',
    peca: 'Peça'
};

let pais = [];
const abertos = new Set(); // ids dos pais que estão expandidos (mantém aberto depois de salvar)

function abrirModal(id) { document.getElementById(id).style.display = 'flex'; }
function fecharModal(id) { document.getElementById(id).style.display = 'none'; }

function criarEl(tag, classe, texto) {
    const e = document.createElement(tag);
    if (classe) e.className = classe;
    if (texto !== undefined) e.textContent = texto;
    return e;
}

function debounce(fn, delay) {
    let timer;
    return (...args) => { clearTimeout(timer); timer = setTimeout(() => fn(...args), delay); };
}

function acharPai(id) { return pais.find(p => p.id === Number(id)); }

// Colunas da tabela de variações = nomes dos atributos (Armazenamento, Cor...)
function colunasDoPai(pai) {
    const nomes = [];
    pai.variacoes.forEach(v => (v.atributos || []).forEach(a => { if (!nomes.includes(a.nome)) nomes.push(a.nome); }));
    return nomes;
}

function htmlVariacoes(pai) {
    if (pai.variacoes.length === 0) {
        return '<div class="pai-vazio">Nenhuma variação cadastrada. Use "+ Adicionar variações".</div>';
    }
    const colunas = colunasDoPai(pai);
    const nCols = Math.max(colunas.length, 1);
    const cabecalho = (colunas.length ? colunas : ['Variação']).map(c => `<th>${esc(c)}</th>`).join('');

    const linhas = pai.variacoes.map(v => {
        let celulas;
        if (colunas.length && v.atributos) {
            celulas = colunas.map(c => {
                const a = v.atributos.find(x => x.nome === c);
                return `<td>${a ? esc(a.valor) : '<span class="text-muted">-</span>'}</td>`;
            }).join('');
        } else {
            celulas = `<td colspan="${nCols}">${esc(v.rotulo)}</td>`;
        }
        return `
            <tr>
                ${celulas}
                <td class="text-right">${Number(v.preco_venda) > 0 ? formatarMoeda(v.preco_venda) : '-'}</td>
                <td class="text-right">${v.estoque > 0 ? `<span class="badge badge-green">${v.estoque}</span>` : '<span class="text-muted">0</span>'}</td>
                <td class="text-right">
                    <div class="row-actions">
                        <a class="btn btn-primary btn-sm" href="nova-compra.html?modelo=${v.id}">Dar entrada</a>
                        <button class="btn btn-secondary btn-sm" data-acao="editar-var" data-pai="${pai.id}" data-var="${v.id}">Editar</button>
                        <button class="btn btn-secondary btn-sm btn-perigo" data-acao="remover-var" data-pai="${pai.id}" data-var="${v.id}">Remover</button>
                    </div>
                </td>
            </tr>`;
    }).join('');

    return `
        <table>
            <thead><tr>${cabecalho}<th class="text-right">Preço sugerido</th><th class="text-right">Em estoque</th><th></th></tr></thead>
            <tbody>${linhas}</tbody>
        </table>`;
}

function renderizarPais() {
    const lista = document.getElementById('lista-pais');
    if (pais.length === 0) {
        lista.innerHTML = '<div class="panel"><div class="empty-state">Nenhum produto pai cadastrado. Clique em "+ Novo produto pai".</div></div>';
        return;
    }
    lista.innerHTML = pais.map(p => `
        <div class="pai-card ${abertos.has(p.id) ? 'aberto' : ''}" data-pai="${p.id}">
            <div class="pai-topo" data-acao="alternar" data-pai="${p.id}">
                <div>
                    <div class="pai-nome">${esc(p.nome)}</div>
                    <div class="pai-meta">${esc([p.marca, rotulosCategoria[p.categoria] || p.categoria].filter(Boolean).join(' · '))}</div>
                </div>
                <div class="pai-badges">
                    <span class="badge badge-gray">${p.total_variacoes} variaç${p.total_variacoes === 1 ? 'ão' : 'ões'}</span>
                    <span class="badge ${p.estoque_total > 0 ? 'badge-green' : 'badge-gray'}">${p.estoque_total} em estoque</span>
                    <span class="pai-seta">▸</span>
                </div>
            </div>
            <div class="pai-corpo">
                <div class="pai-acoes">
                    <button class="btn btn-secondary btn-sm" data-acao="editar-pai" data-pai="${p.id}">✎ Editar produto pai</button>
                    <button class="btn btn-secondary btn-sm" data-acao="add-var" data-pai="${p.id}">+ Adicionar variações</button>
                    <button class="btn btn-secondary btn-sm btn-perigo" data-acao="remover-pai" data-pai="${p.id}">Remover produto pai</button>
                </div>
                ${htmlVariacoes(p)}
            </div>
        </div>
    `).join('');
}

async function carregarPais() {
    const busca = document.getElementById('busca').value.trim();
    try {
        pais = await api.pais.listar(busca ? `?busca=${encodeURIComponent(busca)}` : '');
        if (busca && pais.length <= 3) pais.forEach(p => abertos.add(p.id));
        renderizarPais();
    } catch (err) {
        document.getElementById('lista-pais').innerHTML = `<div class="text-muted">Erro ao carregar: ${esc(err.message)}</div>`;
    }
}

document.getElementById('lista-pais').addEventListener('click', async (e) => {
    const alvo = e.target.closest('[data-acao]');
    if (!alvo) return;
    const { acao, pai: paiId, var: varId } = alvo.dataset;
    const pai = acharPai(paiId);

    if (acao === 'alternar') {
        if (abertos.has(pai.id)) abertos.delete(pai.id); else abertos.add(pai.id);
        alvo.closest('.pai-card').classList.toggle('aberto');
    } else if (acao === 'editar-pai') {
        abrirEdicaoPai(pai);
    } else if (acao === 'add-var') {
        abrirGerador(pai);
    } else if (acao === 'editar-var') {
        abrirEdicaoVariacao(pai, pai.variacoes.find(v => v.id === Number(varId)));
    } else if (acao === 'remover-var') {
        const v = pai.variacoes.find(x => x.id === Number(varId));
        if (!confirm(`Remover a variação "${v.nome}" do catálogo? Produtos que já entraram no estoque a partir dela não são afetados.`)) return;
        try { await api.pais.removerVariacao(pai.id, v.id); await carregarPais(); }
        catch (err) { alert('Erro ao remover variação: ' + err.message); }
    } else if (acao === 'remover-pai') {
        if (!confirm(`Remover o produto pai "${pai.nome}" e as ${pai.total_variacoes} variações do catálogo? O estoque e o histórico não são afetados.`)) return;
        try { await api.pais.remover(pai.id); abertos.delete(pai.id); await carregarPais(); }
        catch (err) { alert('Erro ao remover produto pai: ' + err.message); }
    }
});

document.getElementById('busca').addEventListener('input', debounce(carregarPais, 300));

// =====================================================
// Editar produto pai
// =====================================================
let paiEmEdicao = null;

function abrirEdicaoPai(pai) {
    paiEmEdicao = pai;
    document.getElementById('ep-nome').value = pai.nome;
    document.getElementById('ep-marca').value = pai.marca || '';
    document.getElementById('ep-venda').value = pai.preco_venda;
    document.getElementById('ep-categoria').value = pai.categoria;
    document.getElementById('ep-condicao').value = pai.condicao || 'novo';
    document.getElementById('ep-aplicar-preco').checked = false;
    abrirModal('modal-pai');
}

document.getElementById('form-pai').addEventListener('submit', async (e) => {
    e.preventDefault();
    try {
        const r = await api.pais.editar(paiEmEdicao.id, {
            nome: document.getElementById('ep-nome').value,
            marca: document.getElementById('ep-marca').value,
            preco_venda: document.getElementById('ep-venda').value,
            categoria: document.getElementById('ep-categoria').value,
            condicao: document.getElementById('ep-condicao').value,
            aplicar_preco: document.getElementById('ep-aplicar-preco').checked
        });
        fecharModal('modal-pai');
        await carregarPais();
        alert(r.mensagem);
    } catch (err) {
        alert('Erro ao salvar produto pai: ' + err.message);
    }
});

// =====================================================
// Editar uma variação
// =====================================================
let variacaoEmEdicao = null; // { pai, variacao }

function abrirEdicaoVariacao(pai, variacao) {
    variacaoEmEdicao = { pai, variacao };
    document.getElementById('ev-titulo').textContent = variacao.nome;
    const box = document.getElementById('ev-attrs');
    box.innerHTML = '';
    const attrs = variacao.atributos || [{ nome: 'Variação', valor: variacao.rotulo }];
    attrs.forEach((a, i) => {
        const grupo = criarEl('div', 'form-group');
        const label = criarEl('label', '', a.nome);
        const input = criarEl('input');
        input.type = 'text';
        input.value = a.valor;
        input.dataset.nome = a.nome;
        input.className = 'ev-valor';
        grupo.append(label, input);
        box.appendChild(grupo);
    });
    document.getElementById('ev-venda').value = variacao.preco_venda;
    abrirModal('modal-var');
}

document.getElementById('form-var').addEventListener('submit', async (e) => {
    e.preventDefault();
    const atributos = [...document.querySelectorAll('#ev-attrs .ev-valor')]
        .map(i => ({ nome: i.dataset.nome, valor: i.value.trim() }));
    if (atributos.some(a => !a.valor)) { alert('Preencha todos os campos da variação.'); return; }
    try {
        await api.pais.editarVariacao(variacaoEmEdicao.pai.id, variacaoEmEdicao.variacao.id, {
            atributos,
            preco_venda: document.getElementById('ev-venda').value
        });
        fecharModal('modal-var');
        await carregarPais();
    } catch (err) {
        alert('Erro ao salvar variação: ' + err.message);
    }
});

// =====================================================
// Gerador de variações (novo pai OU adicionar a um pai existente)
// =====================================================
let varModo = 'novo';          // 'novo' | 'adicionar'
let varPai = null;             // pai alvo quando varModo === 'adicionar'
let varAtributos = [];         // [{ nome, valores: [{ texto, ativo }] }]
let varDesmarcadas = new Set(); // combinações desmarcadas (minúsculo)
let varExistentes = new Set();  // variações que já existem nesse pai (minúsculo)
const VAR_MAX = 500;

document.getElementById('btn-novo-pai').addEventListener('click', () => abrirGerador(null));

function abrirGerador(pai) {
    varModo = pai ? 'adicionar' : 'novo';
    varPai = pai;
    varDesmarcadas = new Set();
    varExistentes = new Set(pai ? pai.variacoes.map(v => v.nome.trim().toLowerCase()) : []);

    document.getElementById('v-titulo').textContent = pai ? `Adicionar variações — ${pai.nome}` : 'Novo produto pai';
    const campoNome = document.getElementById('v-nome');
    campoNome.value = pai ? pai.nome : '';
    campoNome.readOnly = !!pai;
    document.querySelectorAll('#modal-variacoes .campo-novo').forEach(el => el.style.display = pai ? 'none' : '');
    ['v-marca', 'v-venda'].forEach(id => document.getElementById(id).value = '');
    document.getElementById('v-categoria').value = 'aparelho_novo';
    document.getElementById('v-condicao').value = 'novo';

    // Ao adicionar num pai que já tem atributos, reaproveita os mesmos nomes (Armazenamento, Cor...)
    const nomesAttr = pai ? colunasDoPai(pai) : [];
    varAtributos = (nomesAttr.length ? nomesAttr : ['Armazenamento', 'Cor'])
        .map(n => ({ nome: n, valores: [{ texto: '', ativo: true }] }));

    abrirModal('modal-variacoes');
    renderizarAtributos();
    renderizarVariacoes();
    (pai ? document.querySelector('#v-atributos .var-valor-input') : campoNome).focus();
}

// Separa "256GB, 512GB" em dois valores
function separarValoresPorVirgula(atributo, indice) {
    const partes = atributo.valores[indice].texto.split(',').map(t => t.trim()).filter(Boolean);
    if (partes.length <= 1) {
        atributo.valores[indice].texto = partes[0] || '';
        return;
    }
    atributo.valores.splice(indice, 1, ...partes.map(t => ({ texto: t, ativo: true })));
}

function renderizarAtributos(focarAtributo) {
    const box = document.getElementById('v-atributos');
    box.innerHTML = '';

    varAtributos.forEach((attr, ai) => {
        const bloco = criarEl('div', 'var-attr');

        const topo = criarEl('div', 'var-attr-topo');
        const nome = criarEl('input');
        nome.type = 'text';
        nome.placeholder = 'Atributo (ex: Cor)';
        nome.value = attr.nome;
        nome.addEventListener('input', () => { attr.nome = nome.value; renderizarVariacoes(); });

        const btnValor = criarEl('button', 'btn btn-secondary btn-sm', '+ Valor');
        btnValor.type = 'button';
        btnValor.addEventListener('click', () => {
            attr.valores.push({ texto: '', ativo: true });
            renderizarAtributos(ai);
        });

        const btnDel = criarEl('button', 'btn btn-secondary btn-sm', '🗑');
        btnDel.type = 'button';
        btnDel.title = 'Remover atributo';
        btnDel.addEventListener('click', () => {
            varAtributos.splice(ai, 1);
            renderizarAtributos();
            renderizarVariacoes();
        });

        topo.append(nome, btnValor, btnDel);
        bloco.appendChild(topo);

        attr.valores.forEach((valor, vi) => {
            const linha = criarEl('div', 'var-valor');

            const chk = criarEl('input');
            chk.type = 'checkbox';
            chk.checked = valor.ativo;
            chk.addEventListener('change', () => { valor.ativo = chk.checked; renderizarVariacoes(); });

            const txt = criarEl('input', 'var-valor-input');
            txt.type = 'text';
            txt.placeholder = 'Valor (ex: 256GB) — separe vários por vírgula';
            txt.value = valor.texto;
            txt.addEventListener('input', () => { valor.texto = txt.value; renderizarVariacoes(); });
            txt.addEventListener('change', () => {
                if (txt.value.includes(',')) {
                    valor.texto = txt.value;
                    separarValoresPorVirgula(attr, vi);
                    renderizarAtributos();
                    renderizarVariacoes();
                }
            });
            txt.addEventListener('keydown', (ev) => {
                if (ev.key !== 'Enter') return;
                ev.preventDefault();
                valor.texto = txt.value;
                separarValoresPorVirgula(attr, vi);
                if (attr.valores[attr.valores.length - 1].texto.trim() !== '') {
                    attr.valores.push({ texto: '', ativo: true });
                }
                renderizarAtributos(ai);
                renderizarVariacoes();
            });

            const del = criarEl('button', 'btn btn-secondary btn-sm', '🗑');
            del.type = 'button';
            del.title = 'Remover valor';
            del.addEventListener('click', () => {
                attr.valores.splice(vi, 1);
                renderizarAtributos();
                renderizarVariacoes();
            });

            linha.append(chk, txt, del);
            bloco.appendChild(linha);
        });

        box.appendChild(bloco);
    });

    if (focarAtributo !== undefined) {
        const campos = box.querySelectorAll('.var-attr')[focarAtributo].querySelectorAll('.var-valor-input');
        if (campos.length) campos[campos.length - 1].focus();
    }
}

// Todas as combinações: um valor de cada atributo, na ordem dos atributos.
// Retorna { lista: [{ nome, atributos }], total }; lista fica vazia se passar do limite.
function gerarCombinacoes() {
    const base = document.getElementById('v-nome').value.trim();
    if (!base) return { lista: [], total: 0 };

    const grupos = varAtributos
        .map(a => {
            const vistos = new Set();
            const valores = a.valores
                .filter(v => v.ativo && v.texto.trim())
                .map(v => v.texto.trim())
                .filter(t => { const k = t.toLowerCase(); if (vistos.has(k)) return false; vistos.add(k); return true; });
            return { nome: a.nome.trim() || 'Atributo', valores };
        })
        .filter(g => g.valores.length > 0);

    if (grupos.length === 0) return { lista: [], total: 0 };

    const total = grupos.reduce((n, g) => n * g.valores.length, 1);
    if (total > 5000) return { lista: [], total };

    let combos = [[]];
    grupos.forEach(g => {
        const proximo = [];
        combos.forEach(c => g.valores.forEach(v => proximo.push([...c, { nome: g.nome, valor: v }])));
        combos = proximo;
    });

    const lista = [];
    const vistos = new Set();
    combos.forEach(c => {
        const nome = [base, ...c.map(x => x.valor)].join(' ');
        const k = nome.toLowerCase();
        if (!vistos.has(k)) { vistos.add(k); lista.push({ nome, atributos: c }); }
    });
    return { lista, total: lista.length };
}

function variacoesSelecionadas() {
    return gerarCombinacoes().lista.filter(c => {
        const k = c.nome.toLowerCase();
        return !varDesmarcadas.has(k) && !varExistentes.has(k);
    });
}

function nomeDePaiJaExiste() {
    if (varModo !== 'novo') return false;
    const nome = document.getElementById('v-nome').value.trim().toLowerCase();
    return !!nome && pais.some(p => p.nome.trim().toLowerCase() === nome);
}

function atualizarResumoVariacoes() {
    const { lista, total } = gerarCombinacoes();
    const selecionadas = variacoesSelecionadas();
    const jaExiste = nomeDePaiJaExiste();

    const aviso = document.getElementById('v-aviso-nome');
    aviso.style.display = jaExiste ? 'block' : 'none';
    aviso.textContent = jaExiste ? 'Já existe um produto pai com esse nome. Abra ele na lista e use "+ Adicionar variações".' : '';

    document.getElementById('v-resumo').textContent = `${lista.length} variações - ${selecionadas.length} selecionadas`;
    const btn = document.getElementById('v-salvar');
    btn.textContent = selecionadas.length ? `Cadastrar ${selecionadas.length} variaç${selecionadas.length === 1 ? 'ão' : 'ões'}` : 'Cadastrar';
    btn.disabled = jaExiste || selecionadas.length === 0 || selecionadas.length > VAR_MAX || total > 5000;
}

function renderizarVariacoes() {
    const lista = document.getElementById('v-lista');
    lista.innerHTML = '';
    const { lista: combos, total } = gerarCombinacoes();

    if (!document.getElementById('v-nome').value.trim()) {
        lista.appendChild(criarEl('div', 'var-vazio', 'Informe o produto pai para gerar as variações.'));
    } else if (total > VAR_MAX) {
        lista.appendChild(criarEl('div', 'var-vazio', `Muitas combinações (${total}). O máximo é ${VAR_MAX} por vez — desmarque alguns valores.`));
    } else if (combos.length === 0) {
        lista.appendChild(criarEl('div', 'var-vazio', 'Preencha os valores dos atributos (ex: 256GB, Laranja).'));
    } else {
        combos.forEach(c => {
            const k = c.nome.toLowerCase();
            const existe = varExistentes.has(k);
            const linha = criarEl('label', 'var-item' + (existe ? ' desabilitado' : ''));
            const chk = criarEl('input');
            chk.type = 'checkbox';
            chk.checked = !existe && !varDesmarcadas.has(k);
            chk.disabled = existe;
            chk.addEventListener('change', () => {
                if (chk.checked) varDesmarcadas.delete(k); else varDesmarcadas.add(k);
                atualizarResumoVariacoes();
            });
            linha.append(chk, criarEl('span', '', c.nome));
            if (existe) linha.appendChild(criarEl('span', 'badge badge-gray', 'já cadastrado'));
            lista.appendChild(linha);
        });
    }
    atualizarResumoVariacoes();
}

document.getElementById('v-nome').addEventListener('input', renderizarVariacoes);
document.getElementById('v-add-atributo').addEventListener('click', () => {
    varAtributos.push({ nome: '', valores: [{ texto: '', ativo: true }] });
    renderizarAtributos();
});
document.getElementById('v-marcar-todas').addEventListener('click', () => {
    varDesmarcadas = new Set();
    renderizarVariacoes();
});
document.getElementById('v-desmarcar-todas').addEventListener('click', () => {
    gerarCombinacoes().lista.forEach(c => varDesmarcadas.add(c.nome.toLowerCase()));
    renderizarVariacoes();
});

document.getElementById('v-salvar').addEventListener('click', async () => {
    const selecionadas = variacoesSelecionadas();
    if (selecionadas.length === 0) return;
    const btn = document.getElementById('v-salvar');
    btn.disabled = true;
    const variacoes = selecionadas.map(c => ({ atributos: c.atributos }));
    try {
        let r;
        if (varModo === 'adicionar') {
            r = await api.pais.adicionarVariacoes(varPai.id, variacoes);
            abertos.add(varPai.id);
        } else {
            r = await api.pais.criar({
                nome: document.getElementById('v-nome').value.trim(),
                categoria: document.getElementById('v-categoria').value,
                condicao: document.getElementById('v-condicao').value,
                marca: document.getElementById('v-marca').value.trim(),
                preco_venda: Number(document.getElementById('v-venda').value) || 0,
                variacoes
            });
            abertos.add(r.id);
        }
        fecharModal('modal-variacoes');
        await carregarPais();
        alert(r.mensagem);
    } catch (err) {
        alert('Erro ao cadastrar: ' + err.message);
        btn.disabled = false;
    }
});

carregarPais();
