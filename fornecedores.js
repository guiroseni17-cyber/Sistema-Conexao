async function carregarFornecedores() {
    const busca = document.getElementById('busca').value;
    const params = busca ? `?busca=${encodeURIComponent(busca)}` : '';
    const tabela = document.getElementById('tabela-fornecedores');
    try {
        const fornecedores = await api.fornecedores.listar(params);
        tabela.innerHTML = fornecedores.length ? fornecedores.map(f => `
            <tr>
                <td><strong>${f.nome}</strong></td>
                <td>${f.telefone || '-'}</td>
                <td>${f.cnpj_cpf || '-'}</td>
                <td class="text-muted">${f.email || '-'}</td>
                <td class="text-right">
                    <div class="row-actions">
                        <button class="btn btn-secondary btn-sm" onclick="editarFornecedor(${f.id})">Editar</button>
                        <button class="btn btn-danger btn-sm" onclick="removerFornecedor(${f.id})">Remover</button>
                    </div>
                </td>
            </tr>
        `).join('') : '<tr><td colspan="5" class="empty-state">Nenhum fornecedor cadastrado</td></tr>';
    } catch (err) {
        tabela.innerHTML = `<tr><td colspan="5" class="text-muted">Erro: ${err.message}</td></tr>`;
    }
}

function abrirModalFornecedor() {
    document.getElementById('form-fornecedor').reset();
    delete document.getElementById('form-fornecedor').dataset.editId;
    document.getElementById('titulo-modal-fornecedor').textContent = 'Novo fornecedor';
    document.getElementById('modal-fornecedor').style.display = 'flex';
}
function fecharModalFornecedor() {
    document.getElementById('modal-fornecedor').style.display = 'none';
}

async function editarFornecedor(id) {
    const f = await api.fornecedores.buscar(id);
    document.getElementById('f-nome').value = f.nome;
    document.getElementById('f-telefone').value = f.telefone || '';
    document.getElementById('f-cnpj').value = f.cnpj_cpf || '';
    document.getElementById('f-email').value = f.email || '';
    document.getElementById('f-endereco').value = f.endereco || '';
    document.getElementById('f-obs').value = f.observacoes || '';
    document.getElementById('form-fornecedor').dataset.editId = id;
    document.getElementById('titulo-modal-fornecedor').textContent = 'Editar fornecedor';
    document.getElementById('modal-fornecedor').style.display = 'flex';
}

async function removerFornecedor(id) {
    if (!confirm('Remover este fornecedor? O histórico de compras dele é mantido.')) return;
    try {
        await api.fornecedores.remover(id);
        carregarFornecedores();
    } catch (err) {
        alert('Erro ao remover fornecedor: ' + err.message);
    }
}

document.getElementById('form-fornecedor').addEventListener('submit', async (e) => {
    e.preventDefault();
    const dados = {
        nome: document.getElementById('f-nome').value,
        telefone: document.getElementById('f-telefone').value,
        cnpj_cpf: document.getElementById('f-cnpj').value,
        email: document.getElementById('f-email').value,
        endereco: document.getElementById('f-endereco').value,
        observacoes: document.getElementById('f-obs').value
    };
    const editId = e.target.dataset.editId;
    try {
        if (editId) {
            await api.fornecedores.editar(editId, dados);
            delete e.target.dataset.editId;
        } else {
            await api.fornecedores.criar(dados);
        }
        fecharModalFornecedor();
        carregarFornecedores();
    } catch (err) {
        alert('Erro ao salvar fornecedor: ' + err.message);
    }
});

document.getElementById('busca').addEventListener('input', (() => {
    let t;
    return () => { clearTimeout(t); t = setTimeout(carregarFornecedores, 300); };
})());

carregarFornecedores();
