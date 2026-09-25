document.addEventListener("DOMContentLoaded", () => {
    const tabela = document.querySelector("#tabelaProdutos tbody");
    document.getElementById("n_pedido").value = Math.floor(100 + Math.random() * 900);

    let produtosEstoque = []; // vem da API real (/api/produtos)
    async function carregarEstoque() {
        try {
            produtosEstoque = await api.produtos.listar('?busca=');
        } catch (err) {
            console.error('Erro ao carregar estoque:', err);
            alert('Não foi possível carregar o estoque. Recarregue a página.');
        }
    }

    function calcularTotais() {
        let somaProdutos = 0;
        document.querySelectorAll("#tabelaProdutos tbody tr").forEach(row => {
            const qtd = parseFloat(row.querySelector(".prod-qtd").value) || 0;
            const unit = parseFloat(row.querySelector(".prod-unit").value) || 0;
            const totalLinha = qtd * unit;
            row.querySelector(".prod-total").value = totalLinha.toFixed(2);
            somaProdutos += totalLinha;
        });

        document.getElementById("totalProdutos").value = somaProdutos.toFixed(2);
        const frete = parseFloat(document.getElementById("totalFrete").value) || 0;
        const desconto = parseFloat(document.getElementById("totalDesconto").value) || 0;
        const geral = somaProdutos + frete - desconto;
        document.getElementById("totalGeral").value = geral.toFixed(2);
    }

    // Configurar busca de produtos no estoque por linha
    function configurarLinha(linha) {
        const inputBusca = linha.querySelector(".prod-busca");
        const boxSugestoes = linha.querySelector(".sugestoes-box");
        const inputUnit = linha.querySelector(".prod-unit");

        linha.dataset.produtoId = ""; // só fica preenchido quando um produto real é escolhido na lista

        inputBusca.addEventListener("input", () => {
            linha.dataset.produtoId = "";
            const termo = inputBusca.value.toLowerCase();
            boxSugestoes.innerHTML = "";
            if (termo.length === 0) {
                boxSugestoes.style.display = "none";
                return;
            }

            const filtrados = produtosEstoque.filter(p =>
                p.nome.toLowerCase().includes(termo) ||
                (p.modelo && p.modelo.toLowerCase().includes(termo))
            );
            if (filtrados.length > 0) {
                boxSugestoes.style.display = "block";
                filtrados.forEach(prod => {
                    const item = document.createElement("div");
                    item.className = "sugestao-item";
                    const rotuloModelo = prod.modelo ? ` - ${prod.modelo}` : '';
                    item.textContent = `${prod.nome}${rotuloModelo} — R$ ${Number(prod.preco_venda).toFixed(2)} (estoque: ${prod.quantidade})`;
                    item.addEventListener("click", () => {
                        inputBusca.value = `${prod.nome}${rotuloModelo}`;
                        inputUnit.value = Number(prod.preco_venda).toFixed(2);
                        linha.dataset.produtoId = prod.id;
                        boxSugestoes.style.display = "none";
                        calcularTotais();
                    });
                    boxSugestoes.appendChild(item);
                });
            } else {
                boxSugestoes.style.display = "none";
            }
        });

        linha.querySelector(".prod-qtd").addEventListener("input", calcularTotais);
        inputUnit.addEventListener("input", calcularTotais);
        linha.querySelector(".btn-remover").addEventListener("click", (e) => {
            if (tabela.rows.length > 1) {
                e.target.closest("tr").remove();
                calcularTotais();
            } else {
                alert("O pedido precisa ter pelo menos um produto.");
            }
        });
    }

    configurarLinha(tabela.querySelector("tr"));

    document.getElementById("btnAddProduto").addEventListener("click", () => {
        const novaLinha = document.createElement("tr");
        novaLinha.innerHTML = `
            <td style="position: relative;">
                <input type="text" class="prod-busca" placeholder="Digite para buscar no estoque..." style="width: 95%;" autocomplete="off">
                <div class="sugestoes-box"></div>
            </td>
            <td><input type="number" class="prod-qtd" value="1" min="1" style="width: 80%;"></td>
            <td><input type="number" class="prod-unit" step="0.01" value="0.00" style="width: 90%;"></td>
            <td><input type="text" class="prod-total" readonly value="0,00" style="background-color: #e9ecef; width: 90%;"></td>
            <td><button type="button" class="btn-remover" style="background:none; border:none; cursor:pointer; color:red; font-size:16px;">🗑️</button></td>
        `;
        tabela.appendChild(novaLinha);
        configurarLinha(novaLinha);
    });

    // Dinâmica de Formas de Pagamento múltiplas
    const qtdPagamentoInput = document.getElementById("qtdFormasPagamento");
    const containerParcelas = document.getElementById("containerParcelas");

    qtdPagamentoInput.addEventListener("input", () => {
        const qtd = parseInt(qtdPagamentoInput.value) || 1;
        containerParcelas.innerHTML = "";
        for (let i = 1; i <= qtd; i++) {
            const div = document.createElement("div");
            div.className = "linha-pagamento";
            div.style.cssText = "display: flex; gap: 10px;";
            div.innerHTML = `
                <select class="pag-forma" style="flex: 1;">
                    <option value="Dinheiro">Dinheiro</option>
                    <option value="Pix">Pix</option>
                    <option value="Cartão de crédito">Cartão de crédito</option>
                    <option value="Cartão de débito">Cartão de débito</option>
                </select>
                <input type="number" class="pag-valor" placeholder="Valor R$ (${i})" style="width: 120px;" step="0.01">
            `;
            containerParcelas.appendChild(div);
        }
    });

// GESTÃO DO MODAL DE CADASTRO DE CLIENTE
    const btnCadastrarCliente = document.getElementById("btnCadastrarCliente");
    const modalCliente = document.getElementById("modalCliente");
    const btnFecharModalTopo = document.getElementById("btnFecharModalTopo");
    const btnCancelarModal = document.getElementById("btnCancelarModal");
    const formCadastrarCliente = document.getElementById("formCadastrarCliente");
    const inputCliente = document.getElementById("cliente");
    const inputClienteId = document.getElementById("clienteId");
    const boxSugestoesCliente = document.getElementById("clienteSugestoes");

    // Busca cliente já cadastrado, de verdade, via /api/clientes
    let debounceCliente = null;
    inputCliente.addEventListener("input", () => {
        inputClienteId.value = "";
        const termo = inputCliente.value.trim();
        clearTimeout(debounceCliente);
        if (termo.length < 2) {
            boxSugestoesCliente.style.display = "none";
            return;
        }
        debounceCliente = setTimeout(async () => {
            try {
                const encontrados = await api.clientes.listar(`?busca=${encodeURIComponent(termo)}`);
                boxSugestoesCliente.innerHTML = "";
                if (encontrados.length === 0) {
                    boxSugestoesCliente.style.display = "none";
                    return;
                }
                boxSugestoesCliente.style.display = "block";
                encontrados.forEach(cli => {
                    const item = document.createElement("div");
                    item.className = "sugestao-item";
                    item.textContent = cli.telefone ? `${cli.nome} — ${cli.telefone}` : cli.nome;
                    item.addEventListener("click", () => {
                        inputCliente.value = cli.nome;
                        inputClienteId.value = cli.id;
                        boxSugestoesCliente.style.display = "none";
                    });
                    boxSugestoesCliente.appendChild(item);
                });
            } catch (err) {
                console.error('Erro ao buscar clientes:', err);
            }
        }, 300);
    });

    document.addEventListener("click", (e) => {
        if (!inputCliente.contains(e.target) && !boxSugestoesCliente.contains(e.target)) {
            boxSugestoesCliente.style.display = "none";
        }
    });

    btnCadastrarCliente.addEventListener("click", (e) => {
        e.preventDefault();
        modalCliente.style.display = "flex";
    });

    const fecharModal = () => { modalCliente.style.display = "none"; };
    btnFecharModalTopo.addEventListener("click", fecharModal);
    btnCancelarModal.addEventListener("click", fecharModal);

    // Alternar rótulo CPF/CNPJ conforme tipo de pessoa
    document.getElementById("cliTipoPessoa").addEventListener("change", (e) => {
        document.getElementById("lblDocumento").textContent = e.target.value === "Física" ? "CPF" : "CNPJ";
    });

    formCadastrarCliente.addEventListener("submit", async (e) => {
        e.preventDefault();
        const nome = document.getElementById("cliNome").value;
        const telefone = document.getElementById("cliCelular").value || document.getElementById("cliTelefone").value;
        const cpfCnpj = document.getElementById("cliCpfCnpj").value;
        const email = document.getElementById("cliEmail").value;
        const partesEndereco = [
            document.getElementById("cliEndereco").value,
            document.getElementById("cliNumero").value,
            document.getElementById("cliBairro").value,
            document.getElementById("cliCidade").value,
            document.getElementById("cliEstado").value,
            document.getElementById("cliCep").value
        ].filter(Boolean);

        try {
            const resultado = await api.clientes.criar({
                nome, telefone, cpf_cnpj: cpfCnpj, email,
                endereco: partesEndereco.join(', ')
            });
            inputCliente.value = nome;
            inputClienteId.value = resultado.id;
            modalCliente.style.display = "none";
            formCadastrarCliente.reset();
            alert("Cliente cadastrado com sucesso!");
        } catch (erro) {
            alert("Erro ao cadastrar cliente: " + erro.message);
        }
    });

    ["totalFrete", "totalDesconto"].forEach(id => {
        document.getElementById(id).addEventListener("input", calcularTotais);
    });

    // ENVIO DO PEDIDO — isso que faltava por completo
    document.getElementById("formNovoPedido").addEventListener("submit", async (e) => {
        e.preventDefault();

        if (!inputClienteId.value) {
            alert('Selecione um cliente da lista de sugestões ou cadastre um novo em "+ Cadastrar novo cliente".');
            inputCliente.focus();
            return;
        }

        const linhas = Array.from(document.querySelectorAll("#tabelaProdutos tbody tr"));
        const itens = [];
        for (const linha of linhas) {
            const produtoId = linha.dataset.produtoId;
            const quantidade = Number(linha.querySelector(".prod-qtd").value) || 0;
            const precoUnitario = Number(linha.querySelector(".prod-unit").value) || 0;
            if (!produtoId) {
                alert('Selecione o produto de cada linha a partir da lista de sugestões do estoque.');
                return;
            }
            if (quantidade <= 0) {
                alert('Informe uma quantidade válida para todos os produtos.');
                return;
            }
            itens.push({ produto_id: Number(produtoId), quantidade, preco_unitario: precoUnitario });
        }

        const pagamentos = Array.from(document.querySelectorAll(".linha-pagamento")).map(linha => ({
            forma_pagamento: linha.querySelector(".pag-forma").value,
            parcelas: 1,
            valor: Number(linha.querySelector(".pag-valor").value) || 0
        })).filter(p => p.valor > 0);

        const frete = parseFloat(document.getElementById("totalFrete").value) || 0;
        const desconto = parseFloat(document.getElementById("totalDesconto").value) || 0;
        const textareas = document.querySelectorAll('textarea');
        let observacoes = textareas[0] ? textareas[0].value : '';
        if (frete > 0) observacoes += `\nFrete: R$ ${frete.toFixed(2)}`;
        if (desconto > 0) observacoes += `\nDesconto: R$ ${desconto.toFixed(2)}`;

        try {
            const resultado = await api.pedidos.criar({
                cliente_id: Number(inputClienteId.value),
                itens,
                pagamentos,
                observacoes: observacoes.trim() || null
            });
            alert(resultado.mensagem);
            window.location.href = 'pedidos.html';
        } catch (err) {
            alert('Erro ao salvar pedido: ' + err.message);
        }
    });

    carregarEstoque();
});
