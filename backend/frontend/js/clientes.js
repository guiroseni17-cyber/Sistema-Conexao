async function carregarClientes() {
    const busca = document.getElementById('busca').value;
    const params = busca ? `?busca=${encodeURIComponent(busca)}` : '';
    const tabela = document.getElementById('tabela-clientes');
    try {
        const clientes = await api.clientes.listar(params);
        tabela.innerHTML = clientes.length ? clientes.map(c => `
            <tr>
                <td><strong>${c.nome}</strong></td>
                <td>${c.telefone || '-'}</td>
                <td>${c.cpf_cnpj || '-'}</td>
                <td class="text-muted">${c.email || '-'}</td>
                <td class="text-right"><button class="btn btn-secondary btn-sm" onclick="editarCliente(${c.id})">Editar</button></td>
            </tr>
        `).join('') : '<tr><td colspan="5" class="empty-state">Nenhum cliente cadastrado</td></tr>';
    } catch (err) {
        tabela.innerHTML = `<tr><td colspan="5" class="text-muted">Erro: ${err.message}</td></tr>`;
    }
}

function abrirModalCliente() {
    document.getElementById('form-cliente').reset();
    delete document.getElementById('form-cliente').dataset.editId;
    document.getElementById('titulo-modal-cliente').textContent = 'Novo cliente';
    document.getElementById('modal-cliente').style.display = 'flex';
}
function fecharModalCliente() {
    document.getElementById('modal-cliente').style.display = 'none';
}

async function editarCliente(id) {
    const c = await api.clientes.buscar(id);
    document.getElementById('c-nome').value = c.nome;
    document.getElementById('c-telefone').value = c.telefone || '';
    document.getElementById('c-cpf').value = c.cpf_cnpj || '';
    document.getElementById('c-email').value = c.email || '';
    document.getElementById('c-endereco').value = c.endereco || '';
    document.getElementById('form-cliente').dataset.editId = id;
    document.getElementById('titulo-modal-cliente').textContent = 'Editar cliente';
    document.getElementById('modal-cliente').style.display = 'flex';
}

document.getElementById('form-cliente').addEventListener('submit', async (e) => {
    e.preventDefault();
    const dados = {
        nome: document.getElementById('c-nome').value,
        telefone: document.getElementById('c-telefone').value,
        cpf_cnpj: document.getElementById('c-cpf').value,
        email: document.getElementById('c-email').value,
        endereco: document.getElementById('c-endereco').value
    };
    const editId = e.target.dataset.editId;
    try {
        if (editId) {
            await api.clientes.editar(editId, dados);
            delete e.target.dataset.editId;
        } else {
            await api.clientes.criar(dados);
        }
        fecharModalCliente();
        carregarClientes();
    } catch (err) {
        alert('Erro ao salvar cliente: ' + err.message);
    }
});

document.getElementById('busca').addEventListener('input', (() => {
    let t;
    return () => { clearTimeout(t); t = setTimeout(carregarClientes, 300); };
})());

carregarClientes();
