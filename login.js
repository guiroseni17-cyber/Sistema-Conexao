document.getElementById('form-login').addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('email').value;
    const senha = document.getElementById('senha').value;
    const erroBox = document.getElementById('login-erro');
    erroBox.style.display = 'none';

    try {
        const resultado = await api.auth.login(email, senha);
        localStorage.setItem('foneninja_token', resultado.token);
        localStorage.setItem('foneninja_usuario', JSON.stringify(resultado.usuario));
        window.location.href = 'index.html';
    } catch (err) {
        erroBox.textContent = err.message;
        erroBox.style.display = 'block';
    }
});
