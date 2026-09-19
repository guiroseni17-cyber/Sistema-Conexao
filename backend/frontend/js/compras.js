const statusPagamentoBadge = {
    pendente: '<span class="badge badge-red">Pendente</span>',
    parcial: '<span class="badge badge-amber">Parcial</span>',
    pago: '<span class="badge badge-green">Pago</span>'
};

let compraSelecionadaId = null;

async function carregarCompras() {
    const tabela = document.getElementById('tabela-compras');
    try {
        const compras = await api.compras.listar();
        tabela.innerHTML = compras.length ? compras.map(c => {
            const emAberto = Number(c.valor_total) - Number(c.valor_pago);
            return `
            <tr${c.status === 'cancelada' ? ' style="opacity:0.55;"' : ''}>
                <td><strong>#${c.id}</strong></td>
                <td>${c.fornecedor_nome}</td>
                <td class="text-muted">${formatarData(c.criado_em)}</td>
                <td class="text-right">${formatarMoeda(c.valor_total)}</td>
                <td class="text-right">${formatarMoeda(c.valor_pago)}</td>
                <td class="text-right">${emAberto > 0 ? formatarMoeda(emAberto) : '-'}</td>
                <td>${c.status === 'cancelada' ? '<span class="badge badge-gray">Cancelada</span>' : (statusPagamentoBadge[c.status_pagamento] || c.status_pagamento)}</td>
                <td class="text-right">
                    ${c.status !== 'cancelada' ? `
                        <div class="row-actions">
                            ${c.status_pagamento !== 'pago' ? `<button class="btn btn-secondary btn-sm" onclick="abrirModalPagamento(${c.id})">Pagar</button>` : ''}
                            <button class="btn btn-danger btn-sm" onclick="cancelarCompra(${c.id})">Cancelar</button>
                        </div>
                    ` : ''}
                </td>
            </tr>
        `; }).join('') : '<tr><td colspan="8" class="empty-state">Nenhuma compra registrada ainda</td></tr>';
    } catch (err) {
        tabela.innerHTML = `<tr><td colspan="8" class="text-muted">Erro: ${err.message}</td></tr>`;
    }
}

function abrirModalPagamento(id) {
    compraSelecionadaId = id;
    document.getElementById('form-pagamento').reset();
    document.getElementById('modal-pagamento').style.display = 'flex';
}
function fecharModalPagamento() {
    document.getElementById('modal-pagamento').style.display = 'none';
}

document.getElementById('form-pagamento').addEventListener('submit', async (e) => {
    e.preventDefault();
    const valor = Number(document.getElementById('pg-valor').value);
    try {
        await api.compras.registrarPagamento(compraSelecionadaId, valor);
        fecharModalPagamento();
        carregarCompras();
    } catch (err) {
        alert('Erro ao registrar pagamento: ' + err.message);
    }
});

async function cancelarCompra(id) {
    if (!confirm(`Cancelar a compra #${id}? O estoque recebido nela será estornado.`)) return;
    try {
        const resultado = await api.compras.cancelar(id);
        alert(resultado.mensagem);
        carregarCompras();
    } catch (err) {
        alert('Erro ao cancelar compra: ' + err.message);
    }
}

carregarCompras();
