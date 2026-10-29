// Validação de CPF e CNPJ pelos dígitos verificadores.
// Atenção: isso confirma que o número é matematicamente válido,
// não que ele pertence a uma pessoa real (só a Receita Federal confirma isso).

function somenteDigitos(valor) {
    return String(valor || '').replace(/\D/g, '');
}

function validarCPF(valor) {
    const cpf = somenteDigitos(valor);
    if (cpf.length !== 11) return false;
    if (/^(\d)\1{10}$/.test(cpf)) return false; // 111.111.111-11 etc.

    const calcular = (tamanho) => {
        let soma = 0;
        for (let i = 0; i < tamanho; i++) {
            soma += Number(cpf[i]) * (tamanho + 1 - i);
        }
        const resto = (soma * 10) % 11;
        return resto === 10 ? 0 : resto;
    };

    return calcular(9) === Number(cpf[9]) && calcular(10) === Number(cpf[10]);
}

function validarCNPJ(valor) {
    const cnpj = somenteDigitos(valor);
    if (cnpj.length !== 14) return false;
    if (/^(\d)\1{13}$/.test(cnpj)) return false;

    const calcular = (tamanho) => {
        const pesos = tamanho === 12
            ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]
            : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
        let soma = 0;
        for (let i = 0; i < tamanho; i++) {
            soma += Number(cnpj[i]) * pesos[i];
        }
        const resto = soma % 11;
        return resto < 2 ? 0 : 11 - resto;
    };

    return calcular(12) === Number(cnpj[12]) && calcular(13) === Number(cnpj[13]);
}

// Documento vazio é permitido (campo opcional).
// 11 dígitos = CPF, 14 dígitos = CNPJ, qualquer outro tamanho é inválido.
function validarDocumento(valor) {
    const digitos = somenteDigitos(valor);
    if (digitos.length === 0) return { valido: true, tipo: null, mensagem: '' };
    if (digitos.length === 11) {
        return validarCPF(digitos)
            ? { valido: true, tipo: 'CPF', mensagem: '' }
            : { valido: false, tipo: 'CPF', mensagem: 'CPF inválido. Confira os números.' };
    }
    if (digitos.length === 14) {
        return validarCNPJ(digitos)
            ? { valido: true, tipo: 'CNPJ', mensagem: '' }
            : { valido: false, tipo: 'CNPJ', mensagem: 'CNPJ inválido. Confira os números.' };
    }
    return { valido: false, tipo: null, mensagem: 'Documento inválido. O CPF tem 11 números e o CNPJ tem 14.' };
}

module.exports = { somenteDigitos, validarCPF, validarCNPJ, validarDocumento };
