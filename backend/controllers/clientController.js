const db = require('../config/db');
const { validarDocumento } = require('../documentos');

// Data de nascimento sai como texto AAAA-MM-DD (evita deslocar o dia por fuso horário)
const SELECT_CLIENTE = `SELECT *, DATE_FORMAT(data_nascimento, '%Y-%m-%d') AS data_nascimento FROM clientes`;

const vazioParaNulo = (v) => (v === undefined || v === null || String(v).trim() === '' ? null : String(v).trim());

// Campos do cadastro, na ordem usada nos comandos SQL
function lerCampos(body) {
    return {
        nome: vazioParaNulo(body.nome),
        tipo_pessoa: body.tipo_pessoa === 'Jurídica' ? 'Jurídica' : 'Física',
        cpf_cnpj: vazioParaNulo(body.cpf_cnpj),
        consumidor_final: body.consumidor_final === undefined ? 1 : (body.consumidor_final ? 1 : 0),
        data_nascimento: vazioParaNulo(body.data_nascimento),
        genero: vazioParaNulo(body.genero),
        celular: vazioParaNulo(body.celular),
        telefone: vazioParaNulo(body.telefone),
        email: vazioParaNulo(body.email),
        cep: vazioParaNulo(body.cep),
        endereco: vazioParaNulo(body.endereco),
        numero: vazioParaNulo(body.numero),
        complemento: vazioParaNulo(body.complemento),
        bairro: vazioParaNulo(body.bairro),
        cidade: vazioParaNulo(body.cidade),
        estado: vazioParaNulo(body.estado)
    };
}

exports.listar = async (req, res) => {
    try {
        const { busca } = req.query;
        let sql = SELECT_CLIENTE;
        const params = [];
        if (busca) {
            sql += ' WHERE nome LIKE ? OR telefone LIKE ? OR celular LIKE ? OR cpf_cnpj LIKE ?';
            params.push(`%${busca}%`, `%${busca}%`, `%${busca}%`, `%${busca}%`);
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
        const [rows] = await db.query(`${SELECT_CLIENTE} WHERE id = ?`, [req.params.id]);
        if (rows.length === 0) return res.status(404).json({ erro: 'Cliente não encontrado' });
        res.json(rows[0]);
    } catch (err) {
        res.status(500).json({ erro: 'Erro ao buscar cliente', detalhe: err.message });
    }
};

exports.criar = async (req, res) => {
    try {
        const c = lerCampos(req.body);
        if (!c.nome) return res.status(400).json({ erro: 'Nome é obrigatório' });
        const doc = validarDocumento(c.cpf_cnpj);
        if (!doc.valido) return res.status(400).json({ erro: doc.mensagem });

        const colunas = Object.keys(c);
        const [result] = await db.query(
            `INSERT INTO clientes (${colunas.join(', ')}) VALUES (${colunas.map(() => '?').join(', ')})`,
            colunas.map(k => c[k])
        );
        res.status(201).json({ id: result.insertId, mensagem: 'Cliente cadastrado com sucesso' });
    } catch (err) {
        res.status(500).json({ erro: 'Erro ao cadastrar cliente', detalhe: err.message });
    }
};

exports.editar = async (req, res) => {
    try {
        const c = lerCampos(req.body);
        if (!c.nome) return res.status(400).json({ erro: 'Nome é obrigatório' });
        const doc = validarDocumento(c.cpf_cnpj);
        if (!doc.valido) return res.status(400).json({ erro: doc.mensagem });

        const colunas = Object.keys(c);
        await db.query(
            `UPDATE clientes SET ${colunas.map(k => `${k} = ?`).join(', ')} WHERE id = ?`,
            [...colunas.map(k => c[k]), req.params.id]
        );
        res.json({ mensagem: 'Cliente atualizado com sucesso' });
    } catch (err) {
        res.status(500).json({ erro: 'Erro ao atualizar cliente', detalhe: err.message });
    }
};
