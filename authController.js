const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const db = require('../config/db');

exports.login = async (req, res) => {
    try {
        const { email, senha } = req.body;
        if (!email || !senha) {
            return res.status(400).json({ erro: 'Informe e-mail e senha' });
        }

        const [rows] = await db.query(
            'SELECT * FROM usuarios WHERE email = ? AND ativo = TRUE', [email]
        );
        if (rows.length === 0) {
            return res.status(401).json({ erro: 'E-mail ou senha incorretos' });
        }

        const usuario = rows[0];
        const senhaCorreta = await bcrypt.compare(senha, usuario.senha_hash);
        if (!senhaCorreta) {
            return res.status(401).json({ erro: 'E-mail ou senha incorretos' });
        }

        const token = jwt.sign(
            { id: usuario.id, nome: usuario.nome, papel: usuario.papel },
            process.env.JWT_SECRET,
            { expiresIn: '12h' }
        );

        res.json({
            token,
            usuario: { id: usuario.id, nome: usuario.nome, email: usuario.email, papel: usuario.papel }
        });
    } catch (err) {
        res.status(500).json({ erro: 'Erro ao fazer login', detalhe: err.message });
    }
};

// Retorna os dados de quem está logado (usado pelo frontend para
// mostrar o nome na tela e decidir se mostra opções de admin)
exports.me = async (req, res) => {
    res.json(req.user);
};
