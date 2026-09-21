document.addEventListener("DOMContentLoaded", () => {
    const tabela = document.querySelector("#tabelaProdutos tbody");
    document.getElementById("n_pedido").value = Math.floor(100 + Math.random() * 900);

    // Simulação de produtos em estoque vindos da API / Base de dados
    const estoqueSimulado = [
        { nome: "iPhone 11 64gb", preco: 990.00 },
        { nome: "iPhone 13 128gb", preco: 2300.00 },
        { nome: "Fonte Original 20W", preco: 80.00 },
        { nome: "Película Blindagem Lacrados", preco: 300.00 },
        { nome: "Película Blindagem 17 Pro Max", preco: 200.00 },
        { nome: "Película Blindagem Seminovos", preco: 350.00 }
    ];

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

        inputBusca.addEventListener("input", () => {
            const termo = inputBusca.value.toLowerCase();
            boxSugestoes.innerHTML = "";
            if (termo.length === 0) {
                boxSugestoes.style.display = "none";
                return;
            }

            const filtrados = estoqueSimulado.filter(p => p.nome.toLowerCase().includes(termo));
            if (filtrados.length > 0) {
                boxSugestoes.style.display = "block";
                filtrados.forEach(prod => {
                    const item = document.createElement("div");
                    item.className = "sugestao-item";
                    item.textContent = `${prod.nome} - R$ ${prod.preco.toFixed(2)}`;
                    item.addEventListener("click", () => {
                        inputBusca.value = prod.nome;
                        inputUnit.value = prod.preco.toFixed(2);
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
            div.style.cssText = "display: flex; gap: 10px;";
            div.innerHTML = `
                <select style="flex: 1;"><option>Dinheiro</option><option>Pix</option><option>Cartão Crédito (${i}ª Parcela)</option><option>Cartão Débito</option></select>
                <input type="number" placeholder="Valor R$ (${i})" style="width: 120px;" step="0.01">
            `;
            containerParcelas.appendChild(div);
        }
    });

    ["totalFrete", "totalDesconto"].forEach(id => {
        document.getElementById(id).addEventListener("input", calcularTotais);
    });
});
