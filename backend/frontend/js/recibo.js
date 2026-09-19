async function carregarRecibo() {
    const params = new URLSearchParams(window.location.search);
    const id = params.get('id');
    if (!id) {
        document.getElementById('recibo').innerHTML = '<p>Pedido não informado.</p>';
        return;
    }

    try {
        const pedido = await api.pedidos.buscar(id);

        document.getElementById('r-numero').innerHTML = `Pedido #${pedido.id}<br>${formatarData(pedido.criado_em)}${pedido.vendedor_nome ? `<br>Vendedor: ${pedido.vendedor_nome}` : ''}`;
        document.getElementById('r-cliente').textContent = `${pedido.cliente_nome}${pedido.cliente_telefone ? ' — ' + pedido.cliente_telefone : ''}`;

        document.getElementById('r-itens').innerHTML = pedido.itens.map(i => `
            <div class="recibo-linha">
                <span>${i.quantidade}x ${i.produto_nome}${i.modelo ? ' - ' + i.modelo : ''}</span>
                <span>${formatarMoeda(i.quantidade * i.preco_unitario)}</span>
            </div>
        `).join('');

        if (pedido.trocas && pedido.trocas.length > 0) {
            document.getElementById('r-secao-troca').style.display = 'block';
            document.getElementById('r-troca').innerHTML = pedido.trocas.map(t => `
                <div class="recibo-linha">
                    <span>${t.produto_nome}${t.modelo ? ' - ' + t.modelo : ''}${t.imei ? ' (IMEI ' + t.imei + ')' : ''}</span>
                    <span>- ${formatarMoeda(t.valor_abatido)}</span>
                </div>
            `).join('');
        }

        document.getElementById('r-subtotal').textContent = formatarMoeda(pedido.valor_total);
        document.getElementById('r-forma').textContent = pedido.forma_pagamento || '-';

        if (Number(pedido.valor_troca) > 0) {
            document.getElementById('r-linha-troca').style.display = 'flex';
            document.getElementById('r-valor-troca').textContent = '- ' + formatarMoeda(pedido.valor_troca);
        }

        document.getElementById('r-total').textContent = formatarMoeda(pedido.valor_a_pagar);

        if (pedido.status === 'cancelado') {
            document.getElementById('recibo').style.opacity = '0.6';
            document.getElementById('r-numero').innerHTML += '<br><strong style="color:var(--accent-dark);">PEDIDO CANCELADO</strong>';
        }
    } catch (err) {
        document.getElementById('recibo').innerHTML = `<p>Erro ao carregar recibo: ${err.message}</p>`;
    }
}

carregarRecibo();
