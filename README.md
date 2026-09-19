# FoneNinja — Sistema de Gestão para Loja

Sistema próprio de **vendas, estoque e compras**, com **troca automática de aparelho**:
quando você vende um aparelho e o cliente dá outro na troca, o aparelho recebido é
cadastrado automaticamente no estoque, já com os dados preenchidos.

## O que o sistema faz hoje

- **Login da equipe**: cada pessoa entra com seu usuário; o sistema sabe quem vendeu
  o quê e quem comprou o quê. Um admin gerencia quem tem acesso (tela **Equipe**).
- **Estoque**: cadastro de aparelhos novos, seminovos, acessórios e peças, com IMEI,
  condição, quantidade, estoque mínimo configurável (dispara alerta) e **histórico
  completo de movimentações** de cada item (toda entrada/saída, de onde veio).
- **Clientes** e **Fornecedores**: cadastro simples de ambos.
- **Pedidos de venda**: venda de um ou mais itens, com baixa automática no estoque,
  recibo para impressão e vínculo com o vendedor que atendeu.
- **Troca**: ao marcar "o cliente deu um aparelho na troca" e preencher os dados,
  o sistema cria o produto no estoque automaticamente e abate o valor do total do pedido.
- **Compras**: registrar mercadoria recebida de um fornecedor — repõe produto já
  existente ou cadastra um produto novo, tudo entrando direto no estoque. Controla
  pagamento (pendente / parcial / pago) e o quanto está em aberto com cada fornecedor.
- **Relatórios**: vendas e lucro estimado por período, produtos mais vendidos, vendas
  por forma de pagamento, vendas por vendedor, e total comprado/em aberto por fornecedor.
- **Dashboard**: faturamento do dia, pedidos do dia, alertas de estoque baixo e quanto
  está em aberto com fornecedores.

## Estrutura do projeto

```
foneninja/
├── backend/
│   ├── config/         → conexão com o banco de dados
│   ├── middleware/      → autenticação (confere o login em cada requisição)
│   ├── controllers/     → regras de negócio (troca, compra, relatórios, etc.)
│   ├── routes/          → endereços da API
│   └── server.js        → arquivo principal, é ele que você "liga"
├── database/
│   └── schema.sql       → estrutura das tabelas do banco de dados
└── frontend/            → telas do sistema (HTML, CSS, JS puro)
```

## Como colocar para rodar (passo a passo)

### 1. Banco de dados
Você vai precisar de um servidor MySQL (a maioria das hospedagens já oferece isso
dentro do plano). Depois de ter o acesso:
1. Crie um banco chamado `foneninja` (ou use o comando já pronto no arquivo)
2. Rode o conteúdo do arquivo `database/schema.sql` — ele cria todas as tabelas
   automaticamente (produtos, clientes, fornecedores, compras, pedidos, usuários, etc.)

> Se você já tinha o banco antigo (sem compras/fornecedores/login), **não** rode o
> `CREATE TABLE produtos`/`pedidos` de novo — vá até o fim do arquivo `schema.sql` e
> rode só os dois comandos `ALTER TABLE` que estão comentados lá, e depois rode as
> `CREATE TABLE` novas (`usuarios`, `fornecedores`, `compras`, `compra_itens`,
> `estoque_movimentos`) que ainda não existiam no seu banco.

### 2. Backend
1. Entre na pasta `backend`
2. Copie o arquivo `.env.example` e renomeie a cópia para `.env`
3. Abra o `.env` e preencha com os dados do seu banco (host, usuário, senha) e troque
   o `JWT_SECRET` por uma frase longa e só sua (é o que garante a segurança do login)
4. Instale as dependências (comando `npm install`)
5. Ligue o sistema (comando `npm start`)

O terminal vai mostrar algo como `FoneNinja rodando em http://localhost:3000`. Na
primeira vez que ligar, se ainda não existir nenhum usuário, o sistema cria um admin
automaticamente e mostra no terminal:

```
E-mail: admin@foneninja.com
Senha:  admin123
```

**Troque essa senha assim que entrar** (tela "Trocar minha senha", no menu).

### 3. Frontend
Não precisa de nenhuma instalação separada — o próprio backend já entrega as telas.
Basta abrir `http://localhost:3000` (ou o endereço do seu servidor) no navegador.
Você vai cair na tela de login primeiro.

## Como usar no dia a dia

- **Cadastre os fornecedores** antes de registrar a primeira compra.
- **Registre as compras** conforme a mercadoria chega — isso já bota tudo no estoque.
- **Venda pelos Pedidos** — se o cliente der um aparelho na troca, marque a opção
  na hora e ele já entra no estoque sozinho.
- **Acompanhe o Dashboard e os Relatórios** para saber faturamento, lucro estimado
  e o que está em aberto com fornecedores.
- Só **administradores** veem a tela **Equipe** (cadastrar/bloquear usuários). Qualquer
  usuário pode trocar a própria senha em "Trocar minha senha".

## Sobre a hospedagem em nuvem

Quando você contratar o VPS, alguém vai te ajudar a instalar o Node.js e o MySQL
no servidor (ou a hospedagem já vem com isso pronto). Depois é só repetir os passos
acima lá dentro.

## Próximos passos sugeridos

- Exportar relatórios em PDF/Excel
- Parcelamento de pagamento de compra (hoje é só total/parcial/pago)
- Notificação (e-mail/WhatsApp) quando o estoque bater no mínimo
- Multi-loja (mais de uma filial no mesmo sistema)
