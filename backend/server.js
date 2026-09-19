const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const path = require('path');
require('dotenv').config();

const db = require('./config/db');
const { autenticar } = require('./middleware/auth');

const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/users');
const productRoutes = require('./routes/products');
const clientRoutes = require('./routes/clients');
const orderRoutes = require('./routes/orders');
const supplierRoutes = require('./routes/suppliers');
const purchaseRoutes = require('./routes/purchases');
const reportRoutes = require('./routes/reports');

const app = express();

app.use(cors());
app.use(express.json());

// Serve o frontend (HTML/CSS/JS) diretamente pelo mesmo servidor
app.use(express.static(path.join(__dirname, 'frontend')));

// Login não exige token (é ele quem gera o token)
app.use('/api/auth', authRoutes);

// A partir daqui, toda rota de API exige login
app.use('/api', autenticar);

app.use('/api/usuarios', userRoutes);
app.use('/api/produtos', productRoutes);
app.use('/api/clientes', clientRoutes);
app.use('/api/pedidos', orderRoutes);
app.use('/api/fornecedores', supplierRoutes);
app.use('/api/compras', purchaseRoutes);
app.use('/api/relatorios', reportRoutes);

app.get('/api', (req, res) => {
    res.json({ sistema: 'FoneNinja API', status: 'online' });
});

// Se ainda não existe nenhum usuário cadastrado, cria um admin padrão
// para você conseguir entrar pela primeira vez.
async function garantirUsuarioAdmin() {
    try {
        const [rows] = await db.query('SELECT COUNT(*) AS total FROM usuarios');
        if (rows[0].total === 0) {
            const senhaHash = await bcrypt.hash('admin123', 10);
            await db.query(
                'INSERT INTO usuarios (nome, email, senha_hash, papel) VALUES (?, ?, ?, ?)',
                ['Administrador', 'admin@foneninja.com', senhaHash, 'admin']
            );
            console.log('====================================================');
            console.log('Usuário admin criado automaticamente:');
            console.log('  E-mail: admin@foneninja.com');
            console.log('  Senha:  admin123');
            console.log('IMPORTANTE: troque essa senha assim que entrar!');
            console.log('====================================================');
        }
    } catch (err) {
        console.error('Aviso: não foi possível checar/criar o usuário admin automaticamente:', err.message);
    }
}

const PORT = process.env.PORT || 3000;
app.listen(PORT, async () => {
    console.log(`FoneNinja rodando em http://localhost:${PORT}`);
    await garantirUsuarioAdmin();
});
