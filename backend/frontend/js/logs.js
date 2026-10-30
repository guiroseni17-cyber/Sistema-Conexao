// Tela Administração > Logs (só administrador)

const AREAS_LOG = ['Pedidos', 'Estoque', 'Produtos pai', 'Clientes', 'Fornecedores', 'Compras', 'Financeiro',
    'Metas', 'Equipe', 'Acesso', 'Impressão', 'Relatórios', 'Sistema', 'Navegação'];

const ROTULOS_CAMPO = {
    status: 'Status', valor_total: 'Total', valor_troca: 'Valor da troca', valor_a_pagar: 'A pagar',
    desconto: 'Desconto', frete: 'Frete', forma_pagamento: 'Forma de pagamento', observacoes: 'Observações',
    data: 'Data', vendedor: 'Vendedor', cliente: 'Cliente', itens: 'Itens', pagamentos: 'Pagamentos',
    trocas: 'Aparelhos na troca', nome: 'Nome', preco_venda: 'Preço de venda', preco_custo: 'Preço de custo',
    preco_venda_atacado: 'Preço atacado', ativo: 'Ativo', papel: 'Papel', email: 'E-mail', telefone: 'Telefone',
    celular: 'Celular', cpf_cnpj: 'CPF/CNPJ', imei: 'IMEI', imei2: 'IMEI 2', garantia: 'Garantia',
    numero_serie: 'Serial', bateria: 'Bateria', marca: 'Marca', modelo: 'Modelo', categoria: 'Categoria', condicao: 'Condição', conciliado: 'Conciliado',
    valor_recebido: 'Valor recebido', descricao: 'Descrição', valor: 'Valor', tipo: 'Tipo'
};
const rotuloCampo = c => ROTULOS_CAMPO[c] || c.replace(/_/g, ' ');

let paginaAtual = 1;
const logsCarregados = {};

if (getUsuarioLogado()?.papel !== 'admin') {
    document.body.innerHTML = '<div style="padding:40px; font-family:sans-serif;">Esta página é restrita a administradores. <a href="index.html">Voltar ao início</a></div>';
} else {
    iniciarLogs();
}

