const rotulosCategoria = {
    aparelho_novo: 'Aparelho novo',
    aparelho_seminovo: 'Aparelho seminovo',
    acessorio: 'Acessório',
    peca: 'Peça'
};

const rotulosMovimento = {
    entrada_compra: 'Entrada (compra)',
    entrada_troca: 'Entrada (troca)',
    saida_venda: 'Saída (venda)',
    estorno_venda: 'Estorno (cancelamento)',
    ajuste_manual: 'Ajuste manual'
};

async function carregarProdutos() {
    const busca = document.getElementById('busca').value;
    const categoria = document.getElementById('filtro-categoria').value;
    const params = new URLSearchParams();
    if (busca) params.set('busca', busca);
    if (categoria) params.set('categoria', categoria);

    const tabela = document.getElementById('tabela-produtos');
    try {
        let produtos = await api.produtos.listar(`?${params.toString()}`);
        const filtroEstoque = document.getElementById('filtro-estoque').value;
        if (filtroEstoque === 'com') produtos = produtos.filter(p => p.quantidade > 0);
        if (filtroEstoque === 'sem') produtos = produtos.filter(p => p.quantidade <= 0);
        tabela.innerHTML = produtos.length ? produtos.map(p => `
            <tr>
                <td><strong>${esc(p.nome)}</strong>${p.modelo ? `<div class="text-muted" style="font-size:12px;">${esc(p.modelo)}</div>` : ''}</td>
                <td>${rotulosCategoria[p.categoria] || p.categoria}</td>
                <td class="text-muted">${esc(p.imei || '-')}</td>
                                <td>${p.origem === 'troca'
                    ? `<span class="badge badge-green" title="Pedido #${p.troca_pedido_id}">${p.troca_cliente_nome ? 'De: ' + esc(p.troca_cliente_nome) : 'Troca'}${p.troca_pedido_id ? ' (#' + p.troca_pedido_id + ')' : ''}</span>`
                    : '<span class="badge badge-gray">Compra</span>'}</td>
                <td class="text-right">${p.estoque_minimo > 0 && p.quantidade <= p.estoque_minimo ? `<span class="badge ${p.quantidade === 0 ? 'badge-red' : 'badge-amber'}">${p.quantidade}</span>` : p.quantidade}</td>
                <td class="text-right">${formatarMoeda(p.preco_venda)}</td>
                <td class="text-right">
                    <div class="row-actions">
                        <button class="btn btn-secondary btn-sm" data-nome="${esc(p.nome)}" onclick="verHistorico(${p.id}, this.dataset.nome)">Histórico</button>
                        <button class="btn btn-secondary btn-sm" onclick="editarProduto(${p.id})">Editar</button>
                    </div>
                </td>
            </tr>
        `).join('') : '<tr><td colspan="7" class="empty-state">Nenhum produto encontrado</td></tr>';
    } catch (err) {
        tabela.innerHTML = `<tr><td colspan="7" class="text-muted">Erro ao carregar: ${err.message}</td></tr>`;
    }
}

async function carregarModelos() {
    const tabela = document.getElementById('tabela-modelos');
    const busca = document.getElementById('busca').value;
    try {
        const modelos = await api.modelos.listar(busca ? `?busca=${encodeURIComponent(busca)}` : '');
        tabela.innerHTML = modelos.length ? modelos.map(m => `
            <tr>
                <td><strong>${esc(m.nome)}</strong>${m.modelo ? `<div class="text-muted" style="font-size:12px;">${esc(m.modelo)}</div>` : ''}</td>
                <td>${rotulosCategoria[m.categoria] || m.categoria}</td>
                <td class="text-right">${Number(m.preco_venda) > 0 ? formatarMoeda(m.preco_venda) : '-'}</td>
                <td class="text-right">
                    <div class="row-actions">
                        <a class="btn btn-primary btn-sm" href="nova-compra.html?modelo=${m.id}">Dar entrada</a>
                        <button class="btn btn-secondary btn-sm" data-nome="${esc(m.nome)}" onclick="removerModelo(${m.id}, this.dataset.nome)">Remover</button>
                    </div>
                </td>
            </tr>
        `).join('') : '<tr><td colspan="4" class="empty-state">Nenhum modelo base cadastrado</td></tr>';
    } catch (err) {
        tabela.innerHTML = `<tr><td colspan="4" class="text-muted">Erro ao carregar: ${err.message}</td></tr>`;
    }
}

async function removerModelo(id, nome) {
    if (!confirm(`Remover o modelo base "${nome}"? Produtos que já entraram no estoque a partir dele não são afetados.`)) return;
    try {
        await api.modelos.remover(id);
        carregarModelos();
    } catch (err) {
        alert('Erro ao remover modelo: ' + err.message);
    }
}

