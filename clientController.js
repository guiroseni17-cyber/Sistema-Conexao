const db = require('../config/db');

exports.listar = async (req, res) => {
    try {
        const { busca } = req.query;
        let sql = 'SELECT * FROM clientes';
        const params = [];
        if (busca) {
            sql += ' WHERE nome LIKE ? OR telefone LIKE ? OR cpf_cnpj LIKE ?';
            params.push(`%${busca}%`, `%${busca}%`, `%${busca}%`);
        }
        sql += ' ORDER BY nome ASC';
        const [rows] = await db.query(sql, params);
        res.json(rows);
    } catch (err) {
        res.status(500).json({ erro: 'Erro ao listar clientes', detalhe: err.message });
    }
};

exports.buscarPorId = async (req, res) => {
    try {
        const [rows] = await db.query('SELECT * FROM clientes WHERE id = ?', [req.params.id]);
        if (rows.length === 0) return res.status(404).json({ erro: 'Cliente não encontrado' });
        res.json(rows[0]);
    } catch (err) {
        res.status(500).json({ erro: 'Erro ao buscar cliente', detalhe: err.message });
    }
};

exports.criar = async (req, res) => {
    try {
        const { nome, telefone, cpf_cnpj, email, endereco } = req.body;
        if (!nome) return res.status(400).json({ erro: 'Nome é obrigatório' });

        const [result] = await db.query(
            'INSERT INTO clientes (nome, telefone, cpf_cnpj, email, endereco) VALUES (?, ?, ?, ?, ?)',
            [nome, telefone, cpf_cnpj, email, endereco]
        );
        res.status(201).json({ id: result.insertId, mensagem: 'Cliente cadastrado com sucesso' });
    } catch (err) {
        res.status(500).json({ erro: 'Erro ao cadastrar cliente', detalhe: err.message });
    }
};

exports.editar = async (req, res) => {
    try {
        const { nome, telefone, cpf_cnpj, email, endereco } = req.body;
        await db.query(
            'UPDATE clientes SET nome=?, telefone=?, cpf_cnpj=?, email=?, endereco=? WHERE id=?',
            [nome, telefone, cpf_cnpj, email, endereco, req.params.id]
        );
        res.json({ mensagem: 'Cliente atualizado com sucesso' });
    } catch (err) {
        res.status(500).json({ erro: 'Erro ao atualizar cliente', detalhe: err.message });
    }
};
