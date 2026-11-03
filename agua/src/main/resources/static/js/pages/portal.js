/* Portal do cliente: contas, dívida, faturas, recibos, consumo e extrato (todas as contas ou uma a uma). */
(async function () {
  const { api, fmt, esc, icon } = App;
  await App.boot({ title: 'Minha conta', roles: ['customer'] });
  const $ = (id) => document.getElementById(id);
  const r = await api.get('/api/portal');
  if (!r.success) { $('stats').innerHTML = `<div class="alert warning">${esc(r.error)}</div>`; return; }
  const c = r.customer || {};
  App.setTitle('Olá, ' + (c.name || '').split(' ')[0]);
  $('stats').innerHTML = `
    <div class="stat-card top red"><div class="stat-label">Total por pagar</div><h3>${fmt.moneyHtml(c.debt)}</h3><div class="stat-sub">${esc(c.code)}</div></div>
    <div class="stat-card top"><div class="stat-label">Total pago</div><h3>${fmt.moneyHtml(c.total_paid)}</h3></div>
    <div class="stat-card top blue"><div class="stat-label">Contas</div><h3>${(r.accounts || []).length}</h3></div>`;
  $('accounts').innerHTML = (r.accounts || []).map(a => `<div class="acc-card"><div class="head">
      <div><span class="strong">Conta ${esc(a.number)}</span> <span class="pill">${esc(App.CATEGORIES[a.category] || a.category)}</span> ${App.badge(a.status)}</div>
      <a class="btn-secondary" href="/print?type=statement&mode=single&account=${a.id}" target="_blank">${icon('print')} Extrato desta conta</a></div>
      <div class="dl" style="margin:0"><div><small>Contador</small><span>${esc(a.meter_number || '—')}</span></div><div><small>Local</small><span>${esc(a.address || '—')}</span></div>
      <div><small>Por pagar</small><span style="color:${Number(a.debt) ? 'var(--danger)' : 'inherit'}">${fmt.money(a.debt)}</span></div></div></div>`).join('') || '<div class="empty-state">Sem contas.</div>';
  $('btnStAll').onclick = () => window.open('/print?type=statement&mode=all', '_blank');
  $('btnStEach').onclick = () => window.open('/print?type=statement&mode=each', '_blank');
  let filter = '';
  function renderInvoices() {
    const rows = (r.invoices || []).filter(i => !filter || (filter === 'debt' ? Number(i.balance) > 0 && i.status !== 'cancelled' : i.status === 'paid'));
    $('invoices').innerHTML = rows.map(i => `<tr><td class="strong">${esc(i.number)}</td><td class="hide-sm">${esc(i.account_number)}</td><td>${fmt.period(i.period)}</td>
      <td class="num hide-sm">${i.kind === 'manual' ? esc(i.description || '') : `${fmt.num(i.previous_value)} → ${fmt.num(i.current_value)} (${fmt.num(i.consumption)} m³)`}</td>
      <td class="num">${fmt.amount(i.total)}</td><td class="num strong">${fmt.amount(i.balance)}</td><td>${App.badge(i.status)}</td>
      <td class="actions"><a class="act" href="/print?type=invoice&id=${i.id}" target="_blank" title="Imprimir">${icon('print')}</a></td></tr>`).join('')
      || '<tr><td colspan="8" class="empty-state">Sem faturas.</td></tr>';
  }
  $('chips').addEventListener('click', (e) => { const ch = e.target.closest('.chip'); if (!ch) return; filter = ch.dataset.f;
    document.querySelectorAll('#chips .chip').forEach(x => x.classList.toggle('active', x === ch)); renderInvoices(); });
  renderInvoices();
  $('payments').innerHTML = (r.payments || []).map(p => `<tr><td class="strong">${esc(p.receipt_number)}<br>${App.badge(p.status)}</td><td>${fmt.datetime(p.paid_at)}</td>
    <td class="num">${fmt.amount(p.amount)}</td><td class="actions">${p.status !== 'voided' ? `<div class="acts">
      <a class="act blue" href="/print?type=receipt&id=${p.id}&auto=0" target="_blank" title="Ver recibo">${icon('eye')}</a>
      <a class="act" href="/print?type=receipt&id=${p.id}" target="_blank" title="Imprimir">${icon('print')}</a>
      <button class="act green" data-pdf="${p.id}" title="Baixar PDF">${icon('pdf')}</button></div>` : ''}</td></tr>`).join('')
    || '<tr><td colspan="4" class="empty-state">Sem pagamentos.</td></tr>';
  $('payments').addEventListener('click', async (e) => {
    const b = e.target.closest('[data-pdf]'); if (!b) return;
    App.busy(b, true, '…');
    const x = await api.get('/api/portal/receipts/' + b.dataset.pdf);
    App.busy(b, false);
    if (!x.success) { App.toast(x.error, 'error'); return; }
    PrintDocs.receiptPdf(x.receipt);
  });
  const cons = (r.consumption || []).slice().reverse();
  const max = Math.max(1, ...cons.map(x => Number(x.consumption)));
  $('chart').innerHTML = cons.map(x => `<div class="col" title="${fmt.period(x.period)}: ${x.consumption} m³ · ${fmt.money(x.total)}"><div class="pair">
    <div class="bar collected" style="height:${Number(x.consumption) / max * 100}%;width:60%"></div></div><small>${fmt.periodShort(x.period).split('/')[0]}</small></div>`).join('') || '<div class="muted">Sem consumos.</div>';
})();
