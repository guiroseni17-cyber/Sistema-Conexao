// Termo de responsabilidade de troca: preenchido com os dados do pedido, só para imprimir e assinar.
// Para mudar os dados da loja ou o texto da declaração, edite apenas este arquivo.

const LOJA_TERMO = {
    nome: 'Conexão Iphone',
    cnpj: '67.014.377/0001-70',
    endereco: 'Avenida Pereira Barreto, 1974 - Sala 2111',
    fone: '11951578722',
    email: 'conexaoiphonebr@gmail.com'
};

const DECLARACAO_TROCA = {
    titulo: 'DECLARAÇÃO DE RESPONSABILIDADE',
    paragrafos: [
        'Declaro para os devidos fins que o aparelho celular entregue à loja é de minha legítima propriedade, possuindo origem lícita, estando livre de qualquer tipo de bloqueio, restrição, financiamento, conta Apple (iCloud), senha, impedimento judicial ou administrativo, bem como não possui registro de perda, furto ou roubo.',
        'Declaro ainda que o aparelho encontra-se totalmente desbloqueado para uso e comercialização, responsabilizando-me integralmente por qualquer informação prestada neste documento.',
        'Comprometo-me a não solicitar bloqueio do IMEI junto às operadoras ou qualquer outro tipo de restrição futura que impeça o uso ou revenda do aparelho após a presente data.',
        'Caso seja constatada qualquer irregularidade, bloqueio ou impedimento posterior que comprometa o uso ou comercialização do aparelho, assumo total responsabilidade civil e legal, comprometendo-me a ressarcir integralmente os prejuízos causados à empresa.',
        'O presente termo é firmado conforme as disposições do Código Civil Brasileiro (Lei nº 10.406/2002), responsabilizando o declarante pelas informações prestadas.',
        'Declaro que li, compreendi e concordo com todos os termos acima.'
    ]
};

// Rua, número, complemento e bairro num campo só (clientes antigos têm tudo no campo endereço)
function enderecoDoCliente(p) {
    const ruaNumero = [p.cliente_endereco, p.cliente_numero].filter(Boolean).join(', ');
    return [ruaNumero, p.cliente_complemento, p.cliente_bairro].filter(Boolean).join(', ');
}

function descricaoDoAparelho(t) {
    let texto = t.produto_nome || '';
    if (t.imei) texto += ` - IMEI 1: ${t.imei}`;
    if (t.imei2) texto += ` - IMEI 2: ${t.imei2}`;
    return texto;
}

async function carregarTermo() {
    const caixa = document.getElementById('termo');
    const id = new URLSearchParams(window.location.search).get('id');
    if (!id) {
        caixa.innerHTML = '<div class="t-vazio">Pedido não informado.</div>';
        return;
    }

    try {
        const p = await api.pedidos.buscar(id);
        const trocas = p.trocas || [];
        if (!trocas.length) {
            caixa.innerHTML = '<div class="t-vazio">Este pedido não tem aparelho na troca, então não há termo para gerar.</div>';
            return;
        }

        const telefone = p.cliente_celular || p.cliente_telefone || '';

        caixa.innerHTML = `
            <table class="t-topo">
                <tr>
                    <td class="t-marca">${esc(LOJA_TERMO.nome)}</td>
                    <td class="t-loja">
                        ${esc(LOJA_TERMO.nome)}<br>
                        CNPJ: ${esc(LOJA_TERMO.cnpj)}<br>
                        ${esc(LOJA_TERMO.endereco)}<br>
                        ${esc(LOJA_TERMO.fone)}<br>
                        ${esc(LOJA_TERMO.email)}
                    </td>
                    <td class="t-data">DATA DA VENDA<br>${formatarData(p.criado_em)}</td>
                </tr>
            </table>

            <div class="t-vendedor"><b>Vendedor (Loja):</b> ${esc(p.vendedor_nome || '-')}</div>

            <div class="t-titulo">VENDEDOR (CLIENTE)</div>
            <table>
                <tr><th style="width:44%;">Nome/Razão social</th><th>Nascimento</th><th>Telefone</th><th>CPF/CNPJ</th></tr>
                <tr><td>${esc(p.cliente_nome)}</td><td>${esc(p.cliente_nascimento || '')}</td><td>${esc(telefone)}</td><td>${esc(p.cliente_cpf_cnpj || '')}</td></tr>
                <tr><th>Endereço</th><th>CEP</th><th>Cidade</th><th>Estado</th></tr>
                <tr><td>${esc(enderecoDoCliente(p))}</td><td>${esc(p.cliente_cep || '')}</td><td>${esc(p.cliente_cidade || '')}</td><td>${esc(p.cliente_estado || '')}</td></tr>
            </table>

            <div class="t-titulo" style="margin-top:18px;">UPGRADES</div>
            <table class="t-upgrades">
                <tr><th>Produto</th><th class="c">Qtd</th><th class="v">Valor</th></tr>
                ${trocas.map(t => `
                    <tr>
                        <td>${esc(descricaoDoAparelho(t))}</td>
                        <td class="c">1</td>
                        <td class="v">${formatarMoeda(t.valor_abatido)}</td>
                    </tr>`).join('')}
            </table>

            <div class="t-titulo" style="margin-top:18px;">DADOS ADICIONAIS</div>
            <div class="t-declaracao">
                <p>${esc(DECLARACAO_TROCA.titulo)}</p>
                ${DECLARACAO_TROCA.paragrafos.map(x => `<p>${esc(x)}</p>`).join('')}
            </div>

            <div class="t-assinaturas">
                <div>${esc(p.cliente_nome)}</div>
                <div>${esc(LOJA_TERMO.nome)}</div>
            </div>
        `;
    } catch (err) {
        caixa.innerHTML = `<div class="t-vazio">Erro ao carregar o termo: ${esc(err.message)}</div>`;
    }
}

carregarTermo();
