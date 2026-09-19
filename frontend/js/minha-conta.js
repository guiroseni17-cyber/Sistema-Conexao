document.getElementById('form-senha').addEventListener('submit', async (e) => {
    e.preventDefault();
    const msg = document.getElementById('senha-msg');
    msg.style.display = 'none';

    try {
        const resultado = await api.usuarios.trocarSenha({
            senha_atual: document.getElementById('senha-atual').value,
            senha_nova: document.getElementById('senha-nova').value
        });
        msg.style.cssText = 'display:block; margin-bottom:14px; font-size:12.5px; color:var(--green);';
        msg.textContent = resultado.mensagem;
        document.getElementById('form-senha').reset();
    } catch (err) {
        msg.style.cssText = 'display:block; margin-bottom:14px; font-size:12.5px; color:var(--accent-dark);';
        msg.textContent = err.message;
    }
});
