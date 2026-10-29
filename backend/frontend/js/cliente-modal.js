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
                ${campo('cm-f2', '<span id="cm-lbl-doc">CPF</span>', `<input type="text" id="cm-doc" placeholder="Digite o documento...">`, 'cm-doc')}
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
                    ${campo('cm-f1', 'CEP', `<input type="text" id="cm-cep" placeholder="00000-000">`, 'cm-cep')}
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
        $('cm-tipo').addEventListener('change', atualizarRotuloDocumento);
        form.addEventListener('submit', salvar);
    }

    function atualizarRotuloDocumento() {
        $('cm-lbl-doc').textContent = $('cm-tipo').value === 'Jurídica' ? 'CNPJ' : 'CPF';
    }

    function limpar() {
        form.reset();
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
