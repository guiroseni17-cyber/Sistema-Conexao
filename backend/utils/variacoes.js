// Helpers compartilhados entre o controller de produtos pai e o de modelos (variações).

// "atributos" é guardado como JSON: [{ nome: "Armazenamento", valor: "256GB" }, { nome: "Cor", valor: "Laranja" }]
function parseAtributos(raw) {
    if (!raw) return null;
    try {
        const lista = typeof raw === 'string' ? JSON.parse(raw) : raw;
        return Array.isArray(lista) && lista.length ? lista : null;
    } catch (e) {
        return null;
    }
}

function limparAtributos(lista) {
    if (!Array.isArray(lista)) return [];
    return lista
        .map(a => ({
            nome: String((a && a.nome) || '').trim() || 'Atributo',
            valor: String((a && a.valor) || '').trim()
        }))
        .filter(a => a.valor);
}

// Nome completo da variação = pai + valores (mesmo padrão que já era usado: "iPhone 17 Pro Max 256GB Laranja")
function montarNome(paiNome, atributos) {
    return [String(paiNome).trim(), ...atributos.map(a => a.valor)].join(' ').trim();
}

// Texto curto mostrado dentro do pai: "256GB · Laranja".
// Para variações antigas (sem atributos), tira o nome do pai do começo do nome.
function rotuloDe(variacao, paiNome) {
    const attrs = parseAtributos(variacao.atributos);
    if (attrs) return attrs.map(a => a.valor).join(' · ');
    const nome = String(variacao.nome || '');
    const pai = String(paiNome || variacao.modelo || '');
    if (pai && nome.toLowerCase().startsWith(pai.toLowerCase())) {
        const resto = nome.slice(pai.length).trim();
        if (resto) return resto;
    }
    return nome;
}

// Quando o pai é renomeado, calcula o novo nome de uma variação já existente
function renomearVariacao(variacao, paiAntigo, paiNovo) {
    const attrs = parseAtributos(variacao.atributos);
    if (attrs) return montarNome(paiNovo, attrs);
    const nome = String(variacao.nome || '');
    if (nome.toLowerCase().startsWith(String(paiAntigo).toLowerCase())) {
        return (String(paiNovo) + nome.slice(String(paiAntigo).length)).trim();
    }
    return nome;
}

module.exports = { parseAtributos, limparAtributos, montarNome, rotuloDe, renomearVariacao };
