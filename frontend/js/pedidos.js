const statusBadge = {
    aberto: '<span class="badge badge-amber">Aberto</span>',
    finalizado: '<span class="badge badge-green">Finalizado</span>',
    cancelado: '<span class="badge badge-red">Cancelado</span>'
};

async function carregarPedidos() {
    const tabela = document.getElementById('tabela-pedidos');
    try {
        const pedidos = await api.pedidos.listar();
        tabela.innerHTML = pedidos.length ? pedidos.map(p => `
            <tr>
                <td><strong>#${p.id}</strong></td>
                <td>${p.cliente_nome}</td>
                <td class="text-muted">${p.vendedor_nome || '-'}</td>
                <td class="text-muted">${formatarData(p.criado_em)}</td>
                <td>${Number(p.valor_troca) > 0 ? '<span class="badge badge-green">Sim</span>' : '<span class="badge badge-gray">Não</span>'}</td>
                <td class="text-right">${formatarMoeda(p.valor_total)}</td>
                <td class="text-right">${formatarMoeda(p.valor_a_pagar)}</td>
                <td>${statusBadge[p.status] || p.status}</td>
                <td class="text-right">
                    <div class="row-actions">
                        <a class="btn btn-secondary btn-sm" href="recibo.html?id=${p.id}" target="_blank">Recibo</a>
                        ${p.status !== 'cancelado' ? `
                            <a class="btn btn-secondary btn-sm" href="novo-pedido.html?id=${p.id}">Editar</a>
                            <button class="btn btn-danger btn-sm" onclick="cancelarPedido(${p.id})">Cancelar</button>
                        ` : ''}
                    </div>
                </td>
            </tr>
        `).join('') : '<tr><td colspan="9" class="empty-state">Nenhum pedido registrado ainda</td></tr>';
    } catch (err) {
        tabela.innerHTML = `<tr><td colspan="9" class="text-muted">Erro: ${err.message}</td></tr>`;
    }
}

async function cancelarPedido(id) {
    if (!confirm(`Cancelar o pedido #${id}? Os itens vendidos voltam para o estoque.`)) return;
    try {
        const resultado = await api.pedidos.cancelar(id);
        alert(resultado.mensagem);
        carregarPedidos();
    } catch (err) {
        alert('Erro ao cancelar pedido: ' + err.message);
    }
}

carregarPedidos();
