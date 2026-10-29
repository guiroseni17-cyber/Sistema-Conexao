let pagamentosAtuais = [];

function dataInput(d) {
    const z = n => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}`;
}

function periodoMes(deslocamento) {
    const hoje = new Date();
    const ini = new Date(hoje.getFullYear(), hoje.getMonth() + deslocamento, 1);
    const fim = new Date(hoje.getFullYear(), hoje.getMonth() + deslocamento + 1, 0);
    document.getElementById('data-inicio').value = dataInput(ini);
    document.getElementById('data-fim').value = dataInput(fim);
    carregarTudo();
}

function periodo() {
    const inicio = document.getElementById('data-inicio').value;
    const fim = document.getElementById('data-fim').value;
    if (!inicio || !fim) { alert('Escolha as duas datas do período.'); return null; }
    return { inicio, fim };
}

function dataBR(iso) {
    const [a, m, d] = String(iso).split('-');
    return `${d}/${m}/${a}`;
}

function numeroDe(texto) {
    const n = parseFloat(String(texto).replace(/\./g, '').replace(',', '.'));
    return isNaN(n) ? NaN : n;
}

function mostrarAba(aba) {
    document.getElementById('painel-vendas').style.display = aba === 'vendas' ? '' : 'none';
    document.getElementById('painel-despesas').style.display = aba === 'despesas' ? '' : 'none';
    document.getElementById('aba-vendas').classList.toggle('ativa', aba === 'vendas');
    document.getElementById('aba-despesas').classList.toggle('ativa', aba === 'despesas');
}

async function carregarTudo() {
    if (!periodo()) return;
    await Promise.all([carregarResumo(), carregarPagamentos(), carregarLancamentos()]);
}

async function carregarResumo() {
    const p = periodo(); if (!p) return;
    try {
        const r = await api.financeiro.resumo(p.inicio, p.fim);
        document.getElementById('k-receita').textContent = formatarMoeda(r.receita);
        document.getElementById('k-pedidos').textContent = `${r.total_pedidos} pedido(s)`;
        document.getElementById('k-cmv').textContent = formatarMoeda(r.cmv);
        document.getElementById('k-taxas').textContent = formatarMoeda(r.taxas);
        document.getElementById('k-despesas').textContent = formatarMoeda(r.despesas);
        document.getElementById('k-lucro').textContent = formatarMoeda(r.lucro_real);
        document.getElementById('k-margem').textContent = `Margem real: ${r.margem_real.toFixed(1).replace('.', ',')}%`;

        const cls = v => v < 0 ? 'negativo' : 'positivo';
        document.getElementById('calculo').innerHTML = `
            <div class="linha"><span>Receita das vendas (com frete e desconto)</span><span>${formatarMoeda(r.receita)}</span></div>
            <div class="linha"><span>− Custo dos aparelhos vendidos</span><span class="negativo">${formatarMoeda(r.cmv)}</span></div>
            <div class="linha"><span><b>= Lucro bruto</b></span><span class="${cls(r.lucro_bruto)}"><b>${formatarMoeda(r.lucro_bruto)}</b></span></div>
            <div class="linha"><span>− Taxas de pagamento (vendas conciliadas)</span><span class="negativo">${formatarMoeda(r.taxas)}</span></div>
            <div class="linha"><span>− Despesas lançadas</span><span class="negativo">${formatarMoeda(r.despesas)}</span></div>
            <div class="linha"><span>+ Outras entradas lançadas</span><span class="positivo">${formatarMoeda(r.outras_entradas)}</span></div>
            <div class="linha final"><span>= Lucro real</span><span class="${cls(r.lucro_real)}">${formatarMoeda(r.lucro_real)}</span></div>`;

        const c = r.conciliacao;
        const aviso = document.getElementById('aviso-pendente');
        const partes = [];
        if (c.qtd_pendentes > 0) partes.push(`${c.qtd_pendentes} pagamento(s) de venda (${formatarMoeda(c.valor_pendente)}) ainda sem conciliar`);
        if (c.lancamentos_pendentes > 0) partes.push(`${c.lancamentos_pendentes} lançamento(s) sem conciliar`);
        aviso.style.display = partes.length ? '' : 'none';
        aviso.textContent = partes.length ? `Atenção: ${partes.join(' e ')}. As taxas só entram no lucro depois que a venda é conciliada, então o lucro pode estar acima do real.` : '';
    } catch (err) {
        alert('Erro ao calcular o lucro real: ' + err.message);
    }
}

// ---------- Conciliação das vendas (uma venda por bloco, cada forma de pagamento conciliada separadamente) ----------
async function carregarPagamentos() {
    const p = periodo(); if (!p) return;
    const status = document.getElementById('filtro-status').value;
    const lista = document.getElementById('lista-vendas');
    try {
        pagamentosAtuais = await api.financeiro.pagamentos(p.inicio, p.fim, status);
        if (!pagamentosAtuais.length) {
            lista.innerHTML = '<div class="panel"><p class="text-muted" style="padding:16px 20px; margin:0;">Nenhuma venda nesse filtro</p></div>';
            return;
        }

        // Agrupa por pedido mantendo a ordem (mais recentes primeiro)
        const vendas = new Map();
        pagamentosAtuais.forEach(pg => {
            if (!vendas.has(pg.pedido_id)) vendas.set(pg.pedido_id, { ...pg, pagamentos: [] });
            vendas.get(pg.pedido_id).pagamentos.push(pg);
        });

        lista.innerHTML = [...vendas.values()].map(v => {
            const pend = v.pagamentos.filter(x => !x.conciliado);
            const taxaVenda = v.pagamentos.filter(x => x.conciliado)
                .reduce((soma, x) => soma + Number(x.valor) - Number(x.valor_recebido), 0);
            let badge = '<span class="badge badge-green">Conciliada</span>';
            if (pend.length === v.pagamentos.length) badge = '<span class="badge badge-gray">Pendente</span>';
            else if (pend.length > 0) badge = '<span class="badge badge-amber">Parcial</span>';

            const linhas = v.pagamentos.map(pg => {
                const forma = esc(pg.forma_pagamento) + (Number(pg.parcelas) > 1 ? ` ${pg.parcelas}x` : '') +
                    (pg.observacao ? ` <span class="text-muted">(${esc(pg.observacao)})</span>` : '');
                const valor = Number(pg.valor);
                if (pg.conciliado) {
                    return `<tr>
                        <td>${forma}</td>
                        <td class="text-right">${formatarMoeda(valor)}</td>
                        <td class="text-right">${formatarMoeda(pg.valor_recebido)}</td>
                        <td class="text-right">${formatarMoeda(valor - Number(pg.valor_recebido))}</td>
                        <td><span class="badge badge-green">Conciliado</span>
                            <button class="btn btn-secondary btn-sm" onclick="desfazer(${pg.id})">Desfazer</button></td></tr>`;
                }
                return `<tr>
                    <td>${forma}</td>
                    <td class="text-right">${formatarMoeda(valor)}</td>
                    <td class="text-right"><input type="text" class="campo-recebido" id="rec-${pg.id}" inputmode="decimal"
                        value="${valor.toFixed(2).replace('.', ',')}" oninput="atualizarTaxa(${pg.id}, ${valor})"></td>
                    <td class="text-right" id="taxa-${pg.id}">${formatarMoeda(0)}</td>
                    <td><button class="btn btn-primary btn-sm" onclick="conciliar(${pg.id})">Conciliar</button></td></tr>`;
            }).join('');

            return `<div class="panel venda">
                <div class="venda-topo">
                    <div class="info">
                        <b>Pedido #${v.pedido_id} ${badge}</b>
                        <span class="text-muted">${dataBR(v.data)} · ${esc(v.cliente_nome)} · Total da venda ${formatarMoeda(v.valor_total)}</span>
                    </div>
                    <div class="acoes">
                        ${pend.length ? `<button class="btn btn-secondary btn-sm" onclick="conciliarVenda(${v.pedido_id})">Conciliar venda toda</button>` : ''}
                    </div>
                </div>
                <table>
                    <thead><tr><th>Forma de pagamento</th><th class="text-right">Valor</th><th class="text-right">Recebido</th><th class="text-right">Taxa</th><th></th></tr></thead>
                    <tbody>${linhas}</tbody>
                </table>
                <div class="venda-rodape">
                    <span>${Number(v.valor_troca) > 0 ? `Aparelho recebido na troca: ${formatarMoeda(v.valor_troca)} (não passa pela conta, não precisa conciliar)` : ''}</span>
                    <span>Taxa da venda (já conciliada): <b>${formatarMoeda(taxaVenda)}</b></span>
                </div>
            </div>`;
        }).join('');
    } catch (err) {
        lista.innerHTML = `<div class="panel"><p class="text-muted" style="padding:16px 20px; margin:0;">Erro: ${esc(err.message)}</p></div>`;
    }
}

function atualizarTaxa(id, valor) {
    const rec = numeroDe(document.getElementById(`rec-${id}`).value);
    document.getElementById(`taxa-${id}`).textContent = isNaN(rec) ? '--' : formatarMoeda(valor - rec);
}

async function conciliar(id) {
    const rec = numeroDe(document.getElementById(`rec-${id}`).value);
    if (isNaN(rec) || rec < 0) { alert('Informe o valor que realmente caiu na conta.'); return; }
    try {
        await api.financeiro.conciliar(id, rec);
        await Promise.all([carregarResumo(), carregarPagamentos()]);
    } catch (err) { alert('Erro ao conciliar: ' + err.message); }
}

// Concilia, de uma vez, todas as formas pendentes da venda usando o que está digitado em "Recebido"
async function conciliarVenda(pedidoId) {
    const pendentes = pagamentosAtuais.filter(x => x.pedido_id === pedidoId && !x.conciliado);
    const itens = [];
    for (const pg of pendentes) {
        const rec = numeroDe(document.getElementById(`rec-${pg.id}`).value);
        if (isNaN(rec) || rec < 0) { alert(`Informe o valor recebido em "${pg.forma_pagamento}".`); return; }
        itens.push({ id: pg.id, rec });
    }
    try {
        for (const it of itens) await api.financeiro.conciliar(it.id, it.rec);
        await Promise.all([carregarResumo(), carregarPagamentos()]);
    } catch (err) {
        alert('Erro ao conciliar: ' + err.message);
        carregarPagamentos();
    }
}

async function desfazer(id) {
    try {
        await api.financeiro.desfazer(id);
        await Promise.all([carregarResumo(), carregarPagamentos()]);
    } catch (err) { alert('Erro ao desfazer: ' + err.message); }
}

// ---------- Despesas e contas ----------
async function carregarLancamentos() {
    const p = periodo(); if (!p) return;
    const corpo = document.getElementById('tabela-lancamentos');
    try {
        const lista = await api.financeiro.lancamentos(p.inicio, p.fim);
        corpo.innerHTML = lista.length ? lista.map(l => `
            <tr>
                <td>${dataBR(l.data)}</td>
                <td>${esc(l.descricao)} ${l.tipo === 'receita' ? '<span class="badge badge-green">Entrada</span>' : ''}</td>
                <td>${esc(l.categoria || '-')}</td>
                <td>${esc(l.conta || '-')}</td>
                <td class="text-right">${l.tipo === 'receita' ? '' : '− '}${formatarMoeda(l.valor)}</td>
                <td><input type="checkbox" ${l.conciliado ? 'checked' : ''} onchange="alternarConciliado(${l.id}, this.checked)"></td>
                <td><button class="btn btn-danger btn-sm" onclick="excluirLancamento(${l.id})">Excluir</button></td>
            </tr>`).join('')
            : '<tr><td colspan="7" class="text-muted">Nenhum lançamento no período</td></tr>';
    } catch (err) {
        corpo.innerHTML = `<tr><td colspan="7" class="text-muted">Erro: ${esc(err.message)}</td></tr>`;
    }
}

async function salvarLancamento() {
    const valor = numeroDe(document.getElementById('l-valor').value);
    const dados = {
        tipo: document.getElementById('l-tipo').value,
        descricao: document.getElementById('l-descricao').value.trim(),
        categoria: document.getElementById('l-categoria').value.trim(),
        valor,
        data: document.getElementById('l-data').value,
        conta: document.getElementById('l-conta').value.trim()
    };
    if (!dados.descricao) { alert('Informe a descrição.'); return; }
    if (isNaN(valor) || valor <= 0) { alert('Informe um valor maior que zero.'); return; }
    if (!dados.data) { alert('Informe a data.'); return; }
    try {
        await api.financeiro.criarLancamento(dados);
        ['l-descricao', 'l-categoria', 'l-valor', 'l-conta'].forEach(id => document.getElementById(id).value = '');
        await Promise.all([carregarResumo(), carregarLancamentos()]);
    } catch (err) { alert('Erro ao salvar: ' + err.message); }
}

async function alternarConciliado(id, marcado) {
    try {
        await api.financeiro.conciliarLancamento(id, marcado);
        await carregarResumo();
    } catch (err) { alert('Erro: ' + err.message); carregarLancamentos(); }
}

async function excluirLancamento(id) {
    if (!confirm('Excluir este lançamento?')) return;
    try {
        await api.financeiro.excluirLancamento(id);
        await Promise.all([carregarResumo(), carregarLancamentos()]);
    } catch (err) { alert('Erro ao excluir: ' + err.message); }
}

document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('l-data').value = dataInput(new Date());
    periodoMes(0);
});
