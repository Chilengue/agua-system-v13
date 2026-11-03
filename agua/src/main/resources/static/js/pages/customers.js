/* Clientes: lista com filtros, registo completo (sem duplicados), contas/contratos, contadores, acesso ao portal. */
(async function () {
  const { api, fmt, esc, icon, toast, modal } = App;
  await App.boot({ title: 'Clientes', roles: ['manager'] });
  const $ = (id) => document.getElementById(id);
  let filter = '', editingId = null, editingAcc = null, accCustomer = null, current = null;

  // ---------- campos da conta (usados no registo e no modal de conta) ----------
  const ACC_FIELDS = `
    <div class="field"><label>Nº da conta / contrato</label><input type="text" name="number" maxlength="30" placeholder="Automático"></div>
    <div class="field"><label>Categoria (tarifa)</label><select name="category"><option value="residential">Doméstico</option><option value="commercial">Comercial</option><option value="public">Público</option><option value="industrial">Industrial</option></select></div>
    <div class="field"><label>Data de ligação</label><input type="date" name="opened_at"></div>
    <div class="field span-2"><label>Local da ligação (se diferente da morada)</label><input type="text" name="address"></div>
    <div class="field"><label>Bairro</label><input type="text" name="neighborhood" maxlength="120"></div>
    <div class="field"><label>Quarteirão</label><input type="text" name="block" maxlength="40"></div>
    <div class="field"><label>Nº da casa</label><input type="text" name="house_number" maxlength="40"></div>
    <div class="field"><label>Ponto de referência</label><input type="text" name="landmark" maxlength="200"></div>
    <div class="field acc-meter"><label>Nº do contador</label><input type="text" name="meter_number" maxlength="50" placeholder="Automático se vazio"></div>
    <div class="field acc-meter"><label>Leitura inicial (m³)</label><input type="number" name="initial_reading" min="0" value="0"></div>
    <div class="field"><label>Latitude / longitude</label><div style="display:flex;gap:6px"><input type="text" name="latitude" maxlength="20" placeholder="-25.96"><input type="text" name="longitude" maxlength="20" placeholder="32.58"></div></div>
    <div class="field span-3"><label>Observações da conta</label><input type="text" name="notes"></div>`;
  $('accFields').innerHTML = ACC_FIELDS;
  $('accFields2').innerHTML = ACC_FIELDS;
  const readForm = (box) => { const o = {}; box.querySelectorAll('[name]').forEach(el => { o[el.name] = el.value === '' ? null : (el.type === 'number' ? Number(el.value) : el.value); }); return o; };

  // ---------- lista ----------
  const nbs = await api.get('/api/customers/neighborhoods');
  const nbItems = (nbs.success && nbs.items) || [];
  $('nb').innerHTML += nbItems.map(n => `<option value="${esc(n.neighborhood)}">${esc(n.neighborhood)} (${n.customers})</option>`).join('');
  $('nbList').innerHTML = nbItems.map(n => `<option value="${esc(n.neighborhood)}">`).join('');
  const params = () => ({ q: $('q').value.trim(), neighborhood: $('nb').value, sort: $('sort').value,
    status: ['active', 'inactive'].includes(filter) ? filter : '', debt: ['debtor', 'clear', 'overdue', 'noaccess'].includes(filter) ? filter : '' });
  const initials = (n) => String(n || '?').trim().split(/\s+/).filter(Boolean).slice(0, 2).map(x => x[0]).join('').toUpperCase();
  const list = App.pagedList({
    url: '/api/customers', params, tbody: 'rows', pager: 'pager', cols: 8, empty: 'Nenhum cliente encontrado.',
    row: (c) => `<tr>
      <td><div class="cust-cell"><span class="initials ${c.status !== 'active' ? 'off' : Number(c.debt) ? 'debt' : ''}">${esc(initials(c.name))}</span>
        <div class="meta"><a href="#" class="strong" data-view="${c.id}" title="${esc(c.name)}">${esc(c.name)}</a>
        <span class="muted">${esc(c.code)}${c.document ? ' · ' + esc(App.DOCS[c.document_type] || '') + ' ' + esc(c.document) : ''}${c.login ? '' : ' · <span class="badge gray">sem acesso</span>'}</span></div></div></td>
      <td class="hide-sm">${esc(c.phone || '—')}${c.email ? `<br><span class="muted">${esc(c.email)}</span>` : ''}</td>
      <td class="hide-sm">${esc(c.neighborhood || '—')}${c.block || c.house_number ? `<br><span class="muted">${[c.block && 'Q. ' + esc(c.block), c.house_number && 'casa ' + esc(c.house_number)].filter(Boolean).join(', ')}</span>` : ''}</td>
      <td class="hide-sm"><span class="pill">${c.accounts}</span> <span class="muted">${esc(c.account_numbers || '')}</span></td>
      <td class="num ${Number(c.debt) ? 'strong' : 'muted'}" style="${Number(c.debt) ? 'color:var(--danger)' : ''}">${fmt.money(c.debt)}${Number(c.open_invoices) ? `<br><span class="muted">${c.open_invoices} fat.${Number(c.overdue_invoices) ? ' · ' + c.overdue_invoices + ' vencida(s)' : ''}</span>` : ''}</td>
      <td class="hide-sm">${fmt.date(c.last_payment)}</td>
      <td>${App.badge(c.status)}</td>
      <td class="actions"><div class="acts">
        <button class="act blue" data-view="${c.id}" title="Ver ficha">${icon('eye')}</button>
        <button class="act orange" data-edit="${c.id}" title="Editar">${icon('edit')}</button>
        <a class="act green" href="/cashier?customer=${c.id}" title="Receber pagamento">${icon('cash')}</a>
        <a class="act" href="/statements?customer=${c.id}" title="Extrato">${icon('list')}</a></div></td></tr>`,
    onData: (r) => {
      const s = r.stats || {};
      $('stats').innerHTML = `
        <div class="stat-card top"><div class="stat-label">Clientes</div><h3>${fmt.num(s.customers)}</h3><div class="stat-sub">${fmt.num(s.active)} ativos</div></div>
        <div class="stat-card top blue"><div class="stat-label">Contas / contratos</div><h3>${fmt.num(s.accounts)}</h3><div class="stat-sub">ativas</div></div>
        <div class="stat-card top red"><div class="stat-label">Clientes com dívida</div><h3>${fmt.num(s.debtors)}</h3><div class="stat-sub">a pagar</div></div>
        <div class="stat-card top orange"><div class="stat-label">Total em dívida</div><h3>${fmt.moneyHtml(s.debt)}</h3><div class="stat-sub">todas as contas</div></div>`;
    }
  });
  $('rows').addEventListener('click', (e) => {
    const v = e.target.closest('[data-view]'), ed = e.target.closest('[data-edit]');
    if (v) { e.preventDefault(); view(v.dataset.view); }
    if (ed) edit(ed.dataset.edit);
  });
  $('q').addEventListener('input', App.debounce(() => list.load(1), 350));
  ['nb', 'sort'].forEach(id => $(id).addEventListener('change', () => list.load(1)));
  $('size').addEventListener('change', () => { list.setSize(Number($('size').value)); list.load(1); });
  $('btnClear').addEventListener('click', () => { $('q').value = ''; $('nb').value = ''; $('sort').value = ''; setChip(''); });
  $('chips').addEventListener('click', (e) => { const c = e.target.closest('.chip'); if (c) setChip(c.dataset.f); });
  function setChip(f) { filter = f; document.querySelectorAll('#chips .chip').forEach(c => c.classList.toggle('active', c.dataset.f === f)); list.load(1); }

  const exportCfg = () => ({
    url: '/api/customers', params: params(), title: 'Lista de clientes', landscape: true,
    filters: [$('q').value && 'Pesquisa: ' + $('q').value, $('nb').value && 'Bairro: ' + $('nb').value, filter && document.querySelector('#chips .chip.active').textContent].filter(Boolean).join(' · ') || 'Todos',
    columns: [['Código', 'code'], ['Nome', 'name'], ['Telefone', 'phone'], ['Documento', r => r.document ? (App.DOCS[r.document_type] || '') + ' ' + r.document : ''],
      ['Bairro', 'neighborhood'], ['Contas', 'account_numbers'], ['Faturas em aberto', 'open_invoices', 'n'], ['Em dívida', r => fmt.amount(r.debt), 'n'],
      ['Último pagamento', r => fmt.date(r.last_payment)], ['Estado', r => (App.STATUS[r.status] || [r.status])[0]]],
    totals: (rows) => ['Total', rows.length + ' clientes', '', '', '', '', App.sum(rows, 'open_invoices'), fmt.amount(App.sum(rows, 'debt')), '', '']
  });
  $('btnPrint').addEventListener('click', () => App.exportList(exportCfg(), 'print'));
  $('btnCsv').addEventListener('click', () => App.exportList(exportCfg(), 'csv'));

  // ---------- registo / edição (3 passos, aviso imediato de duplicados) ----------
  const form = $('custForm');
  let step = 1, saveAndNew = false;
  const maxStep = () => editingId ? 2 : 3;
  function goStep(n) {
    step = Math.max(1, Math.min(maxStep(), n));
    form.querySelectorAll('.step').forEach(s => s.classList.toggle('active', Number(s.dataset.step) === step));
    $('steps').querySelectorAll('button').forEach(b => b.classList.toggle('active', Number(b.dataset.s) === step));
    $('btnPrev').style.display = step > 1 ? '' : 'none';
    $('btnNext').style.display = step < maxStep() ? '' : 'none';
    const first = form.querySelector(`.step[data-step="${step}"] input:not([type=hidden])`);
    if (first) setTimeout(() => first.focus(), 30);
  }
  $('steps').addEventListener('click', (e) => { const b = e.target.closest('[data-s]'); if (b) goStep(Number(b.dataset.s)); });
  $('btnPrev').addEventListener('click', () => goStep(step - 1));
  $('btnNext').addEventListener('click', () => {
    if (step === 1 && (form.name.value.trim().length < 3)) { toast('Indique o nome completo do cliente.', 'error'); form.name.focus(); return; }
    goStep(step + 1);
  });
  function openForm(isEdit) {
    $('step3btn').style.display = isEdit ? 'none' : '';
    $('btnSaveNew').style.display = isEdit ? 'none' : '';
    $('accountSection').style.display = isEdit ? 'none' : '';
    $('dupWarn').innerHTML = '';
    modal.open('formModal'); goStep(1);
  }
  $('btnNew').addEventListener('click', () => {
    editingId = null;
    form.reset(); App.fillForm(form, { document_type: 'bi', status: 'active', category: 'residential', initial_reading: 0 });
    $('formTitle').textContent = 'Novo cliente';
    openForm(false);
  });
  async function edit(id) {
    const r = await api.get('/api/customers/' + id);
    if (!r.success) { toast(r.error, 'error'); return; }
    editingId = id;
    form.reset(); App.fillForm(form, r.customer);
    $('formTitle').textContent = 'Editar ' + r.customer.name;
    openForm(true);
  }
  // duplicados: avisa logo ao preencher telefone, documento ou NUIT
  const checkDup = App.debounce(async () => {
    const q = { phone: form.phone.value, document: form.document.value, nuit: form.nuit.value, exceptId: editingId || '' };
    if (!q.phone && !q.document && !q.nuit) { $('dupWarn').innerHTML = ''; return; }
    const r = await api.get('/api/customers/check' + App.query(q));
    const why = { phone: 'o mesmo telefone', document: 'o mesmo documento', nuit: 'o mesmo NUIT' };
    $('dupWarn').innerHTML = (r.items || []).map(d => `<div class="dup-warn">Já existe <a href="#" data-dup="${d.id}">${esc(d.name)} (${esc(d.code)})</a> com ${why[d.reason] || 'dados iguais'}.
      Para outra casa deste cliente, abra a ficha e adicione uma nova conta.</div>`).join('');
  }, 450);
  form.querySelectorAll('[data-check]').forEach(i => i.addEventListener('input', checkDup));
  $('dupWarn').addEventListener('click', (e) => { const a = e.target.closest('[data-dup]'); if (a) { e.preventDefault(); modal.close('formModal'); view(a.dataset.dup); } });
  $('btnSaveNew').addEventListener('click', () => { saveAndNew = true; form.requestSubmit(); });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const again = saveAndNew; saveAndNew = false;
    const d = {};
    form.querySelectorAll('.step[data-step="1"] [name], .step[data-step="2"] [name]').forEach(el => { d[el.name] = el.value === '' ? null : el.value.trim(); });
    if (!d.name || d.name.length < 3) { toast('Indique o nome completo do cliente.', 'error'); goStep(1); return; }
    if (!d.phone) { toast('Indique o telefone do cliente.', 'error'); goStep(2); return; }
    if (!editingId) d.account = readForm($('accFields'));
    const btn = $('btnSave'); App.busy(btn, true, 'A guardar…');
    let r;
    if (editingId) r = await api.put('/api/customers/' + editingId, d);
    else {
      d.client_uuid = App.uuid();
      r = await api.post('/api/customers', d);
      if (r.offline) {
        App.outbox.add('customer', d, d.name + ' · ' + d.phone);
        App.busy(btn, false); modal.close('formModal');
        toast('Sem internet: o cliente ficou guardado e será registado quando a ligação voltar.', 'success');
        return;
      }
    }
    App.busy(btn, false);
    if (!r.success) { toast(r.error, 'error'); return; }
    list.reload();
    if (!editingId && r.temp_password) {
      App.showCredentials('Acesso do cliente ' + r.name, r.username, r.temp_password,
        `Conta ${r.account_number} criada. Entregue estes dados ao cliente para ver faturas e extratos no portal.`);
      if (again) {
        const keep = { neighborhood: d.neighborhood, city: d.city, district: d.district };
        form.reset(); App.fillForm(form, Object.assign({ document_type: 'bi', status: 'active', category: 'residential', initial_reading: 0 }, keep));
        $('dupWarn').innerHTML = ''; goStep(1);
      } else modal.close('formModal');
    } else { modal.close('formModal'); toast(editingId ? 'Cliente atualizado.' : 'Cliente registado.', 'success'); }
  });
  document.addEventListener('outbox-flushed', () => list.reload());

  // ---------- detalhe ----------
  async function view(id) {
    const r = await api.get('/api/customers/' + id);
    if (!r.success) { toast(r.error, 'error'); return; }
    current = r.customer;
    const c = current;
    $('viewTitle').innerHTML = `${esc(c.name)} <span class="muted">${esc(c.code)}</span> ${App.badge(c.status)}`;
    const item = (k, v) => `<div><small>${k}</small><span>${v == null || v === '' ? '—' : esc(v)}</span></div>`;
    $('viewBody').innerHTML = `
      <div class="stats-grid" style="margin-bottom:14px">
        <div class="stat-card top red"><div class="stat-label">Em dívida</div><h3>${fmt.moneyHtml(c.debt)}</h3></div>
        <div class="stat-card top"><div class="stat-label">Total pago</div><h3>${fmt.moneyHtml(c.total_paid)}</h3></div>
        <div class="stat-card top blue"><div class="stat-label">Contas</div><h3>${c.accounts.length}</h3></div>
      </div>
      <div class="dl">
        ${item('Telefone', [c.phone, c.phone2].filter(Boolean).join(' / '))}${item('Email', c.email)}
        ${item('Documento', c.document ? (App.DOCS[c.document_type] || '') + ' ' + c.document : '')}${item('NUIT', c.nuit)}
        ${item('Género', c.gender === 'M' ? 'Masculino' : c.gender === 'F' ? 'Feminino' : '')}${item('Nascimento', c.birth_date ? fmt.date(c.birth_date) : '')}
        ${item('Profissão', c.occupation)}${item('Morada', [c.address, c.neighborhood, c.block && 'Q. ' + c.block, c.house_number && 'Casa ' + c.house_number, c.district, c.city].filter(Boolean).join(', '))}
        ${item('Acesso ao portal', c.login ? c.login + (c.login_status === 'blocked' ? ' (bloqueado)' : '') : 'sem acesso')}${item('Último acesso', c.last_login ? fmt.datetime(c.last_login) : '')}
        ${item('Registado em', fmt.date(c.created_at))}${item('Observações', c.notes)}
      </div>
      <div class="page-actions" style="margin-bottom:16px">
        <a class="btn-primary" href="/cashier?customer=${c.id}">${icon('cash')} Receber pagamento</a>
        <a class="btn-secondary" href="/statements?customer=${c.id}">${icon('list')} Extrato</a>
        <a class="btn-secondary" href="/invoices?customer=${c.id}">${icon('file')} Faturas</a>
        <a class="btn-secondary" href="/payments?customer=${c.id}">${icon('receipt')} Pagamentos</a>
        <button class="btn-secondary" id="vEdit">${icon('edit')} Editar</button>
        <button class="btn-secondary" id="vAccess">${icon('key')} ${c.login ? 'Nova senha do portal' : 'Criar acesso ao portal'}</button>
        <button class="btn-danger" id="vDelete">${icon('trash')} Apagar</button>
      </div>
      <div class="panel-header" style="margin-bottom:10px"><h2>Contas / contratos</h2><button class="btn-primary" id="vAddAcc">+ Adicionar conta</button></div>
      ${c.accounts.map(a => `<div class="acc-card">
        <div class="head"><div><span class="strong">Conta ${esc(a.number)}</span> <span class="pill">${esc(App.CATEGORIES[a.category] || a.category)}</span> ${App.badge(a.status)}</div>
          <div class="acts">
            <button class="act orange" data-acc-edit="${a.id}" title="Editar conta">${icon('edit')}</button>
            <button class="act" data-acc-meter="${a.id}" title="Trocar contador">${icon('sync')}</button>
            <button class="act" data-acc-hist="${a.id}" title="Histórico de contadores">${icon('history')}</button>
            <a class="act" href="/print?type=statement&customer=${c.id}&mode=single&account=${a.id}" target="_blank" title="Extrato desta conta">${icon('print')}</a>
            ${a.status === 'active' ? `<button class="act red" data-acc-status="${a.id}" data-to="suspended" title="Suspender (corte)">${icon('x')}</button>`
              : `<button class="act green" data-acc-status="${a.id}" data-to="active" title="Reativar">${icon('ok')}</button>`}
          </div></div>
        <div class="dl" style="margin:0">
          <div><small>Contador</small><span>${esc(a.meter_number || '—')}</span></div>
          <div><small>Última leitura</small><span>${a.last_value != null ? esc(a.last_value) + ' m³ (' + fmt.period(a.last_period) + ')' : 'Inicial ' + esc(a.initial_reading)}</span></div>
          <div><small>Local</small><span>${esc([a.address, a.neighborhood, a.landmark].filter(Boolean).join(', ') || '—')}</span></div>
          <div><small>Em dívida</small><span style="color:${Number(a.debt) ? 'var(--danger)' : 'inherit'}">${fmt.money(a.debt)} (${a.open_invoices} fat.)</span></div>
        </div></div>`).join('') || '<div class="empty-state">Sem contas.</div>'}`;
    $('vEdit').onclick = () => { modal.close('viewModal'); edit(c.id); };
    $('vAddAcc').onclick = () => openAccount(c, null);
    $('vAccess').onclick = async () => {
      if (!await App.ask('Gerar nova senha do portal?', { text: 'A senha anterior deixa de funcionar.' })) return;
      const r2 = await api.post(`/api/customers/${c.id}/reset-access`);
      if (!r2.success) { toast(r2.error, 'error'); return; }
      App.showCredentials('Acesso de ' + r2.name, r2.username, r2.temp_password, 'Entregue estes dados ao cliente.');
      view(c.id);
    };
    $('vDelete').onclick = async () => {
      if (!await App.ask('Apagar ' + c.name + '?', { text: 'Um cliente que já teve leituras, faturas ou pagamentos nunca é apagado: fica inativo e todo o histórico mantém-se.', danger: true, confirm: 'Apagar' })) return;
      const r2 = await api.del('/api/customers/' + c.id);
      if (!r2.success) { toast(r2.error, 'error'); return; }
      toast(r2.message, 'success'); modal.close('viewModal'); list.reload();
    };
    const body = $('viewBody');
    body.querySelectorAll('[data-acc-edit]').forEach(b => b.onclick = () => openAccount(c, c.accounts.find(a => String(a.id) === b.dataset.accEdit)));
    body.querySelectorAll('[data-acc-status]').forEach(b => b.onclick = async () => {
      const to = b.dataset.to;
      if (!await App.ask(to === 'active' ? 'Reativar a conta?' : 'Suspender a conta?', { text: to === 'active' ? '' : 'Contas suspensas não aparecem para leitura.' })) return;
      const r2 = await api.post(`/api/accounts/${b.dataset.accStatus}/status/${to}`);
      if (!r2.success) { toast(r2.error, 'error'); return; }
      toast(r2.message, 'success'); view(c.id);
    });
    body.querySelectorAll('[data-acc-meter]').forEach(b => b.onclick = async () => {
      const num = await App.ask('Trocar contador', { input: 'Número do novo contador' });
      if (!num) return;
      const ini = await App.ask('Leitura inicial do novo contador', { input: 'Leitura inicial (m³)', value: '0' });
      if (ini == null) return;
      const r2 = await api.post(`/api/accounts/${b.dataset.accMeter}/meter`, { number: num, initial_reading: Number(ini) || 0 });
      if (!r2.success) { toast(r2.error, 'error'); return; }
      toast(r2.message, 'success'); view(c.id);
    });
    body.querySelectorAll('[data-acc-hist]').forEach(b => b.onclick = async () => {
      const r2 = await api.get(`/api/accounts/${b.dataset.accHist}/meters`);
      if (!r2.success) { toast(r2.error, 'error'); return; }
      App.ask('Histórico de contadores', { text: (r2.items || []).map(m => `${m.number}: inicial ${m.initial_reading}, instalado ${fmt.date(m.installed_at)}${m.removed_at ? ', retirado ' + fmt.date(m.removed_at) : ''} (${(App.STATUS[m.status] || [m.status])[0]})`).join(' · ') || 'Sem registos.', confirm: 'OK' });
    });
    modal.open('viewModal');
  }

  // ---------- conta ----------
  function openAccount(c, a) {
    accCustomer = c; editingAcc = a ? a.id : null;
    const f = $('accForm'); f.reset();
    App.fillForm(f, a || { category: 'residential', initial_reading: 0 });
    f.querySelectorAll('.acc-meter').forEach(el => el.style.display = a ? 'none' : '');
    $('accTitle').textContent = a ? 'Editar conta ' + a.number : 'Nova conta para ' + c.name;
    modal.open('accModal');
  }
  $('accForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const d = readForm($('accFields2'));
    const r = editingAcc ? await api.put('/api/accounts/' + editingAcc, d) : await api.post(`/api/customers/${accCustomer.id}/accounts`, d);
    if (!r.success) { toast(r.error, 'error'); return; }
    modal.close('accModal');
    toast(editingAcc ? 'Conta atualizada.' : `Conta ${r.number || ''} criada.`, 'success');
    view(accCustomer.id); list.reload();
  });

  if (App.qs('new')) $('btnNew').click();
  if (App.qs('view')) view(App.qs('view'));
  list.load(1);
})();
