let produtosExistentes = [];
let catalogoPais = []; // [{ id, nome, variacoes: [...] }] — produtos pai com suas variações (só referência)
let contadorItensCompra = 0;

async function inicializarCompra() {
    await recarregarFornecedores();

    produtosExistentes = await api.produtos.listar('?busca=');
    catalogoPais = agruparPorPai(await api.modelos.listar());

    // Vindo do botão "Dar entrada" na tela de Produtos pai: já abre com a variação escolhida
    const params = new URLSearchParams(window.location.search);
    const variacaoUrl = params.get('modelo');
    if (variacaoUrl && catalogoPais.some(p => p.variacoes.some(v => String(v.id) === variacaoUrl))) {
        adicionarItemCompra('pai', variacaoUrl);
    } else {
        adicionarItemCompra('pai');
    }
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

function opcoesPais() {
    return catalogoPais.map((p, i) =>
        `<option value="${i}">${esc(p.nome)} (${p.variacoes.length} variações)</option>`
    ).join('');
}

// Ao escolher o produto pai, lista só as variações dele (ex: 256GB · Laranja)
function trocarPai(id, variacaoIdParaSelecionar) {
    const pai = catalogoPais[document.getElementById(`item-pai-sel-${id}`).value];
    const selVar = document.getElementById(`item-var-sel-${id}`);
    if (!pai) {
        selVar.disabled = true;
        selVar.innerHTML = '<option value="">Escolha o produto pai primeiro</option>';
    } else {
        selVar.disabled = false;
        selVar.innerHTML = '<option value="">Selecione a variação...</option>' + pai.variacoes.map(v =>
            `<option value="${v.id}" data-venda="${v.preco_venda}">${esc(v.rotulo)}${v.estoque > 0 ? ` (estoque atual: ${v.estoque})` : ''}</option>`
        ).join('');
        if (variacaoIdParaSelecionar) selVar.value = variacaoIdParaSelecionar;
    }
    preencherVariacao(id);
}

function adicionarItemCompra(tipoInicial, variacaoId) {
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
                <option value="pai">Produto pai (catálogo)</option>
                <option value="existente">Reposição de produto existente</option>
                <option value="novo">Produto avulso (fora do catálogo)</option>
            </select>
            <button type="button" class="remove-item" onclick="removerItemCompra(${id})" title="Remover item">✕</button>
        </div>
        <div style="padding:16px 20px;">
            <div id="item-existente-${id}" style="display:none;">
                <div class="form-group full">
                    <label>Produto</label>
                    <select id="item-produto-${id}" onchange="preencherCustoAtual(${id})">
                        <option value="">Selecione...</option>
                        ${opcoesProdutos()}
                    </select>
                </div>
            </div>
            <div id="item-pai-${id}">
                <div class="form-grid">
                    <div class="form-group">
                        <label>Produto pai</label>
                        <select id="item-pai-sel-${id}" onchange="trocarPai(${id})">
                            <option value="">Selecione...</option>
                            ${opcoesPais()}
                        </select>
                    </div>
                    <div class="form-group">
                        <label>Variação</label>
                        <select id="item-var-sel-${id}" onchange="preencherVariacao(${id})" disabled>
                            <option value="">Escolha o produto pai primeiro</option>
                        </select>
                    </div>
                </div>
                <span class="text-muted" style="font-size:12px;">A variação só entra no estoque ao salvar esta compra, e o custo unitário é obrigatório.</span>
                <div class="form-grid" style="margin-top:10px;">
                    <div class="form-group">
                        <label>IMEI (opcional — se informar, a quantidade é 1)</label>
                        <div class="imei-linha">
                            <input type="text" id="item-pai-imei-${id}">
                            <button type="button" class="btn btn-secondary btn-sm" title="Abre o site de consulta e copia o IMEI para colar" onclick="consultarImei(document.getElementById('item-pai-imei-${id}').value, this)">Consultar</button>
                        </div>
                    </div>
                    <div class="form-group">
                        <label>Preço de venda (R$)</label>
                        <input type="number" id="item-pai-venda-${id}" step="0.01" value="0">
                    </div>
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
                        <div class="imei-linha">
                            <input type="text" id="item-imei-${id}">
                            <button type="button" class="btn btn-secondary btn-sm" title="Abre o site de consulta e copia o IMEI para colar" onclick="consultarImei(document.getElementById('item-imei-${id}').value, this)">Consultar</button>
                        </div>
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

    document.getElementById(`item-tipo-${id}`).value = tipoInicial || 'pai';
    alternarTipoItemCompra(id);
    if (tipoInicial === 'pai' && variacaoId) {
        // Vindo da tela de Produtos pai: já seleciona o pai e a variação
        const indice = catalogoPais.findIndex(p => p.variacoes.some(v => String(v.id) === String(variacaoId)));
        if (indice >= 0) {
            document.getElementById(`item-pai-sel-${id}`).value = indice;
            trocarPai(id, variacaoId);
        }
    }
}

function preencherVariacao(id) {
    const sel = document.getElementById(`item-var-sel-${id}`);
    const venda = sel.selectedOptions[0]?.dataset.venda || 0;
    document.getElementById(`item-pai-venda-${id}`).value = venda;
    document.getElementById(`item-custo-${id}`).value = 0;
    calcularResumoCompra();
}

function alternarTipoItemCompra(id) {
    const tipo = document.getElementById(`item-tipo-${id}`).value;
    document.getElementById(`item-existente-${id}`).style.display = tipo === 'existente' ? 'block' : 'none';
    document.getElementById(`item-pai-${id}`).style.display = tipo === 'pai' ? 'block' : 'none';
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

        if (tipo === 'pai') {
            const variacaoId = document.getElementById(`item-var-sel-${id}`).value;
            if (variacaoId) {
                const imei = document.getElementById(`item-pai-imei-${id}`).value.trim();
                itens.push({
                    modelo_base_id: Number(variacaoId),
                    imei: imei || null,
                    preco_venda: Number(document.getElementById(`item-pai-venda-${id}`).value || 0),
                    quantidade: imei ? 1 : quantidade,
                    preco_custo_unitario
                });
            }
        } else if (tipo === 'existente') {
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

    const semCusto = itens.find(i => i.modelo_base_id && !(i.preco_custo_unitario > 0));
    if (semCusto) {
        alert('Informe o custo unitário de todas as variações do produto pai. Sem custo, elas não entram no estoque.');
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