function abrirModalProduto() {
    document.getElementById('form-produto').reset();
    delete document.getElementById('form-produto').dataset.editId;
    document.getElementById('modal-produto').style.display = 'flex';
}

function fecharModalProduto() {
    document.getElementById('modal-produto').style.display = 'none';
}

async function editarProduto(id) {
    const p = await api.produtos.buscar(id);
    document.getElementById('p-nome').value = p.nome;
    document.getElementById('p-categoria').value = p.categoria;
    document.getElementById('p-condicao').value = p.condicao;
    document.getElementById('p-marca').value = p.marca || '';
    document.getElementById('p-modelo').value = p.modelo || '';
    document.getElementById('p-imei').value = p.imei || '';
    document.getElementById('p-quantidade').value = p.quantidade;
    document.getElementById('p-estoque-minimo').value = p.estoque_minimo;
    document.getElementById('p-custo').value = p.preco_custo;
    document.getElementById('p-venda').value = p.preco_venda;
    document.getElementById('p-obs').value = p.observacoes || '';
    document.getElementById('form-produto').dataset.editId = id;
    document.getElementById('modal-produto').style.display = 'flex';
}

async function verHistorico(id, nome) {
    document.getElementById('titulo-historico').textContent = `Histórico — ${nome}`;
    const tabela = document.getElementById('tabela-historico');
    tabela.innerHTML = '<tr><td colspan="5" class="text-muted">Carregando...</td></tr>';
    document.getElementById('modal-historico').style.display = 'flex';

    try {
        const movimentos = await api.produtos.historico(id);
        tabela.innerHTML = movimentos.length ? movimentos.map(m => `
            <tr>
                <td class="text-muted">${formatarData(m.criado_em)}</td>
                <td>${rotulosMovimento[m.tipo] || m.tipo}</td>
                <td class="text-right" style="color:${m.quantidade > 0 ? 'var(--green)' : 'var(--accent-dark)'};">${m.quantidade > 0 ? '+' : ''}${m.quantidade}</td>
                <td class="text-muted">${esc(m.referencia || '-')}</td>
                <td class="text-muted">${esc(m.usuario_nome || '-')}</td>
            </tr>
        `).join('') : '<tr><td colspan="5" class="empty-state">Nenhuma movimentação registrada</td></tr>';
    } catch (err) {
        tabela.innerHTML = `<tr><td colspan="5" class="text-muted">Erro: ${err.message}</td></tr>`;
    }
}

function fecharModalHistorico() {
    document.getElementById('modal-historico').style.display = 'none';
}

document.getElementById('form-produto').addEventListener('submit', async (e) => {
    e.preventDefault();
    const dados = {
        nome: document.getElementById('p-nome').value,
        categoria: document.getElementById('p-categoria').value,
        condicao: document.getElementById('p-condicao').value,
        marca: document.getElementById('p-marca').value,
        modelo: document.getElementById('p-modelo').value,
        imei: document.getElementById('p-imei').value,
        quantidade: Number(document.getElementById('p-quantidade').value),
        estoque_minimo: Number(document.getElementById('p-estoque-minimo').value),
        preco_custo: Number(document.getElementById('p-custo').value),
        preco_venda: Number(document.getElementById('p-venda').value),
        observacoes: document.getElementById('p-obs').value
    };

    const editId = e.target.dataset.editId;
    try {
        if (editId) {
            await api.produtos.editar(editId, dados);
            delete e.target.dataset.editId;
        } else {
            await api.produtos.criar(dados);
        }
        fecharModalProduto();
        carregarProdutos();
    } catch (err) {
        alert('Erro ao salvar produto: ' + err.message);
    }
});

document.getElementById('busca').addEventListener('input', debounce(() => { carregarProdutos(); carregarModelos(); }, 300));
document.getElementById('filtro-categoria').addEventListener('change', carregarProdutos);
document.getElementById('filtro-estoque').addEventListener('change', carregarProdutos);

function debounce(fn, delay) {
    let timer;
    return (...args) => {
        clearTimeout(timer);
        timer = setTimeout(() => fn(...args), delay);
    };
}

// =====================================================
// Cadastro com variações (produto pai + atributos)
// =====================================================
let varAtributos = [];          // [{ nome, valores: [{ texto, ativo }] }]
let varDesmarcadas = new Set(); // variações que o usuário desmarcou (minúsculo)
let varExistentes = new Set();  // nomes já cadastrados (minúsculo)
const VAR_MAX = 500;

function criarEl(tag, classe, texto) {
    const e = document.createElement(tag);
    if (classe) e.className = classe;
    if (texto !== undefined) e.textContent = texto;
    return e;
}

