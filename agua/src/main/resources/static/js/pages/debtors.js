/* Devedores: lista com antiguidade da dívida, lembretes por WhatsApp/SMS (conforme o plano), caixa, extrato; imprimir/exportar com filtros. */
(async function () {
  const { fmt, esc, icon, toast, api } = App;
  await App.boot({ title: 'Devedores', roles: ['manager'] });
  const $ = (id) => document.getElementById(id);
  const params = () => ({ q: $('q').value.trim(), overdueOnly: $('overdue').checked, minDebt: $('minDebt').value });
  let totals = null;
  const list = App.pagedList({
    url: '/api/debtors', params, tbody: 'rows', pager: 'pager', cols: 10, empty: 'Sem devedores. 🎉',
    row: (c) => {
      return `<tr><td><span class="strong">${esc(c.name)}</span><br><span class="muted">${esc(c.code)} · ${esc(c.phone || '')}${c.days_late ? ` · <b style="color:var(--danger)">${c.days_late} dias</b>` : ''}</span></td>
      <td class="hide-sm">${esc(c.neighborhood || '—')}</td><td class="num hide-sm">${c.invoices}</td>
      <td class="num hide-sm">${fmt.amount(c.not_due)}</td><td class="num hide-sm">${fmt.amount(c.d30)}</td><td class="num hide-sm">${fmt.amount(c.d90)}</td><td class="num hide-sm">${fmt.amount(c.d90plus)}</td>
      <td class="num strong" style="color:var(--danger)">${fmt.amount(c.debt)}</td><td class="hide-sm">${fmt.date(c.last_payment)}</td>
      <td class="actions"><div class="acts"><a class="act green" href="/cashier?customer=${c.id}" title="Receber">${icon('cash')}</a>
        ${c.phone ? App.msgButtons(`data-cust="${c.id}"`, 'Lembrete por WhatsApp', 'Lembrete por SMS') : ''}
        <a class="act" href="/print?type=statement&customer=${c.id}&mode=all" target="_blank" title="Extrato">${icon('list')}</a></div></td></tr>`;
    },
    onData: async () => { if (!totals) loadTotals(); }
  });
  async function loadTotals() {
    const r = await App.api.get('/api/debtors' + App.query(Object.assign(params(), { size: 5000 })));
    if (!r.success) return;
    const it = r.items || [];
    totals = true;
    $('stats').innerHTML = `
      <div class="stat-card top red"><div class="stat-label">Clientes devedores</div><h3>${fmt.num(it.length)}</h3></div>
      <div class="stat-card top orange"><div class="stat-label">Total em dívida</div><h3>${fmt.moneyHtml(App.sum(it, 'debt'))}</h3></div>
      <div class="stat-card top blue"><div class="stat-label">Ainda no prazo</div><h3>${fmt.moneyHtml(App.sum(it, 'not_due'))}</h3></div>
      <div class="stat-card top red"><div class="stat-label">Mais de 90 dias</div><h3>${fmt.moneyHtml(App.sum(it, 'd90plus'))}</h3></div>`;
  }
  const reload = () => { totals = null; list.load(1); };
  // ---------- lembretes por WhatsApp / SMS ----------
  $('rows').addEventListener('click', async (e) => {
    const b = e.target.closest('[data-msg]'); if (!b) return;
    const r = await api.post('/api/messages/bulk', { channel: b.dataset.msg, customer_ids: [Number(b.dataset.cust)] });
    if (!r.success) { toast(r.error, 'error'); return; }
    if (r.manual && r.manual[0]) App.deliverMessage(r.manual[0]); else toast(r.created ? 'Lembrete enviado.' : 'O cliente não tem telefone.', r.created ? 'success' : 'error');
  });
  if (App.features.messages) {
    const actions = document.querySelector('.page-actions');
    actions.insertAdjacentHTML('beforeend', `<button class="btn-primary" data-remind="whatsapp">${icon('whatsapp')} Lembrar todos</button>` +
      (App.features.sms ? `<button class="btn-secondary" data-remind="sms">${icon('sms')} Lembrar por SMS</button>` : ''));
    actions.querySelectorAll('[data-remind]').forEach(btn => btn.addEventListener('click', async () => {
      const ch = btn.dataset.remind;
      if (!await App.ask(`Enviar lembrete por ${ch === 'sms' ? 'SMS' : 'WhatsApp'} a todos os devedores do filtro?`, { text: ($('overdue').checked ? 'Só clientes com faturas vencidas' : 'Todos os clientes com dívida') + ($('minDebt').value ? ', dívida ≥ ' + $('minDebt').value : '') + '.' })) return;
      const r = await api.post('/api/messages/bulk', { channel: ch, debtors_only: true, overdue_only: $('overdue').checked, min_debt: $('minDebt').value ? Number($('minDebt').value) : null });
      if (!r.success) { toast(r.error, 'error'); return; }
      toast(`${r.created} lembrete(s) criado(s)` + (r.skipped ? `, ${r.skipped} sem telefone` : '') + '.', 'success');
      if (!r.api && r.created) setTimeout(() => { location.href = '/messages?status=manual'; }, 900);
    }));
  }
  $('q').addEventListener('input', App.debounce(reload, 350));
  $('minDebt').addEventListener('change', reload);
  $('overdue').addEventListener('change', reload);
  $('btnClear').addEventListener('click', () => { $('q').value = ''; $('minDebt').value = ''; $('overdue').checked = false; reload(); });
  const exportCfg = () => ({
    url: '/api/debtors', params: params(), title: 'Clientes devedores', landscape: true,
    filters: [$('q').value, $('minDebt').value && 'dívida ≥ ' + $('minDebt').value, $('overdue').checked && 'só vencidas'].filter(Boolean).join(' · ') || 'Todos',
    columns: [['Código', 'code'], ['Cliente', 'name'], ['Telefone', 'phone'], ['Bairro', 'neighborhood'], ['Faturas', 'invoices', 'n'], ['No prazo', r => fmt.amount(r.not_due), 'n'],
      ['≤30 dias', r => fmt.amount(r.d30), 'n'], ['31–90', r => fmt.amount(r.d90), 'n'], ['>90', r => fmt.amount(r.d90plus), 'n'], ['Total', r => fmt.amount(r.debt), 'n'],
      ['Dias atraso', 'days_late', 'n'], ['Último pagamento', r => fmt.date(r.last_payment)]],
    totals: (rows) => ['Total', rows.length + ' clientes', '', '', App.sum(rows, 'invoices'), fmt.amount(App.sum(rows, 'not_due')), fmt.amount(App.sum(rows, 'd30')),
      fmt.amount(App.sum(rows, 'd90')), fmt.amount(App.sum(rows, 'd90plus')), fmt.amount(App.sum(rows, 'debt')), '', '']
  });
  $('btnPrint').addEventListener('click', () => App.exportList(exportCfg(), 'print'));
  $('btnCsv').addEventListener('click', () => App.exportList(exportCfg(), 'csv'));
  list.load(1);
})();
