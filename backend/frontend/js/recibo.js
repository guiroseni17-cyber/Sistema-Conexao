// ===== DADOS DA LOJA (edite aqui) =====
const LOJA = {
    nome: 'Conexão Store',
    cnpj: '67.014.377/0001-70',
    endereco: 'AV PEREIRA BARRETO, 1479 SALA 2110 BAETA NEVES - SÃO BERNARDO DO CAMPO - SP',
    cep: '09.751-000',
    fone: '(11) 97028-9556',
    email: 'emersonn_ribeiro@hotmail.com'
};

// Evita que texto digitado (nome, observação...) quebre ou injete HTML na página
function esc(texto) {
    return String(texto ?? '').replace(/[&<>"']/g, c => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[c]));
}

function somarMeses(data, meses) {
    const d = new Date(data);
    d.setMonth(d.getMonth() + meses);
    return d;
}

// Monta as linhas "Parcela / Data / Valor / Forma"
function montarParcelas(pedido) {
    const linhas = [];

    if (Number(pedido.valor_troca) > 0) {
        linhas.push({ data: new Date(pedido.criado_em), valor: Number(pedido.valor_troca), forma: 'Crédito de troca' });
    }

    (pedido.pagamentos || []).forEach(p => {
        const n = Math.max(1, Number(p.parcelas) || 1);
        const valorParcela = Number(p.valor) / n;
        for (let i = 0; i < n; i++) {
            linhas.push({ data: somarMeses(pedido.criado_em, i), valor: valorParcela, forma: p.forma_pagamento });
        }
    });

    return linhas;
}

async function carregarRecibo() {
    const params = new URLSearchParams(window.location.search);
    const id = params.get('id');
    if (!id) {
        document.getElementById('recibo').innerHTML = '<p>Pedido não informado.</p>';
        return;
    }

    try {
        const pedido = await api.pedidos.buscar(id);

        // Topo
        document.getElementById('r-numero').textContent = `PEDIDO ${pedido.id}`;
        document.getElementById('r-ref').textContent = pedido.vendedor_nome ? `Vendedor: ${pedido.vendedor_nome}` : '';
        document.getElementById('r-data').textContent = formatarData(pedido.criado_em);
        document.getElementById('r-loja').innerHTML =
            `<b>${esc(LOJA.nome)}</b> - ${esc(LOJA.cnpj)}<br>` +
            `${esc(LOJA.endereco)}<br>CEP: ${esc(LOJA.cep)}<br>` +
            `Fone: ${esc(LOJA.fone)} · ${esc(LOJA.email)}`;

        // Cliente
        document.getElementById('r-cliente').innerHTML = `
            <div><b>Nome:</b> ${esc(pedido.cliente_nome)}</div>
            <div><b>CPF/CNPJ:</b> ${esc(pedido.cliente_cpf_cnpj || '-')}</div>
            <div><b>E-mail:</b> ${esc(pedido.cliente_email || '-')}</div>
            <div><b>Telefone:</b> ${esc(pedido.cliente_telefone || '-')}</div>
            <div><b>Endereço:</b> ${esc(pedido.cliente_endereco || '-')}</div>
        `;

        // Itens
        document.getElementById('r-itens').innerHTML = pedido.itens.map((i, idx) => `
            <tr>
                <td>${idx + 1}. ${esc(i.produto_nome)}${i.modelo ? ' ' + esc(i.modelo) : ''}${i.imei ? ' · ' + esc(i.imei) : ''}</td>
                <td class="num">${Number(i.quantidade).toFixed(2).replace('.', ',')}</td>
                <td class="num">${formatarMoeda(i.preco_unitario)}</td>
                <td class="num">${formatarMoeda(i.quantidade * i.preco_unitario)}</td>
            </tr>
        `).join('');

        // Totais
        const totalQtd = pedido.itens.reduce((s, i) => s + Number(i.quantidade), 0);
        document.getElementById('r-totais').innerHTML = `
            <b>Total de quantidades</b><span>${totalQtd.toFixed(2).replace('.', ',')}</span>
            <b>Número total de itens</b><span>${pedido.itens.length} produto(s)</span>
            <b>Valor total dos produtos</b><span>${formatarMoeda(pedido.valor_total)}</span>
            <b>Valor total do pedido</b><span>${formatarMoeda(pedido.valor_total)}</span>
        `;

        // Parcelas
        const parcelas = montarParcelas(pedido);
        document.getElementById('r-parcelas').innerHTML = parcelas.length
            ? parcelas.map((p, idx) => `
                <tr>
                    <td>${idx + 1}</td>
                    <td>${formatarData(p.data)}</td>
                    <td class="num">${formatarMoeda(p.valor)}</td>
                    <td>${esc(p.forma)}</td>
                </tr>`).join('')
            : '<tr><td colspan="4">Sem pagamentos registrados</td></tr>';

        // Aparelho recebido em troca
        document.getElementById('r-obs-troca').innerHTML = (pedido.trocas || []).map(t =>
            `<div><b>Aparelho recebido na troca</b>${esc(t.produto_nome)}${t.modelo ? ' ' + esc(t.modelo) : ''}${t.imei ? '<br>IMEI ' + esc(t.imei) : ''}</div>`
        ).join('');

        // Observações do pedido
        document.getElementById('r-observacoes').textContent = pedido.observacoes || '';

       // Termo de garantia fixo (vem de js/garantia.js)
        document.getElementById('r-garantia').innerHTML =
            `<h5>${esc(GARANTIA_LOJA.titulo)}</h5>` +
            GARANTIA_LOJA.secoes.map(s =>
                `<h6>${esc(s.titulo)}</h6>` + s.linhas.map(l => `<p>${esc(l)}</p>`).join('')
            ).join('');

        if (pedido.status === 'cancelado') {
            document.getElementById('recibo').style.opacity = '0.6';
            document.getElementById('r-numero').innerHTML += ' <span style="font-size:14px;">(CANCELADO)</span>';
        }
    } catch (err) {
        document.getElementById('recibo').innerHTML = `<p>Erro ao carregar recibo: ${esc(err.message)}</p>`;
    }
}

carregarRecibo();
