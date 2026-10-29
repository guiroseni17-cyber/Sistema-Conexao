// Página é só para admin — se um vendedor entrar aqui direto pela URL,
// a API já bloqueia (403), mas avisamos com uma mensagem clara.
if (getUsuarioLogado()?.papel !== 'admin') {
    document.body.innerHTML = '<div style="padding:40px; font-family:sans-serif;">Esta página é restrita a administradores. <a href="index.html">Voltar ao início</a></div>';
} else {
    carregarUsuarios();
}

async function carregarUsuarios() {
    const tabela = document.getElementById('tabela-usuarios');
    try {
        const usuarios = await api.usuarios.listar();
        tabela.innerHTML = usuarios.map(u => `
            <tr>
                <td><strong>${u.nome}</strong></td>
                <td class="text-muted">${u.email}</td>
                <td>${u.papel === 'admin' ? '<span class="badge badge-green">Admin</span>' : '<span class="badge badge-gray">Vendedor</span>'}</td>
                <td>${u.ativo ? '<span class="badge badge-green">Ativo</span>' : '<span class="badge badge-red">Bloqueado</span>'}</td>
                <td class="text-right">
                    <button class="btn btn-secondary btn-sm" onclick="alternarAtivo(${u.id})">${u.ativo ? 'Bloquear' : 'Reativar'}</button>
                </td>
            </tr>
        `).join('');
    } catch (err) {
        tabela.innerHTML = `<tr><td colspan="5" class="text-muted">Erro: ${err.message}</td></tr>`;
    }
}

function abrirModalUsuario() {
    document.getElementById('form-usuario').reset();
    document.getElementById('modal-usuario').style.display = 'flex';
}
function fecharModalUsuario() {
    document.getElementById('modal-usuario').style.display = 'none';
}

async function alternarAtivo(id) {
    try {
        await api.usuarios.alternarAtivo(id);
        carregarUsuarios();
    } catch (err) {
        alert('Erro: ' + err.message);
    }
}

document.getElementById('form-usuario').addEventListener('submit', async (e) => {
    e.preventDefault();
    const dados = {
        nome: document.getElementById('u-nome').value,
        email: document.getElementById('u-email').value,
        senha: document.getElementById('u-senha').value,
        papel: document.getElementById('u-papel').value
    };
    try {
        await api.usuarios.criar(dados);
        fecharModalUsuario();
        carregarUsuarios();
    } catch (err) {
        alert('Erro ao cadastrar usuário: ' + err.message);
    }
});
