const db = require('./db');

// Colunas que o sistema precisa. Roda sozinho ao ligar o servidor e só cria
// o que ainda não existe, então é seguro com o banco que já está no ar.
const COLUNAS = [
    ['produtos', 'imei2', 'VARCHAR(30) NULL'],
    ['produtos', 'numero_serie', 'VARCHAR(60) NULL'],
    ['produtos', 'bateria', 'TINYINT UNSIGNED NULL'],
    ['produtos', 'garantia', 'VARCHAR(30) NULL'],
    ['produtos', 'preco_venda_atacado', 'DECIMAL(10,2) NULL'],
    ['produtos', 'modelo_base_id', 'INT NULL'],
    ['pedidos', 'frete', 'DECIMAL(10,2) NOT NULL DEFAULT 0'],
    ['pedidos', 'desconto', 'DECIMAL(10,2) NOT NULL DEFAULT 0'],
    ['pedido_trocas', 'preco_compra', 'DECIMAL(10,2) NULL'],
    ['pedido_trocas', 'desconto', 'DECIMAL(10,2) NOT NULL DEFAULT 0'],
    // Produto pai: cada variação (modelos_base) aponta para o seu pai
    ['modelos_base', 'produto_pai_id', 'INT NULL'],
    ['modelos_base', 'atributos', 'TEXT NULL'],
    // Cadastro completo de cliente (mesmo formulário em Clientes e no Pedido)
    ['clientes', 'tipo_pessoa', "VARCHAR(10) NOT NULL DEFAULT 'Física'"],
    ['clientes', 'consumidor_final', 'BOOLEAN NOT NULL DEFAULT TRUE'],
    ['clientes', 'data_nascimento', 'DATE NULL'],
    ['clientes', 'genero', 'VARCHAR(20) NULL'],
    ['clientes', 'celular', 'VARCHAR(20) NULL'],
    ['clientes', 'cep', 'VARCHAR(12) NULL'],
    ['clientes', 'numero', 'VARCHAR(20) NULL'],
    ['clientes', 'complemento', 'VARCHAR(100) NULL'],
    ['clientes', 'bairro', 'VARCHAR(100) NULL'],
    ['clientes', 'cidade', 'VARCHAR(100) NULL'],
    ['clientes', 'estado', 'VARCHAR(2) NULL'],
    // Observação livre de cada forma de pagamento (ex.: "12x de R$ 190")
    ['pedido_pagamentos', 'observacao', 'VARCHAR(255) NULL'],
    // Conciliação: quanto realmente caiu na conta (a diferença para o valor da venda é a taxa)
    ['pedido_pagamentos', 'conciliado', 'BOOLEAN NOT NULL DEFAULT FALSE'],
    ['pedido_pagamentos', 'valor_recebido', 'DECIMAL(10,2) NULL'],
    ['pedido_pagamentos', 'conciliado_em', 'DATETIME NULL']
];

