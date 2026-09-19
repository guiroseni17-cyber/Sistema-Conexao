function formatarDataInput(data) {
    return data.toISOString().split('T')[0];
}

function definirPeriodo(dias) {
    const fim = new Date();
    const inicio = new Date();
    inicio.setDate(inicio.getDate() - (dias - 1));
    document.getElementById('data-inicio').value = formatarDataInput(inicio);
    document.getElementById('data-fim').value = formatarDataInput(fim);
    gerarRelatorios();
}

async function gerarRelatorios() {
    const inicio = document.getElementById('data-inicio').value;
    const fim = document.getElementById('data-fim').value;
    if (!inicio || !fim) {
        alert('Escolha as duas datas do período.');
        return;
    }

    try {
        const [vendas, compras] = await Promise.all([
            api.relatorios.vendas(inicio, fim),
            api.relatorios.compras(inicio, fim)
        ]);
        renderizarVendas(vendas);
        renderizarCompras(compras);
    } catch (err) {
        alert('Erro ao gerar relatório: ' + err.message);
    }
}

function renderizarVendas(dados) {
    const cards = document.querySelectorAll('#stats-vendas .value');
    cards[0].textContent = formatarMoeda(dados.faturamento_bruto);
    cards[1].textContent = formatarMoeda(dados.lucro_estimado);
    cards[2].textContent = dados.total_pedidos;
    cards[3].textContent = formatarMoeda(dados.total_abatido_trocas);

    const maisVendidos = document.getElementById('tabela-mais-vendidos');
    maisVendidos.innerHTML = dados.produtosMaisVendidos.length
        ? dados.produtosMaisVendidos.map(p => `
            <tr>
                <td>${p.nome}${p.modelo ? ` <span class="text-muted">(${p.modelo})</span>` : ''}</td>
                <td class="text-right">${p.quantidade_vendida}</td>
                <td class="text-right">${formatarMoeda(p.valor_total)}</td>
            </tr>
        `).join('')
        : '<tr><td colspan="3" class="text-muted">Nenhuma venda no período</td></tr>';

    const formas = document.getElementById('tabela-formas-pagamento');
    formas.innerHTML = dados.formasPagamento.length
        ? dados.formasPagamento.map(f => `
            <tr>
                <td>${f.forma_pagamento}</td>
                <td class="text-right">${f.total_pedidos}</td>
                <td class="text-right">${formatarMoeda(f.valor)}</td>
            </tr>
        `).join('')
        : '<tr><td colspan="3" class="text-muted">Nenhuma venda no período</td></tr>';

    const vendedores = document.getElementById('tabela-vendedores');
    vendedores.innerHTML = dados.porVendedor.length
        ? dados.porVendedor.map(v => `
            <tr>
                <td>${v.vendedor}</td>
                <td class="text-right">${v.total_pedidos}</td>
                <td class="text-right">${formatarMoeda(v.valor)}</td>
            </tr>
        `).join('')
        : '<tr><td colspan="3" class="text-muted">Nenhuma venda no período</td></tr>';
}

function renderizarCompras(dados) {
    document.getElementById('compras-total').textContent = formatarMoeda(dados.total_comprado);
    document.getElementById('compras-pago').textContent = formatarMoeda(dados.total_pago);
    document.getElementById('compras-aberto').textContent = formatarMoeda(dados.total_em_aberto);

    const tabela = document.getElementById('tabela-fornecedores-relatorio');
    tabela.innerHTML = dados.porFornecedor.length
        ? dados.porFornecedor.map(f => `
            <tr>
                <td>${f.fornecedor}</td>
                <td class="text-right">${f.total_compras}</td>
                <td class="text-right">${formatarMoeda(f.valor_comprado)}</td>
                <td class="text-right">${Number(f.valor_em_aberto) > 0 ? formatarMoeda(f.valor_em_aberto) : '-'}</td>
            </tr>
        `).join('')
        : '<tr><td colspan="4" class="text-muted">Nenhuma compra no período</td></tr>';
}

// Já abre com os últimos 7 dias preenchidos
definirPeriodo(7);
