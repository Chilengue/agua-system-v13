/* Extratos: cliente → todas as contas juntas, uma por página, ou uma só conta → pré-visualizar / imprimir. */
(async function () {
  const { api, fmt, esc, toast } = App;
  await App.boot({ title: 'Extratos', roles: ['manager'] });
  const $ = (id) => document.getElementById(id);
  let cust = null;
  const d = new Date(); d.setMonth(d.getMonth() - 12); d.setDate(1);
  $('from').value = d.toISOString().slice(0, 10); $('to').value = App.today();

  $('q').addEventListener('input', App.debounce(async () => {
    const q = $('q').value.trim();
    if (q.length < 2) { $('results').innerHTML = ''; return; }
    const r = await api.get('/api/customers' + App.query({ q, size: 10 }));
    $('results').innerHTML = (r.items || []).map(c => `<div class="cust-item" data-id="${c.id}"><div><div class="name">${esc(c.name)}</div>
      <div class="muted">${esc(c.code)} · ${esc(c.phone || '')} · ${c.accounts} conta(s)</div></div><div class="muted">${fmt.money(c.debt)}</div></div>`).join('') || '<div class="muted">Nada encontrado.</div>';
  }, 300));
  $('results').addEventListener('click', (e) => { const it = e.target.closest('[data-id]'); if (it) choose(it.dataset.id); });

  async function choose(id) {
    const r = await api.get('/api/customers/' + id);
    if (!r.success) { toast(r.error, 'error'); return; }
    cust = r.customer;
    $('results').innerHTML = ''; $('q').value = '';
    $('chosen').innerHTML = `<b>${esc(cust.name)}</b> · ${esc(cust.code)}<br>${cust.accounts.length} conta(s) · dívida ${fmt.money(cust.debt)}`;
    $('account').innerHTML = cust.accounts.map(a => `<option value="${a.id}">Conta ${esc(a.number)} (${esc(App.CATEGORIES[a.category] || '')})</option>`).join('');
    $('mode').value = cust.accounts.length > 1 ? 'all' : 'single';
    $('accField').style.display = $('mode').value === 'single' ? '' : 'none';
    $('opts').style.display = '';
    preview();
  }
  $('mode').addEventListener('change', () => { $('accField').style.display = $('mode').value === 'single' ? '' : 'none'; preview(); });
  ['account', 'from', 'to'].forEach(id => $(id).addEventListener('change', preview));
  const params = () => ({ mode: $('mode').value, accountId: $('mode').value === 'single' ? $('account').value : '', from: $('from').value, to: $('to').value });
  async function preview() {
    if (!cust) return;
    const r = await api.get(`/api/customers/${cust.id}/statement` + App.query(params()));
    if (!r.success) { toast(r.error, 'error'); return; }
    $('previewPanel').style.display = '';
    $('preview').innerHTML = PrintDocs.statement(r.statement);
  }
  $('btnView').addEventListener('click', preview);
  $('btnPrint').addEventListener('click', () => {
    if (!cust) return;
    const p = params();
    window.open('/print' + App.query({ type: 'statement', customer: cust.id, mode: p.mode, account: p.accountId, from: p.from, to: p.to }), '_blank');
  });
  if (App.qs('customer')) choose(App.qs('customer'));
})();