// Tabelas novas (criadas só se ainda não existirem)
const TABELAS = [
    `CREATE TABLE IF NOT EXISTS modelos_base (
        id INT AUTO_INCREMENT PRIMARY KEY,
        nome VARCHAR(150) NOT NULL,
        categoria ENUM('aparelho_novo', 'aparelho_seminovo', 'acessorio', 'peca') NOT NULL DEFAULT 'aparelho_novo',
        condicao ENUM('novo', 'seminovo_excelente', 'seminovo_bom', 'seminovo_regular') DEFAULT 'novo',
        marca VARCHAR(60),
        modelo VARCHAR(100),
        preco_venda DECIMAL(10,2) NOT NULL DEFAULT 0,
        ativo BOOLEAN DEFAULT TRUE,
        criado_em DATETIME DEFAULT CURRENT_TIMESTAMP
    )`,
    // Produtos pai (ex: "iPhone 17 Pro Max"). As variações (cor, armazenamento...) ficam em modelos_base.
    `CREATE TABLE IF NOT EXISTS produtos_pai (
        id INT AUTO_INCREMENT PRIMARY KEY,
        nome VARCHAR(150) NOT NULL,
        categoria ENUM('aparelho_novo', 'aparelho_seminovo', 'acessorio', 'peca') NOT NULL DEFAULT 'aparelho_novo',
        condicao ENUM('novo', 'seminovo_excelente', 'seminovo_bom', 'seminovo_regular') DEFAULT 'novo',
        marca VARCHAR(60),
        preco_venda DECIMAL(10,2) NOT NULL DEFAULT 0,
        ativo BOOLEAN DEFAULT TRUE,
        criado_em DATETIME DEFAULT CURRENT_TIMESTAMP
  )`,
    // Metas do mês (tela "Meta do mês" e cartões do dashboard)
    `CREATE TABLE IF NOT EXISTS metas_mensais (
        id INT AUTO_INCREMENT PRIMARY KEY,
        mes CHAR(7) NOT NULL,
        nome VARCHAR(60) NOT NULL,
        tipo ENUM('quantidade', 'valor') NOT NULL DEFAULT 'quantidade',
        alvo DECIMAL(12,2) NOT NULL DEFAULT 0,
        palavras VARCHAR(255) NULL,
        categorias VARCHAR(120) NULL,
        ordem INT NOT NULL DEFAULT 0,
        UNIQUE KEY uq_meta_mes_nome (mes, nome)
    )`,
    // Despesas e outras entradas lançadas na tela "Lucro real" (aluguel, salários, etc.)
    `CREATE TABLE IF NOT EXISTS lancamentos (
        id INT AUTO_INCREMENT PRIMARY KEY,
        tipo ENUM('despesa', 'receita') NOT NULL DEFAULT 'despesa',
        descricao VARCHAR(150) NOT NULL,
        categoria VARCHAR(60) NULL,
        valor DECIMAL(10,2) NOT NULL DEFAULT 0,
        data DATE NOT NULL,
        conta VARCHAR(60) NULL,
        conciliado BOOLEAN NOT NULL DEFAULT FALSE,
        usuario_id INT NULL,
        criado_em DATETIME DEFAULT CURRENT_TIMESTAMP
    )`,
    // Logs: registro de tudo que cada pessoa faz no sistema (tela Administração > Logs)
    `CREATE TABLE IF NOT EXISTS logs_atividade (
        id BIGINT AUTO_INCREMENT PRIMARY KEY,
        criado_em DATETIME NOT NULL,
        usuario_id INT NULL,
        usuario_nome VARCHAR(120) NULL,
        usuario_papel VARCHAR(20) NULL,
        area VARCHAR(30) NOT NULL,
        acao VARCHAR(60) NOT NULL,
        descricao VARCHAR(600) NOT NULL,
        entidade VARCHAR(40) NULL,
        entidade_id INT NULL,
        sucesso BOOLEAN NOT NULL DEFAULT TRUE,
        metodo VARCHAR(8) NULL,
        rota VARCHAR(255) NULL,
        status_http SMALLINT NULL,
        ip VARCHAR(60) NULL,
        dispositivo VARCHAR(200) NULL,
        dados MEDIUMTEXT NULL,
        INDEX idx_logs_data (criado_em),
        INDEX idx_logs_usuario (usuario_id, criado_em),
        INDEX idx_logs_area (area, criado_em),
        INDEX idx_logs_entidade (entidade, entidade_id)
    )`
];

// Variações cadastradas antes da existência do produto pai: o nome do pai estava
// guardado na coluna "modelo". Agrupa por esse nome e cria os pais automaticamente.
// Só mexe em variações sem pai, então rodar várias vezes não duplica nada.
async function agruparVariacoesAntigas() {
    const [soltas] = await db.query(
        `SELECT id, nome, categoria, condicao, marca, modelo, preco_venda
         FROM modelos_base WHERE ativo = TRUE AND produto_pai_id IS NULL ORDER BY id`
    );
    if (soltas.length === 0) return;

    const grupos = new Map();
    for (const m of soltas) {
        const nomePai = String(m.modelo || '').trim() || String(m.nome).trim();
        const chave = [nomePai.toLowerCase(), String(m.marca || '').toLowerCase(), m.categoria].join('|');
        if (!grupos.has(chave)) {
            grupos.set(chave, { nome: nomePai, categoria: m.categoria, condicao: m.condicao, marca: m.marca, preco: 0, ids: [] });
        }
        const g = grupos.get(chave);
        g.ids.push(m.id);
        if (!g.preco && Number(m.preco_venda) > 0) g.preco = Number(m.preco_venda);
    }

    for (const g of grupos.values()) {
        const [r] = await db.query(
            'INSERT INTO produtos_pai (nome, categoria, condicao, marca, preco_venda) VALUES (?, ?, ?, ?, ?)',
            [g.nome, g.categoria, g.condicao, g.marca || null, g.preco]
        );
        await db.query(
            'UPDATE modelos_base SET produto_pai_id = ?, modelo = ? WHERE id IN (?)',
            [r.insertId, g.nome, g.ids]
        );
    }
    console.log(`Migração: ${soltas.length} variação(ões) antigas agrupadas em ${grupos.size} produto(s) pai`);
}

async function migrar() {
    for (const sql of TABELAS) await db.query(sql);
    for (const [tabela, coluna, definicao] of COLUNAS) {
        const [rows] = await db.query(
            `SELECT COUNT(*) AS total FROM information_schema.COLUMNS
             WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
            [tabela, coluna]
        );
        if (rows[0].total === 0) {
            await db.query(`ALTER TABLE \`${tabela}\` ADD COLUMN \`${coluna}\` ${definicao}`);
            console.log(`Migração: coluna ${tabela}.${coluna} criada`);
        }
    }
    await agruparVariacoesAntigas();
}

module.exports = { migrar };
