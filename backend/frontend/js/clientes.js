async function carregarClientes() {
    const busca = document.getElementById('busca').value;
    const params = busca ? `?busca=${encodeURIComponent(busca)}` : '';
    const tabela = document.getElementById('tabela-clientes');
    try {
        const clientes = await api.clientes.listar(params);
        tabela.innerHTML = clientes.length ? clientes.map(c => `
            <tr>
                <td><strong>${c.nome}</strong></td>
                <td>${c.celular || c.telefone || '-'}</td>
                <td>${c.cpf_cnpj || '-'}</td>
                <td class="text-muted">${c.email || '-'}</td>
                <td class="text-right"><button class="btn btn-secondary btn-sm" onclick="editarCliente(${c.id})">Editar</button></td>
            </tr>
        `).join('') : '<tr><td colspan="5" class="empty-state">Nenhum cliente cadastrado</td></tr>';
    } catch (err) {
        tabela.innerHTML = `<tr><td colspan="5" class="text-muted">Erro: ${err.message}</td></tr>`;
    }
}

// O formulário de cadastro/edição é o mesmo do pedido: js/cliente-modal.js
function abrirModalCliente() {
    ClienteModal.abrir({ aoSalvar: carregarClientes });
}

function editarCliente(id) {
    ClienteModal.abrir({ id, aoSalvar: carregarClientes });
}

document.getElementById('busca').addEventListener('input', (() => {
    let t;
    return () => { clearTimeout(t); t = setTimeout(carregarClientes, 300); };
})());

carregarClientes();
