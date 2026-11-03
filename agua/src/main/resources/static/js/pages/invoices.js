/* Faturas: cartões, pesquisa, filtro por mês e datas, estados, ações (ver, WhatsApp, imprimir, desconto, anular) e fatura avulsa. */
(async function () {
  const { api, fmt, esc, icon, toast, modal } = App;
  await App.boot({ title: 'Faturas', roles: ['manager'] });
  const $ = (id) => document.getElementById(id);
  let filter = App.qs('status') || '', chosen = null;
  const customerId = App.qs('customer');
  $('period').innerHTML = '<option value="">Todos os meses</option>' + App.monthOptions(24, App.qs('period') || '');
  if (customerId) $('custFilter').innerHTML = `<div class="alert info"><span>A mostrar só as faturas de um cliente.</span><a class="btn-secondary" href="/invoices">Ver todas</a></div>`;
  document.querySelectorAll('#chips .chip').forEach(c => c.classList.toggle('active', c.dataset.f === filter));

  const params = () => ({ q: $('q').value.trim(), period: $('period').value, status: filter, from: $('from').value, to: $('to').value, customerId });
  const list = App.pagedList({
    url: '/api/invoices', params, tbody: 'rows', pager: 'pager', cols: 10, empty: 'Sem faturas com estes filtros.',
    row: (i) => {
      const canMsg = i.status !== 'cancelled' && i.phone;
      return `<tr>
      <td><a href="#" class="strong" data-view="${i.id}">${esc(i.number)}</a>${i.kind === 'manual' ? '<br><span class="muted">' + esc(i.description || 'Avulsa') + '</span>' : ''}</td>
      <td>${esc(i.customer_name)}<br><span class="muted">${esc(i.customer_code)} · Conta ${esc(i.account_number)}</span></td>
      <td class="hide-sm">${fmt.period(i.period)}</td><td class="hide-sm">${fmt.date(i.due_date)}</td>
      <td class="num hide-sm">${i.kind === 'manual' ? '—' : fmt.num(i.consumption) + ' m³'}</td>
      <td class="num">${fmt.amount(i.total)}</td><td class="num hide-sm">${fmt.amount(i.paid)}</td>
      <td class="num strong" style="color:${Number(i.balance) > 0 && i.status !== 'cancelled' ? 'var(--danger)' : 'var(--primary-dark)'}">${fmt.amount(i.balance)}</td>
      <td>${App.badge(i.status)}</td>
      <td class="actions"><div class="acts">
        <button class="act blue" data-view="${i.id}" title="Ver">${icon('eye')}</button>
        ${Number(i.balance) > 0 && i.status !== 'cancelled' ? `<a class="act green" href="/cashier?customer=${i.customer_id}" title="Receber">${icon('cash')}</a>` : ''}
        ${canMsg ? App.msgButtons(`data-inv="${i.id}"`, 'Enviar a fatura por WhatsApp', 'Enviar a fatura por SMS') : ''}
        <a class="act" href="/print?type=invoice&id=${i.id}" target="_blank" title="Imprimir">${icon('print')}</a>
        ${i.status !== 'cancelled' && !Number(i.paid) ? `<button class="act red" data-cancel="${i.id}" title="Anular">${icon('trash')}</button>` : ''}
      </div></td></tr>`;
    },
    onData: (r) => {
      const s = r.stats || {};
      $('stats').innerHTML = `
        <div class="stat-card top"><div class="stat-label">Total de faturas</div><h3>${fmt.num(s.total)}</h3><div class="stat-sub">Faturado ${fmt.money(s.billed)}</div></div>
        <div class="stat-card top orange"><div class="stat-label">Pendentes</div><h3>${fmt.num(s.pending)}</h3><div class="stat-sub">${fmt.num(s.partial)} parciais</div></div>
        <div class="stat-card top red"><div class="stat-label">Total em dívida</div><h3>${fmt.moneyHtml(s.debt)}</h3><div class="stat-sub">${fmt.num(s.overdue)} vencidas</div></div>
        <div class="stat-card top blue"><div class="stat-label">Pagas</div><h3>${fmt.num(s.paid)}</h3><div class="stat-sub">Recebido ${fmt.money(s.collected)}</div></div>`;
    }
  });
  $('rows').addEventListener('click', async (e) => {
    const v = e.target.closest('[data-view]'), c = e.target.closest('[data-cancel]'), ms = e.target.closest('[data-msg]');
    if (ms) { App.busy(ms, true, '…'); await App.sendMessage('invoice', ms.dataset.inv, ms.dataset.msg); App.busy(ms, false); return; }
    if (v) { e.preventDefault(); view(v.dataset.view); }
    if (c) cancel(c.dataset.cancel);
  });
  ['period', 'from', 'to'].forEach(id => $(id).addEventListener('change', () => list.load(1)));
  $('q').addEventListener('input', App.debounce(() => list.load(1), 350));
  $('btnClear').addEventListener('click', () => { ['q', 'period', 'from', 'to'].forEach(id => $(id).value = ''); setChip(''); });
  $('chips').addEventListener('click', (e) => { const c = e.target.closest('.chip'); if (c) setChip(c.dataset.f); });
  function setChip(f) { filter = f; document.querySelectorAll('#chips .chip').forEach(c => c.classList.toggle('active', c.dataset.f === f)); list.load(1); }

  const exportCfg = () => ({
    url: '/api/invoices', params: params(), title: 'Faturas', landscape: true,
    filters: [$('period').value && fmt.periodLong($('period').value), $('from').value && 'desde ' + fmt.date($('from').value), $('to').value && 'até ' + fmt.date($('to').value),
      filter && document.querySelector('#chips .chip.active').textContent, $('q').value].filter(Boolean).join(' · ') || 'Todas',
    columns: [['Nº', 'number'], ['Cliente', 'customer_name'], ['Código', 'customer_code'], ['Conta', 'account_number'], ['Mês', r => fmt.period(r.period)],
      ['Emissão', r => fmt.date(r.issue_date)], ['Vencimento', r => fmt.date(r.due_date)], ['Leituras', r => r.kind === 'manual' ? r.description : `${r.previous_value} → ${r.current_value}`],
      ['Consumo', 'consumption', 'n'], ['Total', r => fmt.amount(r.total), 'n'], ['Pago', r => fmt.amount(r.paid), 'n'], ['Saldo', r => fmt.amount(r.balance), 'n'],
      ['Estado', r => (App.STATUS[r.status] || [r.status])[0]]],
    totals: (rows) => ['Total', rows.length + ' faturas', '', '', '', '', '', '', App.sum(rows, 'consumption'), fmt.amount(App.sum(rows, 'total')), fmt.amount(App.sum(rows, 'paid')), fmt.amount(App.sum(rows, 'balance')), '']
  });
  $('btnPrint').addEventListener('click', () => App.exportList(exportCfg(), 'print'));
  $('btnCsv').addEventListener('click', () => App.exportList(exportCfg(), 'csv'));

  $('btnCharges').addEventListener('click', async () => {
    if (!await App.ask('Atualizar multas e juros?', { text: 'Aplica as regras de "Empresa e recibo" às faturas vencidas.' })) return;
    const r = await api.post('/api/invoices/late-charges');
    r.success ? (toast(r.message, 'success'), list.reload()) : toast(r.error, 'error');
  });

  async function cancel(id) {
    const why = await App.ask('Anular fatura?', { input: 'Motivo da anulação', danger: true, confirm: 'Anular' });
    if (!why) return;
    const r = await api.post(`/api/invoices/${id}/cancel`, { reason: why });
    r.success ? (toast(r.message, 'success'), modal.close('viewModal'), list.reload()) : toast(r.error, 'error');
  }

  async function view(id) {
    const r = await api.get('/api/invoices/' + id);
    if (!r.success) { toast(r.error, 'error'); return; }
    const i = r.invoice;
    $('viewTitle').innerHTML = `Fatura ${esc(i.number)} ${App.badge(i.status)}`;
    const line = (k, v, neg) => Number(v) ? `<tr><td>${k}</td><td class="num">${neg ? '− ' : ''}${fmt.money(v)}</td></tr>` : '';
    $('viewBody').innerHTML = `
      <div class="dl">
        <div><small>Cliente</small><span>${esc(i.customer_name)} (${esc(i.customer_code)})</span></div>
        <div><small>Conta / contador</small><span>${esc(i.account_number)} · ${esc(i.meter_number || '—')}</span></div>
        <div><small>Mês</small><span>${fmt.periodLong(i.period)}</span></div>
        <div><small>Emissão / vencimento</small><span>${fmt.date(i.issue_date)} → ${fmt.date(i.due_date)}</span></div>
        ${i.kind === 'consumption' ? `<div><small>Leituras</small><span>${fmt.num(i.previous_value)} → ${fmt.num(i.current_value)} (${fmt.num(i.consumption)} m³)</span></div>` : `<div><small>Descrição</small><span>${esc(i.description)}</span></div>`}
        <div><small>Criada por</small><span>${esc(i.created_by || '—')}</span></div>
      </div>
      <table class="table"><tbody>
        ${line('Água', i.water_amount)}${line('Saneamento', i.sewer_amount)}${line('Taxa fixa', i.fixed_fee)}${line(i.kind === 'manual' ? esc(i.description) : 'Outros', i.other_amount)}
        ${line('Multa', i.fine_amount)}${line('Juros', i.interest_amount)}${line('Desconto', i.discount, true)}
        <tr><td class="strong">Total</td><td class="num strong">${fmt.money(i.total)}</td></tr>
        <tr><td>Pago</td><td class="num">${fmt.money(i.paid)}</td></tr>
        <tr><td class="strong">Saldo</td><td class="num strong" style="color:var(--danger)">${fmt.money(i.balance)}</td></tr></tbody></table>
      ${i.cancel_reason ? `<div class="alert warning">Anulada: ${esc(i.cancel_reason)}</div>` : ''}
      <h2 style="font-size:15px;margin:16px 0 8px">Pagamentos desta fatura</h2>
      <div class="table-wrap"><table class="table"><thead><tr><th>Recibo</th><th>Data</th><th>Método</th><th class="num">Valor</th><th class="num">Ficou</th><th>Estado</th></tr></thead><tbody>
        ${(i.payments || []).map(p => `<tr><td><a href="/print?type=receipt&id=${p.payment_id}" target="_blank">${esc(p.receipt_number)}</a></td><td>${fmt.datetime(p.paid_at)}</td>
          <td>${esc(App.METHODS[p.method] || p.method)}</td><td class="num">${fmt.money(p.amount)}</td><td class="num">${fmt.money(p.balance_after)}</td><td>${App.badge(p.status)}</td></tr>`).join('') ||
          '<tr><td colspan="6" class="empty-state">Ainda sem pagamentos.</td></tr>'}</tbody></table></div>
      <div class="form-actions">
        ${i.status !== 'cancelled' && !Number(i.paid) ? '<button class="btn-danger" id="vCancel">Anular</button>' : ''}
        ${i.status !== 'cancelled' && Number(i.balance) > 0 ? '<button class="btn-secondary" id="vDiscount">Desconto</button>' : ''}
        <a class="btn-secondary" href="/print?type=invoice&id=${i.id}" target="_blank">${icon('print')} Imprimir</a>
        ${Number(i.balance) > 0 && i.status !== 'cancelled' ? `<a class="btn-primary" href="/cashier?customer=${i.customer_id}">${icon('cash')} Receber</a>` : ''}
      </div>`;
    if ($('vCancel')) $('vCancel').onclick = () => cancel(i.id);
    if ($('vDiscount')) $('vDiscount').onclick = async () => {
      const v = await App.ask('Desconto', { input: 'Valor do desconto' });
      if (!v) return;
      const why = await App.ask('Motivo do desconto', { input: 'Motivo' });
      if (!why) return;
      const r2 = await api.post(`/api/invoices/${i.id}/discount`, { amount: Number(String(v).replace(',', '.')), reason: why });
      r2.success ? (toast(r2.message, 'success'), view(i.id), list.reload()) : toast(r2.error, 'error');
    };
    modal.open('viewModal');
  }

  // ---------- fatura avulsa ----------
  $('btnNew').addEventListener('click', () => {
    chosen = null; $('accQ').value = ''; $('accResults').innerHTML = ''; $('newForm').style.display = 'none';
    modal.open('newModal'); setTimeout(() => $('accQ').focus(), 50);
  });
  $('accQ').addEventListener('input', App.debounce(async () => {
    const q = $('accQ').value.trim();
    if (q.length < 2) { $('accResults').innerHTML = ''; return; }
    const r = await api.get('/api/accounts/search?q=' + encodeURIComponent(q));
    $('accResults').innerHTML = (r.items || []).map(a => `<div class="cust-item" data-a='${esc(JSON.stringify(a))}'>
      <div><div class="name">${esc(a.customer_name)}</div><div class="muted">Conta ${esc(a.number)} · ${esc(a.customer_code)} · ${esc(a.phone || '')}</div></div>
      <div class="muted">Dívida ${fmt.money(a.debt)}</div></div>`).join('') || '<div class="muted">Nada encontrado.</div>';
  }, 300));
  $('accResults').addEventListener('click', (e) => {
    const it = e.target.closest('[data-a]'); if (!it) return;
    chosen = JSON.parse(it.dataset.a);
    $('accInfo').innerHTML = `<span><b>${esc(chosen.customer_name)}</b> · Conta ${esc(chosen.number)}</span>`;
    $('accResults').innerHTML = '';
    const f = $('newForm'); f.reset(); f.period.value = App.thisPeriod(); f.style.display = '';
    setTimeout(() => f.description.focus(), 50);
  });
  $('newForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const f = e.target;
    const r = await api.post('/api/invoices', { account_id: chosen.id, description: f.description.value, amount: Number(f.amount.value),
      period: f.period.value || null, due_date: f.due_date.value || null, notes: f.notes.value || null });
    if (!r.success) { toast(r.error, 'error'); return; }
    modal.close('newModal'); toast(`Fatura ${r.number} criada: ${fmt.money(r.total)}`, 'success'); list.reload();
  });
  list.load(1);
})();
