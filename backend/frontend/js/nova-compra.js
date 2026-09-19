let produtosExistentes = [];
let contadorItensCompra = 0;

async function inicializarCompra() {
    await recarregarFornecedores();

    produtosExistentes = await api.produtos.listar('?busca=');

    adicionarItemCompra();
    calcularResumoCompra();
}

async function recarregarFornecedores(selecionarId) {
    const fornecedores = await api.fornecedores.listar();
    const selectFornecedor = document.getElementById('fornecedor_id');
    selectFornecedor.innerHTML = '<option value="">Selecione um fornecedor...</option>';
    fornecedores.forEach(f => {
        const opt = document.createElement('option');
        opt.value = f.id;
        opt.textContent = f.nome;
        selectFornecedor.appendChild(opt);
    });
    if (selecionarId) selectFornecedor.value = selecionarId;
}

function abrirModalNovoFornecedor() {
    document.getElementById('form-novo-fornecedor').reset();
    document.getElementById('modal-novo-fornecedor').style.display = 'flex';
}
function fecharModalNovoFornecedor() {
    document.getElementById('modal-novo-fornecedor').style.display = 'none';
}

document.getElementById('form-novo-fornecedor').addEventListener('submit', async (e) => {
    e.preventDefault();
    try {
        const resultado = await api.fornecedores.criar({
            nome: document.getElementById('nf-nome').value,
            telefone: document.getElementById('nf-telefone').value,
            cnpj_cpf: document.getElementById('nf-cnpj').value,
            email: document.getElementById('nf-email').value
        });
        await recarregarFornecedores(resultado.id);
        fecharModalNovoFornecedor();
    } catch (err) {
        alert('Erro ao cadastrar fornecedor: ' + err.message);
    }
});

function opcoesProdutos() {
    return produtosExistentes.map(p =>
        `<option value="${p.id}" data-custo="${p.preco_custo}">${p.nome}${p.modelo ? ' - ' + p.modelo : ''} (estoque atual: ${p.quantidade})</option>`
    ).join('');
}

function adicionarItemCompra() {
    contadorItensCompra++;
    const id = contadorItensCompra;
    const container = document.getElementById('itens-compra-container');

    const bloco = document.createElement('div');
    bloco.className = 'panel';
    bloco.id = `compra-item-${id}`;
    bloco.style.cssText = 'margin-bottom:12px; border-style:dashed;';
    bloco.innerHTML = `
        <div class="panel-header">
            <select id="item-tipo-${id}" onchange="alternarTipoItemCompra(${id})" style="width:230px;">
                <option value="existente">Reposição de produto existente</option>
                <option value="novo">Produto novo (ainda não está no estoque)</option>
            </select>
            <button type="button" class="remove-item" onclick="removerItemCompra(${id})" title="Remover item">✕</button>
        </div>
        <div style="padding:16px 20px;">
            <div id="item-existente-${id}">
                <div class="form-group full">
                    <label>Produto</label>
                    <select id="item-produto-${id}" onchange="preencherCustoAtual(${id})">
                        <option value="">Selecione...</option>
                        ${opcoesProdutos()}
                    </select>
                </div>
            </div>
            <div id="item-novo-${id}" style="display:none;">
                <div class="form-grid">
                    <div class="form-group full">
                        <label>Nome do produto</label>
                        <input type="text" id="item-nome-${id}" placeholder="Ex: iPhone 13 128GB">
                    </div>
                    <div class="form-group">
                        <label>Categoria</label>
                        <select id="item-categoria-${id}">
                            <option value="aparelho_novo">Aparelho novo</option>
                            <option value="aparelho_seminovo">Aparelho seminovo</option>
                            <option value="acessorio">Acessório</option>
                            <option value="peca">Peça</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label>Condição</label>
                        <select id="item-condicao-${id}">
                            <option value="novo">Novo</option>
                            <option value="seminovo_excelente">Seminovo - Excelente</option>
                            <option value="seminovo_bom">Seminovo - Bom</option>
                            <option value="seminovo_regular">Seminovo - Regular</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label>Marca</label>
                        <input type="text" id="item-marca-${id}">
                    </div>
                    <div class="form-group">
                        <label>Modelo</label>
                        <input type="text" id="item-modelo-${id}">
                    </div>
                    <div class="form-group">
                        <label>IMEI</label>
                        <input type="text" id="item-imei-${id}">
                    </div>
                    <div class="form-group">
                        <label>Preço de venda sugerido (R$)</label>
                        <input type="number" id="item-preco-venda-${id}" step="0.01" value="0">
                    </div>
                </div>
            </div>
            <div class="form-grid" style="margin-top:4px;">
                <div class="form-group" style="margin-bottom:0;">
                    <label>Quantidade</label>
                    <input type="number" id="item-qtd-${id}" value="1" min="1" onchange="calcularResumoCompra()">
                </div>
                <div class="form-group" style="margin-bottom:0;">
                    <label>Custo unitário (R$)</label>
                    <input type="number" id="item-custo-${id}" step="0.01" value="0" onchange="calcularResumoCompra()">
                </div>
            </div>
        </div>
    `;
    container.appendChild(bloco);
}

