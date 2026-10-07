document.addEventListener("DOMContentLoaded", () => {
    const tabela = document.querySelector("#tabelaProdutos tbody");
    // Modo edição: novo-pedido.html?id=123
    const pedidoEditId = new URLSearchParams(window.location.search).get("id");
    let pedidoEditando = null; // guarda o pedido carregado quando estamos editando
    let upgradeAtivo = false;  // true quando o cartão de upgrade está aberto

    // N° do pedido: o número real, igual ao da lista de pedidos
    async function definirNumeroPedido() {
        const campo = document.getElementById("n_pedido");
        if (pedidoEditId) {
            campo.value = pedidoEditId;
            return;
        }
        try {
            const r = await api.pedidos.proximoNumero();
            campo.value = r.proximo;
        } catch (err) {
            campo.value = "";
        }
    }

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

        const upgrade = valorAbatidoUpgrade();
        const aPagar = geral - upgrade;
        document.getElementById("totalUpgrade").value = upgrade.toFixed(2);
        document.getElementById("totalAPagar").value = aPagar.toFixed(2);

        // Resumo: quanto já foi lançado nas formas de pagamento
        const lancado = Array.from(document.querySelectorAll(".pag-valor"))
            .reduce((soma, el) => soma + (parseFloat(el.value) || 0), 0);
        const falta = aPagar - lancado;
        const resumo = document.getElementById("resumoPagamento");
        if (resumo) {
            const ok = Math.abs(falta) < 0.01;
            resumo.innerHTML = `A pagar: <b>R$ ${aPagar.toFixed(2)}</b> · Lançado: <b>R$ ${lancado.toFixed(2)}</b> · ` +
                (ok ? '<b style="color:#28a745;">Pagamento conferido ✔</b>'
                    : `<b style="color:#dc3545;">${falta > 0 ? 'Falta' : 'Passou'} R$ ${Math.abs(falta).toFixed(2)}</b>`);
        }
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

    function adicionarLinha() {
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
        return novaLinha;
    }

    document.getElementById("btnAddProduto").addEventListener("click", adicionarLinha);

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
        document.addEventListener("keydown", prenderFocoModal);
        document.getElementById("cliTipoPessoa").focus();
    });

    const fecharModal = () => {
        modalCliente.style.display = "none";
        document.removeEventListener("keydown", prenderFocoModal);
    };
    btnFecharModalTopo.addEventListener("click", fecharModal);
    btnCancelarModal.addEventListener("click", fecharModal);

    // Trava o Tab dentro do modal (o foco não escapa mais pra página de trás)
    // e fecha o modal com Esc.
    function prenderFocoModal(e) {
        if (e.key === "Escape") {
            fecharModal();
            return;
        }
        if (e.key !== "Tab") return;

        const focaveis = modalCliente.querySelectorAll(
            'input:not([type=hidden]), select, textarea, button, a[href]'
        );
        const lista = Array.from(focaveis).filter(el => !el.disabled && el.offsetParent !== null);
        if (lista.length === 0) return;

        const primeiro = lista[0];
        const ultimo = lista[lista.length - 1];

        if (e.shiftKey && document.activeElement === primeiro) {
            e.preventDefault();
            ultimo.focus();
        } else if (!e.shiftKey && document.activeElement === ultimo) {
            e.preventDefault();
            primeiro.focus();
        }
    }

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

    // UPGRADE (aparelho recebido como forma de pagamento)
    const cardUpgrade = document.getElementById("cardUpgrade");
    const btnAddUpgrade = document.getElementById("btnAddUpgrade");
    const upBusca = document.getElementById("upBusca");
    const upLista = document.getElementById("upLista");
    const upContagem = document.getElementById("upContagem");
    const upBuscaBox = document.getElementById("upBuscaBox");
    const upSelecionado = document.getElementById("upSelecionado");
    const upManualCampos = document.getElementById("upManualCampos");
    let upSel = null;      // aparelho escolhido na lista: { nome, marca, modelo, categoria, condicao }
    let upManual = false;  // true quando o aparelho é digitado à mão

    const numUp = (id) => parseFloat(document.getElementById(id).value) || 0;
    const brl = (v) => Number(v || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

    // Quanto o upgrade abate do pedido: preço de compra - desconto
    function valorAbatidoUpgrade() {
        if (!upgradeAtivo) return 0;
        return Math.max(0, numUp("upCompra") - numUp("upDesconto"));
    }

    function erroCompra(mostrar) {
        document.getElementById("upCompraErro").style.display = mostrar ? "block" : "none";
        document.getElementById("upCompra").classList.toggle("invalido", mostrar);
    }

    function etapaUpgrade(etapa) {
        upBuscaBox.style.display = etapa === "busca" ? "block" : "none";
        upSelecionado.style.display = etapa === "dados" ? "block" : "none";
    }

    // Catálogo = aparelhos já cadastrados no estoque (um por título, sem repetir)
    function catalogoUpgrade() {
        const vistos = new Map();
        produtosEstoque.forEach(p => {
            if (p.categoria !== "aparelho_novo" && p.categoria !== "aparelho_seminovo") return;
            const chave = [p.nome, p.marca, p.modelo, p.condicao].map(x => (x || "").toLowerCase()).join("|");
            if (!vistos.has(chave)) vistos.set(chave, p);
        });
        return Array.from(vistos.values());
    }

    function renderizarListaUpgrade() {
        const termo = upBusca.value.trim().toLowerCase();
        const catalogo = catalogoUpgrade().filter(p =>
            !termo || [p.nome, p.modelo, p.marca, p.imei].some(v => v && String(v).toLowerCase().includes(termo))
        );
        upContagem.textContent = `${catalogo.length} resultado${catalogo.length === 1 ? "" : "s"}`;
        upLista.innerHTML = "";
        catalogo.slice(0, 100).forEach(p => {
            const item = document.createElement("div");
            item.className = "up-item";
            const nome = document.createElement("span");
            nome.textContent = p.nome;
            const icone = document.createElement("span");
            icone.className = "up-item-icone";
            icone.textContent = "⊕";
            item.append(nome, icone);
            item.addEventListener("click", () => selecionarUpgrade(p));
            upLista.appendChild(item);
        });
    }

    function selecionarUpgrade(p) {
        upManual = false;
        upSel = {
            nome: p.nome,
            marca: p.marca || "",
            modelo: p.modelo || "",
            categoria: p.categoria,
            condicao: p.condicao || "seminovo_bom"
        };
        document.getElementById("upTituloTxt").textContent = p.nome;
        upManualCampos.style.display = "none";
        etapaUpgrade("dados");
        document.getElementById("upCompra").focus();
    }

    function limparUpgrade() {
        cardUpgrade.querySelectorAll("input, textarea").forEach(el => { el.value = ""; el.disabled = false; });
        cardUpgrade.querySelectorAll("select").forEach(el => el.disabled = false);
        document.getElementById("upCondicao").value = "seminovo_bom";
        document.getElementById("upGarantia").value = "3 meses";
        document.getElementById("upDesconto").value = "";
        document.getElementById("upAbate").textContent = brl(0);
        document.getElementById("avisoUpgrade").style.display = "none";
        document.getElementById("upTrocar").style.display = "";
        upSel = null;
        upManual = false;
        erroCompra(false);
    }

    function mostrarUpgrade(ativo) {
        upgradeAtivo = ativo;
        cardUpgrade.style.display = ativo ? "block" : "none";
        btnAddUpgrade.style.display = ativo ? "none" : "inline-block";
        limparUpgrade();
        if (ativo) {
            etapaUpgrade("busca");
            renderizarListaUpgrade();
        }
        calcularTotais();
    }

    btnAddUpgrade.addEventListener("click", () => {
        mostrarUpgrade(true);
        upBusca.focus();
    });
    document.getElementById("btnRemoverUpgrade").addEventListener("click", () => mostrarUpgrade(false));
    upBusca.addEventListener("input", renderizarListaUpgrade);
    document.getElementById("upManual").addEventListener("click", (e) => {
        e.preventDefault();
        upManual = true;
        upSel = null;
        document.getElementById("upTituloTxt").textContent = "Aparelho digitado manualmente";
        upManualCampos.style.display = "grid";
        etapaUpgrade("dados");
        document.getElementById("upNome").focus();
    });
    document.getElementById("upTrocar").addEventListener("click", () => {
        upSel = null;
        upManual = false;
        etapaUpgrade("busca");
        upBusca.focus();
    });
    document.getElementById("upCompra").addEventListener("input", () => erroCompra(false));
    cardUpgrade.addEventListener("input", () => {
        document.getElementById("upAbate").textContent = brl(valorAbatidoUpgrade());
        calcularTotais();
    });
    containerParcelas.addEventListener("input", calcularTotais);
    qtdPagamentoInput.addEventListener("input", calcularTotais);

    // Lê o aparelho do upgrade. Retorna: null (sem upgrade), false (dados inválidos) ou o objeto da troca.
    function lerUpgrade() {
        if (!upgradeAtivo) return null;
        // Se o pedido editado já tem upgrade registrado, não envia de novo
        if (pedidoEditando && pedidoEditando.trocas && pedidoEditando.trocas.length > 0) return null;

        let base;
        if (upManual) {
            const nome = document.getElementById("upNome").value.trim();
            if (!nome) {
                alert("Informe o nome do aparelho do upgrade.");
                document.getElementById("upNome").focus();
                return false;
            }
            const condicao = document.getElementById("upCondicao").value;
            base = {
                nome,
                marca: document.getElementById("upMarca").value.trim(),
                modelo: document.getElementById("upModelo").value.trim(),
                categoria: condicao === "novo" ? "aparelho_novo" : "aparelho_seminovo",
                condicao
            };
        } else if (upSel) {
            base = upSel;
        } else {
            alert("Escolha o aparelho do upgrade na lista (ou digite o aparelho manualmente).");
            upBusca.focus();
            return false;
        }

        const compra = numUp("upCompra");
        const desconto = numUp("upDesconto");
        if (compra <= 0) {
            erroCompra(true);
            document.getElementById("upCompra").focus();
            return false;
        }
        if (desconto > compra) {
            alert("O desconto não pode ser maior que o preço de compra.");
            document.getElementById("upDesconto").focus();
            return false;
        }
        const bateriaTxt = document.getElementById("upBateria").value.trim();
        const bateria = bateriaTxt === "" ? null : Number(bateriaTxt);
        if (bateria !== null && (isNaN(bateria) || bateria < 0 || bateria > 100)) {
            alert("A bateria deve ser um valor entre 0 e 100%.");
            document.getElementById("upBateria").focus();
            return false;
        }

        return {
            ...base,
            preco_compra: compra,
            desconto,
            valor_abatido: compra - desconto, // vira o custo do produto no estoque
            garantia: document.getElementById("upGarantia").value,
            bateria,
            imei: document.getElementById("upImei").value.trim(),
            imei2: document.getElementById("upImei2").value.trim(),
            numero_serie: document.getElementById("upSerial").value.trim(),
            preco_venda_sugerido: numUp("upVenda"),
            preco_venda_atacado: numUp("upVendaAtacado") || null,
            observacoes: document.getElementById("upObs").value.trim() || null
        };
    }

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
            parcelas: Number(linha.dataset.parcelas) || 1,
            valor: Number(linha.querySelector(".pag-valor").value) || 0
        })).filter(p => p.valor > 0);

        const frete = parseFloat(document.getElementById("totalFrete").value) || 0;
        const desconto = parseFloat(document.getElementById("totalDesconto").value) || 0;
        let observacoes = document.getElementById("obsPedido").value;
        if (frete > 0) observacoes += `\nFrete: R$ ${frete.toFixed(2)}`;
        if (desconto > 0) observacoes += `\nDesconto: R$ ${desconto.toFixed(2)}`;

        try {
            const dados = {
                cliente_id: Number(inputClienteId.value),
                itens,
                pagamentos,
                observacoes: observacoes.trim() || null
            };

            const troca = lerUpgrade();
            if (troca === false) return;
            if (troca) dados.troca = troca;

            let resultado;
            if (pedidoEditando) {
                // EDIÇÃO: atualiza o pedido existente (mantém o valor da troca já registrado)
                dados.valor_troca = Number(pedidoEditando.valor_troca || 0);
                resultado = await api.pedidos.editar(pedidoEditando.id, dados);
                alert(`Pedido #${pedidoEditando.id} atualizado com sucesso.`);
            } else {
                resultado = await api.pedidos.criar(dados);
                alert(`Pedido #${resultado.id} criado com sucesso.` + (dados.troca ? "\nO aparelho do upgrade já entrou no estoque." : ""));
            }
            window.location.href = 'pedidos.html';
        } catch (err) {
            alert('Erro ao salvar pedido: ' + err.message);
        }
    });

    // Carrega o pedido existente nos campos da tela (modo edição)
    async function carregarPedidoParaEdicao(id) {
        try {
            const pedido = await api.pedidos.buscar(id);

            if (pedido.status === 'cancelado') {
                alert('Pedido cancelado não pode ser editado.');
                window.location.href = 'pedidos.html';
                return;
            }
            pedidoEditando = pedido;

            document.title = `Editar Pedido #${pedido.id}`;
            document.querySelector(".container h2").textContent = `Editar Pedido de Venda #${pedido.id}`;
            document.querySelector("#formNovoPedido button[type='submit']").textContent = "Salvar alterações";

            // Cliente e vendedor
            inputCliente.value = pedido.cliente_nome;
            inputClienteId.value = pedido.cliente_id;
            if (pedido.vendedor_nome) document.getElementById("vendedor").value = pedido.vendedor_nome;

            // Itens
            tabela.innerHTML = "";
            pedido.itens.forEach(item => {
                const linha = adicionarLinha();
                linha.dataset.produtoId = item.produto_id;
                linha.querySelector(".prod-busca").value = `${item.produto_nome}${item.modelo ? ' - ' + item.modelo : ''}`;
                linha.querySelector(".prod-qtd").value = item.quantidade;
                linha.querySelector(".prod-unit").value = Number(item.preco_unitario).toFixed(2);
            });

            // Pagamentos
            if (pedido.pagamentos && pedido.pagamentos.length > 0) {
                qtdPagamentoInput.value = pedido.pagamentos.length;
                qtdPagamentoInput.dispatchEvent(new Event("input"));
                const linhasPag = document.querySelectorAll(".linha-pagamento");
                pedido.pagamentos.forEach((p, i) => {
                    if (!linhasPag[i]) return;
                    linhasPag[i].querySelector(".pag-forma").value = p.forma_pagamento;
                    linhasPag[i].querySelector(".pag-valor").value = p.valor;
                    linhasPag[i].dataset.parcelas = p.parcelas;
                });
            }

            // Observações
            document.getElementById("obsPedido").value = pedido.observacoes || "";

            // Upgrade já registrado: mostra os dados e trava os campos
            if (pedido.trocas && pedido.trocas.length > 0) {
                const t = pedido.trocas[0];
                mostrarUpgrade(true);
                const garantiaSel = document.getElementById("upGarantia");
                if (t.garantia && !Array.from(garantiaSel.options).some(o => o.value === t.garantia)) {
                    garantiaSel.add(new Option(t.garantia, t.garantia));
                }
                document.getElementById("upTituloTxt").textContent = t.produto_nome || "";
                document.getElementById("upCompra").value = Number(t.preco_compra != null ? t.preco_compra : t.valor_abatido).toFixed(2);
                document.getElementById("upDesconto").value = Number(t.desconto || 0) > 0 ? Number(t.desconto).toFixed(2) : "";
                if (t.garantia) garantiaSel.value = t.garantia;
                document.getElementById("upBateria").value = t.bateria != null ? t.bateria : "";
                document.getElementById("upImei").value = t.imei || "";
                document.getElementById("upImei2").value = t.imei2 || "";
                document.getElementById("upSerial").value = t.numero_serie || "";
                document.getElementById("upVenda").value = Number(t.preco_venda || 0) > 0 ? Number(t.preco_venda).toFixed(2) : "";
                document.getElementById("upVendaAtacado").value = t.preco_venda_atacado != null ? Number(t.preco_venda_atacado).toFixed(2) : "";
                document.getElementById("upObs").value = t.observacoes || "";
                document.getElementById("upAbate").textContent = brl(t.valor_abatido);
                etapaUpgrade("dados");
                document.getElementById("upTrocar").style.display = "none";
                cardUpgrade.querySelectorAll("input, select, textarea").forEach(el => el.disabled = true);
                document.getElementById("btnRemoverUpgrade").style.display = "none";
                document.getElementById("avisoUpgrade").style.display = "block";
            }

            calcularTotais();
        } catch (err) {
            alert("Erro ao carregar o pedido para edição: " + err.message);
            window.location.href = "pedidos.html";
        }
    }

    definirNumeroPedido();
    carregarEstoque();
    if (pedidoEditId) carregarPedidoParaEdicao(pedidoEditId);
    calcularTotais();
});
