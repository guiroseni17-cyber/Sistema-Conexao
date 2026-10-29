document.addEventListener("DOMContentLoaded", () => {
    const tabela = document.querySelector("#tabelaProdutos tbody");
    // Modo edição: novo-pedido.html?id=123
    const pedidoEditId = new URLSearchParams(window.location.search).get("id");
    let pedidoEditando = null; // guarda o pedido carregado quando estamos editando
    let upgradeAtivo = false;  // true quando o cartão de upgrade está aberto
    let upgrades = [];         // aparelhos já confirmados nesta tela (ainda não salvos)
    let trocasSalvas = [];     // aparelhos que o pedido editado já tinha (somente leitura)
    let etapaAtual = "busca";  // busca | dados | lista

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
    let catalogoPais = [];    // variações dos produtos pai (/api/modelos) — só referência, não é estoque
    async function carregarEstoque() {
        try {
            produtosEstoque = await api.produtos.listar('?busca=');
        } catch (err) {
            console.error('Erro ao carregar estoque:', err);
            alert('Não foi possível carregar o estoque. Recarregue a página.');
        }
        try {
            catalogoPais = await api.modelos.listar();
        } catch (err) {
            console.error('Erro ao carregar produtos pai:', err);
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
        const resumoFinal = document.getElementById("resumoFinal");
        if (resumoFinal) resumoFinal.textContent = Number(aPagar || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

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
                p.quantidade > 0 && (
                    p.nome.toLowerCase().includes(termo) ||
                    (p.modelo && p.modelo.toLowerCase().includes(termo))
                )
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
            <td class="col-prod" data-label="Produto / código"><input type="text" class="prod-busca" placeholder="Digite para buscar no estoque..." autocomplete="off"><div class="sugestoes-box"></div></td>
            <td class="col-qtd" data-label="Qtde."><input type="number" class="prod-qtd" value="1" min="1"></td>
            <td class="col-unit" data-label="Valor unit. (R$)"><input type="number" class="prod-unit" step="0.01" value="0.00"></td>
            <td class="col-total" data-label="Total (R$)"><input type="text" class="prod-total" readonly value="0,00"></td>
            <td class="col-acao"><button type="button" class="btn-remover" title="Remover produto">🗑️</button></td>
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
            div.innerHTML = `
                <select class="pag-forma">
                    <option value="Dinheiro">Dinheiro</option>
                    <option value="Pix">Pix</option>
                    <option value="Cartão de crédito">Cartão de crédito</option>
                    <option value="Cartão de débito">Cartão de débito</option>
                </select>
                <input type="number" class="pag-valor" placeholder="Valor R$ (${i})" step="0.01">
                <input type="text" class="pag-obs" placeholder="Obs. (ex.: 12x de R$ 190,00)" maxlength="255" autocomplete="off">
            `;
            containerParcelas.appendChild(div);
        }
    });

// GESTÃO DO MODAL DE CADASTRO DE CLIENTE
    const btnCadastrarCliente = document.getElementById("btnCadastrarCliente");
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

    // O formulário de cadastro é o mesmo da tela Clientes (js/cliente-modal.js).
    // Ao salvar, o cliente novo já fica selecionado no pedido.
    btnCadastrarCliente.addEventListener("click", (e) => {
        e.preventDefault();
        ClienteModal.abrir({
            nome: inputCliente.value.trim(),
            aoSalvar: (cliente) => {
                inputCliente.value = cliente.nome;
                inputClienteId.value = cliente.id;
            }
        });
    });

    // Data e hora do pedido: vem da Agenda (?data=AAAA-MM-DD&hora=HH:MM) ou é "agora".
    // Data futura = pedido agendado (aparece na Agenda).
    const inputData = document.getElementById("dataPedido");
    const dicaData = document.getElementById("dicaData");
    const dois = n => String(n).padStart(2, "0");
    const dataParaInput = d => `${d.getFullYear()}-${dois(d.getMonth() + 1)}-${dois(d.getDate())}T${dois(d.getHours())}:${dois(d.getMinutes())}`;
    function atualizarDicaData() {
        const futuro = !!inputData.value && new Date(inputData.value) > new Date();
        dicaData.textContent = !inputData.value ? "" : futuro
            ? "📅 Data futura: o pedido fica agendado e aparece na Agenda neste dia e horário."
            : "Venda registrada com a data e hora ao lado.";
        dicaData.classList.toggle("agendado", futuro);
    }
    inputData.addEventListener("input", atualizarDicaData);
    (function () {
        const q = new URLSearchParams(window.location.search);
        let v = dataParaInput(new Date());
        const d = q.get("data"), h = q.get("hora");
        if (/^\d{4}-\d{2}-\d{2}$/.test(d || "")) {
            if (/^\d{2}:\d{2}$/.test(h || "")) v = `${d}T${h}`;
            else if (d !== v.slice(0, 10)) v = `${d}T09:00`;
        }
        inputData.value = v;
        atualizarDicaData();
    })();

    // Lupa: abre a lista completa de clientes com busca e ficha do cadastro
    document.getElementById("btnBuscarCliente").addEventListener("click", () => {
        ClienteBusca.abrir({
            termo: inputCliente.value.trim(),
            aoEscolher: (cli) => {
                inputCliente.value = cli.nome;
                inputClienteId.value = cli.id;
                boxSugestoesCliente.style.display = "none";
            }
        });
    });

    // Vendedor: lista de quem tem login no sistema (quem está logado já vem marcado,
    // mas dá para trocar, ex.: a Vitória atendendo um pedido no login de outra pessoa)
    const selVendedor = document.getElementById("vendedor");
    const vendedoresPronto = (async () => {
        try {
            const lista = await api.usuarios.vendedores();
            const logado = getUsuarioLogado();
            selVendedor.innerHTML = lista.map(u => `<option value="${u.id}">${u.nome}</option>`).join("");
            if (logado && lista.some(u => u.id === logado.id)) selVendedor.value = logado.id;
        } catch (err) {
            selVendedor.innerHTML = '<option value="">Erro ao carregar vendedores</option>';
            console.error("Erro ao carregar vendedores:", err);
        }
    })();

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
    function abateFormulario() {
        return etapaAtual === "dados" ? Math.max(0, numUp("upCompra") - numUp("upDesconto")) : 0;
    }
    // Soma de todos os aparelhos: já salvos + confirmados + o que está sendo preenchido
    function valorAbatidoUpgrade() {
        if (!upgradeAtivo) return 0;
        const lista = [...trocasSalvas, ...upgrades].reduce((s, t) => s + Number(t.valor_abatido || 0), 0);
        return lista + abateFormulario();
    }

    function erroCompra(mostrar) {
        document.getElementById("upCompraErro").style.display = mostrar ? "block" : "none";
        document.getElementById("upCompra").classList.toggle("invalido", mostrar);
    }

    function etapaUpgrade(etapa) {
        etapaAtual = etapa;
        upBuscaBox.style.display = etapa === "busca" ? "block" : "none";
        upSelecionado.style.display = etapa === "dados" ? "block" : "none";
        document.getElementById("upMais").style.display = etapa === "lista" ? "inline-block" : "none";
        document.getElementById("upCancelarNovo").style.display =
            (etapa === "busca" && (upgrades.length + trocasSalvas.length) > 0) ? "inline" : "none";
        renderizarResumoUpgrade();
    }

    // Lista dos aparelhos já confirmados (cada um com seu valor de abatimento)
    function renderizarResumoUpgrade() {
        const box = document.getElementById("upResumoLista");
        box.innerHTML = "";
        [...trocasSalvas, ...upgrades].forEach((t) => {
            const item = document.createElement("div");
            item.className = "up-resumo-item";
            const info = document.createElement("div");
            const nome = document.createElement("strong");
            nome.textContent = t.nome || "Aparelho";
            const det = document.createElement("span");
            det.className = "det";
            det.textContent = [t.imei ? `IMEI ${t.imei}` : "", `Abate ${brl(t.valor_abatido)}`].filter(Boolean).join("  ·  ");
            info.append(nome, det);
            item.appendChild(info);
            if (t.salvo) {
                const tag = document.createElement("span");
                tag.className = "tag";
                tag.textContent = "Já está no estoque";
                item.appendChild(tag);
            } else {
                const x = document.createElement("button");
                x.type = "button";
                x.className = "up-x";
                x.title = "Remover este aparelho";
                x.textContent = "✕";
                x.addEventListener("click", () => {
                    upgrades = upgrades.filter(u => u !== t);
                    if (!upgrades.length && !trocasSalvas.length && etapaAtual === "lista") etapaUpgrade("busca");
                    else renderizarResumoUpgrade();
                    calcularTotais();
                });
                item.appendChild(x);
            }
            box.appendChild(item);
        });
    }

    // Catálogo do upgrade = variações dos PRODUTOS PAI (referência). Não é o estoque:
    // o que for escolhido aqui serve de base para cadastrar o produto real no estoque.
    function catalogoUpgrade() {
        return catalogoPais
            .filter(m => m.categoria === "aparelho_novo" || m.categoria === "aparelho_seminovo")
            .map(m => {
                const nome = String(m.nome || "").toLowerCase();
                // O estado do aparelho recebido vem do próprio nome da variação (Seminovo / Lacrado)
                let condicao = m.condicao || "seminovo_bom";
                if (nome.includes("seminovo")) condicao = condicao.startsWith("seminovo") ? condicao : "seminovo_bom";
                else if (nome.includes("lacrado")) condicao = "novo";
                return {
                    modelo_base_id: m.id,
                    nome: m.nome,
                    rotulo: m.rotulo || m.nome,
                    pai_nome: m.pai_nome || m.modelo || m.nome,
                    marca: m.marca,
                    modelo: m.modelo || m.pai_nome,
                    categoria: condicao === "novo" ? "aparelho_novo" : "aparelho_seminovo",
                    condicao
                };
            });
    }

    // Todas as palavras digitadas precisam aparecer (ex: "17 pro max azul")
    function combinaBusca(p, termo) {
        if (!termo) return true;
        const texto = [p.nome, p.pai_nome, p.marca].filter(Boolean).join(" ").toLowerCase();
        return termo.split(/\s+/).every(palavra => texto.includes(palavra));
    }

    // Lista agrupada por produto pai: cabeçalho com o pai e, embaixo, as variações
    function renderizarListaUpgrade() {
        const termo = upBusca.value.trim().toLowerCase();
        const catalogo = catalogoUpgrade().filter(p => combinaBusca(p, termo));
        upContagem.textContent = `${catalogo.length} resultado${catalogo.length === 1 ? "" : "s"}`;
        upLista.innerHTML = "";

        const grupos = new Map();
        catalogo.slice(0, 200).forEach(p => {
            if (!grupos.has(p.pai_nome)) grupos.set(p.pai_nome, []);
            grupos.get(p.pai_nome).push(p);
        });

        grupos.forEach((variacoes, paiNome) => {
            const cab = document.createElement("div");
            cab.className = "up-grupo";
            cab.textContent = paiNome;
            upLista.appendChild(cab);

            variacoes.forEach(p => {
                const item = document.createElement("div");
                item.className = "up-item";
                const nome = document.createElement("span");
                nome.textContent = p.rotulo;
                const icone = document.createElement("span");
                icone.className = "up-item-icone";
                icone.textContent = "⊕";
                item.append(nome, icone);
                item.addEventListener("click", () => selecionarUpgrade(p));
                upLista.appendChild(item);
            });
        });
    }

    function selecionarUpgrade(p) {
        upManual = false;
        upSel = {
            modelo_base_id: p.modelo_base_id,
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
        if (!ativo) upgrades = [];
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
    document.getElementById("btnRemoverUpgrade").addEventListener("click", () => {
        if (upgrades.length && !confirm("Remover o upgrade e todos os aparelhos já cadastrados nele?")) return;
        mostrarUpgrade(false);
    });

    // Confirma o aparelho preenchido, guarda na lista e libera o cadastro de mais um
    document.getElementById("upConfirmar").addEventListener("click", () => {
        const t = lerUpgrade();
        if (t === false) return;
        upgrades.push(t);
        limparUpgrade();
        etapaUpgrade("lista");
        calcularTotais();
    });
    document.getElementById("upMais").addEventListener("click", () => {
        limparUpgrade();
        etapaUpgrade("busca");
        renderizarListaUpgrade();
        upBusca.focus();
    });
    document.getElementById("upCancelarNovo").addEventListener("click", (e) => {
        e.preventDefault();
        limparUpgrade();
        etapaUpgrade("lista");
        calcularTotais();
    });
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
        document.getElementById("upAbate").textContent = brl(abateFormulario());
        calcularTotais();
    });
    containerParcelas.addEventListener("input", calcularTotais);
    qtdPagamentoInput.addEventListener("input", calcularTotais);

    // Lê o aparelho que está no formulário. Retorna false (dados inválidos) ou o objeto da troca.
    function lerUpgrade() {

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

    // Todos os aparelhos novos do pedido: os confirmados + o que estiver preenchido na tela.
    // Retorna a lista (pode ser vazia) ou false se algo estiver inválido.
    function coletarUpgrades() {
        if (!upgradeAtivo) return [];
        const lista = [...upgrades];
        if (etapaAtual === "dados") {
            const t = lerUpgrade();
            if (t === false) return false;
            lista.push(t);
        } else if (etapaAtual === "busca" && !lista.length && !trocasSalvas.length) {
            alert("Escolha o aparelho do upgrade na lista (ou digite o aparelho manualmente).");
            upBusca.focus();
            return false;
        }
        return lista;
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
            valor: Number(linha.querySelector(".pag-valor").value) || 0,
            observacao: linha.querySelector(".pag-obs").value.trim() || null
        })).filter(p => p.valor > 0);

        const frete = parseFloat(document.getElementById("totalFrete").value) || 0;
        const desconto = parseFloat(document.getElementById("totalDesconto").value) || 0;
        let observacoes = document.getElementById("obsPedido").value;
        if (frete > 0) observacoes += `\nFrete: R$ ${frete.toFixed(2)}`;
        if (desconto > 0) observacoes += `\nDesconto: R$ ${desconto.toFixed(2)}`;

        try {
            const dados = {
                cliente_id: Number(inputClienteId.value),
                vendedor_id: Number(selVendedor.value) || undefined,
                data_pedido: inputData.value ? inputData.value.replace("T", " ") + ":00" : undefined,
                agendado: !!inputData.value && new Date(inputData.value) > new Date(),
                itens,
                pagamentos,
                observacoes: observacoes.trim() || null
            };

            const trocasNovas = coletarUpgrades();
            if (trocasNovas === false) return;
            if (trocasNovas.length) dados.trocas = trocasNovas;

            let resultado;
            if (pedidoEditando) {
                // EDIÇÃO: atualiza o pedido existente (mantém o valor da troca já registrado)
                dados.valor_troca = Number(pedidoEditando.valor_troca || 0);
                resultado = await api.pedidos.editar(pedidoEditando.id, dados);
                alert(`Pedido #${pedidoEditando.id} atualizado com sucesso.`);
            } else {
                resultado = await api.pedidos.criar(dados);
                alert(`Pedido #${resultado.id} criado com sucesso.` + (dados.trocas ? (dados.trocas.length > 1 ? "\nOs aparelhos do upgrade já entraram no estoque." : "\nO aparelho do upgrade já entrou no estoque.") : ""));
            }
            window.location.href = dados.agendado ? `agenda.html?data=${inputData.value.slice(0, 10)}` : 'pedidos.html';
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
            document.querySelector(".page-title").textContent = `Editar pedido #${pedido.id}`;
            document.querySelector(".page-subtitle").textContent = "Altere os dados do pedido e salve";
            document.title = `Editar pedido #${pedido.id} - FoneNinja`;
            document.querySelector("#formNovoPedido button[type='submit']").textContent = "Salvar alterações";

            // Cliente e vendedor
            inputCliente.value = pedido.cliente_nome;
            inputClienteId.value = pedido.cliente_id;
            if (pedido.data_hora) { inputData.value = pedido.data_hora; atualizarDicaData(); }
            await vendedoresPronto;
            if (pedido.usuario_id) {
                // vendedor desativado depois da venda continua aparecendo no pedido antigo
                if (!Array.from(selVendedor.options).some(o => Number(o.value) === pedido.usuario_id)) {
                    selVendedor.add(new Option(pedido.vendedor_nome || `Usuário #${pedido.usuario_id}`, pedido.usuario_id));
                }
                selVendedor.value = pedido.usuario_id;
            }

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
                    linhasPag[i].querySelector(".pag-obs").value = p.observacao || "";
                    linhasPag[i].dataset.parcelas = p.parcelas;
                });
            }

            // Observações
            document.getElementById("obsPedido").value = pedido.observacoes || "";

            // Upgrade já registrado: mostra os aparelhos salvos (somente leitura); dá para cadastrar mais
            if (pedido.trocas && pedido.trocas.length > 0) {
                trocasSalvas = pedido.trocas.map(t => ({
                    nome: t.produto_nome, imei: t.imei, valor_abatido: Number(t.valor_abatido || 0), salvo: true
                }));
                mostrarUpgrade(true);
                etapaUpgrade("lista");
                document.getElementById("btnRemoverUpgrade").style.display = "none";
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