function hojeISO(deslocaDias = 0) {
    const d = new Date();
    d.setDate(d.getDate() + deslocaDias);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

async function iniciarLogs() {
    document.getElementById('f-de').value = hojeISO(-6);
    document.getElementById('f-ate').value = hojeISO(0);
    document.getElementById('f-area').innerHTML += AREAS_LOG.map(a => `<option value="${a}">${a}</option>`).join('');
    try {
        const usuarios = await api.usuarios.listar();
        document.getElementById('f-usuario').innerHTML += usuarios.map(u => `<option value="${u.id}">${esc(u.nome)}</option>`).join('');
    } catch (e) { /* o filtro de usuário só fica vazio */ }
    carregarLogs(1);
}

function quandoFormatado(iso) {
    const [data, hora] = String(iso).split('T');
    const [a, m, d] = data.split('-');
    return `${d}/${m}/${a} ${hora || ''}`;
}

async function carregarLogs(pagina) {
    if (pagina < 1) return;
    paginaAtual = pagina;
    const tabela = document.getElementById('tabela-logs');

    const q = new URLSearchParams({ pagina, limite: 50 });
    const campos = { de: 'f-de', ate: 'f-ate', usuario_id: 'f-usuario', area: 'f-area', q: 'f-busca' };
    for (const [param, id] of Object.entries(campos)) {
        const v = document.getElementById(id).value.trim();
        if (v) q.set(param, v);
    }
    if (document.getElementById('f-falhas').checked) q.set('apenas_falhas', '1');
    if (document.getElementById('f-navegacao').checked) q.set('navegacao', '1');

    try {
        const r = await api.logs.listar('?' + q.toString());
        r.logs.forEach(l => { logsCarregados[l.id] = l; });
        tabela.innerHTML = r.logs.length ? r.logs.map(linhaLog).join('')
            : '<tr><td colspan="4" class="text-muted">Nenhum registro neste filtro.</td></tr>';

        const inicio = r.total ? (r.pagina - 1) * r.limite + 1 : 0;
        const fim = Math.min(r.pagina * r.limite, r.total);
        document.getElementById('logs-resumo').textContent = `Mostrando ${inicio}–${fim} de ${r.total} registro(s)`;
        document.getElementById('btn-anterior').disabled = r.pagina <= 1;
        document.getElementById('btn-proxima').disabled = r.pagina * r.limite >= r.total;
    } catch (err) {
        tabela.innerHTML = `<tr><td colspan="4" class="text-muted">Erro: ${esc(err.message)}</td></tr>`;
    }
}

function linhaLog(l) {
    const falhou = !Number(l.sucesso);
    return `
        <tr class="log-linha ${falhou ? 'falhou' : ''}" onclick="alternarDetalhe(${l.id}, this)">
            <td class="log-quando">${quandoFormatado(l.criado_em)}</td>
            <td class="log-quem">${esc(l.usuario_nome || '—')}
                ${l.usuario_papel ? `<span class="badge ${l.usuario_papel === 'admin' ? 'badge-green' : 'badge-gray'}">${l.usuario_papel === 'admin' ? 'Admin' : 'Vendedor'}</span>` : ''}</td>
            <td><span class="badge badge-gray">${esc(l.area)}</span></td>
            <td class="log-desc">${falhou ? '<span class="badge badge-red">falhou</span> ' : ''}${esc(l.descricao)}</td>
        </tr>`;
}

async function alternarDetalhe(id, tr) {
    const proxima = tr.nextElementSibling;
    if (proxima && proxima.classList.contains('log-detalhe')) { proxima.remove(); return; }

    const linha = document.createElement('tr');
    linha.className = 'log-detalhe';
    linha.innerHTML = '<td colspan="4">Carregando detalhes...</td>';
    tr.insertAdjacentElement('afterend', linha);

    try {
        const r = await api.logs.detalhe(id);
        linha.firstElementChild.innerHTML = metaDoLog(logsCarregados[id]) + renderizarDetalhe(r.dados);
    } catch (err) {
        linha.firstElementChild.textContent = 'Erro ao carregar detalhes: ' + err.message;
    }
}

function metaDoLog(l) {
    if (!l) return '';
    const partes = [];
    if (l.metodo && l.rota) partes.push(`Ação técnica: ${esc(l.metodo)} ${esc(l.rota)}${l.status_http ? ' (resposta ' + l.status_http + ')' : ''}`);
    if (l.ip) partes.push(`IP: ${esc(l.ip)}`);
    if (l.dispositivo) partes.push(`Aparelho/navegador: ${esc(l.dispositivo)}`);
    return partes.length ? `<div class="log-meta" style="margin-bottom:8px;">${partes.map(p => `<span>${p}</span>`).join('')}</div>` : '';
}

function renderizarDetalhe(d) {
    if (!d) return '<div class="log-meta">Sem detalhes adicionais para este registro.</div>';
    let html = '';

    if (d.mudancas && d.mudancas.length) {
        html += `<strong>O que mudou</strong>
            <table class="mud-tabela"><thead><tr><th>Campo</th><th>Antes</th><th>Depois</th></tr></thead><tbody>
            ${d.mudancas.map(m => `<tr><td>${esc(rotuloCampo(m.campo))}</td>
                <td class="de">${esc(valorLog(m.de))}</td><td class="para">${esc(valorLog(m.para))}</td></tr>`).join('')}
            </tbody></table>`;
    }
    if (d.erro) html += `<p><strong>Motivo da falha:</strong> ${esc(d.erro)}</p>`;
    if (d.resposta) html += `<p><strong>Resposta do sistema:</strong> ${esc(d.resposta)}</p>`;

    const extras = {};
    if (d.requisicao && Object.keys(d.requisicao).length) extras['Dados enviados'] = d.requisicao;
    if (!d.mudancas && d.antes) extras['Antes'] = d.antes;
    if (!d.mudancas && d.depois) extras['Depois'] = d.depois;
    for (const [titulo, valor] of Object.entries(extras)) {
        html += `<details style="margin-top:8px;"><summary style="cursor:pointer;">${titulo}</summary><pre>${esc(JSON.stringify(valor, null, 2))}</pre></details>`;
    }
    return html || '<div class="log-meta">Sem detalhes adicionais para este registro.</div>';
}

function valorLog(v) {
    return v === null || v === undefined || v === '' ? '—' : String(v);
}
