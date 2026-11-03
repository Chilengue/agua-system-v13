/* Relatórios do gestor (diferentes dos extratos): faturação, recebimentos, quem pagou, devedores, consumo, mediadores, caixa. */
(async function () {
  const { api, fmt, esc, toast } = App;
  await App.boot({ title: 'Relatórios', roles: ['manager'] });
  const $ = (id) => document.getElementById(id);
  const a = (k) => { const f = (r) => fmt.amount(r[k]); f.key = k; return f; };
  const REPORTS = {
    billing: { title: 'Faturação mensal', f: 'p', desc: 'Faturas emitidas por mês: consumo, valores, multas, descontos, recebido e saldo.',
      cols: [['Mês', r => fmt.period(r.period)], ['Faturas', 'invoices', 'n'], ['Consumo m³', 'consumption', 'n'], ['Água', a('water'), 'n'], ['Saneamento', a('sewer'), 'n'],
        ['Taxa fixa', a('fixed_fee'), 'n'], ['Outros', a('other'), 'n'], ['Multas/juros', a('late_charges'), 'n'], ['Descontos', a('discount'), 'n'], ['Total', a('total'), 'n'], ['Pago', a('paid'), 'n'], ['Saldo', a('balance'), 'n']] },
    collections: { title: 'Recebimentos por dia e método', f: 'd', desc: 'Pagamentos confirmados por dia e método de pagamento.',
      cols: [['Dia', r => fmt.date(r.day)], ['Método', r => App.METHODS[r.method] || r.method], ['Pagamentos', 'payments', 'n'], ['Valor', a('amount'), 'n']] },
    payers: { title: 'Clientes que pagaram', f: 'm', desc: 'Clientes com pagamentos no mês final escolhido e quanto ainda devem.',
      cols: [['Código', 'code'], ['Cliente', 'name'], ['Telefone', 'phone'], ['Pagamentos', 'payments', 'n'], ['Valor pago', a('amount'), 'n'], ['Último', r => fmt.date(r.last_payment)], ['Ainda deve', a('debt'), 'n']] },
    debtors: { title: 'Devedores', f: 'o', desc: 'Clientes com dívida, por antiguidade.',
      cols: [['Código', 'code'], ['Cliente', 'name'], ['Telefone', 'phone'], ['Bairro', 'neighborhood'], ['Faturas', 'invoices', 'n'], ['No prazo', a('not_due'), 'n'], ['≤30 dias', a('d30'), 'n'],
        ['31–90', a('d90'), 'n'], ['>90', a('d90plus'), 'n'], ['Total', a('debt'), 'n'], ['Dias', 'days_late', 'n']] },
    consumption: { title: 'Consumo por categoria', f: 'p', desc: 'Consumo e valor faturado por categoria de tarifa.',
      cols: [['Categoria', r => App.CATEGORIES[r.category] || r.category], ['Contas', 'accounts', 'n'], ['Faturas', 'invoices', 'n'], ['Consumo m³', 'consumption', 'n'], ['Faturado', a('total'), 'n'], ['Média m³', r => Number(r.average || 0).toFixed(1), 'n']] },
    readers: { title: 'Leituras por mediador', f: 'p', desc: 'Produção de cada mediador no período.',
      cols: [['Mediador', 'reader'], ['Utilizador', 'username'], ['Leituras', 'readings', 'n'], ['Sem internet', 'offline', 'n'], ['Consumo alto', 'anomalies', 'n'], ['Consumo m³', 'consumption', 'n'], ['Última', r => fmt.datetime(r.last_reading)]] },
    cashiers: { title: 'Recebimentos por operador', f: 'd', desc: 'Valor recebido por cada operador de caixa (e pagamentos anulados).',
      cols: [['Operador', 'cashier'], ['Pagamentos', 'payments', 'n'], ['Valor', a('amount'), 'n'], ['Anulados', 'voided', 'n']] }
  };
  let type = (location.hash || '#billing').slice(1);
  if (!REPORTS[type]) type = 'billing';
  let last = null;
  const y = new Date().getFullYear();
  $('fromPeriod').value = y + '-01'; $('toPeriod').value = App.thisPeriod();
  $('from').value = App.today().slice(0, 8) + '01'; $('to').value = App.today();

  function setTab(t) {
    type = t; history.replaceState(null, '', '#' + t);
    document.querySelectorAll('#tabs .tab').forEach(b => b.classList.toggle('active', b.dataset.t === t));
    const f = REPORTS[t].f;
    document.querySelectorAll('.fp').forEach(e => e.style.display = f === 'p' || f === 'm' ? '' : 'none');
    document.querySelectorAll('.fd').forEach(e => e.style.display = f === 'd' ? '' : 'none');
    document.querySelectorAll('.fo').forEach(e => e.style.display = f === 'o' ? '' : 'none');
    $('desc').textContent = REPORTS[t].desc;
    run();
  }
  const params = () => ({ fromPeriod: $('fromPeriod').value, toPeriod: $('toPeriod').value, from: $('from').value, to: $('to').value, overdueOnly: $('overdue').checked ? 1 : 0 });
  const val = (c, r) => typeof c[1] === 'function' ? c[1](r) : (r[c[1]] == null ? '' : r[c[1]]);
  function totalsRow(cfg, rows) {
    return cfg.cols.map((c, i) => {
      if (i === 0) return 'Total';
      if (c[2] !== 'n' || /Dias|Média|Última/.test(c[0])) return '';
      if (typeof c[1] === 'string') return fmt.num(App.sum(rows, c[1]));
      return c[1].key ? fmt.amount(App.sum(rows, c[1].key)) : '';
    });
  }
  async function run() {
    const cfg = REPORTS[type];
    $('head').innerHTML = `<tr>${cfg.cols.map(c => `<th class="${c[2] === 'n' ? 'num' : ''}">${esc(c[0])}</th>`).join('')}</tr>`;
    $('rows').innerHTML = `<tr><td colspan="${cfg.cols.length}"><div class="spinner"></div></td></tr>`; $('foot').innerHTML = '';
    const r = await api.get('/api/reports/' + type + App.query(params()));
    if (!r.success) { $('rows').innerHTML = `<tr><td colspan="${cfg.cols.length}" class="empty-state">${esc(r.error)}</td></tr>`; return; }
    last = r;
    const rows = r.rows || [];
    $('rows').innerHTML = rows.map(row => `<tr>${cfg.cols.map(c => `<td class="${c[2] === 'n' ? 'num' : ''}">${esc(val(c, row))}</td>`).join('')}</tr>`).join('')
      || `<tr><td colspan="${cfg.cols.length}" class="empty-state">Sem dados no período.</td></tr>`;
    if (rows.length) $('foot').innerHTML = `<tr>${totalsRow(cfg, rows).map((t, i) => `<td class="${cfg.cols[i][2] === 'n' ? 'num' : ''} strong">${esc(t)}</td>`).join('')}</tr>`;
  }
  function filterText() {
    const f = REPORTS[type].f;
    if (f === 'p') return `${fmt.period($('fromPeriod').value)} a ${fmt.period($('toPeriod').value)}`;
    if (f === 'm') return fmt.periodLong($('toPeriod').value);
    if (f === 'd') return `${fmt.date($('from').value)} a ${fmt.date($('to').value)}`;
    return $('overdue').checked ? 'Só com faturas vencidas' : 'Todos';
  }
  $('tabs').addEventListener('click', (e) => { const b = e.target.closest('.tab'); if (b) setTab(b.dataset.t); });
  $('btnRun').addEventListener('click', run);
  ['fromPeriod', 'toPeriod', 'from', 'to', 'overdue'].forEach(id => $(id).addEventListener('change', run));
  $('btnPrint').addEventListener('click', () => {
    if (!last) return;
    const cfg = REPORTS[type], rows = last.rows || [];
    App.printHtml(cfg.title, `<div class="flt">Filtros: ${esc(filterText())}</div>` + App.tableHtml(cfg.cols, rows, rows.length ? totalsRow(cfg, rows) : null), { landscape: cfg.cols.length > 7 });
  });
  $('btnCsv').addEventListener('click', () => { if (last) App.downloadCsv(REPORTS[type].title + ' ' + filterText(), REPORTS[type].cols, last.rows || []); });
  if (!(App.branding || {}).id) toast('Sem dados da empresa.', 'error');
  setTab(type);
})();
