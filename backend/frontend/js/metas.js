// Tela "Meta do mês": mostra o progresso e (para admin) edita as metas do mês.

const CATEGORIAS_META = [
    ['aparelho_novo', 'Aparelho novo'],
    ['aparelho_seminovo', 'Aparelho seminovo'],
    ['acessorio', 'Acessório'],
    ['peca', 'Peça']
];

let mesAtual = mesAtualLocal();
let metasCarregadas = [];

function somarMes(mes, delta) {
    const [a, m] = mes.split('-').map(Number);
    const d = new Date(a, m - 1 + delta, 1);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function mudarMes(delta) {
    mesAtual = somarMes(mesAtual, delta);
    fecharEditor();
    carregarMetas();
}

async function carregarMetas() {
    document.getElementById('nome-mes').textContent = nomeDoMes(mesAtual);
    const caixa = document.getElementById('metas-lista');
    try {
        const r = await api.metas.listar(mesAtual);
        metasCarregadas = r.metas;
        caixa.innerHTML = renderizarCartoesMeta(r.metas);
    } catch (err) {
        caixa.innerHTML = `<div class="empty-state" style="grid-column:1/-1;">Erro ao carregar as metas: ${esc(err.message)}</div>`;
    }
}

// ---------- Editor (só admin) ----------

function linhaEditor(m = {}) {
    const cats = String(m.categorias || '').split(',').map(x => x.trim()).filter(Boolean);
    return `
        <div class="meta-linha">
            <div class="form-group">
                <label>Nome</label>
                <input type="text" class="m-nome" maxlength="60" value="${esc(m.nome || '')}" placeholder="Ex.: Seguro">
            </div>
            <div class="form-group">
                <label>Tipo</label>
                <select class="m-tipo">
                    <option value="quantidade" ${m.tipo !== 'valor' ? 'selected' : ''}>Quantidade</option>
                    <option value="valor" ${m.tipo === 'valor' ? 'selected' : ''}>Valor (R$)</option>
                </select>
            </div>
            <div class="form-group">
                <label>Meta</label>
                <input type="number" class="m-alvo" min="0" step="any" value="${m.alvo ?? 0}">
            </div>
            <div class="form-group">
                <label>Categorias</label>
                <div style="display:flex; flex-wrap:wrap; gap:4px 12px; font-size:12.5px;">
                    ${CATEGORIAS_META.map(([v, rot]) => `
                        <label style="display:flex; align-items:center; gap:4px; font-weight:500;">
                            <input type="checkbox" class="m-cat" value="${v}" ${cats.includes(v) ? 'checked' : ''} style="width:auto;"> ${rot}
                        </label>`).join('')}
                </div>
            </div>
            <div class="form-group meta-linha-palavras">
                <label>Palavras no nome do produto (separadas por vírgula)</label>
                <input type="text" class="m-palavras" maxlength="255" value="${esc(m.palavras || '')}" placeholder="Ex.: seguro, garantia estendida">
            </div>
            <div class="form-group">
                <button type="button" class="btn btn-secondary btn-sm" onclick="this.closest('.meta-linha').remove()">Remover</button>
            </div>
        </div>`;
}

function abrirEditor() {
    document.getElementById('editor-linhas').innerHTML = metasCarregadas.map(linhaEditor).join('');
    document.getElementById('painel-editor').style.display = 'block';
}

function fecharEditor() {
    document.getElementById('painel-editor').style.display = 'none';
}

function adicionarLinha() {
    document.getElementById('editor-linhas').insertAdjacentHTML('beforeend', linhaEditor());
}

async function salvarMetas() {
    const metas = [...document.querySelectorAll('#editor-linhas .meta-linha')].map(l => ({
        nome: l.querySelector('.m-nome').value.trim(),
        tipo: l.querySelector('.m-tipo').value,
        alvo: Number(l.querySelector('.m-alvo').value) || 0,
        palavras: l.querySelector('.m-palavras').value.trim(),
        categorias: [...l.querySelectorAll('.m-cat:checked')].map(c => c.value).join(',')
    }));
    try {
        await api.metas.salvar(mesAtual, metas);
        fecharEditor();
        await carregarMetas();
    } catch (err) {
        alert(err.message || 'Erro ao salvar as metas');
    }
}

carregarMetas();
