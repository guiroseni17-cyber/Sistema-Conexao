-- ============================================
-- FoneNinja - Schema do Banco de Dados
-- ============================================

CREATE DATABASE IF NOT EXISTS foneninja CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE foneninja;

-- ---------------------------------------------
-- Usuários (equipe da loja)
-- ---------------------------------------------
CREATE TABLE usuarios (
    id INT AUTO_INCREMENT PRIMARY KEY,
    nome VARCHAR(150) NOT NULL,
    email VARCHAR(150) NOT NULL UNIQUE,
    senha_hash VARCHAR(255) NOT NULL,
    papel ENUM('admin', 'vendedor') NOT NULL DEFAULT 'vendedor',
    ativo BOOLEAN DEFAULT TRUE,
    criado_em DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- ---------------------------------------------
-- Clientes
-- ---------------------------------------------
CREATE TABLE clientes (
    id INT AUTO_INCREMENT PRIMARY KEY,
    nome VARCHAR(150) NOT NULL,
    telefone VARCHAR(20),
    cpf_cnpj VARCHAR(20),
    email VARCHAR(150),
    endereco VARCHAR(255),
    criado_em DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- ---------------------------------------------
-- Fornecedores
-- ---------------------------------------------
CREATE TABLE fornecedores (
    id INT AUTO_INCREMENT PRIMARY KEY,
    nome VARCHAR(150) NOT NULL,
    telefone VARCHAR(20),
    cnpj_cpf VARCHAR(20),
    email VARCHAR(150),
    endereco VARCHAR(255),
    observacoes TEXT,
    ativo BOOLEAN DEFAULT TRUE,
    criado_em DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- ---------------------------------------------
-- Produtos / Estoque
-- Cobre aparelhos novos, seminovos (recebidos em troca) e acessórios
-- ---------------------------------------------
CREATE TABLE produtos (
    id INT AUTO_INCREMENT PRIMARY KEY,
    nome VARCHAR(150) NOT NULL,
    categoria ENUM('aparelho_novo', 'aparelho_seminovo', 'acessorio', 'peca') NOT NULL DEFAULT 'aparelho_novo',
    marca VARCHAR(60),
    modelo VARCHAR(100),
    imei VARCHAR(30),
    condicao ENUM('novo', 'seminovo_excelente', 'seminovo_bom', 'seminovo_regular') DEFAULT 'novo',
    quantidade INT NOT NULL DEFAULT 0,
    estoque_minimo INT NOT NULL DEFAULT 2,
    preco_custo DECIMAL(10,2) DEFAULT 0,
    preco_venda DECIMAL(10,2) NOT NULL DEFAULT 0,
    origem ENUM('compra', 'troca') NOT NULL DEFAULT 'compra',
    observacoes TEXT,
    ativo BOOLEAN DEFAULT TRUE,
    criado_em DATETIME DEFAULT CURRENT_TIMESTAMP,
    atualizado_em DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- ---------------------------------------------
-- Compras (entrada de mercadoria vinda de fornecedor)
-- ---------------------------------------------
CREATE TABLE compras (
    id INT AUTO_INCREMENT PRIMARY KEY,
    fornecedor_id INT NOT NULL,
    usuario_id INT,
    status ENUM('ativa', 'cancelada') NOT NULL DEFAULT 'ativa',
    status_pagamento ENUM('pendente', 'parcial', 'pago') NOT NULL DEFAULT 'pendente',
    valor_total DECIMAL(10,2) NOT NULL DEFAULT 0,
    valor_pago DECIMAL(10,2) NOT NULL DEFAULT 0,
    observacoes TEXT,
    criado_em DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (fornecedor_id) REFERENCES fornecedores(id),
    FOREIGN KEY (usuario_id) REFERENCES usuarios(id)
);

-- Itens comprados (cada linha gera ou repõe um produto no estoque)
CREATE TABLE compra_itens (
    id INT AUTO_INCREMENT PRIMARY KEY,
    compra_id INT NOT NULL,
    produto_id INT NOT NULL,
    quantidade INT NOT NULL DEFAULT 1,
    preco_custo_unitario DECIMAL(10,2) NOT NULL DEFAULT 0,
    FOREIGN KEY (compra_id) REFERENCES compras(id) ON DELETE CASCADE,
    FOREIGN KEY (produto_id) REFERENCES produtos(id)
);

-- ---------------------------------------------
-- Pedidos de Venda
-- ---------------------------------------------
CREATE TABLE pedidos (
    id INT AUTO_INCREMENT PRIMARY KEY,
    cliente_id INT NOT NULL,
    usuario_id INT,
    status ENUM('aberto', 'finalizado', 'cancelado') DEFAULT 'finalizado',
    forma_pagamento VARCHAR(50),
    valor_total DECIMAL(10,2) NOT NULL DEFAULT 0,
    valor_troca DECIMAL(10,2) NOT NULL DEFAULT 0,
    valor_a_pagar DECIMAL(10,2) NOT NULL DEFAULT 0,
    observacoes TEXT,
    criado_em DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (cliente_id) REFERENCES clientes(id),
    FOREIGN KEY (usuario_id) REFERENCES usuarios(id)
);

-- ---------------------------------------------
-- Itens do pedido (produtos vendidos - saída de estoque)
-- ---------------------------------------------
CREATE TABLE pedido_itens (
    id INT AUTO_INCREMENT PRIMARY KEY,
    pedido_id INT NOT NULL,
    produto_id INT NOT NULL,
    quantidade INT NOT NULL DEFAULT 1,
    preco_unitario DECIMAL(10,2) NOT NULL,
    FOREIGN KEY (pedido_id) REFERENCES pedidos(id) ON DELETE CASCADE,
    FOREIGN KEY (produto_id) REFERENCES produtos(id)
);

-- ---------------------------------------------
-- Trocas vinculadas ao pedido (aparelho recebido - entrada em estoque)
-- Guarda o vínculo entre o pedido e o produto que foi criado no estoque
-- ---------------------------------------------
CREATE TABLE pedido_trocas (
    id INT AUTO_INCREMENT PRIMARY KEY,
    pedido_id INT NOT NULL,
    produto_id INT NOT NULL, -- produto criado automaticamente no estoque
    valor_abatido DECIMAL(10,2) NOT NULL DEFAULT 0,
    FOREIGN KEY (pedido_id) REFERENCES pedidos(id) ON DELETE CASCADE,
    FOREIGN KEY (produto_id) REFERENCES produtos(id)
);

-- ---------------------------------------------
-- Movimentações de estoque — histórico único de toda entrada/saída,
-- não importa se veio de compra, troca, venda, cancelamento ou ajuste manual.
-- É o que permite auditar "por que esse produto tem essa quantidade hoje".
-- ---------------------------------------------
CREATE TABLE estoque_movimentos (
    id INT AUTO_INCREMENT PRIMARY KEY,
    produto_id INT NOT NULL,
    tipo ENUM('entrada_compra', 'entrada_troca', 'saida_venda', 'estorno_venda', 'ajuste_manual') NOT NULL,
    quantidade INT NOT NULL, -- positivo = entrada, negativo = saída
    referencia VARCHAR(80),  -- ex: "Compra #4", "Pedido #12"
    usuario_id INT,
    criado_em DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (produto_id) REFERENCES produtos(id),
    FOREIGN KEY (usuario_id) REFERENCES usuarios(id)
);

-- Índices úteis
CREATE INDEX idx_produtos_imei ON produtos(imei);
CREATE INDEX idx_pedidos_cliente ON pedidos(cliente_id);
CREATE INDEX idx_compras_fornecedor ON compras(fornecedor_id);
CREATE INDEX idx_movimentos_produto ON estoque_movimentos(produto_id);

-- ---------------------------------------------
-- Migração para quem já tinha o banco antigo instalado:
-- rode só os comandos abaixo (não recrie tudo, para não perder dados).
-- ---------------------------------------------
-- ALTER TABLE produtos ADD COLUMN estoque_minimo INT NOT NULL DEFAULT 2;
-- ALTER TABLE pedidos ADD COLUMN usuario_id INT, ADD FOREIGN KEY (usuario_id) REFERENCES usuarios(id);
