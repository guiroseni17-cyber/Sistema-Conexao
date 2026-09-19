document.getElementById('data-hoje').textContent = new Date().toLocaleDateString('pt-BR', {
    weekday: 'long', day: '2-digit', month: 'long'
});

async function carregarDashboard() {
    try {
        const dados = await api.pedidos.dashboard();

        const cards = document.querySelectorAll('.stat-card .value');
        cards[0].textContent = formatarMoeda(dados.faturamentoHoje);
        cards[1].textContent = dados.pedidosHoje;
        cards[2].textContent = dados.totalUnidadesEstoque || 0;
        cards[3].textContent = dados.totalClientes;
        cards[4].textContent = formatarMoeda(dados.comprasAPagar);

        const listaPedidos = document.getElementById('ultimos-pedidos');
        listaPedidos.innerHTML = dados.ultimosPedidos.length
            ? dados.ultimosPedidos.map(p => `
                <tr>
                    <td>#${p.id}</td>
                    <td>${p.cliente_nome}</td>
                    <td class="text-muted">${formatarData(p.criado_em)}</td>
                    <td class="text-right">${formatarMoeda(p.valor_total)}</td>
                </tr>
            `).join('')
            : '<tr><td colspan="4" class="text-muted">Nenhum pedido ainda</td></tr>';

        const estoqueBaixo = document.getElementById('estoque-baixo');
        estoqueBaixo.innerHTML = dados.estoqueBaixo.length
            ? dados.estoqueBaixo.map(p => `
                <tr>
                    <td>${p.nome}</td>
                    <td class="text-right"><span class="badge ${p.quantidade === 0 ? 'badge-red' : 'badge-amber'}">${p.quantidade}</span></td>
                </tr>
            `).join('')
            : '<tr><td colspan="2" class="text-muted">Estoque saudável</td></tr>';

    } catch (err) {
        console.error('Erro ao carregar dashboard:', err);
    }
}

carregarDashboard();
