const db = require('./db');

// Colunas que o sistema precisa. Roda sozinho ao ligar o servidor e só cria
// o que ainda não existe, então é seguro com o banco que já está no ar.
const COLUNAS = [
    ['produtos', 'imei2', 'VARCHAR(30) NULL'],
    ['produtos', 'numero_serie', 'VARCHAR(60) NULL'],
    ['produtos', 'bateria', 'TINYINT UNSIGNED NULL'],
    ['produtos', 'garantia', 'VARCHAR(30) NULL'],
    ['produtos', 'preco_venda_atacado', 'DECIMAL(10,2) NULL'],
    ['pedido_trocas', 'preco_compra', 'DECIMAL(10,2) NULL'],
    ['pedido_trocas', 'desconto', 'DECIMAL(10,2) NOT NULL DEFAULT 0']
];

async function migrar() {
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
}

module.exports = { migrar };
