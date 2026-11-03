/* Utilizadores da empresa (gestor): mediadores (criar, editar, bloquear, nova senha, apagar),
   acessos dos clientes ao portal e pedidos de recuperação de senha. O administrador só gere os gestores. */
(async function () {
  const { api, fmt, esc, icon, toast, modal } = App;
  await App.boot({ title: 'Utilizadores', roles: ['manager'] });
  const $ = (id) => document.getElementById(id);
  let items = [], editing = null;

  $('tabs').addEventListener('click', (e) => {
    const t = e.target.closest('.tab'); if (!t) return;
    document.querySelectorAll('#tabs .tab').forEach(x => x.classList.toggle('active', x === t));
    document.querySelectorAll('.tab-panel').forEach(p => p.classList.toggle('active', p.id === 'tab-' + t.dataset.t));
    history.replaceState(null, '', '#' + t.dataset.t);
    if (t.dataset.t === 'customers') cl.load(1);
    if (t.dataset.t === 'resets') loadResets();
  });

  // ================= Mediadores =================
  async function load() {
    const r = await api.get('/api/team/readers');
    if (!r.success) { $('rows').innerHTML = `<tr><td colspan="7" class="empty-state">${esc(r.error)}</td></tr>`; return; }
    items = r.items || [];
    $('rows').innerHTML = items.map(u => `<tr><td class="strong">${esc(u.name)}</td><td><code>${esc(u.username)}</code>${u.must_change_password ? ' <span class="badge orange">senha temporária</span>' : ''}</td>
      <td class="hide-sm">${esc([u.phone, u.email].filter(Boolean).join(' · ') || '—')}${!u.email ? ' <span class="badge gray">sem email</span>' : ''}</td>
      <td class="num">${fmt.num(u.readings_month)}<br><span class="muted">${fmt.num(u.readings_total)} no total</span></td><td class="hide-sm">${u.last_login ? fmt.datetime(u.last_login) : 'nunca'}</td><td>${App.badge(u.status)}</td>
      <td class="actions"><div class="acts"><button class="act orange" data-edit="${u.id}" title="Editar">${icon('edit')}</button>
        ${u.status === 'active' ? `<button class="act" data-block="${u.id}" data-to="blocked" title="Bloquear">${icon('lock')}</button>`
          : `<button class="act green" data-block="${u.id}" data-to="active" title="Desbloquear">${icon('unlock')}</button>`}
        <button class="act" data-reset="${u.id}" title="Nova senha">${icon('key')}</button>
        <a class="act blue" href="/readings?reader=${u.id}" title="Leituras">${icon('drop')}</a>
        <button class="act red" data-del="${u.id}" title="${Number(u.readings_total) ? 'Bloquear (tem leituras)' : 'Apagar'}">${icon('trash')}</button></div></td></tr>`).join('')
      || '<tr><td colspan="7" class="empty-state">Ainda sem mediadores.</td></tr>';
  }
  const form = $('form');
  $('btnNew').addEventListener('click', () => { editing = null; form.reset(); $('statusField').style.display = 'none'; $('formTitle').textContent = 'Novo mediador'; modal.open('formModal'); });
  $('rows').addEventListener('click', async (e) => {
    const ed = e.target.closest('[data-edit]'), rs = e.target.closest('[data-reset]'), dl = e.target.closest('[data-del]'), bl = e.target.closest('[data-block]');
    const u = (x) => items.find(i => String(i.id) === x);
    if (ed) {
      const m = u(ed.dataset.edit);
      editing = m.id; App.fillForm(form, m); $('statusField').style.display = ''; $('formTitle').textContent = 'Editar ' + m.name; modal.open('formModal');
    }
    if (bl) {
      const m = u(bl.dataset.block);
      const r = await api.put('/api/team/readers/' + m.id, { name: m.name, phone: m.phone, email: m.email, status: bl.dataset.to });
      r.success ? (toast(bl.dataset.to === 'blocked' ? 'Mediador bloqueado.' : 'Mediador desbloqueado.', 'success'), load()) : toast(r.error, 'error');
    }
    if (rs) {
      if (!await App.ask('Gerar nova senha temporária?', { text: 'A senha atual deixa de funcionar.' })) return;
      const r = await api.post(`/api/team/readers/${rs.dataset.reset}/reset-password`);
      r.success ? (App.showCredentials('Mediador ' + r.name, r.username, r.temp_password), load()) : toast(r.error, 'error');
    }
    if (dl) {
      const m = u(dl.dataset.del);
      const has = Number(m.readings_total) > 0;
      if (!await App.ask((has ? 'Bloquear ' : 'Apagar ') + m.name + '?', { danger: true, confirm: has ? 'Bloquear' : 'Apagar',
        text: has ? `Tem ${m.readings_total} leitura(s): não se apaga para manter o histórico. Fica bloqueado e deixa de poder entrar.` : 'O utilizador do mediador é apagado.' })) return;
      const r = await api.del('/api/team/readers/' + m.id);
      r.success ? (toast(r.message, 'success'), load()) : toast(r.error, 'error');
    }
  });
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const d = App.formData(form);
    const r = editing ? await api.put('/api/team/readers/' + editing, { name: d.name, phone: d.phone, email: d.email, status: d.status })
      : await api.post('/api/team/readers', { name: d.name, phone: d.phone, email: d.email });
    if (!r.success) { toast(r.error, 'error'); return; }
    modal.close('formModal'); load();
    if (!editing) App.showCredentials('Mediador ' + r.name, r.username, r.temp_password, 'Entregue estes dados ao mediador. No telemóvel, abra o sistema e escolha "Adicionar ao ecrã inicial".');
    else toast('Mediador atualizado.', 'success');
  });
  $('btnPrint').addEventListener('click', () => App.printHtml('Mediadores', App.tableHtml([['Nome', 'name'], ['Utilizador', 'username'], ['Telefone', 'phone'], ['Email', 'email'],
    ['Leituras no mês', 'readings_month', 'n'], ['Leituras (total)', 'readings_total', 'n'], ['Último acesso', r => r.last_login ? fmt.datetime(r.last_login) : 'nunca'], ['Estado', r => (App.STATUS[r.status] || [r.status])[0]]], items)));

  // ================= Acessos dos clientes =================
  let cFilter = '';
  const cl = App.pagedList({
    url: '/api/team/customer-users', params: () => ({ q: $('cq').value.trim(), status: cFilter }), tbody: 'cRows', pager: 'cPager', cols: 6,
    empty: 'Sem acessos de clientes.',
    row: (u) => `<tr><td><a class="strong" href="/customers?view=${u.customer_id}">${esc(u.name)}</a><br><span class="muted">${esc(u.customer_code)}${u.customer_status !== 'active' ? ' · cliente inativo' : ''}</span></td>
      <td><code>${esc(u.username)}</code>${u.must_change_password ? '<br><span class="badge orange">senha temporária</span>' : ''}</td>
      <td class="hide-sm">${esc([u.phone, u.email].filter(Boolean).join(' · ') || '—')}</td>
      <td class="hide-sm">${u.last_login ? fmt.datetime(u.last_login) : 'nunca entrou'}</td><td>${App.badge(u.status)}</td>
      <td class="actions"><div class="acts">
        ${u.status === 'active' ? `<button class="act" data-cs="${u.id}" data-to="blocked" title="Bloquear acesso">${icon('lock')}</button>`
          : `<button class="act green" data-cs="${u.id}" data-to="active" title="Desbloquear">${icon('unlock')}</button>`}
        <button class="act" data-creset="${u.id}" title="Nova senha">${icon('key')}</button>
        <button class="act red" data-cdel="${u.id}" data-n="${esc(u.name)}" title="Remover acesso ao portal">${icon('trash')}</button></div></td></tr>`
  });
  $('cq').addEventListener('input', App.debounce(() => cl.load(1), 350));
  $('cClear').addEventListener('click', () => { $('cq').value = ''; cFilter = ''; $('cChips').querySelectorAll('.chip').forEach(c => c.classList.toggle('active', c.dataset.f === '')); cl.load(1); });
  $('cChips').addEventListener('click', (e) => { const c = e.target.closest('.chip'); if (!c) return; cFilter = c.dataset.f;
    $('cChips').querySelectorAll('.chip').forEach(x => x.classList.toggle('active', x === c)); cl.load(1); });
  $('cRows').addEventListener('click', async (e) => {
    const s = e.target.closest('[data-cs]'), rs = e.target.closest('[data-creset]'), d = e.target.closest('[data-cdel]');
    if (s) { const r = await api.post(`/api/team/customer-users/${s.dataset.cs}/status/${s.dataset.to}`); r.success ? (toast(r.message, 'success'), cl.reload()) : toast(r.error, 'error'); }
    if (rs) {
      if (!await App.ask('Gerar nova senha do portal?', { text: 'A senha atual deixa de funcionar.' })) return;
      const r = await api.post(`/api/team/customer-users/${rs.dataset.creset}/reset-password`);
      r.success ? (App.showCredentials('Acesso de ' + r.name, r.username, r.temp_password, 'Entregue estes dados ao cliente.'), cl.reload()) : toast(r.error, 'error');
    }
    if (d) {
      if (!await App.ask('Remover o acesso de ' + d.dataset.n + '?', { danger: true, confirm: 'Remover acesso', text: 'Só o utilizador do portal é apagado. O cliente, as contas, faturas e pagamentos ficam intactos; pode criar novo acesso na ficha do cliente.' })) return;
      const r = await api.del('/api/team/customer-users/' + d.dataset.cdel);
      r.success ? (toast(r.message, 'success'), cl.reload()) : toast(r.error, 'error');
    }
  });

  // ================= Pedidos de senha =================
  let rFilter = 'pending';
  async function loadResets() {
    const r = await api.get('/api/team/password-resets' + App.query({ status: rFilter }));
    const rows = (r.success && r.items) || [];
    if (rFilter === 'pending') $('resetCount').innerHTML = rows.length ? `<span class="badge red">${rows.length}</span>` : '';
    $('rRows').innerHTML = rows.map(x => `<tr><td>${fmt.datetime(x.created_at)}</td>
      <td class="strong">${esc(x.name)}<br><code>${esc(x.username)}</code> <span class="muted">${esc(App.ROLES[x.role] || '')}</span></td>
      <td class="hide-sm">${esc([x.phone, x.email].filter(Boolean).join(' · ') || '—')}</td><td>${App.badge(x.status)}</td>
      <td class="actions">${x.status === 'pending' ? `<div class="acts"><button class="act green" data-resolve="${x.id}" title="Gerar senha temporária">${icon('key')}</button>
        <button class="act red" data-rcancel="${x.id}" title="Cancelar">${icon('x')}</button></div>` : ''}</td></tr>`).join('')
      || `<tr><td colspan="5" class="empty-state">${r.success ? 'Sem pedidos.' : esc(r.error)}</td></tr>`;
  }
  $('rChips').addEventListener('click', (e) => { const c = e.target.closest('.chip'); if (!c) return; rFilter = c.dataset.f;
    $('rChips').querySelectorAll('.chip').forEach(x => x.classList.toggle('active', x === c)); loadResets(); });
  $('rRows').addEventListener('click', async (e) => {
    const ok = e.target.closest('[data-resolve]'), no = e.target.closest('[data-rcancel]');
    if (ok) {
      const r = await api.post(`/api/team/password-resets/${ok.dataset.resolve}/resolve`);
      r.success ? (App.showCredentials('Nova senha de ' + r.name, r.username, r.temp_password, r.phone ? 'Contacto: ' + r.phone : ''), loadResets()) : toast(r.error, 'error');
    }
    if (no) { if (!await App.ask('Cancelar o pedido?')) return; const r = await api.post(`/api/team/password-resets/${no.dataset.rcancel}/cancel`); r.success ? loadResets() : toast(r.error, 'error'); }
  });

  load();
  loadResets();
  if (location.hash) { const t = document.querySelector(`#tabs .tab[data-t="${location.hash.slice(1)}"]`); if (t) t.click(); }
})();
