// ===== CADASTRO DE CLIENTE (formulário único do sistema) =====
// Qualquer tela que cadastra ou edita cliente usa este arquivo:
//     ClienteModal.abrir({ aoSalvar: (cliente) => { ... } });          // novo cliente
//     ClienteModal.abrir({ id: 12, aoSalvar: (cliente) => { ... } });  // editar
// Para mudar os campos do formulário, edite apenas este arquivo.
// Precisa de js/api.js carregado antes.

(function () {
    const ESTADOS = ['AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO'];

    const CSS = `
    #cm-fundo { display: none; position: fixed; inset: 0; background: rgba(0,0,0,.5); z-index: 1000; align-items: center; justify-content: center; padding: 12px; }
    #cm-fundo * { box-sizing: border-box; }
    #cm-caixa { background: #fff; border-radius: 8px; width: 760px; max-width: 100%; max-height: 94vh; overflow-y: auto; padding: 18px 22px; box-shadow: 0 4px 12px rgba(0,0,0,.2); font-size: 13px; color: #333; }
    #cm-topo { display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #eee; padding-bottom: 10px; margin-bottom: 14px; }
    #cm-topo h3 { margin: 0; color: #1f4e79; font-size: 18px; }
    #cm-x { background: none; border: none; font-size: 20px; cursor: pointer; font-weight: bold; line-height: 1; }
    .cm-linha { display: flex; gap: 10px; margin-bottom: 8px; }
    .cm-campo { display: flex; flex-direction: column; gap: 3px; margin: 0; min-width: 0; }
    .cm-campo label { font-weight: 600; font-size: 13px; color: #444; margin: 0; }
    .cm-campo input, .cm-campo select { width: 100%; padding: 6px 8px; font-size: 13px; border: 1px solid #ccc; border-radius: 4px; background: #fff; }
    .cm-campo input:focus, .cm-campo select:focus { outline: none; border-color: #337ab7; }
    .cm-f1 { flex: 1; } .cm-f2 { flex: 2; } .cm-f3 { flex: 3; }
    .cm-check { display: flex; align-items: center; gap: 6px; padding-top: 20px; cursor: pointer; font-weight: 600; white-space: nowrap; }
    .cm-check input { width: auto; }
    #cm-caixa fieldset { border: 1px dashed #ccc; padding: 10px 12px; border-radius: 6px; margin: 4px 0 12px; }
    #cm-caixa legend { font-size: 13px; color: #666; padding: 0 5px; }
    #cm-rodape { display: flex; justify-content: space-between; align-items: center; }
    #cm-rodape .cm-dir { display: flex; gap: 10px; }
    #cm-rodape button { padding: 10px 20px; border-radius: 4px; cursor: pointer; font-size: 14px; }
    #cm-cancelar { background: #e9ecef; color: #333; border: 1px solid #ccc; }
    #cm-completo { background: #fff; color: #007bff; border: 1px solid #007bff; padding: 10px 15px !important; }
    #cm-salvar { background: #337ab7; color: #fff; border: none; font-weight: bold; padding: 10px 25px !important; }
    #cm-salvar[disabled] { opacity: .6; cursor: wait; }
    .cm-msg { font-size: 11px; min-height: 0; color: #c0392b; }
    .cm-msg.ok { color: #2e7d32; }
    .cm-msg.info { color: #666; }
    .cm-campo input.cm-invalido { border-color: #c0392b; background: #fdf3f2; }
    @media (max-width: 640px) { .cm-linha { flex-wrap: wrap; } .cm-linha > .cm-campo { flex: 1 1 100%; } .cm-check { padding-top: 0; } }
    `;

    const campo = (cls, rotulo, html, id) =>
        `<div class="cm-campo ${cls}"><label${id ? ` for="${id}"` : ''}>${rotulo}</label>${html}</div>`;

    const HTML = `
    <div id="cm-caixa" role="dialog" aria-modal="true" aria-labelledby="cm-titulo">
        <div id="cm-topo">
            <h3 id="cm-titulo">Cadastro de cliente</h3>
            <button type="button" id="cm-x" aria-label="Fechar">&times;</button>
        </div>
        <form id="cm-form" autocomplete="off">
            <div class="cm-linha">
                ${campo('cm-f1', 'Tipo de pessoa', `<select id="cm-tipo"><option value="Física">Física</option><option value="Jurídica">Jurídica</option></select>`, 'cm-tipo')}
                ${campo('cm-f2', '<span id="cm-lbl-doc">CPF</span>', `<input type="text" id="cm-doc" placeholder="Digite o documento..." inputmode="numeric"><small class="cm-msg" id="cm-doc-msg"></small>`, 'cm-doc')}
                <div class="cm-campo cm-f1"><label class="cm-check"><input type="checkbox" id="cm-consumidor" checked> Consumidor Final</label></div>
            </div>
            <div class="cm-linha">
                ${campo('cm-f2', 'Nome *', `<input type="text" id="cm-nome" required placeholder="Nome completo ou Razão Social">`, 'cm-nome')}
                ${campo('cm-f1', 'Data de nascimento', `<input type="date" id="cm-nasc">`, 'cm-nasc')}
                ${campo('cm-f1', 'Gênero', `<select id="cm-genero"><option value="">Selecione</option><option value="Masculino">Masculino</option><option value="Feminino">Feminino</option><option value="Outro">Outro</option></select>`, 'cm-genero')}
            </div>
            <div class="cm-linha">
                ${campo('cm-f1', 'Celular', `<input type="text" id="cm-celular" placeholder="(00) 00000-0000">`, 'cm-celular')}
                ${campo('cm-f1', 'Telefone', `<input type="text" id="cm-telefone" placeholder="(00) 0000-0000">`, 'cm-telefone')}
                ${campo('cm-f2', 'E-mail', `<input type="email" id="cm-email" placeholder="exemplo@email.com">`, 'cm-email')}
            </div>
            <fieldset>
                <legend>Endereço e Localização</legend>
                <div class="cm-linha">
                    ${campo('cm-f1', 'CEP', `<input type="text" id="cm-cep" placeholder="00000-000" inputmode="numeric"><small class="cm-msg" id="cm-cep-msg"></small>`, 'cm-cep')}
                    ${campo('cm-f3', 'Endereço', `<input type="text" id="cm-endereco" placeholder="Rua, Avenida, etc.">`, 'cm-endereco')}
                    ${campo('cm-f1', 'Número', `<input type="text" id="cm-numero" placeholder="Nº">`, 'cm-numero')}
                </div>
                <div class="cm-linha" style="margin-bottom:0;">
                    ${campo('cm-f2', 'Bairro', `<input type="text" id="cm-bairro">`, 'cm-bairro')}
                    ${campo('cm-f2', 'Cidade', `<input type="text" id="cm-cidade">`, 'cm-cidade')}
                    ${campo('cm-f1', 'Estado', `<select id="cm-estado"><option value="">Selecione</option>${ESTADOS.map(u => `<option value="${u}">${u}</option>`).join('')}</select>`, 'cm-estado')}
                </div>
            </fieldset>
            <div id="cm-rodape">
                <button type="button" id="cm-cancelar">Cancelar</button>
                <div class="cm-dir">
                    <button type="button" id="cm-completo">Ver cadastro completo</button>
                    <button type="submit" id="cm-salvar">Salvar</button>
                </div>
            </div>
        </form>
    </div>`;

    // id do campo -> nome do campo no banco
    const CAMPOS = {
        'cm-tipo': 'tipo_pessoa', 'cm-doc': 'cpf_cnpj', 'cm-nome': 'nome', 'cm-nasc': 'data_nascimento',
        'cm-genero': 'genero', 'cm-celular': 'celular', 'cm-telefone': 'telefone', 'cm-email': 'email',
        'cm-cep': 'cep', 'cm-endereco': 'endereco', 'cm-numero': 'numero', 'cm-bairro': 'bairro',
        'cm-cidade': 'cidade', 'cm-estado': 'estado'
    };


    // ---------- CPF / CNPJ ----------
    // Confere os dígitos verificadores: pega números inventados ou digitados errados.
    // (Só a Receita Federal confirma se o documento pertence mesmo a alguém.)
    const soDigitos = (v) => String(v || '').replace(/\D/g, '');

    function cpfValido(valor) {
        const c = soDigitos(valor);
        if (c.length !== 11 || /^(\d)\1{10}$/.test(c)) return false;
        const dv = (n) => {
            let soma = 0;
            for (let i = 0; i < n; i++) soma += Number(c[i]) * (n + 1 - i);
            const r = (soma * 10) % 11;
            return r === 10 ? 0 : r;
        };
        return dv(9) === Number(c[9]) && dv(10) === Number(c[10]);
    }

    function cnpjValido(valor) {
        const c = soDigitos(valor);
        if (c.length !== 14 || /^(\d)\1{13}$/.test(c)) return false;
        const dv = (n) => {
            const pesos = n === 12 ? [5,4,3,2,9,8,7,6,5,4,3,2] : [6,5,4,3,2,9,8,7,6,5,4,3,2];
            let soma = 0;
            for (let i = 0; i < n; i++) soma += Number(c[i]) * pesos[i];
            const r = soma % 11;
            return r < 2 ? 0 : 11 - r;
        };
        return dv(12) === Number(c[12]) && dv(13) === Number(c[13]);
    }

    function mascaraDocumento(valor) {
        const d = soDigitos(valor).slice(0, 14);
        if (d.length <= 11) {
            return d.replace(/^(\d{3})(\d)/, '$1.$2').replace(/^(\d{3})\.(\d{3})(\d)/, '$1.$2.$3').replace(/\.(\d{3})(\d)/, '.$1-$2');
        }
        return d.replace(/^(\d{2})(\d)/, '$1.$2').replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3').replace(/\.(\d{3})(\d)/, '.$1/$2').replace(/(\d{4})(\d)/, '$1-$2');
    }

    // Devolve '' se estiver tudo certo (ou vazio: o documento é opcional), ou o texto do erro
    function erroDocumento() {
        const d = soDigitos($('cm-doc').value);
        if (d.length === 0) return '';
        if (d.length === 11) return cpfValido(d) ? '' : 'CPF inválido. Confira os números.';
        if (d.length === 14) return cnpjValido(d) ? '' : 'CNPJ inválido. Confira os números.';
        return 'Documento incompleto: o CPF tem 11 números e o CNPJ tem 14.';
    }

    function mostrarErroDocumento(final) {
        const d = soDigitos($('cm-doc').value);
        // Enquanto a pessoa ainda digita, só reclama quando o tamanho já fechou
        let erro = erroDocumento();
        if (!final && d.length !== 11 && d.length !== 14) erro = '';
        const msg = $('cm-doc-msg');
        msg.textContent = erro || (d.length === 11 || d.length === 14 ? (d.length === 11 ? 'CPF válido' : 'CNPJ válido') : '');
        msg.className = 'cm-msg' + (erro ? '' : ' ok');
        $('cm-doc').classList.toggle('cm-invalido', !!erro);
        return erro;
    }

    function aoDigitarDocumento() {
        const campoDoc = $('cm-doc');
        campoDoc.value = mascaraDocumento(campoDoc.value);
        const d = soDigitos(campoDoc.value);
        // 11 números = pessoa física, 14 = jurídica: acerta o tipo sozinho
        if (d.length === 11 && $('cm-tipo').value !== 'Física') { $('cm-tipo').value = 'Física'; atualizarRotuloDocumento(); }
        if (d.length === 14 && $('cm-tipo').value !== 'Jurídica') { $('cm-tipo').value = 'Jurídica'; atualizarRotuloDocumento(); }
        mostrarErroDocumento(false);
    }

    // ---------- CEP ----------
    function mascaraCep(valor) {
        const d = soDigitos(valor).slice(0, 8);
        return d.length > 5 ? d.slice(0, 5) + '-' + d.slice(5) : d;
    }

    let cepConsultado = '';
    async function buscarCep() {
        const cep = soDigitos($('cm-cep').value);
        const msg = $('cm-cep-msg');
        if (cep.length !== 8) { msg.textContent = ''; cepConsultado = ''; return; }
        if (cep === cepConsultado) return;
        cepConsultado = cep;
        msg.className = 'cm-msg info';
        msg.textContent = 'Buscando endereço...';
        try {
            const resp = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
            const dados = await resp.json();
            if (soDigitos($('cm-cep').value) !== cep) return; // a pessoa já mudou o CEP
            if (dados.erro) {
                msg.className = 'cm-msg';
                msg.textContent = 'CEP não encontrado. Preencha o endereço à mão.';
                return;
            }
            $('cm-endereco').value = dados.logradouro || $('cm-endereco').value;
            $('cm-bairro').value = dados.bairro || $('cm-bairro').value;
            $('cm-cidade').value = dados.localidade || $('cm-cidade').value;
            if (dados.uf) $('cm-estado').value = dados.uf;
            msg.className = 'cm-msg ok';
            msg.textContent = 'Endereço preenchido';
            // Falta só o número (ou a rua, se o CEP for geral da cidade)
            ($('cm-endereco').value ? $('cm-numero') : $('cm-endereco')).focus();
        } catch (err) {
            cepConsultado = '';
            msg.className = 'cm-msg';
            msg.textContent = 'Não consegui buscar o CEP agora. Preencha o endereço à mão.';
        }
    }

    let fundo, form, estado = { id: null, aoSalvar: null };
    const $ = (id) => document.getElementById(id);

    function montar() {
        if (fundo) return;
        const st = document.createElement('style');
        st.textContent = CSS;
        document.head.appendChild(st);

        fundo = document.createElement('div');
        fundo.id = 'cm-fundo';
        fundo.innerHTML = HTML;
        document.body.appendChild(fundo);
        form = $('cm-form');

        $('cm-x').addEventListener('click', fechar);
        $('cm-cancelar').addEventListener('click', fechar);
        $('cm-completo').addEventListener('click', () => {
            // Ainda não existe uma tela de cadastro completo; leva para a lista de clientes.
            if (!/clientes\.html$/.test(window.location.pathname)) window.open('clientes.html', '_blank');
        });
        $('cm-tipo').addEventListener('change', () => { atualizarRotuloDocumento(); mostrarErroDocumento(false); });
        $('cm-doc').addEventListener('input', aoDigitarDocumento);
        $('cm-doc').addEventListener('blur', () => mostrarErroDocumento(true));
        $('cm-cep').addEventListener('input', () => { $('cm-cep').value = mascaraCep($('cm-cep').value); buscarCep(); });
        $('cm-cep').addEventListener('blur', buscarCep);
        form.addEventListener('submit', salvar);
    }

    function atualizarRotuloDocumento() {
        $('cm-lbl-doc').textContent = $('cm-tipo').value === 'Jurídica' ? 'CNPJ' : 'CPF';
    }

    function limpar() {
        form.reset();
        cepConsultado = '';
        ['cm-doc-msg', 'cm-cep-msg'].forEach(id => { $(id).textContent = ''; });
        $('cm-doc').classList.remove('cm-invalido');
        $('cm-consumidor').checked = true;
        atualizarRotuloDocumento();
    }

    function preencher(c) {
        Object.entries(CAMPOS).forEach(([idCampo, col]) => {
            let v = c[col] ?? '';
            if (col === 'data_nascimento') v = String(v).slice(0, 10);
            $(idCampo).value = v;
        });
        if (!$('cm-tipo').value) $('cm-tipo').value = 'Física';
        $('cm-consumidor').checked = c.consumidor_final === undefined || c.consumidor_final === null ? true : !!Number(c.consumidor_final);
        atualizarRotuloDocumento();
        cepConsultado = soDigitos($('cm-cep').value); // cliente já cadastrado: não sobrescreve o endereço
        if ($('cm-doc').value) { $('cm-doc').value = mascaraDocumento($('cm-doc').value); mostrarErroDocumento(false); }
    }

    function lerFormulario() {
        const dados = {};
        Object.entries(CAMPOS).forEach(([idCampo, col]) => { dados[col] = $(idCampo).value.trim(); });
        dados.consumidor_final = $('cm-consumidor').checked;
        return dados;
    }

    // Mantém o Tab dentro do formulário e fecha com Esc
    function teclado(e) {
        if (e.key === 'Escape') { fechar(); return; }
        if (e.key !== 'Tab') return;
        const lista = Array.from(fundo.querySelectorAll('input:not([type=hidden]), select, textarea, button'))
            .filter(el => !el.disabled && el.offsetParent !== null);
        if (!lista.length) return;
        const primeiro = lista[0], ultimo = lista[lista.length - 1];
        if (e.shiftKey && document.activeElement === primeiro) { e.preventDefault(); ultimo.focus(); }
        else if (!e.shiftKey && document.activeElement === ultimo) { e.preventDefault(); primeiro.focus(); }
    }

    function fechar() {
        if (!fundo) return;
        fundo.style.display = 'none';
        document.removeEventListener('keydown', teclado);
    }

    async function salvar(e) {
        e.preventDefault();
        if (mostrarErroDocumento(true)) {
            $('cm-doc').focus();
            return;
        }
        const dados = lerFormulario();
        const botao = $('cm-salvar');
        botao.disabled = true;
        try {
            let id = estado.id;
            if (id) {
                await api.clientes.editar(id, dados);
            } else {
                const r = await api.clientes.criar(dados);
                id = r.id;
            }
            const cliente = { id, ...dados };
            const depois = estado.aoSalvar;
            fechar();
            if (depois) depois(cliente);
        } catch (err) {
            alert('Erro ao salvar cliente: ' + err.message);
        } finally {
            botao.disabled = false;
        }
    }

    async function abrir(opcoes = {}) {
        montar();
        estado = { id: opcoes.id || null, aoSalvar: opcoes.aoSalvar || null };
        limpar();
        $('cm-titulo').textContent = estado.id ? 'Editar cliente' : 'Cadastro de cliente';

        if (estado.id) {
            try {
                preencher(await api.clientes.buscar(estado.id));
            } catch (err) {
                alert('Não foi possível carregar o cliente: ' + err.message);
                return;
            }
        } else if (opcoes.nome) {
            $('cm-nome').value = opcoes.nome;
        }

        fundo.style.display = 'flex';
        document.addEventListener('keydown', teclado);
        $('cm-tipo').focus();
    }

    window.ClienteModal = { abrir, fechar };
})();