async function abrirModalVariacoes() {
    ['v-nome', 'v-marca', 'v-venda'].forEach(id => document.getElementById(id).value = '');
    document.getElementById('v-categoria').value = 'aparelho_novo';
    document.getElementById('v-condicao').value = 'novo';
    varAtributos = [
        { nome: 'Armazenamento', valores: [{ texto: '', ativo: true }] },
        { nome: 'Cor', valores: [{ texto: '', ativo: true }] }
    ];
    varDesmarcadas = new Set();
    varExistentes = new Set();
    document.getElementById('modal-variacoes').style.display = 'flex';
    renderizarAtributos();
    renderizarVariacoes();
    try {
        const [produtos, modelos] = await Promise.all([api.produtos.listar(), api.modelos.listar()]);
        varExistentes = new Set([...produtos, ...modelos].map(p => String(p.nome).trim().toLowerCase()));
        renderizarVariacoes();
    } catch (err) {
        console.error('Não foi possível checar produtos já cadastrados:', err);
    }
}

function fecharModalVariacoes() {
    document.getElementById('modal-variacoes').style.display = 'none';
}

// Separa "256GB, 512GB" em dois valores
function separarValoresPorVirgula(atributo, indice) {
    const partes = atributo.valores[indice].texto.split(',').map(t => t.trim()).filter(Boolean);
    if (partes.length <= 1) {
        atributo.valores[indice].texto = partes[0] || '';
        return;
    }
    const novos = partes.map(t => ({ texto: t, ativo: true }));
    atributo.valores.splice(indice, 1, ...novos);
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

// Todas as combinações: produto pai + um valor de cada atributo (na ordem dos atributos)
function gerarNomesVariacoes() {
    const base = document.getElementById('v-nome').value.trim();
    if (!base) return [];

    const grupos = varAtributos
        .map(a => {
            const vistos = new Set();
            return a.valores
                .filter(v => v.ativo && v.texto.trim())
                .map(v => v.texto.trim())
                .filter(t => { const k = t.toLowerCase(); if (vistos.has(k)) return false; vistos.add(k); return true; });
        })
        .filter(g => g.length > 0);

    let combos = [[]];
    grupos.forEach(grupo => {
        const proximo = [];
        combos.forEach(c => grupo.forEach(v => proximo.push([...c, v])));
        combos = proximo;
    });

    const nomes = [];
    const vistos = new Set();
    combos.forEach(c => {
        const nome = [base, ...c].join(' ');
        if (!vistos.has(nome.toLowerCase())) { vistos.add(nome.toLowerCase()); nomes.push(nome); }
    });
    return nomes;
}

function variacoesSelecionadas() {
    return gerarNomesVariacoes().filter(n => {
        const k = n.toLowerCase();
        return !varDesmarcadas.has(k) && !varExistentes.has(k);
    });
}

function atualizarResumoVariacoes() {
    const todas = gerarNomesVariacoes();
    const selecionadas = variacoesSelecionadas();
    document.getElementById('v-resumo').textContent = `${todas.length} variações - ${selecionadas.length} selecionadas`;
    const btn = document.getElementById('v-salvar');
    btn.textContent = selecionadas.length ? `Cadastrar ${selecionadas.length} modelo${selecionadas.length === 1 ? '' : 's'} base` : 'Cadastrar';
    btn.disabled = selecionadas.length === 0 || selecionadas.length > VAR_MAX;
}

function renderizarVariacoes() {
    const lista = document.getElementById('v-lista');
    lista.innerHTML = '';
    const nomes = gerarNomesVariacoes();

    if (!document.getElementById('v-nome').value.trim()) {
        lista.appendChild(criarEl('div', 'var-vazio', 'Informe o produto pai para gerar as variações.'));
    } else if (nomes.length > VAR_MAX) {
        lista.appendChild(criarEl('div', 'var-vazio', `Muitas combinações (${nomes.length}). O máximo é ${VAR_MAX} por vez — desmarque alguns valores.`));
    } else {
        nomes.forEach(nome => {
            const k = nome.toLowerCase();
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
            linha.append(chk, criarEl('span', '', nome));
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
    gerarNomesVariacoes().forEach(n => varDesmarcadas.add(n.toLowerCase()));
    renderizarVariacoes();
});

document.getElementById('v-salvar').addEventListener('click', async () => {
    const nomes = variacoesSelecionadas();
    if (nomes.length === 0) return;
    const btn = document.getElementById('v-salvar');
    btn.disabled = true;
    try {
        const r = await api.modelos.criarLote({
            nomes,
            categoria: document.getElementById('v-categoria').value,
            condicao: document.getElementById('v-condicao').value,
            marca: document.getElementById('v-marca').value.trim(),
            modelo: document.getElementById('v-nome').value.trim(),
            preco_venda: Number(document.getElementById('v-venda').value) || 0
        });
        fecharModalVariacoes();
        carregarModelos();
        alert(r.mensagem);
    } catch (err) {
        alert('Erro ao cadastrar variações: ' + err.message);
        btn.disabled = false;
    }
});

carregarProdutos();
carregarModelos();
