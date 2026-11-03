/* Painel do gestor: filtro por mês, indicadores, gráfico, quem pagou e quem deve. */
(async function () {
  const { api, fmt, esc, icon } = App;
  const user = await App.boot({ title: 'Painel', roles: ['manager'] });
  const $ = (id) => document.getElementById(id);
  const sel = $('period');
  sel.innerHTML = App.monthOptions(24, App.qs('period') || App.thisPeriod());
  $('hello').textContent = 'Olá, ' + (user.name || '').split(' ')[0];
  let last = null;

  const card = (label, value, ic, color, sub) => `<div class="stat-card"><div class="stat-icon ${color}">${icon(ic)}</div>
    <div><div class="stat-label">${esc(label)}</div><h3>${value}</h3>${sub ? `<div class="stat-sub">${sub}</div>` : ''}</div></div>`;

  async function load() {
    const p = sel.value;
    $('periodLabel').textContent = 'Resumo de ' + fmt.periodLong(p);
    const r = await api.get('/api/dashboard?period=' + p);
    if (!r.success) { $('kpis').innerHTML = `<div class="alert warning">${esc(r.error)}</div>`; return; }
    last = r;
    const k = r.kpis || {};
    const b = App.branding || {};
    $('setupAlert').innerHTML = b.settings && !b.settings.configured
      ? `<div class="alert warning"><span>Configure as <b>tarifas</b> e as regras de multas e do recibo antes de faturar.</span><a class="btn-primary" href="/tariffs">Configurar tarifas</a></div>` : '';
    $('kpis').innerHTML =
      card('Faturado no mês', fmt.moneyHtml(k.billed), 'file', 'blue', fmt.num(k.invoices) + ' faturas · ' + fmt.num(k.consumption) + ' m³') +
      card('Recebido no mês', fmt.moneyHtml(k.collected), 'cash', 'green', fmt.num(k.payers) + ' clientes pagaram') +
      card('Total em dívida', fmt.moneyHtml(k.debt), 'alert', 'red', fmt.num(k.debtors) + ' devedores') +
      card('Dívida vencida', fmt.moneyHtml(k.overdue_debt), 'history', 'orange', fmt.num(k.pending_payments) + ' pagamentos por validar') +
      card('Clientes', fmt.num(k.customers), 'users', 'purple', fmt.num(k.accounts) + ' contas · ' + fmt.num(k.new_customers) + ' novos') +
      card('Leituras do mês', fmt.num(k.readings), 'drop', 'blue', fmt.num(k.pending_readings) + ' por faturar');

    const months = r.monthly || [];
    const max = Math.max(1, ...months.map(m => Math.max(Number(m.billed), Number(m.collected))));
    $('chart').innerHTML = months.map(m => `<div class="col" title="${fmt.period(m.period)}: faturado ${fmt.money(m.billed)} · recebido ${fmt.money(m.collected)}">
      <div class="pair"><div class="bar billed" style="height:${Number(m.billed) / max * 100}%"></div><div class="bar collected" style="height:${Number(m.collected) / max * 100}%"></div></div>
      <small>${fmt.periodShort(m.period).split('/')[0]}</small></div>`).join('');

    const meth = r.methods || [];
    const mmax = Math.max(1, ...meth.map(m => Number(m.amount)));
    $('methods').innerHTML = meth.length ? meth.map(m => `<div class="hbar"><span>${esc(App.METHODS[m.method] || m.method)} (${m.count})</span>
      <div class="track"><div class="fill" style="width:${Number(m.amount) / mmax * 100}%"></div></div><span>${fmt.amount(m.amount)}</span></div>`).join('')
      : '<div class="muted">Sem pagamentos neste mês.</div>';

    const total = Number(k.accounts || 0), done = Number(k.readings || 0);
    const pct = total ? Math.min(100, Math.round(done / total * 100)) : 0;
    $('readingsBox').innerHTML = `<div class="big-number">${fmt.num(done)} <span class="muted">de ${fmt.num(total)} contas</span></div>
      <div style="background:#f1f5f9;border-radius:6px;height:10px;margin:10px 0;overflow:hidden"><div style="background:var(--primary);height:100%;width:${pct}%"></div></div>
      <div class="muted">${pct}% lido · ${fmt.num(k.pending_readings)} leitura(s) à espera de faturação.</div>`;

    $('payers').innerHTML = (r.payers || []).map(c => `<tr class="clickable" data-c="${c.id}"><td><span class="strong">${esc(c.name)}</span><br><span class="muted">${esc(c.code)}</span></td>
      <td class="num">${c.payments}</td><td class="num strong">${fmt.money(c.amount)}</td><td class="num hide-sm">${Number(c.debt) ? fmt.money(c.debt) : '<span class="badge green">Em dia</span>'}</td></tr>`).join('')
      || '<tr><td colspan="4" class="empty-state">Ninguém pagou neste mês.</td></tr>';
    $('debtors').innerHTML = (r.debtors || []).map(c => `<tr class="clickable" data-c="${c.id}"><td><span class="strong">${esc(c.name)}</span><br><span class="muted">${esc(c.code)} · ${esc(c.phone || '')}</span></td>
      <td class="num hide-sm">${c.invoices}</td><td class="num strong" style="color:var(--danger)">${fmt.money(c.debt)}</td><td class="num hide-sm">${c.days_late || 0}</td></tr>`).join('')
      || '<tr><td colspan="4" class="empty-state">Sem devedores. 🎉</td></tr>';
    document.querySelectorAll('[data-c]').forEach(tr => tr.addEventListener('click', () => location.href = '/cashier?customer=' + tr.dataset.c));
  }
  sel.addEventListener('change', load);
  $('btnPrint').addEventListener('click', () => {
    if (!last) return;
    const k = last.kpis || {};
    App.printHtml('Resumo mensal', `
      <table class="t"><tr><th>Faturado</th><td class="n">${fmt.money(k.billed)}</td><th>Recebido</th><td class="n">${fmt.money(k.collected)}</td></tr>
      <tr><th>Total em dívida</th><td class="n">${fmt.money(k.debt)}</td><th>Dívida vencida</th><td class="n">${fmt.money(k.overdue_debt)}</td></tr>
      <tr><th>Faturas</th><td class="n">${k.invoices}</td><th>Consumo</th><td class="n">${fmt.num(k.consumption)} m³</td></tr>
      <tr><th>Clientes que pagaram</th><td class="n">${k.payers}</td><th>Devedores</th><td class="n">${k.debtors}</td></tr></table>
      <h2>Últimos 12 meses</h2>${App.tableHtml([['Mês', r => fmt.period(r.period)], ['Faturado', r => fmt.amount(r.billed), 'n'], ['Recebido', r => fmt.amount(r.collected), 'n'], ['Consumo m³', 'consumption', 'n']], last.monthly || [])}
      <h2>Clientes que pagaram</h2>${App.tableHtml([['Cliente', 'name'], ['Código', 'code'], ['Pagamentos', 'payments', 'n'], ['Valor', r => fmt.amount(r.amount), 'n']], last.payers || [])}
      <h2>Maiores devedores</h2>${App.tableHtml([['Cliente', 'name'], ['Telefone', 'phone'], ['Faturas', 'invoices', 'n'], ['Em dívida', r => fmt.amount(r.debt), 'n']], last.debtors || [])}`,
      { subtitle: fmt.periodLong(sel.value) });
  });
  load();
})();
