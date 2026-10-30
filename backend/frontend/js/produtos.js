const rotulosCategoria = {
    iphone: 'iPhone',
    acessorio: 'Acessórios',
    blindagem: 'Blindagem',
    seguro: 'Seguro'
};
// Só acessório e blindagem têm alerta de estoque mínimo
const usaEstoqueMinimo = c => c === 'acessorio' || c === 'blindagem';

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
                <td class="text-right">${usaEstoqueMinimo(p.categoria) && p.estoque_minimo > 0 && p.quantidade <= p.estoque_minimo ? `<span class="badge ${p.quantidade === 0 ? 'badge-red' : 'badge-amber'}">${p.quantidade}</span>` : p.quantidade}</td>
                <td class="text-right">${formatarMoeda(p.preco_venda)}</td>
                <td class="text-right">
                    <div class="row-actions">
                        ${p.imei ? `<button class="btn btn-secondary btn-sm" data-imei="${esc(p.imei)}" title="Abre o site de consulta e copia o IMEI" onclick="consultarImei(this.dataset.imei, this)">Consultar IMEI</button>` : ''}
                        <button class="btn btn-secondary btn-sm" data-nome="${esc(p.nome)}" onclick="verHistorico(${p.id}, this.dataset.nome)">Histórico</button>
                        ${getUsuarioLogado()?.papel === 'admin' ? `<button class="btn btn-secondary btn-sm" onclick="editarProduto(${p.id})">Editar</button>` : ''}
                    </div>
                </td>
            </tr>
        `).join('') : '<tr><td colspan="7" class="empty-state">Nenhum produto encontrado</td></tr>';
    } catch (err) {
        tabela.innerHTML = `<tr><td colspan="7" class="text-muted">Erro ao carregar: ${err.message}</td></tr>`;
    }
}

// ---------- Entrada manual a partir de um produto pai ----------
let catalogoPais = []; // [{ id, nome, variacoes: [...] }] — só referência, não é estoque

async function carregarCatalogoPais() {
    try {
        catalogoPais = agruparPorPai(await api.modelos.listar());
    } catch (err) {
        console.error('Não foi possível carregar os produtos pai:', err);
        catalogoPais = [];
    }
    const sel = document.getElementById('p-pai');
    sel.innerHTML = '<option value="">Sem produto pai (cadastro avulso)</option>';
    catalogoPais.forEach((pai, i) => {
        const opt = document.createElement('option');
        opt.value = i; // índice no catálogo
        opt.textContent = `${pai.nome} (${pai.variacoes.length} variações)`;
        sel.appendChild(opt);
    });
}

function trocarPaiEntrada() {
    const selVar = document.getElementById('p-variacao');
    const pai = catalogoPais[document.getElementById('p-pai').value];
    document.getElementById('form-produto').dataset.modeloBaseId = '';
    selVar.innerHTML = '';
    if (!pai) {
        selVar.disabled = true;
        selVar.innerHTML = '<option value="">Escolha o produto pai primeiro</option>';
        return;
    }
    selVar.disabled = false;
    selVar.innerHTML = '<option value="">Selecione a variação...</option>';
    pai.variacoes.forEach(v => {
        const opt = document.createElement('option');
        opt.value = v.id;
        opt.textContent = `${v.rotulo}${v.estoque > 0 ? ` (estoque: ${v.estoque})` : ''}`;
        selVar.appendChild(opt);
    });
}

function escolherVariacaoEntrada() {
    const pai = catalogoPais[document.getElementById('p-pai').value];
    const v = pai && pai.variacoes.find(x => String(x.id) === document.getElementById('p-variacao').value);
    const form = document.getElementById('form-produto');
    if (!v) { form.dataset.modeloBaseId = ''; return; }
    form.dataset.modeloBaseId = v.id;
    document.getElementById('p-nome').value = v.nome;
    document.getElementById('p-categoria').value = v.categoria;
        atualizarCampoEstoqueMinimo();
    document.getElementById('p-condicao').value = v.condicao || 'novo';
    document.getElementById('p-marca').value = v.marca || '';
    document.getElementById('p-modelo').value = v.modelo || pai.nome;
    if (Number(v.preco_venda) > 0) document.getElementById('p-venda').value = v.preco_venda;
    document.getElementById('p-quantidade').focus();
}

document.getElementById('p-pai').addEventListener('change', trocarPaiEntrada);
document.getElementById('p-variacao').addEventListener('change', escolherVariacaoEntrada);

async function abrirModalProduto() {
    const form = document.getElementById('form-produto');
    form.reset();
    atualizarCampoEstoqueMinimo();
    atualizarCustoInfo();
    delete form.dataset.editId;
    form.dataset.modeloBaseId = '';
    document.getElementById('titulo-modal-produto').textContent = 'Entrada manual';
    document.getElementById('p-pai-box').style.display = '';
    document.getElementById('modal-produto').style.display = 'flex';
    await carregarCatalogoPais();
    trocarPaiEntrada();
}

function fecharModalProduto() {
    document.getElementById('modal-produto').style.display = 'none';
}
// Mostra só o que faz sentido para a categoria: IMEI, serial, bateria e condição são de iPhone;
// estoque mínimo é de acessório e blindagem.
function atualizarCampoEstoqueMinimo() {
    const cat = document.getElementById('p-categoria').value;
    document.querySelectorAll('#form-produto .campo-iphone').forEach(el => el.style.display = cat === 'iphone' ? '' : 'none');
    document.getElementById('p-estoque-minimo').closest('.form-group').style.display = usaEstoqueMinimo(cat) ? '' : 'none';
}

function atualizarCustoInfo() {
    const compra = Number(document.getElementById('p-compra').value) || 0;
    const desconto = Number(document.getElementById('p-desconto').value) || 0;
    document.getElementById('p-custo-info').textContent = formatarMoeda(Math.max(compra - desconto, 0));
}
['p-compra', 'p-desconto'].forEach(id => document.getElementById(id).addEventListener('input', atualizarCustoInfo));
document.getElementById('p-categoria').addEventListener('change', atualizarCampoEstoqueMinimo);

async function editarProduto(id) {
    const p = await api.produtos.buscar(id);
    document.getElementById('p-nome').value = p.nome;
    document.getElementById('p-categoria').value = p.categoria;
    document.getElementById('p-condicao').value = p.condicao;
    document.getElementById('p-marca').value = p.marca || '';
    document.getElementById('p-modelo').value = p.modelo || '';
    document.getElementById('p-imei').value = p.imei || '';
    document.getElementById('p-imei2').value = p.imei2 || '';
    document.getElementById('p-serial').value = p.numero_serie || '';
    document.getElementById('p-bateria').value = p.bateria ?? '';
    const selGarantia = document.getElementById('p-garantia');
    if (p.garantia && ![...selGarantia.options].some(o => o.value === p.garantia)) selGarantia.add(new Option(p.garantia, p.garantia));
    selGarantia.value = p.garantia || 'Sem garantia';
    document.getElementById('p-quantidade').value = p.quantidade;
    document.getElementById('p-estoque-minimo').value = p.estoque_minimo;
    atualizarCampoEstoqueMinimo();
    // O estoque guarda só o custo (compra − desconto): mostra como preço de compra, sem desconto
    document.getElementById('p-compra').value = p.preco_custo ?? '';
    document.getElementById('p-desconto').value = '';
    atualizarCustoInfo();
    document.getElementById('p-venda').value = p.preco_venda || '';
    document.getElementById('p-atacado').value = p.preco_venda_atacado ?? '';
    document.getElementById('p-obs').value = p.observacoes || '';
    document.getElementById('form-produto').dataset.editId = id;
    document.getElementById('titulo-modal-produto').textContent = 'Editar produto';
    document.getElementById('p-pai-box').style.display = 'none';
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
    const categoria = document.getElementById('p-categoria').value;
    const ehIphone = categoria === 'iphone';
    const valor = id => document.getElementById(id).value.trim();
    const dados = {
        nome: valor('p-nome'),
        categoria,
        condicao: ehIphone ? document.getElementById('p-condicao').value : 'novo',
        marca: valor('p-marca'),
        modelo: valor('p-modelo'),
        // IMEI, serial e bateria só existem em iPhone
        imei: ehIphone ? valor('p-imei') : '',
        imei2: ehIphone ? valor('p-imei2') : '',
        numero_serie: ehIphone ? valor('p-serial') : '',
        bateria: ehIphone ? valor('p-bateria') : '',
        garantia: document.getElementById('p-garantia').value,
        quantidade: Number(document.getElementById('p-quantidade').value),
        estoque_minimo: Number(document.getElementById('p-estoque-minimo').value),
        preco_compra: Number(valor('p-compra')) || 0,
        desconto: Number(valor('p-desconto')) || 0,
        preco_venda: Number(valor('p-venda')) || 0,
        preco_venda_atacado: valor('p-atacado'),
        observacoes: valor('p-obs')
    };

    const editId = e.target.dataset.editId;
    try {
        if (editId) {
            await api.produtos.editar(editId, dados);
            delete e.target.dataset.editId;
        } else {
            if (e.target.dataset.modeloBaseId) dados.modelo_base_id = Number(e.target.dataset.modeloBaseId);
            const r = await api.produtos.criar(dados);
            if (r.somado) alert(r.mensagem);
        }
        fecharModalProduto();
        carregarProdutos();
    } catch (err) {
        alert('Erro ao salvar produto: ' + err.message);
    }
});

document.getElementById('busca').addEventListener('input', debounce(carregarProdutos, 300));
document.getElementById('filtro-categoria').addEventListener('change', carregarProdutos);
document.getElementById('filtro-estoque').addEventListener('change', carregarProdutos);

function debounce(fn, delay) {
    let timer;
    return (...args) => {
        clearTimeout(timer);
        timer = setTimeout(() => fn(...args), delay);
    };
}

carregarProdutos();
