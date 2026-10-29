const jwt = require('jsonwebtoken');

// Confere se veio um token válido no cabeçalho "Authorization: Bearer ...".
// Se estiver tudo certo, guarda os dados do usuário em req.user para os
// controllers usarem (ex: saber quem fez a venda).
function autenticar(req, res, next) {
    const cabecalho = req.headers.authorization;
    if (!cabecalho || !cabecalho.startsWith('Bearer ')) {
        return res.status(401).json({ erro: 'Não autenticado. Faça login novamente.' });
    }

    const token = cabecalho.split(' ')[1];
    try {
        const dados = jwt.verify(token, process.env.JWT_SECRET);
        req.user = dados; // { id, nome, papel }
        next();
    } catch (err) {
        return res.status(401).json({ erro: 'Sessão expirada ou inválida. Faça login novamente.' });
    }
}

// Usado nas rotas que só o admin pode acessar (ex: cadastrar outro usuário)
function apenasAdmin(req, res, next) {
    if (req.user?.papel !== 'admin') {
        return res.status(403).json({ erro: 'Apenas administradores podem fazer isso.' });
    }
    next();
}

module.exports = { autenticar, apenasAdmin };
