let produtosDisponiveis = [];
let contadorItens = 0;

const params = new URLSearchParams(window.location.search);
const pedidoIdEdicao = params.get('id');
let valorTrocaExistente = 0; // valor_troca já registrado no pedido (quando editando)

async function inicializar() {
    // Carrega clientes
    const clientes = await api.clientes.listar();
    const selectCliente = document.getElementById('cliente_id');
    clientes.forEach(c => {
        const opt = document.createElement('option');
        opt.value = c.id;
        opt.textContent = `${c.nome}${c.telefone ? ' - ' + c.telefone : ''}`;
        selectCliente.appendChild(opt);
    });

    // Carrega produtos disponíveis em estoque
    produtosDisponiveis = await api.produtos.listar('?busca=');
    produtosDisponiveis = produtosDisponiveis.filter(p => p.quantidade > 0);

    if (pedidoIdEdicao) {
        await carregarPedidoParaEdicao();
    } else {
        adicionarItem(); // pedido novo já começa com 1 linha de item
    }

    calcularResumo();
}

async function carregarPedidoParaEdicao() {
    document.getElementById('titulo-pagina').textContent = `Editar pedido #${pedidoIdEdicao}`;
    document.getElementById('subtitulo-pagina').textContent = 'Os itens antigos voltam ao estoque e os novos são baixados ao salvar';
    document.querySelector('#form-pedido button[type="submit"]').textContent = 'Salvar alterações';

    const pedido = await api.pedidos.buscar(pedidoIdEdicao);

    document.getElementById('cliente_id').value = pedido.cliente_id;
    document.getElementById('forma_pagamento').value = pedido.forma_pagamento || 'Pix';
    document.getElementById('observacoes').value = pedido.observacoes || '';

    // Um item de um pedido em edição pode não estar mais "disponível" na lista de
    // produtos com estoque > 0 (porque o estoque dele já está reservado neste
    // pedido); garante que ele apareça como opção mesmo assim.
    pedido.itens.forEach(item => {
        if (!produtosDisponiveis.some(p => p.id === item.produto_id)) {
            produtosDisponiveis.push({
                id: item.produto_id,
                nome: item.produto_nome,
                modelo: item.modelo,
                quantidade: 0,
                preco_venda: item.preco_unitario
            });
        }
    });

    pedido.itens.forEach(item => {
        adicionarItem();
        const id = contadorItens;
        document.getElementById(`item-produto-${id}`).value = item.produto_id;
        document.getElementById(`item-qtd-${id}`).value = item.quantidade;
        document.getElementById(`item-preco-${id}`).value = item.preco_unitario;
    });

    valorTrocaExistente = Number(pedido.valor_troca || 0);
    if (valorTrocaExistente > 0) {
        document.getElementById('troca-existente').style.display = 'block';
        document.getElementById('t-valor-existente').value = valorTrocaExistente;
        document.getElementById('t-valor-existente').addEventListener('input', calcularResumo);
        // Em edição com troca já existente, esconde a opção de cadastrar uma troca nova
        document.getElementById('trade-box').style.display = 'none';
    }
}

function adicionarItem() {
    contadorItens++;
    const id = contadorItens;
    const container = document.getElementById('itens-container');

    const row = document.createElement('div');
    row.className = 'item-row';
    row.id = `item-row-${id}`;
    row.innerHTML = `
        <div class="form-group" style="margin-bottom:0;">
            <label>Produto</label>
            <select onchange="preencherPreco(${id})" id="item-produto-${id}">
                <option value="">Selecione...</option>
                ${produtosDisponiveis.map(p => `<option value="${p.id}" data-preco="${p.preco_venda}">${p.nome}${p.modelo ? ' - ' + p.modelo : ''} (${p.quantidade} un.)</option>`).join('')}
            </select>
        </div>
        <div class="form-group" style="margin-bottom:0;">
            <label>Qtd.</label>
            <input type="number" id="item-qtd-${id}" value="1" min="1" onchange="calcularResumo()">
        </div>
        <div class="form-group" style="margin-bottom:0;">
            <label>Preço unit. (R$)</label>
            <input type="number" id="item-preco-${id}" step="0.01" value="0" onchange="calcularResumo()">
        </div>
        <button type="button" class="remove-item" onclick="removerItem(${id})" title="Remover item">✕</button>
    `;
    container.appendChild(row);
}

