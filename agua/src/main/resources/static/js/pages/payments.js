/* Pagamentos: lista com filtros, recibo, validar, anular (apagar). */
(async function () {
  const { api, fmt, esc, icon, toast } = App;
  await App.boot({ title: 'Pagamentos', roles: ['manager'] });
  const $ = (id) => document.getElementById(id);
  let filter = App.qs('status') || '';
  const customerId = App.qs('customer');
  $('method').innerHTML += Object.entries(App.METHODS).map(([k, v]) => `<option value="${k}">${esc(v)}</option>`).join('');
  if (customerId) $('custFilter').innerHTML = `<div class="alert info"><span>A mostrar só os pagamentos de um cliente.</span><a class="btn-secondary" href="/payments">Ver todos</a></div>`;
  document.querySelectorAll('#chips .chip').forEach(c => c.classList.toggle('active', c.dataset.f === filter));

  const params = () => ({ q: $('q').value.trim(), status: filter, method: $('method').value, from: $('from').value, to: $('to').value, customerId });
  const list = App.pagedList({
    url: '/api/payments', params, tbody: 'rows', pager: 'pager', cols: 8, empty: 'Sem pagamentos com estes filtros.',
    row: (p) => `<tr>
      <td class="strong">${esc(p.receipt_number)}${p.reference ? `<br><span class="muted">${esc(p.reference)}</span>` : ''}</td>
      <td>${esc(p.customer_name)}<br><span class="muted">${esc(p.customer_code)}</span></td>
      <td class="hide-sm">${fmt.datetime(p.paid_at)}<br><span class="muted">${esc(p.cashier || '')}</span></td>
      <td class="hide-sm"><span class="muted">${esc(p.invoices || '')}</span></td>
      <td>${esc(App.METHODS[p.method] || p.method)}</td>
      <td class="num strong">${fmt.amount(p.amount)}</td>
      <td>${App.badge(p.status)}${p.void_reason ? `<br><span class="muted" title="${esc(p.void_reason)}">${esc(p.void_reason.slice(0, 30))}</span>` : ''}</td>
      <td class="actions"><div class="acts">
        <a class="act blue" href="/print?type=receipt&id=${p.id}" target="_blank" title="Recibo">${icon('print')}</a>
        ${p.status === 'confirmed' && p.phone ? App.msgButtons(`data-pay="${p.id}"`, 'Enviar o recibo por WhatsApp', 'Enviar o recibo por SMS') : ''}
        ${p.status === 'pending' ? `<button class="act green" data-validate="${p.id}" title="Validar">${icon('ok')}</button>` : ''}
        ${p.status !== 'voided' ? `<button class="act red" data-void="${p.id}" data-n="${esc(p.receipt_number)}" title="Apagar (anular)">${icon('trash')}</button>` : ''}
      </div></td></tr>`,
    onData: (r) => {
      const s = r.stats || {};
      $('stats').innerHTML = `
        <div class="stat-card top"><div class="stat-label">Recebido (período filtrado)</div><h3>${fmt.moneyHtml(s.confirmed)}</h3><div class="stat-sub">${fmt.num(s.confirmed_count)} recibos · ${fmt.num(s.customers)} clientes</div></div>
        <div class="stat-card top orange"><div class="stat-label">Por validar</div><h3>${fmt.moneyHtml(s.pending)}</h3><div class="stat-sub">${fmt.num(s.pending_count)} pagamentos</div></div>
        <div class="stat-card top red"><div class="stat-label">Anulados</div><h3>${fmt.num(s.voided_count)}</h3><div class="stat-sub">com motivo registado</div></div>`;
    }
  });
  $('rows').addEventListener('click', async (e) => {
    const v = e.target.closest('[data-validate]'), d = e.target.closest('[data-void]'), ms = e.target.closest('[data-msg]');
    if (ms) { App.busy(ms, true, '…'); await App.sendMessage('payment', ms.dataset.pay, ms.dataset.msg); App.busy(ms, false); return; }
    if (v) {
      if (!await App.ask('Validar este pagamento?', { text: 'Confirme que o dinheiro entrou (M-Pesa, banco…). O valor é aplicado às faturas.' })) return;
      const r = await api.post(`/api/payments/${v.dataset.validate}/validate`);
      r.success ? (toast(r.message, 'success'), list.reload()) : toast(r.error, 'error');
    }
    if (d) {
      const why = await App.ask('Apagar o pagamento ' + d.dataset.n + '?', { input: 'Motivo', danger: true, confirm: 'Apagar pagamento',
        text: 'O pagamento fica anulado no histórico e o valor volta a ficar em dívida nas faturas.' });
      if (!why) return;
      const r = await api.post(`/api/payments/${d.dataset.void}/void`, { reason: why });
      r.success ? (toast(r.message, 'success'), list.reload()) : toast(r.error, 'error');
    }
  });
  ['method', 'from', 'to'].forEach(id => $(id).addEventListener('change', () => list.load(1)));
  $('q').addEventListener('input', App.debounce(() => list.load(1), 350));
  $('btnClear').addEventListener('click', () => { ['q', 'method', 'from', 'to'].forEach(id => $(id).value = ''); setChip(''); });
  $('chips').addEventListener('click', (e) => { const c = e.target.closest('.chip'); if (c) setChip(c.dataset.f); });
  function setChip(f) { filter = f; document.querySelectorAll('#chips .chip').forEach(c => c.classList.toggle('active', c.dataset.f === f)); list.load(1); }
  const exportCfg = () => ({
    url: '/api/payments', params: params(), title: 'Pagamentos recebidos', landscape: true,
    filters: [$('from').value && 'desde ' + fmt.date($('from').value), $('to').value && 'até ' + fmt.date($('to').value), $('method').value && App.METHODS[$('method').value],
      filter && document.querySelector('#chips .chip.active').textContent, $('q').value].filter(Boolean).join(' · ') || 'Todos',
    columns: [['Recibo', 'receipt_number'], ['Data', r => fmt.datetime(r.paid_at)], ['Cliente', 'customer_name'], ['Código', 'customer_code'], ['Faturas', 'invoices'],
      ['Método', r => App.METHODS[r.method] || r.method], ['Referência', 'reference'], ['Operador', 'cashier'], ['Estado', r => (App.STATUS[r.status] || [r.status])[0]], ['Valor', r => fmt.amount(r.amount), 'n']],
    totals: (rows) => ['Total confirmado', '', '', '', '', '', '', '', '', fmt.amount(App.sum(rows.filter(r => r.status === 'confirmed'), 'amount'))]
  });
  $('btnPrint').addEventListener('click', () => App.exportList(exportCfg(), 'print'));
  $('btnCsv').addEventListener('click', () => App.exportList(exportCfg(), 'csv'));
  list.load(1);
})();
