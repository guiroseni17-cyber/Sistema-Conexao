document.addEventListener("DOMContentLoaded", () => {
    const tabela = document.querySelector("#tabelaProdutos tbody");
    const btnAddProduto = document.getElementById("#btnAddProduto" || "btnAddProduto");

    // Gerador simples de número de pedido automático
    document.getElementById("n_pedido").value = Math.floor(100 + Math.random() * 900);

    // Função para calcular totais por linha e geral
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
        
        // Pega valores adicionais
        const frete = parseFloat(document.getElementById("totalFrete").value) || 0;
        const ipi = parseFloat(document.getElementById("totalIpi").value) || 0;
        const desconto = parseFloat(document.getElementById("totalDesconto").value) || 0;

        const geral = somaProdutos + frete + ipi - desconto;
        document.getElementById("totalGeral").value = geral.toFixed(2);
    }

    // Adicionar nova linha de produto
    document.getElementById("btnAddProduto").addEventListener("click", () => {
        const novaLinha = document.createElement("tr");
        novaLinha.innerHTML = `
            <td><input type="text" class="prod-nome" placeholder="Digite o produto..." style="width: 95%;"></td>
            <td><input type="number" class="prod-qtd" value="1" min="1" style="width: 80%;"></td>
            <td><input type="number" class="prod-unit" step="0.01" value="0.00" style="width: 90%;"></td>
            <td><input type="text" class="prod-total" readonly value="0,00" style="background-color: #e9ecef; width: 90%;"></td>
            <td><button type="button" class="btn-remover" style="background:none; border:none; cursor:pointer; color:red; font-size:16px;">🗑️</button></td>
        `;
        tabela.appendChild(novaLinha);
        adicionarEventosLinha(novaLinha);
    });

    function adicionarEventosLinha(linha) {
        linha.querySelector(".prod-qtd").addEventListener("input", calcularTotais);
        linha.querySelector(".prod-unit").addEventListener("input", calcularTotais);
        linha.querySelector(".btn-remover").addEventListener("click", (e) => {
            if (tabela.rows.length > 1) {
                e.target.closest("tr").remove();
                calcularTotais();
            } else {
                alert("O pedido precisa ter pelo menos um produto.");
            }
        });
    }

    // Inicializa os ouvintes na primeira linha
    document.querySelectorAll("#tabelaProdutos tbody tr").forEach(adicionarEventosLinha);
    
    // Ouvintes para frete, ipi e desconto
    ["totalFrete", "totalIpi", "totalDesconto"].forEach(id => {
        document.getElementById(id).addEventListener("input", calcularTotais);
    });
});