function removerItem(id) {
    const row = document.getElementById(`item-row-${id}`);
    if (row) row.remove();
    calcularResumo();
}

function preencherPreco(id) {
    const select = document.getElementById(`item-produto-${id}`);
    const preco = select.selectedOptions[0]?.dataset.preco || 0;
    document.getElementById(`item-preco-${id}`).value = preco;
    calcularResumo();
}

function toggleTroca() {
    const marcado = document.getElementById('tem-troca').checked;
    document.getElementById('trade-box').classList.toggle('active', marcado);
    calcularResumo();
}

function coletarItens() {
    const container = document.getElementById('itens-container');
    const linhas = container.querySelectorAll('.item-row');
    const itens = [];
    linhas.forEach(linha => {
        const id = linha.id.split('-').pop();
        const produtoId = document.getElementById(`item-produto-${id}`).value;
        const quantidade = Number(document.getElementById(`item-qtd-${id}`).value);
        const preco = Number(document.getElementById(`item-preco-${id}`).value);
        if (produtoId) itens.push({ produto_id: Number(produtoId), quantidade, preco_unitario: preco });
    });
    return itens;
}

function obterValorTroca() {
    if (valorTrocaExistente > 0) {
        return Number(document.getElementById('t-valor-existente').value || 0);
    }
    const temTroca = document.getElementById('tem-troca').checked;
    return temTroca ? Number(document.getElementById('t-valor-abatido').value || 0) : 0;
}

function calcularResumo() {
    const itens = coletarItens();
    const subtotal = itens.reduce((soma, i) => soma + (i.quantidade * i.preco_unitario), 0);
    const valorTroca = obterValorTroca();

    document.getElementById('resumo-subtotal').textContent = formatarMoeda(subtotal);

    const linhaTroca = document.getElementById('linha-troca');
    if (valorTroca > 0) {
        linhaTroca.style.display = 'flex';
        document.getElementById('resumo-troca').textContent = '- ' + formatarMoeda(valorTroca);
    } else {
        linhaTroca.style.display = 'none';
    }

    document.getElementById('resumo-final').textContent = formatarMoeda(subtotal - valorTroca);
}

document.getElementById('t-valor-abatido').addEventListener('input', calcularResumo);

document.getElementById('form-pedido').addEventListener('submit', async (e) => {
    e.preventDefault();

    const itens = coletarItens();
    if (itens.length === 0) {
        alert('Adicione ao menos um item vendido.');
        return;
    }

    const payload = {
        cliente_id: Number(document.getElementById('cliente_id').value),
        forma_pagamento: document.getElementById('forma_pagamento').value,
        observacoes: document.getElementById('observacoes').value,
        itens
    };

    try {
        if (pedidoIdEdicao) {
            payload.valor_troca = obterValorTroca();
            const resultado = await api.pedidos.editar(pedidoIdEdicao, payload);
            alert(resultado.mensagem);
        } else {
            if (document.getElementById('tem-troca').checked) {
                payload.troca = {
                    nome: document.getElementById('t-nome').value,
                    categoria: 'aparelho_seminovo',
                    marca: document.getElementById('t-marca').value,
                    modelo: document.getElementById('t-modelo').value,
                    imei: document.getElementById('t-imei').value,
                    condicao: document.getElementById('t-condicao').value,
                    valor_abatido: Number(document.getElementById('t-valor-abatido').value || 0),
                    preco_venda_sugerido: Number(document.getElementById('t-preco-venda').value || 0),
                    observacoes: document.getElementById('t-obs').value
                };
                if (!payload.troca.nome) {
                    alert('Informe o nome do aparelho recebido na troca.');
                    return;
                }
            }
            const resultado = await api.pedidos.criar(payload);
            alert(resultado.mensagem);
        }
        window.location.href = 'pedidos.html';
    } catch (err) {
        alert('Erro ao salvar pedido: ' + err.message);
    }
});

inicializar();