function alternarTipoItemCompra(id) {
    const tipo = document.getElementById(`item-tipo-${id}`).value;
    document.getElementById(`item-existente-${id}`).style.display = tipo === 'existente' ? 'block' : 'none';
    document.getElementById(`item-novo-${id}`).style.display = tipo === 'novo' ? 'block' : 'none';
}

function preencherCustoAtual(id) {
    const select = document.getElementById(`item-produto-${id}`);
    const custo = select.selectedOptions[0]?.dataset.custo || 0;
    document.getElementById(`item-custo-${id}`).value = custo;
    calcularResumoCompra();
}

function removerItemCompra(id) {
    const bloco = document.getElementById(`compra-item-${id}`);
    if (bloco) bloco.remove();
    calcularResumoCompra();
}

function coletarItensCompra() {
    const blocos = document.querySelectorAll('[id^="compra-item-"]');
    const itens = [];
    blocos.forEach(bloco => {
        const id = bloco.id.split('-').pop();
        const tipo = document.getElementById(`item-tipo-${id}`).value;
        const quantidade = Number(document.getElementById(`item-qtd-${id}`).value);
        const preco_custo_unitario = Number(document.getElementById(`item-custo-${id}`).value);

        if (tipo === 'existente') {
            const produtoId = document.getElementById(`item-produto-${id}`).value;
            if (produtoId) {
                itens.push({ produto_id: Number(produtoId), quantidade, preco_custo_unitario });
            }
        } else {
            const nome = document.getElementById(`item-nome-${id}`).value;
            if (nome) {
                itens.push({
                    produto_id: null,
                    nome,
                    categoria: document.getElementById(`item-categoria-${id}`).value,
                    condicao: document.getElementById(`item-condicao-${id}`).value,
                    marca: document.getElementById(`item-marca-${id}`).value,
                    modelo: document.getElementById(`item-modelo-${id}`).value,
                    imei: document.getElementById(`item-imei-${id}`).value,
                    preco_venda: Number(document.getElementById(`item-preco-venda-${id}`).value || 0),
                    quantidade, preco_custo_unitario
                });
            }
        }
    });
    return itens;
}

function calcularResumoCompra() {
    const itens = coletarItensCompra();
    const total = itens.reduce((soma, i) => soma + (i.quantidade * i.preco_custo_unitario), 0);
    const pago = Number(document.getElementById('valor_pago').value || 0);

    document.getElementById('resumo-total').textContent = formatarMoeda(total);
    document.getElementById('resumo-pago').textContent = formatarMoeda(pago);
    document.getElementById('resumo-aberto').textContent = formatarMoeda(Math.max(0, total - pago));
}

document.getElementById('form-compra').addEventListener('submit', async (e) => {
    e.preventDefault();

    const itens = coletarItensCompra();
    if (itens.length === 0) {
        alert('Adicione ao menos um item recebido.');
        return;
    }

    const payload = {
        fornecedor_id: Number(document.getElementById('fornecedor_id').value),
        valor_pago: Number(document.getElementById('valor_pago').value || 0),
        observacoes: document.getElementById('observacoes').value,
        itens
    };

    try {
        const resultado = await api.compras.criar(payload);
        alert(resultado.mensagem);
        window.location.href = 'compras.html';
    } catch (err) {
        alert('Erro ao registrar compra: ' + err.message);
    }
});

inicializarCompra();
