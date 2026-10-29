// ===== BUSCA DE CLIENTES (janela da lupa) =====
// Uso:  ClienteBusca.abrir({ termo: 'maria', aoEscolher: (cliente) => { ... } });
// Mostra todos os clientes, busca por nome / CPF / telefone / e-mail / cidade
// e exibe a ficha completa do cadastro antes de selecionar.
// Precisa de js/api.js (e js/cliente-modal.js, se quiser o botão "Novo cliente").

(function () {
    const CSS = `
    #cb-fundo { display: none; position: fixed; inset: 0; z-index: 1000; background: rgba(18,22,29,.55); align-items: center; justify-content: center; padding: 16px; }
    #cb-fundo * { box-sizing: border-box; }
    #cb-caixa { display: flex; flex-direction: column; width: 980px; max-width: 100%; height: min(680px, 92vh); background: #fff; border-radius: 18px; box-shadow: 0 24px 60px -12px rgba(18,22,29,.45); overflow: hidden; font-family: inherit; color: var(--text, #12161D); }
    .cb-topo { display: flex; align-items: center; gap: 12px; padding: 18px 22px 14px; }
    .cb-topo h3 { font-size: 18px; font-weight: 600; flex: 1; margin: 0; }
    .cb-x { width: 36px; height: 36px; border: 0; border-radius: 10px; background: transparent; font-size: 20px; cursor: pointer; color: var(--text-muted, #5E646C); }
    .cb-x:hover { background: var(--muted, #F1EEE9); }
    .cb-busca { padding: 0 22px 14px; }
    .cb-busca input { width: 100%; min-height: 46px; padding: 10px 14px; border: 1px solid var(--border, #E1DDD7); border-radius: 12px; font-size: 15px; font-family: inherit; }
    .cb-busca input:focus { outline: none; border-color: var(--accent, #F15B00); box-shadow: 0 0 0 3px rgba(241,91,0,.15); }
    .cb-corpo { flex: 1; min-height: 0; display: grid; grid-template-columns: minmax(0, 1.15fr) minmax(0, 1fr); border-top: 1px solid var(--border, #E1DDD7); }
    .cb-lista-col { display: flex; flex-direction: column; min-height: 0; border-right: 1px solid var(--border, #E1DDD7); }
    .cb-contagem { padding: 10px 22px; font-size: 12.5px; color: var(--text-muted, #5E646C); }
    .cb-lista { flex: 1; overflow-y: auto; padding: 0 12px 12px; }
    .cb-item { display: block; width: 100%; text-align: left; padding: 11px 12px; margin-bottom: 4px; border: 1px solid transparent; border-radius: 12px; background: none; cursor: pointer; font-family: inherit; color: inherit; }
    .cb-item:hover { background: var(--muted, #F1EEE9); }
    .cb-item.ativo { background: var(--accent-soft, #FFE7D7); border-color: rgba(241,91,0,.35); }
    .cb-item:focus-visible { outline: 2px solid var(--accent, #F15B00); }
    .cb-item strong { display: block; font-size: 14px; }
    .cb-item span { display: block; font-size: 12.5px; color: var(--text-muted, #5E646C); margin-top: 1px; }
    .cb-vazio { padding: 40px 22px; text-align: center; color: var(--text-muted, #5E646C); }
    .cb-ficha { display: flex; flex-direction: column; min-height: 0; background: #FCFBF9; }
    .cb-ficha-corpo { flex: 1; overflow-y: auto; padding: 20px 24px; }
    .cb-ficha h4 { font-size: 20px; font-weight: 600; margin: 0 0 14px; }
    .cb-campo { padding: 9px 0; border-bottom: 1px dashed var(--border, #E1DDD7); }
    .cb-campo small { display: block; font-size: 11.5px; color: var(--text-muted, #5E646C); margin-bottom: 1px; }
    .cb-campo div { font-size: 14px; font-weight: 600; word-break: break-word; }
    .cb-rodape { display: flex; justify-content: space-between; align-items: center; gap: 10px; padding: 14px 22px; border-top: 1px solid var(--border, #E1DDD7); background: #fff; }
    @media (max-width: 760px) {
        .cb-corpo { grid-template-columns: 1fr; grid-template-rows: minmax(0, 1fr) minmax(0, 1fr); }
        .cb-lista-col { border-right: 0; border-bottom: 1px solid var(--border, #E1DDD7); }
    }`;

    let fundo, inputBusca, lista, contagem, ficha, btnEscolher;
    let clientes = [], selecionado = null, aoEscolher = null, debounce = null, seq = 0;

    const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

    function montar() {
        if (fundo) return;
        const estilo = document.createElement('style');
        estilo.textContent = CSS;
        document.head.appendChild(estilo);

        fundo = document.createElement('div');
        fundo.id = 'cb-fundo';
        fundo.innerHTML = `
            <div id="cb-caixa" role="dialog" aria-modal="true" aria-label="Buscar cliente">
                <div class="cb-topo">
                    <h3>Buscar cliente</h3>
                    <button type="button" class="btn btn-secondary btn-sm" id="cb-novo">+ Novo cliente</button>
                    <button type="button" class="cb-x" id="cb-fechar" aria-label="Fechar">✕</button>
                </div>
                <div class="cb-busca">
                    <input type="text" id="cb-busca" placeholder="Nome, CPF/CNPJ, telefone, e-mail, cidade..." autocomplete="off">
                </div>
                <div class="cb-corpo">
                    <div class="cb-lista-col">
                        <div class="cb-contagem" id="cb-contagem"></div>
                        <div class="cb-lista" id="cb-lista"></div>
                    </div>
                    <div class="cb-ficha">
                        <div class="cb-ficha-corpo" id="cb-ficha"></div>
                        <div class="cb-rodape">
                            <button type="button" class="btn btn-secondary" id="cb-cancelar">Cancelar</button>
                            <button type="button" class="btn-acao" id="cb-escolher" disabled>Selecionar este cliente</button>
                        </div>
                    </div>
                </div>
            </div>`;
        document.body.appendChild(fundo);

        inputBusca = fundo.querySelector('#cb-busca');
        lista = fundo.querySelector('#cb-lista');
        contagem = fundo.querySelector('#cb-contagem');
        ficha = fundo.querySelector('#cb-ficha');
        btnEscolher = fundo.querySelector('#cb-escolher');

        fundo.querySelector('#cb-fechar').addEventListener('click', fechar);
        fundo.querySelector('#cb-cancelar').addEventListener('click', fechar);
        fundo.addEventListener('mousedown', (e) => { if (e.target === fundo) fechar(); });
        btnEscolher.addEventListener('click', escolher);
        fundo.querySelector('#cb-novo').addEventListener('click', () => {
            if (typeof ClienteModal === 'undefined') return;
            const nome = inputBusca.value.trim();
            fechar();
            ClienteModal.abrir({
                nome,
                aoSalvar: (cliente) => { if (aoEscolher) aoEscolher(cliente); }
            });
        });
        inputBusca.addEventListener('input', () => {
            clearTimeout(debounce);
            debounce = setTimeout(() => carregar(inputBusca.value), 250);
        });
        inputBusca.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') { e.preventDefault(); if (selecionado) escolher(); }
            if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); mover(e.key === 'ArrowDown' ? 1 : -1); }
        });
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && fundo.style.display === 'flex') fechar();
        });
    }

    function mover(passo) {
        if (!clientes.length) return;
        const i = clientes.findIndex((c) => c.id === selecionado?.id);
        const novo = Math.min(clientes.length - 1, Math.max(0, i + passo));
        selecionar(clientes[novo], true);
    }

    async function carregar(termo) {
        const minha = ++seq;
        try {
            const t = termo.trim();
            const dados = await api.clientes.listar(t ? `?busca=${encodeURIComponent(t)}` : '');
            if (minha !== seq) return; // chegou resposta de uma busca mais antiga
            clientes = dados;
            desenharLista();
        } catch (err) {
            lista.innerHTML = `<div class="cb-vazio">Não foi possível carregar os clientes.<br>${esc(err.message)}</div>`;
        }
    }

    function desenharLista() {
        contagem.textContent = clientes.length === 1 ? '1 cliente encontrado' : `${clientes.length} clientes encontrados`;
        if (!clientes.length) {
            lista.innerHTML = '<div class="cb-vazio">Nenhum cliente encontrado.<br>Tente outro nome ou número, ou cadastre um novo.</div>';
            selecionar(null);
            return;
        }
        lista.innerHTML = '';
        clientes.forEach((c) => {
            const b = document.createElement('button');
            b.type = 'button';
            b.className = 'cb-item';
            b.dataset.id = c.id;
            const detalhes = [c.cpf_cnpj, c.celular || c.telefone, c.cidade].filter(Boolean).join('  ·  ');
            b.innerHTML = `<strong>${esc(c.nome)}</strong><span>${esc(detalhes) || 'Sem dados de contato'}</span>`;
            b.addEventListener('click', () => selecionar(c));
            b.addEventListener('dblclick', () => { selecionar(c); escolher(); });
            lista.appendChild(b);
        });
        const manter = clientes.find((c) => c.id === selecionado?.id);
        selecionar(manter || clientes[0], !!manter);
    }

    function dataBR(iso) {
        const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso || '');
        return m ? `${m[3]}/${m[2]}/${m[1]}` : '';
    }

    function selecionar(c, rolar) {
        selecionado = c;
        btnEscolher.disabled = !c;
        lista.querySelectorAll('.cb-item').forEach((el) => {
            const ativo = c && Number(el.dataset.id) === c.id;
            el.classList.toggle('ativo', !!ativo);
            if (ativo && rolar) el.scrollIntoView({ block: 'nearest' });
        });
        if (!c) { ficha.innerHTML = '<div class="cb-vazio">Selecione um cliente para ver o cadastro.</div>'; return; }

        const rua = [c.endereco, c.numero].filter(Boolean).join(', ') + (c.complemento ? ` - ${c.complemento}` : '');
        const cidade = [c.cidade, c.estado].filter(Boolean).join('/');
        const campos = [
            ['Tipo de pessoa', c.tipo_pessoa],
            [c.tipo_pessoa === 'Jurídica' ? 'CNPJ' : 'CPF', c.cpf_cnpj],
            ['Data de nascimento', dataBR(c.data_nascimento)],
            ['Celular', c.celular],
            ['Telefone', c.telefone],
            ['E-mail', c.email],
            ['Endereço', rua],
            ['Bairro', c.bairro],
            ['Cidade', cidade],
            ['CEP', c.cep]
        ].filter(([, v]) => v);
        ficha.innerHTML = `<h4>${esc(c.nome)}</h4>` +
            campos.map(([k, v]) => `<div class="cb-campo"><small>${esc(k)}</small><div>${esc(v)}</div></div>`).join('');
    }

    function escolher() {
        if (!selecionado) return;
        const c = selecionado;
        fechar();
        if (aoEscolher) aoEscolher(c);
    }

    function fechar() { if (fundo) fundo.style.display = 'none'; }

    window.ClienteBusca = {
        abrir(opcoes = {}) {
            montar();
            aoEscolher = opcoes.aoEscolher || null;
            selecionado = null;
            inputBusca.value = opcoes.termo || '';
            fundo.style.display = 'flex';
            inputBusca.focus();
            carregar(inputBusca.value);
        }
    };
})();
