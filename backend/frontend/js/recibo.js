// ===== DADOS DA LOJA (edite aqui) =====
const LOJA = {
    nome: 'Conexão Iphone',
    cnpj: '67.014.377/0001-70',
    endereco: 'Avenida Pereira Barreto, 1974 - Sala 2111',
    fone: '11951578722',
    email: 'conexaoiphonebr@gmail.com'
};

// Evita que texto digitado (nome, observação...) quebre ou injete HTML na página
function esc(texto) {
    return String(texto ?? '').replace(/[&<>"']/g, c => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[c]));
}

// "2026-08-03T14:30" (data_hora do pedido) -> "03/08/2026", sem sofrer deslocamento de fuso
function dataDoPedido(pedido) {
    const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(pedido.data_hora || '');
    return m ? `${m[3]}/${m[2]}/${m[1]}` : formatarData(pedido.criado_em);
}

// Rua, número, complemento e bairro (clientes antigos têm tudo só no campo endereço)
function montarEndereco(p) {
    const rua = [p.cliente_endereco, p.cliente_numero].filter(Boolean).join(', ');
    const bairro = p.cliente_bairro ? `(${p.cliente_bairro})` : '';
    return [rua, p.cliente_complemento, bairro].filter(Boolean).join(' ');
}

// "iPhone 14 Pro Max 128GB ... - IMEI 1: xxx - IMEI 2: yyy"
function descricaoAparelho(nome, modelo, imei, imei2) {
    let txt = nome || '';
    if (modelo && !txt.toLowerCase().includes(String(modelo).toLowerCase())) txt += ' ' + modelo;
    if (imei) txt += ` - IMEI 1: ${imei}`;
    if (imei2) txt += ` - IMEI 2: ${imei2}`;
    return txt;
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

        // Cabeçalho
        document.getElementById('r-marca').textContent = LOJA.nome;
        document.getElementById('r-loja').innerHTML =
            `${esc(LOJA.nome)}<br>CNPJ: ${esc(LOJA.cnpj)}<br>${esc(LOJA.endereco)}<br>` +
            `${esc(LOJA.fone)}<br>${esc(LOJA.email)}`;
        document.getElementById('r-data').innerHTML = `DATA DA VENDA<br>${esc(dataDoPedido(pedido))}`;

        // Recibo / vendedor
        document.getElementById('r-ident').innerHTML =
            `<b>Recibo#</b>${esc(pedido.id)}` +
            (pedido.vendedor_nome ? `<br><b>Vendedor:</b> ${esc(pedido.vendedor_nome)}` : '') +
            (pedido.status === 'cancelado' ? '<br><b>(PEDIDO CANCELADO)</b>' : '');

        // Consumidor
        const fones = [pedido.cliente_celular, pedido.cliente_telefone].filter(Boolean).join(' / ');
        document.getElementById('r-cliente').innerHTML = `
            <tr>
                <th style="width:42%">Nome/Razão social</th><th>Nascimento</th><th>Telefone</th><th>CPF/CNPJ</th>
            </tr>
            <tr>
                <td>${esc(pedido.cliente_nome)}</td>
                <td>${esc(pedido.cliente_nascimento || '')}</td>
                <td>${esc(fones)}</td>
                <td>${esc(pedido.cliente_cpf_cnpj || '')}</td>
            </tr>
            <tr>
                <th>Endereço</th><th>CEP</th><th>Cidade</th><th>Estado</th>
            </tr>
            <tr>
                <td>${esc(montarEndereco(pedido))}</td>
                <td>${esc(pedido.cliente_cep || '')}</td>
                <td>${esc(pedido.cliente_cidade || '')}</td>
                <td>${esc(pedido.cliente_estado || '')}</td>
            </tr>`;

        // Produtos
        document.getElementById('r-itens').innerHTML = pedido.itens.map(i => `
            <tr>
                <td></td>
                <td>${esc(descricaoAparelho(i.produto_nome, i.modelo, i.imei, i.imei2))}</td>
                <td class="c">${esc(i.garantia || '-')}</td>
                <td class="c">${esc(i.quantidade)}</td>
                <td>${formatarMoeda(i.preco_unitario)}</td>
                <td>${formatarMoeda(i.quantidade * i.preco_unitario)}</td>
            </tr>
        `).join('');

        const frete = Number(pedido.frete || 0);
        const desconto = Number(pedido.desconto || 0);
        const linhaTotal = (rotulo, valor) => `
            <tr>
                <td class="sem-borda"></td>
                <td style="width:12%">${rotulo}</td>
                <td style="width:12%">${valor}</td>
            </tr>`;
        document.getElementById('r-total').innerHTML =
            (frete > 0 ? linhaTotal('Frete', formatarMoeda(frete)) : '') +
            (desconto > 0 ? linhaTotal('Desconto', '- ' + formatarMoeda(desconto)) : '') +
            linhaTotal('Total', formatarMoeda(pedido.valor_total));

        // Pagamento: formas de pagamento + aparelhos recebidos na troca
        const linhas = [];
        (pedido.pagamentos || []).forEach(p => {
            let forma = p.forma_pagamento;
            if (Number(p.parcelas) > 1) forma += ` ${p.parcelas}x`;
            if ((p.observacao || '').trim()) forma += ` - ${p.observacao.trim()}`;
            linhas.push({ forma, valor: Number(p.valor) });
        });
        (pedido.trocas || []).forEach(t => {
            linhas.push({
                forma: descricaoAparelho(t.produto_nome, t.modelo, t.imei, t.imei2),
                valor: Number(t.valor_abatido)
            });
        });
        // Pedido antigo com crédito de troca mas sem o aparelho vinculado
        if (!(pedido.trocas || []).length && Number(pedido.valor_troca) > 0) {
            linhas.push({ forma: 'Crédito de troca', valor: Number(pedido.valor_troca) });
        }

        document.getElementById('r-pagamentos').innerHTML = linhas.length
            ? linhas.map(l => `<tr><td>${esc(l.forma)}</td><td>${formatarMoeda(l.valor)}</td></tr>`).join('')
            : '<tr><td colspan="2">Sem pagamentos registrados</td></tr>';

        // Observações do pedido: o bloco só aparece se tiver texto
        const obs = (pedido.observacoes || '').trim();
        document.getElementById('r-observacoes').textContent = obs;
        document.getElementById('r-obs-bloco').style.display = obs ? '' : 'none';

        // Termo de garantia fixo (vem de js/garantia.js)
        document.getElementById('r-garantia').innerHTML =
            `<h5>${esc(GARANTIA_LOJA.titulo)}</h5>` +
            GARANTIA_LOJA.secoes.map(s =>
                `<h6>${esc(s.titulo)}</h6>` + s.linhas.map(l => `<p>${esc(l)}</p>`).join('')
            ).join('');
    } catch (err) {
        document.getElementById('recibo').innerHTML = `<p>Erro ao carregar recibo: ${esc(err.message)}</p>`;
    }
}

carregarRecibo();

// Log: registra quando alguém imprime o recibo
window.addEventListener('beforeprint', () => {
    registrarEvento('recibo.imprimir', { id: new URLSearchParams(window.location.search).get('id') });
});
