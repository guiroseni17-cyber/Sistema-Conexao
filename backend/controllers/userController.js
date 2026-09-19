const bcrypt = require('bcryptjs');
const db = require('../config/db');

exports.listar = async (req, res) => {
    try {
        const [rows] = await db.query(
            'SELECT id, nome, email, papel, ativo, criado_em FROM usuarios ORDER BY nome ASC'
        );
        res.json(rows);
    } catch (err) {
        res.status(500).json({ erro: 'Erro ao listar usuários', detalhe: err.message });
    }
};

exports.criar = async (req, res) => {
    try {
        const { nome, email, senha, papel } = req.body;
        if (!nome || !email || !senha) {
            return res.status(400).json({ erro: 'Nome, e-mail e senha são obrigatórios' });
        }

        const [dup] = await db.query('SELECT id FROM usuarios WHERE email = ?', [email]);
        if (dup.length > 0) {
            return res.status(400).json({ erro: 'Já existe um usuário com esse e-mail' });
        }

        const senhaHash = await bcrypt.hash(senha, 10);
        const [result] = await db.query(
            'INSERT INTO usuarios (nome, email, senha_hash, papel) VALUES (?, ?, ?, ?)',
            [nome, email, senhaHash, papel === 'admin' ? 'admin' : 'vendedor']
        );
        res.status(201).json({ id: result.insertId, mensagem: 'Usuário cadastrado com sucesso' });
    } catch (err) {
        res.status(500).json({ erro: 'Erro ao cadastrar usuário', detalhe: err.message });
    }
};

// Ativa/desativa o acesso de alguém da equipe (não apaga, só bloqueia o login)
exports.alternarAtivo = async (req, res) => {
    try {
        await db.query('UPDATE usuarios SET ativo = NOT ativo WHERE id = ?', [req.params.id]);
        res.json({ mensagem: 'Status do usuário atualizado' });
    } catch (err) {
        res.status(500).json({ erro: 'Erro ao atualizar usuário', detalhe: err.message });
    }
};

// Troca a própria senha (qualquer usuário logado)
exports.trocarSenha = async (req, res) => {
    try {
        const { senha_atual, senha_nova } = req.body;
        const [rows] = await db.query('SELECT senha_hash FROM usuarios WHERE id = ?', [req.user.id]);
        if (rows.length === 0) return res.status(404).json({ erro: 'Usuário não encontrado' });

        const confere = await bcrypt.compare(senha_atual, rows[0].senha_hash);
        if (!confere) return res.status(400).json({ erro: 'Senha atual incorreta' });

        const novaHash = await bcrypt.hash(senha_nova, 10);
        await db.query('UPDATE usuarios SET senha_hash = ? WHERE id = ?', [novaHash, req.user.id]);
        res.json({ mensagem: 'Senha alterada com sucesso' });
    } catch (err) {
        res.status(500).json({ erro: 'Erro ao trocar senha', detalhe: err.message });
    }
};
