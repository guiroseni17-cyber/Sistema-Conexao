// Categorias de item do sistema. O "estado" do aparelho (novo, seminovo, lacrado...)
// NÃO é categoria: fica na variação do produto pai.
const CATEGORIAS = ['iphone', 'acessorio', 'blindagem', 'seguro'];

// Nomes antigos que ainda podem chegar (páginas abertas antes da atualização, dados antigos)
const LEGADO = { aparelho_novo: 'iphone', aparelho_seminovo: 'iphone', peca: 'acessorio' };

function normalizarCategoria(categoria, padrao = 'iphone') {
    if (CATEGORIAS.includes(categoria)) return categoria;
    return LEGADO[categoria] || padrao;
}

// Só acessório e blindagem têm alerta de estoque mínimo
function usaEstoqueMinimo(categoria) {
    return categoria === 'acessorio' || categoria === 'blindagem';
}

module.exports = { CATEGORIAS, LEGADO, normalizarCategoria, usaEstoqueMinimo };
