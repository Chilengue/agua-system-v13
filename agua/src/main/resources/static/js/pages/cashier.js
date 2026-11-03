/* Caixa: escolher cliente → faturas em dívida (todas as contas) → pagar total ou parcial → recibo.
   Sem internet: o pagamento fica guardado neste aparelho e é enviado quando a ligação voltar. */
(async function () {
  const { api, fmt, esc, icon, toast } = App;
  await App.boot({ title: 'Caixa', roles: ['manager'] });
  const $ = (id) => document.getElementById(id);
  const form = $('payForm');
  form.method.innerHTML = Object.entries(App.METHODS).map(([k, v]) => `<option value="${k}">${esc(v)}</option>`).join('');
  form.paid_at.value = App.today();
  form.paid_at.max = App.today();
  let cust = null, invoices = [], account = 0;
  const CACHE = 'agua.cashier';
  const cache = {
    get() { try { return JSON.parse(localStorage.getItem(CACHE) || '{"list":[],"open":{}}'); } catch (_) { return { list: [], open: {} }; } },
    set(v) { try { localStorage.setItem(CACHE, JSON.stringify(v)); } catch (_) { /* cheio */ } }
  };

  // ---------- pesquisa ----------
  async function search() {
    const q = $('q').value.trim();
    if (q.length < 2) { $('results').innerHTML = '<div class="muted">Escreva pelo menos 2 letras ou números.</div>'; return; }
    const r = await api.get('/api/customers' + App.query({ q, size: 12 }));
    let items = r.items;
    if (r.offline) {
      const k = q.toLowerCase();
      items = cache.get().list.filter(c => [c.name, c.code, c.phone].join(' ').toLowerCase().includes(k)).slice(0, 12);
      if (!items.length) { $('results').innerHTML = '<div class="alert warning">Sem internet e sem dados guardados para esta pesquisa.</div>'; return; }
    } else if (!r.success) { $('results').innerHTML = `<div class="alert warning">${esc(r.error)}</div>`; return; }
    $('results').innerHTML = (items || []).map(c => `<div class="cust-item" data-id="${c.id}">
      <div><div class="name">${esc(c.name)}</div><div class="muted">${esc(c.code)} · ${esc(c.phone || '')}${c.account_numbers ? ' · ' + esc(c.account_numbers) : ''}</div></div>
      <div class="strong" style="color:${Number(c.debt) ? 'var(--danger)' : 'var(--primary-dark)'};white-space:nowrap">${fmt.money(c.debt)}</div></div>`).join('') || '<div class="muted">Nenhum cliente encontrado.</div>';
  }
  $('q').addEventListener('input', App.debounce(search, 300));
  $('results').addEventListener('click', (e) => { const it = e.target.closest('[data-id]'); if (it) choose(it.dataset.id); });

  // ---------- cliente escolhido ----------
  async function choose(id) {
    const r = await api.get(`/api/customers/${id}/open-invoices`);
    let data = r;
    if (r.offline) {
      data = cache.get().open[id];
      if (!data) { toast('Sem internet e sem as faturas deste cliente guardadas.', 'error'); return; }
      toast('Sem internet: a usar os dados guardados neste aparelho.');
    } else if (!r.success) { toast(r.error, 'error'); return; }
    else { const c = cache.get(); c.open[id] = r; cache.set(c); }
    cust = data; invoices = data.invoices || []; account = 0;
    $('noCustomer').style.display = 'none'; $('custBox').style.display = '';
    $('custName').textContent = cust.customer_name;
    $('custInfo').textContent = `${cust.customer_code} · ${cust.phone || ''}`;
    $('lnkStatement').href = '/statements?customer=' + cust.customer_id;
    const accs = [...new Map(invoices.map(i => [i.account_id, i.account_number])).entries()];
    $('accChips').innerHTML = accs.length > 1 ? `<button class="chip active" data-a="0">Todas as contas</button>` +
      accs.map(([aid, num]) => `<button class="chip" data-a="${aid}">Conta ${esc(num)}</button>`).join('') : '';
    render();
    history.replaceState(null, '', '/cashier?customer=' + cust.customer_id);
  }
  $('accChips').addEventListener('click', (e) => {
    const c = e.target.closest('.chip'); if (!c) return;
    account = Number(c.dataset.a);
    document.querySelectorAll('#accChips .chip').forEach(x => x.classList.toggle('active', x === c));
    render();
  });
  const visible = () => invoices.filter(i => !account || i.account_id === account);
  function render() {
    const rows = visible();
    $('debtTotal').textContent = fmt.money(cust.total_debt);
    $('debtTotal').classList.toggle('ok', !Number(cust.total_debt));
    $('invRows').innerHTML = rows.map(i => `<tr>
      <td><input type="checkbox" class="inv" value="${i.id}" checked></td>
      <td><span class="strong">${esc(i.number)}</span>${i.kind === 'manual' ? '<br><span class="muted">' + esc(i.description || '') + '</span>' : ''}${i.overdue ? ' <span class="badge red">vencida</span>' : ''}</td>
      <td class="hide-sm">${esc(i.account_number)}</td><td>${fmt.period(i.period)}</td>
      <td class="num hide-sm">${i.kind === 'manual' ? '—' : `${fmt.num(i.previous_value)} → ${fmt.num(i.current_value)}`}</td>
      <td class="num hide-sm">${fmt.amount(i.total)}</td><td class="num strong">${fmt.amount(i.balance)}</td></tr>`).join('')
      || '<tr><td colspan="7" class="empty-state">Sem faturas em dívida. O cliente está em dia. ✔</td></tr>';
    $('checkAll').checked = true;
    updateAmount();
  }
  const selected = () => [...document.querySelectorAll('.inv:checked')].map(c => Number(c.value));
  const selectedTotal = () => visible().filter(i => selected().includes(i.id)).reduce((a, i) => a + Number(i.balance), 0);
  function updateAmount() {
    const t = selectedTotal();
    form.amount.value = t ? t.toFixed(2) : '';
    form.amount.max = t ? t.toFixed(2) : '';
    hint();
  }
  function hint() {
    const t = selectedTotal(), v = Number(form.amount.value || 0);
    $('payHint').innerHTML = !t ? '' : v < t
      ? `<div class="alert info">Pagamento parcial: ficam a faltar <b>${fmt.money(t - v)}</b> nas faturas escolhidas.</div>`
      : v > t ? `<div class="alert warning">O valor é maior que a dívida escolhida (${fmt.money(t)}).</div>` : '';
  }
  $('invRows').addEventListener('change', updateAmount);
  $('checkAll').addEventListener('change', (e) => { document.querySelectorAll('.inv').forEach(c => c.checked = e.target.checked); updateAmount(); });
  form.amount.addEventListener('input', hint);
  $('btnFull').addEventListener('click', updateAmount);

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const ids = selected();
    const amount = Number(form.amount.value);
    if (!ids.length) { toast('Escolha pelo menos uma fatura.', 'error'); return; }
    if (!(amount > 0)) { toast('Indique o valor.', 'error'); return; }
    if (amount > selectedTotal() + 0.001) { toast('O valor é maior que a dívida das faturas escolhidas.', 'error'); return; }
    if (form.method.value !== 'cash' && !form.reference.value.trim()) { toast('Indique a referência da transação.', 'error'); return; }
    const body = { customer_id: cust.customer_id, account_id: account || null, invoice_ids: ids, amount, method: form.method.value,
      reference: form.reference.value.trim() || null, paid_at: form.paid_at.value || null, notes: form.notes.value.trim() || null, client_uuid: App.uuid() };
    const btn = $('btnPay'); App.busy(btn, true, 'A registar…');
    const r = await api.post('/api/payments', body);
    App.busy(btn, false);
    if (r.offline) {
      App.outbox.add('payment', body, `${cust.customer_name}: ${fmt.money(amount)} (${App.METHODS[body.method]})`);
      provisional(body);
      toast('Sem internet: pagamento guardado. O recibo oficial sai quando a ligação voltar.', 'success');
      form.notes.value = ''; form.reference.value = '';
      return;
    }
    if (!r.success) { toast(r.error, 'error'); return; }
    const p = r.payment;
    toast(`Recibo ${p.receipt_number}: ${fmt.money(p.amount)}` + (p.needs_validation ? ' (aguarda validação)' : ''), 'success');
    window.open('/print?type=receipt&id=' + p.id, '_blank');
    form.reference.value = ''; form.notes.value = '';
    choose(cust.customer_id); loadToday();
  });

  function provisional(b) {
    App.printHtml('Comprovativo provisório', `<p><b>Cliente:</b> ${esc(cust.customer_name)} (${esc(cust.customer_code)})</p>
      <p><b>Valor recebido:</b> ${fmt.money(b.amount)} · ${esc(App.METHODS[b.method])}${b.reference ? ' · ' + esc(b.reference) : ''}</p>
      <p><b>Data:</b> ${fmt.date(b.paid_at || App.today())} · <b>Ref. interna:</b> ${esc(b.client_uuid.slice(0, 8).toUpperCase())}</p>
      <p>Registado sem internet. O recibo oficial numerado será emitido quando o sistema voltar a ter ligação.</p>`);
  }

  // ---------- guardar para offline ----------
  $('btnCache').addEventListener('click', async () => {
    const r = await api.get('/api/debtors?size=5000');
    if (!r.success) { toast(r.error, 'error'); return; }
    const c = cache.get();
    c.list = (r.items || []).map(d => ({ id: d.id, name: d.name, code: d.code, phone: d.phone, debt: d.debt }));
    cache.set(c);
    toast(`${c.list.length} devedores guardados. As faturas de cada cliente ficam guardadas quando o abre.`, 'success');
  });

  // ---------- recebido hoje ----------
  async function loadToday() {
    const r = await api.get('/api/payments' + App.query({ from: App.today(), to: App.today(), size: 100 }));
    if (!r.success) { $('today').innerHTML = `<tr><td colspan="7" class="empty-state">${esc(r.error)}</td></tr>`; return; }
    const items = r.items || [];
    const total = items.filter(p => p.status === 'confirmed').reduce((a, p) => a + Number(p.amount), 0);
    $('today').innerHTML = items.map(p => `<tr><td class="strong">${esc(p.receipt_number)}</td><td>${esc(p.customer_name)}</td><td class="hide-sm">${fmt.datetime(p.paid_at).slice(11)}</td>
      <td>${esc(App.METHODS[p.method] || p.method)}</td><td class="num">${fmt.amount(p.amount)}</td><td>${App.badge(p.status)}</td>
      <td class="actions"><div class="acts"><a class="act" href="/print?type=receipt&id=${p.id}" target="_blank" title="Recibo">${icon('print')}</a>
        ${p.status === 'confirmed' && p.phone ? App.msgButtons(`data-pay="${p.id}"`, 'Enviar o recibo por WhatsApp', 'Enviar o recibo por SMS') : ''}</div></td></tr>`).join('') +
      (items.length ? `<tr><td colspan="4" class="strong">Total confirmado</td><td class="num strong">${fmt.amount(total)}</td><td colspan="2"></td></tr>` : '<tr><td colspan="7" class="empty-state">Ainda sem pagamentos hoje.</td></tr>');
  }
  $('today').addEventListener('click', async (e) => {
    const ms = e.target.closest('[data-msg]'); if (!ms) return;
    App.busy(ms, true, '…'); await App.sendMessage('payment', ms.dataset.pay, ms.dataset.msg); App.busy(ms, false);
  });
  document.addEventListener('outbox-flushed', () => { loadToday(); if (cust) choose(cust.customer_id); });
  loadToday();
  if (App.qs('customer')) choose(App.qs('customer'));
  else $('q').focus();
})();
