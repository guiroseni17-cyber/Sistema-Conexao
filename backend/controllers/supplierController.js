const db = require('../config/db');

exports.listar = async (req, res) => {
    try {
        const { busca } = req.query;
        let sql = 'SELECT * FROM fornecedores WHERE ativo = TRUE';
        const params = [];
        if (busca) {
            sql += ' AND (nome LIKE ? OR telefone LIKE ? OR cnpj_cpf LIKE ?)';
            params.push(`%${busca}%`, `%${busca}%`, `%${busca}%`);
        }
        sql += ' ORDER BY nome ASC';
        const [rows] = await db.query(sql, params);
        res.json(rows);
    } catch (err) {
        res.status(500).json({ erro: 'Erro ao listar fornecedores', detalhe: err.message });
    }
};

exports.buscarPorId = async (req, res) => {
    try {
        const [rows] = await db.query('SELECT * FROM fornecedores WHERE id = ?', [req.params.id]);
        if (rows.length === 0) return res.status(404).json({ erro: 'Fornecedor não encontrado' });
        res.json(rows[0]);
    } catch (err) {
        res.status(500).json({ erro: 'Erro ao buscar fornecedor', detalhe: err.message });
    }
};

exports.criar = async (req, res) => {
    try {
        const { nome, telefone, cnpj_cpf, email, endereco, observacoes } = req.body;
        if (!nome) return res.status(400).json({ erro: 'Nome é obrigatório' });

        const [result] = await db.query(
            'INSERT INTO fornecedores (nome, telefone, cnpj_cpf, email, endereco, observacoes) VALUES (?, ?, ?, ?, ?, ?)',
            [nome, telefone, cnpj_cpf, email, endereco, observacoes]
        );
        res.status(201).json({ id: result.insertId, mensagem: 'Fornecedor cadastrado com sucesso' });
    } catch (err) {
        res.status(500).json({ erro: 'Erro ao cadastrar fornecedor', detalhe: err.message });
    }
};

exports.editar = async (req, res) => {
    try {
        const { nome, telefone, cnpj_cpf, email, endereco, observacoes } = req.body;
        await db.query(
            'UPDATE fornecedores SET nome=?, telefone=?, cnpj_cpf=?, email=?, endereco=?, observacoes=? WHERE id=?',
            [nome, telefone, cnpj_cpf, email, endereco, observacoes, req.params.id]
        );
        res.json({ mensagem: 'Fornecedor atualizado com sucesso' });
    } catch (err) {
        res.status(500).json({ erro: 'Erro ao atualizar fornecedor', detalhe: err.message });
    }
};

exports.remover = async (req, res) => {
    try {
        await db.query('UPDATE fornecedores SET ativo = FALSE WHERE id = ?', [req.params.id]);
        res.json({ mensagem: 'Fornecedor removido' });
    } catch (err) {
        res.status(500).json({ erro: 'Erro ao remover fornecedor', detalhe: err.message });
    }
};
