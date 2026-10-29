// ===== AGENDA =====
// Mostra os pedidos por dia e horário (visões Mês / Semana / Dia), como o calendário do iPhone.
// Pedido com data futura fica "agendado" (laranja); depois de concluído fica verde.
// Criar: botão "+ Novo pedido", clique num dia (visão Mês) ou num horário vazio (Semana / Dia).

(function () {
    const ALTURA_HORA = 56;     // px por hora nas visões Semana / Dia (igual ao CSS)
    const DURACAO_MIN = 55;     // bloco do pedido na grade (pedido não tem duração)
    const $ = (id) => document.getElementById(id);
    const dois = (n) => String(n).padStart(2, '0');
    const iso = (d) => `${d.getFullYear()}-${dois(d.getMonth() + 1)}-${dois(d.getDate())}`;
    const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    const maiuscula = (t) => t.charAt(0).toUpperCase() + t.slice(1);
    const hora = (d) => `${dois(d.getHours())}:${dois(d.getMinutes())}`;
    const brl = (v) => Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    const soDia = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
    const somar = (d, n) => { const x = soDia(d); x.setDate(x.getDate() + n); return x; };
    const inicioSemana = (d) => somar(d, -d.getDay());
    const hojeIso = () => iso(new Date());

    // "2026-10-29T14:30:00" -> Date local, sem conversão de fuso
    function lerDataHora(s) {
        const m = /(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(s || '');
        return m ? new Date(+m[1], +m[2] - 1, +m[3], +m[4], +m[5]) : new Date(NaN);
    }

    const parametros = new URLSearchParams(window.location.search);
    const dataInicial = /^\d{4}-\d{2}-\d{2}$/.test(parametros.get('data') || '') ? parametros.get('data') : null;
    let ref = dataInicial ? new Date(dataInicial + 'T12:00:00') : new Date();
    let visao = localStorage.getItem('agenda_visao') || (window.innerWidth < 760 ? 'dia' : 'mes');
    let eventos = [];
    let carregamento = 0;

    function periodo() {
        if (visao === 'mes') {
            const ini = inicioSemana(new Date(ref.getFullYear(), ref.getMonth(), 1));
            return { ini, fim: somar(ini, 41), dias: 42 };
        }
        if (visao === 'semana') { const ini = inicioSemana(ref); return { ini, fim: somar(ini, 6), dias: 7 }; }
        return { ini: soDia(ref), fim: soDia(ref), dias: 1 };
    }

    function titulo() {
        if (visao === 'mes') return ref.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
        if (visao === 'dia') return ref.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
        const { ini, fim } = periodo();
        const a = ini.toLocaleDateString('pt-BR', { day: 'numeric', month: 'short' });
        const b = fim.toLocaleDateString('pt-BR', { day: 'numeric', month: 'short', year: 'numeric' });
        return `${a} – ${b}`;
    }

    async function carregar() {
        const minha = ++carregamento;
        const { ini, fim } = periodo();
        try {
            const dados = await api.pedidos.agenda(iso(ini), iso(fim));
            if (minha !== carregamento) return;
            eventos = dados.map((e) => ({ ...e, quando: lerDataHora(e.data_hora) })).filter((e) => !isNaN(e.quando)).sort((a, b) => a.quando - b.quando);
        } catch (err) {
            eventos = [];
            $('agCaixa').innerHTML = `<div class="empty-state" style="padding:40px;">Não foi possível carregar a agenda: ${esc(err.message)}</div>`;
            return;
        }
        desenhar();
    }

    function eventosDoDia(dia) {
        const k = iso(dia);
        return eventos.filter((e) => iso(e.quando) === k);
    }

    function linkNovo(dia, h) {
        return `novo-pedido.html?data=${iso(dia)}${h ? `&hora=${h}` : ''}`;
    }

    function desenhar() {
        document.querySelectorAll('#agVisao button').forEach((b) => b.classList.toggle('ativo', b.dataset.v === visao));
        $('agTitulo').textContent = maiuscula(titulo());
        $('btnNovoPedido').href = linkNovo(ref);
        if (visao === 'mes') desenharMes(); else desenharGrade();
    }

    // ---------- MÊS ----------
    function desenharMes() {
        const { ini } = periodo();
        const caixa = $('agCaixa');
        const nomes = Array.from({ length: 7 }, (_, i) => somar(ini, i).toLocaleDateString('pt-BR', { weekday: 'short' }).replace('.', ''));
        let html = `<div class="ag-mes-cab">${nomes.map((n) => `<div>${esc(n)}</div>`).join('')}</div><div class="ag-mes">`;
        for (let i = 0; i < 42; i++) {
            const dia = somar(ini, i);
            const evs = eventosDoDia(dia);
            const classes = ['ag-dia'];
            if (dia.getMonth() !== ref.getMonth()) classes.push('fora');
            if (iso(dia) === hojeIso()) classes.push('hoje');
            html += `<div class="${classes.join(' ')}" data-dia="${iso(dia)}"><span class="ag-num">${dia.getDate()}</span>`;
            evs.slice(0, 3).forEach((e) => {
                html += `<button type="button" class="ag-pill ${e.status}" data-id="${e.id}">${hora(e.quando)} ${esc(e.cliente_nome)}</button>`;
            });
            if (evs.length > 3) html += `<div class="ag-mais">+${evs.length - 3} mais</div>`;
            html += '</div>';
        }
        caixa.innerHTML = html + '</div>';
        caixa.querySelectorAll('.ag-dia').forEach((el) => el.addEventListener('click', () => {
            ref = new Date(el.dataset.dia + 'T12:00:00');
            definirVisao('dia');
        }));
        caixa.querySelectorAll('.ag-pill').forEach((el) => el.addEventListener('click', (ev) => {
            ev.stopPropagation();
            abrirDetalhe(Number(el.dataset.id));
        }));
    }

    // ---------- SEMANA / DIA (grade de horas) ----------
    function distribuir(evs) {
        const lista = evs.map((e) => ({ e, ini: e.quando.getHours() * 60 + e.quando.getMinutes() })).sort((a, b) => a.ini - b.ini);
        const saida = [];
        let grupo = [], fimGrupo = 0;
        const fechar = () => {
            const faixas = [];
            grupo.forEach((x) => {
                let f = faixas.findIndex((fim) => fim <= x.ini);
                if (f < 0) { f = faixas.length; faixas.push(0); }
                faixas[f] = x.ini + DURACAO_MIN;
                x.faixa = f;
            });
            grupo.forEach((x) => { x.faixas = faixas.length; });
            saida.push(...grupo);
            grupo = [];
        };
        lista.forEach((x) => {
            if (grupo.length && x.ini >= fimGrupo) fechar();
            grupo.push(x);
            fimGrupo = Math.max(fimGrupo, x.ini + DURACAO_MIN);
        });
        if (grupo.length) fechar();
        return saida;
    }

    function desenharGrade() {
        const { ini, dias } = periodo();
        const caixa = $('agCaixa');
        const cols = `56px repeat(${dias}, minmax(0, 1fr))`;
        let cab = `<div class="ag-cab-semana" style="grid-template-columns:${cols}"><div></div>`;
        for (let i = 0; i < dias; i++) {
            const d = somar(ini, i);
            cab += `<div class="ag-cab-dia ${iso(d) === hojeIso() ? 'hoje' : ''}" data-dia="${iso(d)}">${esc(d.toLocaleDateString('pt-BR', { weekday: 'short' }).replace('.', ''))}<br><span class="ag-num">${d.getDate()}</span></div>`;
        }
        cab += '</div>';

        let corpo = `<div class="ag-scroll" id="agScroll"><div class="ag-corpo" style="grid-template-columns:${cols}">`;
        corpo += `<div class="ag-horas">${Array.from({ length: 24 }, (_, h) => `<div>${h === 0 ? '' : `${dois(h)}:00`}</div>`).join('')}</div>`;
        for (let i = 0; i < dias; i++) {
            const d = somar(ini, i);
            corpo += `<div class="ag-col" data-dia="${iso(d)}">`;
            distribuir(eventosDoDia(d)).forEach((x) => {
                const e = x.e, largura = 100 / x.faixas;
                const top = (x.ini / 60) * ALTURA_HORA, altura = (DURACAO_MIN / 60) * ALTURA_HORA - 2;
                corpo += `<button type="button" class="ag-ev ${e.status}" data-id="${e.id}" style="top:${top}px;height:${altura}px;left:calc(${x.faixa * largura}% + 2px);width:calc(${largura}% - 4px)">${hora(e.quando)} ${esc(e.cliente_nome)}<small>${esc(e.produtos || '')}</small></button>`;
            });
            if (iso(d) === hojeIso()) {
                const agora = new Date();
                corpo += `<div class="ag-agora" style="top:${((agora.getHours() * 60 + agora.getMinutes()) / 60) * ALTURA_HORA}px"></div>`;
            }
            corpo += '</div>';
        }
        caixa.innerHTML = cab + corpo + '</div></div>';

        caixa.querySelectorAll('.ag-cab-dia').forEach((el) => el.addEventListener('click', () => {
            ref = new Date(el.dataset.dia + 'T12:00:00');
            definirVisao('dia');
        }));
        caixa.querySelectorAll('.ag-ev').forEach((el) => el.addEventListener('click', (ev) => {
            ev.stopPropagation();
            abrirDetalhe(Number(el.dataset.id));
        }));
        // Clique num horário vazio: cria um pedido naquele dia e hora
        caixa.querySelectorAll('.ag-col').forEach((el) => el.addEventListener('click', (ev) => {
            const y = ev.clientY - el.getBoundingClientRect().top;
            const h = Math.min(23, Math.max(0, Math.floor(y / ALTURA_HORA)));
            window.location.href = linkNovo(new Date(el.dataset.dia + 'T12:00:00'), `${dois(h)}:00`);
        }));

        // Rola até o horário atual (ou 8h) para já mostrar o que importa
        const rolar = $('agScroll');
        const temHoje = iso(ini) <= hojeIso() && hojeIso() <= iso(somar(ini, dias - 1));
        const alvo = temHoje ? new Date().getHours() - 1 : 7;
        rolar.scrollTop = Math.max(0, alvo) * ALTURA_HORA;
    }

    // ---------- DETALHE ----------
    function abrirDetalhe(id) {
        const e = eventos.find((x) => x.id === id);
        if (!e) return;
        const fone = e.cliente_celular || e.cliente_telefone;
        const linha = (rot, val) => val ? `<div class="ag-linha"><small>${esc(rot)}</small><div>${esc(val)}</div></div>` : '';
        const agendado = e.status === 'aberto';
        $('ag-modal').innerHTML = `
            <h3>${esc(e.cliente_nome)}</h3>
            <div class="ag-quando">${esc(maiuscula(e.quando.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })))} às ${hora(e.quando)}</div>
            ${linha('Situação', agendado ? 'Agendado' : 'Concluído')}
            ${linha('Produtos', e.produtos)}
            ${linha('Valor do pedido', brl(e.valor_total))}
            ${Number(e.valor_a_pagar) !== Number(e.valor_total) ? linha('A pagar', brl(e.valor_a_pagar)) : ''}
            ${linha('Telefone', fone)}
            ${linha('Vendedor', e.vendedor_nome)}
            ${linha('Observações', (e.observacoes || '').trim())}
            <div class="ag-acoes">
                <button type="button" class="btn btn-secondary" id="agFechar">Fechar</button>
                <a class="btn btn-secondary" href="recibo.html?id=${e.id}" target="_blank">Recibo</a>
                <a class="btn btn-secondary" href="novo-pedido.html?id=${e.id}">Editar</a>
                ${agendado ? '<button type="button" class="btn btn-primary" id="agConcluir">Marcar como concluído</button>' : ''}
            </div>`;
        $('ag-fundo').style.display = 'flex';
        $('agFechar').addEventListener('click', fecharDetalhe);
        const bc = $('agConcluir');
        if (bc) bc.addEventListener('click', async () => {
            bc.disabled = true;
            try { await api.pedidos.concluir(e.id); fecharDetalhe(); carregar(); }
            catch (err) { alert('Erro: ' + err.message); bc.disabled = false; }
        });
    }
    function fecharDetalhe() { $('ag-fundo').style.display = 'none'; }
    $('ag-fundo').addEventListener('mousedown', (ev) => { if (ev.target === $('ag-fundo')) fecharDetalhe(); });
    document.addEventListener('keydown', (ev) => { if (ev.key === 'Escape') fecharDetalhe(); });

    // ---------- NAVEGAÇÃO ----------
    function definirVisao(v) {
        visao = v;
        localStorage.setItem('agenda_visao', v);
        carregar();
        desenhar();
    }
    function mover(passo) {
        if (visao === 'mes') ref = new Date(ref.getFullYear(), ref.getMonth() + passo, 1);
        else ref = somar(ref, visao === 'semana' ? 7 * passo : passo);
        carregar();
        desenhar();
    }
    $('agAnt').addEventListener('click', () => mover(-1));
    $('agProx').addEventListener('click', () => mover(1));
    $('agHoje').addEventListener('click', () => { ref = new Date(); carregar(); desenhar(); });
    document.querySelectorAll('#agVisao button').forEach((b) => b.addEventListener('click', () => definirVisao(b.dataset.v)));

    desenhar();
    carregar();
})();
