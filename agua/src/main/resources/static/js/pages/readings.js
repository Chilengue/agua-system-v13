/* Leituras: filtros por mês, mediador e estado; corrigir, anular, faturar; registar leitura manual. */
(async function () {
  const { api, fmt, esc, icon, toast, modal } = App;
  await App.boot({ title: 'Leituras', roles: ['manager'] });
  const $ = (id) => document.getElementById(id);
  let filter = '', chosen = null;
  $('period').innerHTML = '<option value="">Todos os meses</option>' + App.monthOptions(24, App.qs('period') || App.thisPeriod());
  const rd = await api.get('/api/team/readers');
  if (rd.success) $('reader').innerHTML += (rd.items || []).map(u => `<option value="${u.id}">${esc(u.name)}</option>`).join('');
  if (App.qs('reader')) { $('reader').value = App.qs('reader'); $('period').value = ''; }

  const params = () => ({ q: $('q').value.trim(), period: $('period').value, status: filter, readerId: $('reader').value });
  const list = App.pagedList({
    url: '/api/readings', params, tbody: 'rows', pager: 'pager', cols: 8, empty: 'Sem leituras com estes filtros.',
    row: (r) => `<tr>
      <td><span class="strong">${esc(r.customer_name)}</span><br><span class="muted">Conta ${esc(r.account_number)} · Cont. ${esc(r.meter_number)}${r.source === 'offline' ? ' · <b>offline</b>' : ''}</span></td>
      <td class="hide-sm">${fmt.period(r.period)}</td>
      <td class="num">${fmt.num(r.previous_value)}</td><td class="num strong">${fmt.num(r.current_value)}</td>
      <td class="num">${fmt.num(r.consumption)} m³ ${r.anomaly ? '<span class="badge red" title="Consumo acima do alerta">alto</span>' : ''}</td>
      <td class="hide-sm">${esc(r.reader_name || '—')}<br><span class="muted">${fmt.datetime(r.read_at)}${r.edited_at ? ' · corrigida' : ''}</span></td>
      <td>${App.badge(r.status)}${r.invoice_number ? `<br><span class="muted">${esc(r.invoice_number)}</span>` : ''}</td>
      <td class="actions"><div class="acts">
        ${r.status !== 'cancelled' && !Number(r.invoice_paid) ? `<button class="act orange" data-edit="${r.id}" data-v="${r.current_value}" title="Corrigir leitura">${icon('edit')}</button>` : ''}
        ${r.status === 'pending' ? `<button class="act green" data-bill="${r.id}" title="Faturar">${icon('file')}</button>` : ''}
        ${r.invoice_id ? `<a class="act blue" href="/print?type=invoice&id=${r.invoice_id}" target="_blank" title="Imprimir fatura">${icon('print')}</a>` : ''}
        ${r.status !== 'cancelled' ? `<button class="act red" data-cancel="${r.id}" title="Anular">${icon('trash')}</button>` : ''}
      </div></td></tr>`,
    onData: (d) => {
      const s = d.stats || {};
      $('stats').innerHTML = `
        <div class="stat-card top"><div class="stat-label">Leituras (${fmt.period($('period').value || App.thisPeriod())})</div><h3>${fmt.num(s.total)}</h3><div class="stat-sub">${fmt.num(s.consumption)} m³</div></div>
        <div class="stat-card top orange"><div class="stat-label">Por faturar</div><h3>${fmt.num(s.pending)}</h3><div class="stat-sub">${fmt.num(s.billed)} faturadas</div></div>
        <div class="stat-card top red"><div class="stat-label">Consumo alto</div><h3>${fmt.num(s.anomalies)}</h3><div class="stat-sub">verificar</div></div>
        <div class="stat-card top blue"><div class="stat-label">Contas sem leitura</div><h3>${fmt.num(s.missing)}</h3><div class="stat-sub">neste mês</div></div>`;
    }
  });
  $('rows').addEventListener('click', async (e) => {
    const ed = e.target.closest('[data-edit]'), bl = e.target.closest('[data-bill]'), cn = e.target.closest('[data-cancel]');
    if (ed) {
      const row = ((list.data && list.data.items) || []).find(x => String(x.id) === ed.dataset.edit) || {};
      const v = await App.ask('Corrigir leitura de ' + (row.customer_name || ''), { input: 'Leitura atual (m³)', value: ed.dataset.v,
        text: `Leitura anterior: ${fmt.num(row.previous_value)} · atual: ${fmt.num(row.current_value)} (${fmt.num(row.consumption)} m³). Se já foi faturada (sem pagamentos), a fatura é recalculada.` });
      if (v == null) return;
      const r = await api.put('/api/readings/' + ed.dataset.edit, { current_value: Number(v) });
      r.success ? (toast(r.message, 'success'), list.reload()) : toast(r.error, 'error');
    }
    if (bl) {
      const r = await api.post(`/api/readings/${bl.dataset.bill}/bill`);
      r.success ? (toast(`Fatura ${r.invoice_number}: ${fmt.money(r.total)}`, 'success'), list.reload()) : toast(r.error, 'error');
    }
    if (cn) {
      const why = await App.ask('Anular leitura?', { input: 'Motivo', danger: true, confirm: 'Anular', text: 'A fatura desta leitura (se não tiver pagamentos) também é anulada.' });
      if (!why) return;
      const r = await api.post(`/api/readings/${cn.dataset.cancel}/cancel`, { reason: why });
      r.success ? (toast(r.message, 'success'), list.reload()) : toast(r.error, 'error');
    }
  });
  ['period', 'reader'].forEach(id => $(id).addEventListener('change', () => list.load(1)));
  $('q').addEventListener('input', App.debounce(() => list.load(1), 350));
  $('btnClear').addEventListener('click', () => { $('q').value = ''; $('reader').value = ''; $('period').value = ''; setChip(''); });
  $('chips').addEventListener('click', (e) => { const c = e.target.closest('.chip'); if (c) setChip(c.dataset.f); });
  function setChip(f) { filter = f; document.querySelectorAll('#chips .chip').forEach(c => c.classList.toggle('active', c.dataset.f === f)); list.load(1); }

  const exportCfg = () => ({
    url: '/api/readings', params: params(), title: 'Leituras', landscape: true,
    filters: [$('period').value && fmt.periodLong($('period').value), $('reader').value && $('reader').selectedOptions[0].textContent,
      filter && document.querySelector('#chips .chip.active').textContent, $('q').value].filter(Boolean).join(' · ') || 'Todas',
    columns: [['Mês', r => fmt.period(r.period)], ['Cliente', 'customer_name'], ['Código', 'customer_code'], ['Conta', 'account_number'], ['Contador', 'meter_number'],
      ['Anterior', 'previous_value', 'n'], ['Atual', 'current_value', 'n'], ['Consumo m³', 'consumption', 'n'], ['Mediador', 'reader_name'],
      ['Data', r => fmt.datetime(r.read_at)], ['Estado', r => (App.STATUS[r.status] || [r.status])[0]], ['Fatura', 'invoice_number']],
    totals: (rows) => ['Total', '', '', '', '', '', '', App.sum(rows, 'consumption'), '', '', '', '']
  });
  $('btnPrint').addEventListener('click', () => App.exportList(exportCfg(), 'print'));
  $('btnCsv').addEventListener('click', () => App.exportList(exportCfg(), 'csv'));

  $('btnBillAll').addEventListener('click', async () => {
    const p = $('period').value || App.thisPeriod();
    if (!await App.ask('Faturar todas as leituras pendentes de ' + fmt.periodLong(p) + '?')) return;
    const r = await api.post('/api/readings/bill-period?period=' + p);
    if (!r.success) { toast(r.error, 'error'); return; }
    toast(`${r.billed} fatura(s) emitida(s)` + ((r.errors || []).length ? `, ${r.errors.length} com erro` : '') + '.', (r.errors || []).length ? 'error' : 'success');
    list.reload();
  });

  // ---------- leitura manual: anterior, consumo e valor a pagar enquanto se escreve ----------
  let tariff = null;
  api.get('/api/tariff').then(r => { if (r.success) tariff = r.tariff; });
  $('btnNew').addEventListener('click', () => {
    chosen = null; $('accQ').value = ''; $('accResults').innerHTML = ''; $('newForm').style.display = 'none'; $('accPick').style.display = '';
    modal.open('newModal'); setTimeout(() => $('accQ').focus(), 50);
  });
  $('accChange').addEventListener('click', () => { $('newForm').style.display = 'none'; $('accPick').style.display = ''; $('accQ').focus(); });
  $('accQ').addEventListener('input', App.debounce(async () => {
    const q = $('accQ').value.trim();
    if (q.length < 2) { $('accResults').innerHTML = ''; return; }
    const r = await api.get('/api/accounts/search?q=' + encodeURIComponent(q));
    $('accResults').innerHTML = (r.items || []).map(a => `<div class="cust-item" data-a='${esc(JSON.stringify(a))}'>
      <div><div class="name">${esc(a.customer_name)}</div><div class="muted">Conta ${esc(a.number)} · Cont. ${esc(a.meter_number || '—')} · ${esc(a.phone || '')}</div>
        ${a.status !== 'active' ? `<span class="badge red">Conta ${esc((App.STATUS[a.status] || [a.status])[0])}</span>` : ''}</div>
      <div style="text-align:right"><div class="muted">Anterior</div><b>${a.last_value != null ? fmt.num(a.last_value) : '—'}</b>
        ${a.last_period === App.thisPeriod() ? '<br><span class="badge orange">já lida este mês</span>' : ''}</div></div>`).join('') || '<div class="muted">Nada encontrado.</div>';
  }, 300));
  $('accResults').addEventListener('click', (e) => {
    const it = e.target.closest('[data-a]'); if (!it) return;
    chosen = JSON.parse(it.dataset.a);
    $('accName').textContent = chosen.customer_name;
    $('accCat').textContent = App.CATEGORIES[chosen.category] || chosen.category || '';
    $('accMeta').textContent = `${chosen.customer_code} · Conta ${chosen.number} · Contador ${chosen.meter_number || '—'}${chosen.phone ? ' · ' + chosen.phone : ''}`;
    $('vPrev').textContent = chosen.last_value != null ? fmt.num(chosen.last_value) : '—';
    $('vPrevWhen').textContent = chosen.last_period ? fmt.period(chosen.last_period) : 'leitura inicial';
    $('vAvg').textContent = chosen.last_consumption != null ? 'último: ' + fmt.num(chosen.last_consumption) + ' m³' : '';
    $('accPick').style.display = 'none';
    const f = $('newForm'); f.reset(); f.period.value = App.thisPeriod(); f.bill.checked = true; f.style.display = '';
    calc();
    setTimeout(() => f.current_value.focus(), 50);
  });
  function calc() {
    const f = $('newForm'), box = $('payBox');
    const prev = Number(chosen && chosen.last_value != null ? chosen.last_value : 0);
    const raw = f.current_value.value;
    if (raw === '') { $('vCons').textContent = '—'; $('vCons').style.color = ''; box.style.display = chosen && Number(chosen.debt) ? '' : 'none';
      box.className = 'pay-box'; box.innerHTML = chosen && Number(chosen.debt) ? `<div class="row"><span>Dívida anterior desta conta</span><b>${fmt.money(chosen.debt)}</b></div>` : ''; return; }
    const cons = Number(raw) - prev;
    $('vCons').textContent = fmt.num(cons) + ' m³';
    $('vCons').style.color = cons < 0 ? 'var(--danger)' : '';
    box.style.display = '';
    if (cons < 0) {
      box.className = 'pay-box warn';
      box.innerHTML = `<b>A leitura atual é menor que a anterior (${fmt.num(prev)}).</b><div class="muted">Confirme o número ou registe a troca de contador na ficha do cliente.</div>`;
      return;
    }
    const p = App.tariffPrice(tariff, cons, chosen.category);
    const debt = Number(chosen.debt || 0);
    const alert = tariff && tariff.consumption_alert && cons > Number(tariff.consumption_alert);
    box.className = 'pay-box' + (alert ? ' warn' : '');
    box.innerHTML = p ? `
      <div class="row"><span>Água (${fmt.num(cons)} m³)</span><b>${fmt.money(p.water)}</b></div>
      ${p.sewer ? `<div class="row"><span>Saneamento</span><b>${fmt.money(p.sewer)}</b></div>` : ''}
      ${p.fixed ? `<div class="row"><span>Taxa fixa</span><b>${fmt.money(p.fixed)}</b></div>` : ''}
      <div class="big"><span>Valor a pagar desta leitura</span><b>${fmt.money(p.total)}</b></div>
      ${debt ? `<div class="row" style="margin-top:6px"><span>Dívida anterior</span><b>${fmt.money(debt)}</b></div>
        <div class="row"><span><b>Total em dívida após faturar</b></span><b style="color:var(--danger)">${fmt.money(debt + p.total)}</b></div>` : ''}
      ${alert ? `<div class="muted" style="color:#b91c1c">Consumo acima do alerta (${fmt.num(tariff.consumption_alert)} m³): confirme a leitura.</div>` : ''}`
      : '<span class="muted">Tarifa não configurada: o valor é calculado ao faturar.</span>';
  }
  $('newForm').current_value.addEventListener('input', calc);
  $('newForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const f = e.target;
    const v = Number(f.current_value.value);
    if (chosen.last_value != null && v < Number(chosen.last_value)) { toast('A leitura não pode ser menor que a anterior.', 'error'); return; }
    App.busy($('btnSaveReading'), true, 'A guardar…');
    const r = await api.post('/api/readings', { account_id: chosen.id, current_value: v, period: f.period.value || null,
      notes: f.notes.value || null, bill: f.bill.checked, client_uuid: App.uuid() });
    App.busy($('btnSaveReading'), false);
    if (!r.success) { toast(r.error, 'error'); return; }
    modal.close('newModal');
    const rr = r.reading || {};
    toast(`Leitura gravada (${rr.consumption} m³)` + (rr.invoice_number ? ` · fatura ${rr.invoice_number}: ${fmt.money(rr.invoice_total)}` : ''), 'success');
    list.reload();
  });
  list.load(1);
})();
