/* ============================================================
   Painel do administrador: painel com gráficos de uso e receitas,
   empresas (aprovar/suspender), utilizadores (corrigir email/nome),
   clientes de todas as empresas com histórico de pagamentos,
   pagamentos, devedores, relatórios, pedidos de senha e auditoria.
   ============================================================ */
(async function () {
  const { api, fmt, esc, icon, toast, modal } = App;
  await App.boot({ title: 'Administração', roles: ['admin'] });
  const $ = (id) => document.getElementById(id);
  const st = (s) => (App.STATUS[s] || [s])[0];
  let companies = [];
  const cr = await api.get('/api/admin/companies?size=1000');
  if (cr.success) companies = cr.items || [];
  const companyOptions = (sel) => '<option value="">Todas as empresas</option>' + companies.map(c => `<option value="${c.id}" ${String(sel) === String(c.id) ? 'selected' : ''}>${esc(c.name)}</option>`).join('');

  // ================= PAINEL =================
  $('dPeriod').innerHTML = App.monthOptions(24, App.thisPeriod());
  let dash = null;
  async function loadDashboard() {
    const r = await api.get('/api/admin/dashboard?period=' + $('dPeriod').value);
    if (!r.success) { $('dKpis').innerHTML = `<div class="alert warning">${esc(r.error)}</div>`; return; }
    dash = r;
    const k = r.kpis || {};
    $('dAlerts').innerHTML = (Number(k.pending_companies) ? `<div class="alert warning"><span><b>${k.pending_companies}</b> empresa(s) à espera de aprovação.</span><a class="btn-primary" href="#companies" data-goto="pending">Ver pedidos</a></div>` : '') +
      (Number(k.pending_resets) ? `<div class="alert info"><span><b>${k.pending_resets}</b> pedido(s) de recuperação de senha.</span><a class="btn-primary" href="#resets">Tratar</a></div>` : '') +
      (Number(k.users_without_email) ? `<div class="alert info"><span><b>${k.users_without_email}</b> gestor(es) sem email (não conseguem recuperar a senha).</span><a class="btn-secondary" href="#users" data-goto="noemail">Completar dados</a></div>` : '');
    const card = (l, v, ic, c, sub) => `<div class="stat-card"><div class="stat-icon ${c}">${icon(ic)}</div><div><div class="stat-label">${l}</div><h3>${v}</h3>${sub ? `<div class="stat-sub">${sub}</div>` : ''}</div></div>`;
    $('dKpis').innerHTML =
      card('Empresas', fmt.num(k.companies), 'building', 'blue', `${fmt.num(k.active_companies)} ativas · ${fmt.num(k.pending_companies)} pendentes`) +
      card('Recebido no mês', fmt.moneyHtml(k.collected_month), 'cash', 'green', 'Total: ' + fmt.money(k.collected_total)) +
      card('Faturado no mês', fmt.moneyHtml(k.billed_month), 'file', 'purple', '') +
      card('Em dívida', fmt.moneyHtml(k.debt), 'alert', 'red', `${fmt.num(k.late_customers)} clientes com faturas vencidas`) +
      card('Clientes', fmt.num(k.customers), 'users', 'blue', `${fmt.num(k.accounts)} contas`) +
      card('Gestores', fmt.num(k.managers), 'user', 'orange', `${fmt.num(k.active_managers)} ativos · ${fmt.num(k.logins_30d)} acessos em 30 dias`);
    $('dPlans').innerHTML = (r.plans || []).map(p => `<a class="plan-card ${p.plan}" href="#plans" data-goto="${p.plan}" style="text-decoration:none;color:inherit">
      <div><span class="plan-tag ${p.plan}">${esc(App.PLANS[p.plan])}</span> <span class="muted">${esc(App.PLAN_INFO[p.plan])}</span></div>
      <div class="num-row"><div><small>Empresas</small><b>${fmt.num(p.companies)}</b></div><div><small>Ativas</small><b>${fmt.num(p.active_companies)}</b></div>
        <div><small>Clientes</small><b>${fmt.num(p.customers)}</b></div><div><small>Contas</small><b>${fmt.num(p.accounts)}</b></div>
        ${p.plan !== 'basic' ? `<div><small>Mensagens (mês)</small><b>${fmt.num(p.messages_month)}</b></div>` : ''}</div></a>`).join('');
    const m = r.monthly || [];
    const max = Math.max(1, ...m.map(x => Math.max(Number(x.billed), Number(x.collected))));
    $('dChart').innerHTML = m.map(x => `<div class="col" title="${fmt.period(x.period)}: faturado ${fmt.money(x.billed)} · recebido ${fmt.money(x.collected)}"><div class="pair">
      <div class="bar billed" style="height:${Number(x.billed) / max * 100}%"></div><div class="bar collected" style="height:${Number(x.collected) / max * 100}%"></div></div><small>${fmt.periodShort(x.period).split('/')[0]}</small></div>`).join('');
    const umax = Math.max(1, ...m.map(x => Math.max(Number(x.logins), Number(x.customers))));
    $('dUsage').innerHTML = m.map(x => `<div class="col" title="${fmt.period(x.period)}: ${x.logins} acessos · ${x.customers} novos clientes"><div class="pair">
      <div class="bar" style="background:#8b5cf6;height:${Number(x.logins) / umax * 100}%"></div><div class="bar collected" style="height:${Number(x.customers) / umax * 100}%"></div></div><small>${fmt.periodShort(x.period).split('/')[0]}</small></div>`).join('');
    const cs = (r.companies || []).slice().sort((a, b) => Number(b.collected_month) - Number(a.collected_month)).slice(0, 10);
    const cmax = Math.max(1, ...cs.map(c => Number(c.collected_month)));
    $('dByCompany').innerHTML = cs.map(c => `<div class="hbar"><span title="${esc(c.name)}">${esc(c.name)}</span><div class="track"><div class="fill" style="width:${Number(c.collected_month) / cmax * 100}%"></div></div><span>${fmt.amount(c.collected_month)}</span></div>`).join('') || '<div class="muted">Sem empresas.</div>';
    $('dDebtors').innerHTML = (r.debtors || []).map(d => `<tr><td><a href="#" data-hist="${d.id}" class="strong">${esc(d.name)}</a><br><span class="muted">${esc(d.phone || '')} · ${d.days_late || 0} dias</span></td>
      <td class="hide-sm">${esc(d.company_name)}</td><td class="num strong" style="color:var(--danger)">${fmt.money(d.debt)}</td></tr>`).join('') || '<tr><td colspan="3" class="empty-state">Sem devedores.</td></tr>';
  }
  $('dPeriod').addEventListener('change', loadDashboard);
  $('dPrint').addEventListener('click', () => {
    if (!dash) return;
    const k = dash.kpis || {};
    App.printHtml('Resumo da plataforma', `<table class="t"><tr><th>Empresas</th><td class="n">${k.companies} (${k.active_companies} ativas, ${k.pending_companies} pendentes)</td><th>Clientes</th><td class="n">${k.customers}</td></tr>
      <tr><th>Recebido no mês</th><td class="n">${fmt.money(k.collected_month)}</td><th>Faturado no mês</th><td class="n">${fmt.money(k.billed_month)}</td></tr>
      <tr><th>Em dívida</th><td class="n">${fmt.money(k.debt)}</td><th>Acessos (30 dias)</th><td class="n">${k.logins_30d}</td></tr></table>
      <h2>Por mês</h2>${App.tableHtml([['Mês', r => fmt.period(r.period)], ['Faturado', r => fmt.amount(r.billed), 'n'], ['Recebido', r => fmt.amount(r.collected), 'n'], ['Acessos', 'logins', 'n'], ['Novos clientes', 'customers', 'n']], dash.monthly || [])}
      <h2>Por empresa</h2>${App.tableHtml([['Empresa', 'name'], ['Estado', r => st(r.status)], ['Clientes', 'customers', 'n'], ['Recebido no mês', r => fmt.amount(r.collected_month), 'n'], ['Em dívida', r => fmt.amount(r.debt), 'n']], dash.companies || [])}`,
      { subtitle: fmt.periodLong($('dPeriod').value) });
  });

  // ================= LISTAS =================
  const PLAN_OPTIONS = '<option value="">Todos os planos</option><option value="basic">Básico</option><option value="standard">Standard</option><option value="enterprise">Enterprise</option>';
  const CHIP = (f, label, color) => `<button class="chip ${color || ''}" data-f="${f}">${label}</button>`;
  const LISTS = {
    companies: {
      title: 'Empresas', hint: 'Aprovar registos feitos no login, suspender ou reativar. O código da empresa é o utilizador do gestor.',
      url: '/api/admin/companies', cols: 8, extra: '<button class="btn-primary" id="btnNewCompany">+ Nova empresa</button>',
      toolbar: '<input type="search" id="fq" placeholder="Nome, código, NUIT, telefone ou email…"><select id="fplan">' + PLAN_OPTIONS + '</select>',
      chips: CHIP('', 'Todas') + CHIP('pending', 'Pendentes', 'orange') + CHIP('active', 'Ativas') + CHIP('suspended', 'Suspensas', 'red') + CHIP('rejected', 'Rejeitadas', 'red'),
      params: (f) => ({ q: val('fq'), status: f, plan: val('fplan') }),
      head: ['Empresa', 'Plano', 'Gestor', 'Clientes', 'Recebido (mês)', 'Em dívida', 'Estado', ''],
      row: (c) => `<tr><td><a href="#" class="strong" data-company="${c.id}">${esc(c.name)}</a><br><span class="muted">${esc(c.code)}${c.self_registered ? ' · registo no login' : ''}${c.city || c.province ? ' · ' + esc([c.city, c.province].filter(Boolean).join(', ')) : ''}</span></td>
        <td><span class="plan-tag ${esc(c.plan)}">${esc(App.PLANS[c.plan] || c.plan)}</span></td>
        <td>${esc(c.manager_name || '—')}<br><span class="muted">${esc(c.manager_email || '')} ${esc(c.manager_phone || c.phone || '')}</span></td>
        <td class="num">${fmt.num(c.customers)}</td>
        <td class="num">${fmt.amount(c.collected_month)}</td><td class="num">${fmt.amount(c.debt)}</td><td>${App.badge(c.status)}</td>
        <td class="actions"><div class="acts">
          ${c.status === 'pending' || c.status === 'suspended' || c.status === 'rejected' ? `<button class="act green" data-cstatus="${c.id}" data-to="active" title="${c.status === 'pending' ? 'Aprovar' : 'Reativar'}">${icon('ok')}</button>` : ''}
          ${c.status === 'active' ? `<button class="act red" data-cstatus="${c.id}" data-to="suspended" title="Suspender">${icon('x')}</button>` : ''}
          ${c.status === 'pending' ? `<button class="act red" data-cstatus="${c.id}" data-to="rejected" title="Rejeitar">${icon('trash')}</button>` : ''}
          <button class="act blue" data-cplan="${c.id}" data-plan="${esc(c.plan)}" data-n="${esc(c.name)}" title="Mudar plano">${icon('star')}</button>
          <button class="act orange" data-cedit="${c.id}" title="Editar">${icon('edit')}</button>
          <button class="act" data-creset="${c.id}" title="Nova senha do gestor">${icon('key')}</button></div></td></tr>`,
      export: { title: 'Empresas', columns: [['Código', 'code'], ['Empresa', 'name'], ['NUIT', 'nuit'], ['Telefone', 'phone'], ['Email', 'email'], ['Cidade', 'city'], ['Província', 'province'],
        ['Plano', r => App.PLANS[r.plan] || r.plan], ['Gestor', 'manager_name'], ['Email do gestor', 'manager_email'], ['Clientes', 'customers', 'n'], ['Mediadores', 'readers', 'n'], ['Recebido (mês)', r => fmt.amount(r.collected_month), 'n'],
        ['Em dívida', r => fmt.amount(r.debt), 'n'], ['Estado', r => st(r.status)], ['Registo', r => fmt.date(r.created_at)]] }
    },
    plans: {
      title: 'Planos das empresas', hint: 'Básico: sem WhatsApp/SMS · Standard: WhatsApp · Enterprise: WhatsApp e SMS. Mudar de plano liga ou desliga logo o módulo de mensagens da empresa.',
      url: '/api/admin/companies', cols: 8,
      toolbar: '<input type="search" id="fq" placeholder="Nome ou código da empresa…">',
      chips: CHIP('', 'Todos os planos') + CHIP('basic', 'Básico') + CHIP('standard', 'Standard', 'blue') + CHIP('enterprise', 'Enterprise', 'orange'),
      params: (f) => ({ q: val('fq'), plan: f }),
      head: ['Empresa', 'Plano', 'Desde', 'Clientes', 'Contas', 'Mensagens (mês)', 'Estado', ''],
      row: (c) => `<tr><td><a href="#" class="strong" data-company="${c.id}">${esc(c.name)}</a><br><span class="muted">${esc(c.code)} · ${esc(c.manager_name || '')}</span></td>
        <td><span class="plan-tag ${esc(c.plan)}">${esc(App.PLANS[c.plan] || c.plan)}</span></td><td>${fmt.date(c.plan_changed_at)}</td>
        <td class="num">${fmt.num(c.customers)}</td><td class="num">${fmt.num(c.accounts)}</td><td class="num">${c.plan === 'basic' ? '—' : fmt.num(c.messages_month)}</td>
        <td>${App.badge(c.status)}</td>
        <td class="actions"><button class="btn-secondary" data-cplan="${c.id}" data-plan="${esc(c.plan)}" data-n="${esc(c.name)}">${icon('star')} Mudar plano</button></td></tr>`,
      export: { title: 'Planos das empresas', columns: [['Código', 'code'], ['Empresa', 'name'], ['Plano', r => App.PLANS[r.plan] || r.plan], ['Desde', r => fmt.date(r.plan_changed_at)],
        ['Clientes', 'customers', 'n'], ['Contas', 'accounts', 'n'], ['Mensagens (mês)', 'messages_month', 'n'], ['Estado', r => st(r.status)], ['Gestor', 'manager_name'], ['Telefone', 'phone']],
        totals: (rows) => ['Total', rows.length + ' empresas', '', '', App.sum(rows, 'customers'), App.sum(rows, 'accounts'), App.sum(rows, 'messages_month'), '', '', ''] }
    },
    users: {
      title: 'Gestores das empresas', hint: 'O administrador gere só os gestores (e administradores). Mediadores e acessos de clientes são geridos pelo gestor de cada empresa. O email é único e serve para recuperar a senha.',
      url: '/api/admin/users', cols: 7,
      toolbar: '<input type="search" id="fq" placeholder="Nome, utilizador, email ou telefone…"><select id="fcompany"></select><select id="frole"><option value="">Gestores e administradores</option><option value="manager">Só gestores</option><option value="admin">Só administradores</option></select>',
      chips: CHIP('', 'Todos') + CHIP('active', 'Ativos') + CHIP('blocked', 'Bloqueados', 'red') + CHIP('noemail', 'Sem email', 'orange'),
      params: (f) => ({ q: val('fq'), company: val('fcompany'), role: val('frole'), status: f === 'noemail' ? '' : f, missingEmail: f === 'noemail' }),
      head: ['Nome', 'Utilizador', 'Perfil', 'Empresa', 'Email / telefone', 'Estado', ''],
      row: (u) => `<tr><td class="strong">${esc(u.name)}</td><td><code>${esc(u.username)}</code>${u.must_change_password ? '<br><span class="badge orange">senha temporária</span>' : ''}</td>
        <td>${esc(App.ROLES[u.role] || u.role)}</td><td class="hide-sm">${esc(u.company_name || '—')}</td>
        <td>${u.email ? esc(u.email) : '<span class="badge orange">sem email</span>'}<br><span class="muted">${esc(u.phone || '')} · ${u.last_login ? 'acesso ' + fmt.datetime(u.last_login) : 'nunca entrou'}</span></td>
        <td>${App.badge(u.status)}</td>
        <td class="actions"><div class="acts"><button class="act orange" data-uedit="${u.id}" title="Editar nome, email, telefone, estado">${icon('edit')}</button>
          <button class="act" data-ureset="${u.id}" title="Nova senha temporária">${icon('key')}</button></div></td></tr>`,
      export: { title: 'Utilizadores', columns: [['Nome', 'name'], ['Utilizador', 'username'], ['Perfil', r => App.ROLES[r.role] || r.role], ['Empresa', 'company_name'], ['Email', 'email'],
        ['Telefone', 'phone'], ['Estado', r => st(r.status)], ['Último acesso', r => fmt.datetime(r.last_login)], ['Criado', r => fmt.date(r.created_at)]] }
    },
    customers: {
      title: 'Clientes de todas as empresas', hint: 'Clique num cliente para ver o histórico de pagamentos, faturas e contas.',
      url: '/api/admin/customers', cols: 7,
      toolbar: '<input type="search" id="fq" placeholder="Nome, código, telefone ou email…"><select id="fcompany"></select><select id="fplan">' + PLAN_OPTIONS + '</select>',
      params: () => ({ q: val('fq'), company: val('fcompany'), plan: val('fplan') }),
      head: ['Cliente', 'Empresa', 'Contas', 'Pagamentos', 'Total pago', 'Em dívida', ''],
      row: (c) => `<tr><td><a href="#" class="strong" data-hist="${c.id}">${esc(c.name)}</a><br><span class="muted">${esc(c.code)} · ${esc(c.phone || '')}</span></td>
        <td>${esc(c.company_name)}<br><span class="plan-tag ${esc(c.plan)}">${esc(App.PLANS[c.plan] || '')}</span></td><td class="num">${c.accounts}</td><td class="num">${c.payments}<br><span class="muted">${fmt.date(c.last_payment)}</span></td>
        <td class="num">${fmt.amount(c.total_paid)}</td><td class="num strong" style="color:${Number(c.debt) ? 'var(--danger)' : 'inherit'}">${fmt.amount(c.debt)}</td>
        <td class="actions"><button class="act blue" data-hist="${c.id}" title="Histórico de pagamentos">${icon('history')}</button></td></tr>`,
      export: { title: 'Clientes', columns: [['Código', 'code'], ['Cliente', 'name'], ['Telefone', 'phone'], ['Email', 'email'], ['Empresa', 'company_name'], ['Plano', r => App.PLANS[r.plan] || ''], ['Contas', 'accounts', 'n'],
        ['Pagamentos', 'payments', 'n'], ['Último pagamento', r => fmt.date(r.last_payment)], ['Total pago', r => fmt.amount(r.total_paid), 'n'], ['Em dívida', r => fmt.amount(r.debt), 'n']] }
    },
    payments: {
      title: 'Pagamentos (dinheiro que entra)', hint: 'Recibos de todas as empresas.', url: '/api/admin/payments', cols: 7,
      toolbar: '<input type="search" id="fq" placeholder="Recibo, cliente ou código…"><select id="fcompany"></select><select id="fmethod"></select><input type="date" id="ffrom"><input type="date" id="fto">',
      chips: CHIP('', 'Todos') + CHIP('confirmed', 'Confirmados') + CHIP('pending', 'Por validar', 'orange') + CHIP('voided', 'Anulados', 'red'),
      params: (f) => ({ q: val('fq'), company: val('fcompany'), method: val('fmethod'), from: val('ffrom'), to: val('fto'), status: f }),
      head: ['Recibo', 'Cliente', 'Empresa', 'Data', 'Método', 'Valor', 'Estado'],
      row: (p) => `<tr><td class="strong">${esc(p.receipt_number)}</td><td><a href="#" data-hist="${p.customer_id}">${esc(p.customer_name)}</a><br><span class="muted">${esc(p.customer_code)}</span></td>
        <td>${esc(p.company_name)}</td><td>${fmt.datetime(p.paid_at)}</td><td>${esc(App.METHODS[p.method] || p.method)}</td><td class="num strong">${fmt.amount(p.amount)}</td><td>${App.badge(p.status)}</td></tr>`,
      stats: (s) => `<div class="stat-card top"><div class="stat-label">Recebido (filtro)</div><h3>${fmt.moneyHtml(s.confirmed)}</h3><div class="stat-sub">${fmt.num(s.confirmed_count)} recibos</div></div>
        <div class="stat-card top blue"><div class="stat-label">Clientes que pagaram</div><h3>${fmt.num(s.customers)}</h3></div>`,
      export: { title: 'Pagamentos', columns: [['Recibo', 'receipt_number'], ['Data', r => fmt.datetime(r.paid_at)], ['Cliente', 'customer_name'], ['Código', 'customer_code'], ['Empresa', 'company_name'],
        ['Método', r => App.METHODS[r.method] || r.method], ['Estado', r => st(r.status)], ['Valor', r => fmt.amount(r.amount), 'n']],
        totals: (rows) => ['Total confirmado', '', '', '', '', '', '', fmt.amount(App.sum(rows.filter(r => r.status === 'confirmed'), 'amount'))] }
    },
    debtors: {
      title: 'Clientes que não pagam', hint: 'Dívida por antiguidade em todas as empresas.', url: '/api/admin/debtors', cols: 8,
      toolbar: '<input type="search" id="fq" placeholder="Nome, código ou telefone…"><select id="fcompany"></select><input type="number" id="fmin" placeholder="Dívida mínima" min="0">',
      chips: CHIP('', 'Todos') + CHIP('overdue', 'Só vencidas', 'red'),
      params: (f) => ({ q: val('fq'), company: val('fcompany'), minDebt: val('fmin'), overdueOnly: f === 'overdue' }),
      head: ['Cliente', 'Empresa', 'Faturas', 'No prazo', '≤30', '31–90', '>90', 'Total'],
      row: (d) => `<tr><td><a href="#" class="strong" data-hist="${d.id}">${esc(d.name)}</a><br><span class="muted">${esc(d.code)} · ${esc(d.phone || '')} · ${d.days_late || 0} dias</span></td>
        <td>${esc(d.company_name)}</td><td class="num">${d.invoices}</td><td class="num">${fmt.amount(d.not_due)}</td><td class="num">${fmt.amount(d.d30)}</td>
        <td class="num">${fmt.amount(d.d90)}</td><td class="num">${fmt.amount(d.d90plus)}</td><td class="num strong" style="color:var(--danger)">${fmt.amount(d.debt)}</td></tr>`,
      export: { title: 'Devedores', columns: [['Código', 'code'], ['Cliente', 'name'], ['Telefone', 'phone'], ['Empresa', 'company_name'], ['Faturas', 'invoices', 'n'], ['No prazo', r => fmt.amount(r.not_due), 'n'],
        ['≤30', r => fmt.amount(r.d30), 'n'], ['31–90', r => fmt.amount(r.d90), 'n'], ['>90', r => fmt.amount(r.d90plus), 'n'], ['Total', r => fmt.amount(r.debt), 'n'], ['Dias', 'days_late', 'n']],
        totals: (rows) => ['Total', rows.length + ' clientes', '', '', App.sum(rows, 'invoices'), fmt.amount(App.sum(rows, 'not_due')), fmt.amount(App.sum(rows, 'd30')), fmt.amount(App.sum(rows, 'd90')), fmt.amount(App.sum(rows, 'd90plus')), fmt.amount(App.sum(rows, 'debt')), ''] }
    },
    resets: {
      title: 'Pedidos de recuperação de senha', hint: 'Pedidos feitos no login quando o email não está configurado. Gere uma senha temporária e entregue-a ao utilizador.',
      url: '/api/admin/password-resets', cols: 6, noPager: true,
      chips: CHIP('pending', 'Pendentes', 'orange') + CHIP('', 'Todos'), defaultChip: 'pending',
      params: (f) => ({ status: f }),
      head: ['Pedido', 'Utilizador', 'Empresa', 'Contactos', 'Estado', ''],
      row: (r) => `<tr><td>${fmt.datetime(r.created_at)}<br><span class="muted">${r.channel === 'email' ? 'por email' : 'para o admin'} · ${esc(r.ip || '')}</span></td>
        <td class="strong">${esc(r.name)}<br><code>${esc(r.username)}</code> <span class="muted">${esc(App.ROLES[r.role] || '')}</span></td><td>${esc(r.company_name || '—')}</td>
        <td>${esc(r.email || '')}<br>${esc(r.phone || '')}</td><td>${App.badge(r.status)}</td>
        <td class="actions">${r.status === 'pending' ? `<div class="acts"><button class="act green" data-resolve="${r.id}" title="Gerar senha temporária">${icon('key')}</button>
          <button class="act red" data-rcancel="${r.id}" title="Cancelar">${icon('x')}</button></div>` : ''}</td></tr>`,
      export: { title: 'Pedidos de senha', columns: [['Data', r => fmt.datetime(r.created_at)], ['Nome', 'name'], ['Utilizador', 'username'], ['Empresa', 'company_name'], ['Email', 'email'], ['Telefone', 'phone'], ['Estado', r => st(r.status)]] }
    },
    audit: {
      title: 'Auditoria', hint: 'Quem fez o quê e quando.', url: '/api/admin/audit', cols: 6,
      toolbar: '<input type="search" id="fq" placeholder="Utilizador, ação ou recurso…"><select id="fcompany"></select><input type="date" id="ffrom"><input type="date" id="fto">',
      params: () => ({ q: val('fq'), company: val('fcompany'), from: val('ffrom'), to: val('fto') }),
      head: ['Data', 'Utilizador', 'Ação', 'Recurso', 'Empresa', 'IP'],
      row: (a) => `<tr><td>${fmt.datetime(a.created_at)}</td><td>${esc(a.username || '—')}</td><td><code>${esc(a.action)}</code></td>
        <td>${esc(a.resource || '')}${a.payload ? `<br><span class="muted">${esc(String(a.payload).slice(0, 80))}</span>` : ''}</td><td>${esc(a.company_name || '—')}</td><td>${esc(a.ip || '')}</td></tr>`,
      export: { title: 'Auditoria', columns: [['Data', r => fmt.datetime(r.created_at)], ['Utilizador', 'username'], ['Ação', 'action'], ['Recurso', 'resource'], ['Detalhe', 'payload'], ['Empresa', 'company_name'], ['IP', 'ip']] }
    }
  };
  const val = (id) => { const el = $(id); return el ? (el.type === 'checkbox' ? el.checked : el.value.trim()) : ''; };
  let current = null, chip = '', pl = null;

  function openList(key) {
    const L = LISTS[key];
    current = key; chip = L.defaultChip || '';
    $('lTitle').textContent = L.title; $('lHint').textContent = L.hint || '';
    $('lExtra').innerHTML = L.extra || '';
    $('lToolbar').innerHTML = (L.toolbar || '') + (L.toolbar ? '<button class="btn-secondary" id="fclear">Limpar</button>' : '');
    $('lToolbar').style.display = L.toolbar ? '' : 'none';
    if ($('fcompany')) $('fcompany').innerHTML = companyOptions('');
    if ($('fmethod')) $('fmethod').innerHTML = '<option value="">Todos os métodos</option>' + Object.entries(App.METHODS).map(([k, v]) => `<option value="${k}">${esc(v)}</option>`).join('');
    $('lChips').innerHTML = L.chips || '';
    $('lChips').querySelectorAll('.chip').forEach(c => c.classList.toggle('active', c.dataset.f === chip));
    $('lHead').innerHTML = `<tr>${L.head.map(h => `<th>${esc(h)}</th>`).join('')}</tr>`;
    $('lStats').innerHTML = '';
    $('lPager').innerHTML = '';
    if (L.noPager) {
      pl = { load: async () => {
        const r = await api.get(L.url + App.query(L.params(chip)));
        $('lRows').innerHTML = r.success ? ((r.items || []).map(L.row).join('') || `<tr><td colspan="${L.cols}" class="empty-state">Sem registos.</td></tr>`)
          : `<tr><td colspan="${L.cols}" class="empty-state">${esc(r.error)}</td></tr>`;
      } };
      pl.reload = pl.load;
    } else {
      pl = App.pagedList({ url: L.url, params: () => L.params(chip), tbody: 'lRows', pager: 'lPager', cols: L.cols, row: L.row,
        onData: (r) => { if (L.stats && r.stats) $('lStats').innerHTML = L.stats(r.stats); } });
    }
    $('lToolbar').querySelectorAll('input[type=search]').forEach(i => i.addEventListener('input', App.debounce(() => pl.load(1), 350)));
    $('lToolbar').querySelectorAll('select, input[type=date], input[type=number]').forEach(i => i.addEventListener('change', () => pl.load(1)));
    if ($('fclear')) $('fclear').onclick = () => { $('lToolbar').querySelectorAll('input, select').forEach(i => i.value = ''); pl.load(1); };
    if ($('btnNewCompany')) $('btnNewCompany').onclick = () => companyForm(null);
    pl.load(1);
  }
  $('lChips').addEventListener('click', (e) => {
    const c = e.target.closest('.chip'); if (!c) return;
    chip = c.dataset.f; $('lChips').querySelectorAll('.chip').forEach(x => x.classList.toggle('active', x === c)); pl.load(1);
  });
  function exportCurrent(mode) {
    const L = LISTS[current];
    const filters = [...$('lToolbar').querySelectorAll('input, select')].filter(i => i.value).map(i => i.tagName === 'SELECT' ? i.selectedOptions[0].textContent : i.value);
    const ch = $('lChips').querySelector('.chip.active');
    if (ch && ch.dataset.f) filters.push(ch.textContent);
    App.exportList({ url: L.url, params: L.params(chip), title: L.export.title, columns: L.export.columns, totals: L.export.totals, landscape: true,
      filters: filters.join(' · ') || 'Todos', pick: (r) => r.items || [] }, mode);
  }
  $('lPrint').addEventListener('click', () => exportCurrent('print'));
  $('lCsv').addEventListener('click', () => exportCurrent('csv'));

  // ---------- ações nas listas ----------
  $('lRows').addEventListener('click', async (e) => {
    const t = e.target.closest('[data-company],[data-cstatus],[data-cedit],[data-creset],[data-cplan],[data-uedit],[data-ureset],[data-hist],[data-resolve],[data-rcancel]');
    if (!t) return;
    e.preventDefault();
    const d = t.dataset;
    if (d.company) companyDetail(d.company);
    else if (d.cstatus) {
      const labels = { active: 'Aprovar / reativar a empresa?', suspended: 'Suspender a empresa?', rejected: 'Rejeitar o registo?' };
      const reason = d.to === 'active' ? await App.ask(labels[d.to], { text: 'O gestor e os utilizadores da empresa passam a poder entrar.' })
        : await App.ask(labels[d.to], { input: 'Motivo', danger: true, confirm: d.to === 'rejected' ? 'Rejeitar' : 'Suspender', text: 'Os utilizadores da empresa deixam de poder entrar (em menos de 1 minuto).' });
      if (!reason) return;
      const r = await api.post(`/api/admin/companies/${d.cstatus}/status/${d.to}`, typeof reason === 'string' ? { reason } : {});
      r.success ? (toast(r.message, 'success'), pl.reload()) : toast(r.error, 'error');
    } else if (d.cplan) planForm(d.cplan, d.plan, d.n);
    else if (d.cedit) companyForm(d.cedit);
    else if (d.creset) {
      if (!await App.ask('Gerar nova senha temporária para o gestor?')) return;
      const r = await api.post(`/api/admin/companies/${d.creset}/reset-manager`);
      r.success ? App.showCredentials('Gestor de ' + r.company, r.username, r.temp_password) : toast(r.error, 'error');
    } else if (d.uedit) userForm(d.uedit);
    else if (d.ureset) {
      if (!await App.ask('Gerar nova senha temporária?', { text: 'A senha atual deixa de funcionar.' })) return;
      const r = await api.post(`/api/admin/users/${d.ureset}/reset-password`);
      r.success ? (App.showCredentials(r.name, r.username, r.temp_password), pl.reload()) : toast(r.error, 'error');
    } else if (d.hist) history_(d.hist);
    else if (d.resolve) {
      const r = await api.post(`/api/admin/password-resets/${d.resolve}/resolve`);
      r.success ? (App.showCredentials('Nova senha de ' + r.name, r.username, r.temp_password, r.phone ? 'Contacto: ' + r.phone : ''), pl.reload()) : toast(r.error, 'error');
    } else if (d.rcancel) {
      if (!await App.ask('Cancelar o pedido?')) return;
      const r = await api.post(`/api/admin/password-resets/${d.rcancel}/cancel`);
      r.success ? pl.reload() : toast(r.error, 'error');
    }
  });
  $('dDebtors').addEventListener('click', (e) => { const t = e.target.closest('[data-hist]'); if (t) { e.preventDefault(); history_(t.dataset.hist); } });

  // ---------- empresa: detalhe / formulário ----------
  async function companyDetail(id) {
    const r = await api.get('/api/admin/companies/' + id);
    if (!r.success) { toast(r.error, 'error'); return; }
    const c = r.company, k = c.kpis || {};
    $('mTitle').innerHTML = `${esc(c.name)} <span class="muted">${esc(c.code)}</span> ${App.badge(c.status)}`;
    $('mBody').innerHTML = `<div style="display:flex;gap:16px;align-items:center;margin-bottom:14px">${c.logo ? `<div class="logo-box"><img src="${esc(c.logo)}" alt=""></div>` : ''}
      <div class="dl" style="flex:1;margin:0"><div><small>NUIT</small><span>${esc(c.nuit || '—')}</span></div><div><small>Contactos</small><span>${esc([c.phone, c.email].filter(Boolean).join(' · ') || '—')}</span></div>
      <div><small>Localização</small><span>${esc([c.address, c.city, c.province].filter(Boolean).join(', ') || '—')}</span></div><div><small>Registo</small><span>${c.self_registered ? 'Feito no login' : 'Criada pelo admin'}</span></div></div></div>
      <div class="stats-grid"><div class="stat-card top"><div class="stat-label">Recebido no mês</div><h3>${fmt.moneyHtml(k.collected)}</h3></div>
        <div class="stat-card top blue"><div class="stat-label">Faturado no mês</div><h3>${fmt.moneyHtml(k.billed)}</h3></div>
        <div class="stat-card top red"><div class="stat-label">Em dívida</div><h3>${fmt.moneyHtml(k.debt)}</h3></div>
        <div class="stat-card top orange"><div class="stat-label">Clientes</div><h3>${fmt.num(k.customers)}</h3><div class="stat-sub">${fmt.num(k.accounts)} contas</div></div></div>
      <div class="alert info"><span>Plano <span class="plan-tag ${esc(c.plan)}">${esc(c.plan_label || App.PLANS[c.plan])}</span> · ${esc(App.PLAN_INFO[c.plan] || '')}</span>
        <button class="btn-primary" data-cplan-detail="${c.id}">${icon('star')} Mudar plano</button></div>
      <h2 style="font-size:15px;margin:6px 0 8px">Gestores da empresa</h2>
      <div class="table-wrap"><table class="table"><thead><tr><th>Nome</th><th>Utilizador</th><th>Perfil</th><th>Email</th><th>Estado</th></tr></thead><tbody>
      ${(c.users || []).filter(u => u.role !== 'customer').map(u => `<tr><td>${esc(u.name)}</td><td><code>${esc(u.username)}</code></td><td>${esc(App.ROLES[u.role])}</td><td>${esc(u.email || '—')}</td><td>${App.badge(u.status)}</td></tr>`).join('')}</tbody></table></div>`;
    const pb = $('mBody').querySelector('[data-cplan-detail]');
    if (pb) pb.onclick = () => planForm(c.id, c.plan, c.name);
    modal.open('mDetail');
  }
  let editingCompany = null;
  async function companyForm(id) {
    editingCompany = id;
    const f = $('cForm'); f.reset();
    $('cManager').style.display = id ? 'none' : '';
    $('cPlan').style.display = id ? 'none' : '';
    $('cTitle').textContent = id ? 'Editar empresa' : 'Nova empresa';
    if (id) { const r = await api.get('/api/admin/companies/' + id); if (r.success) App.fillForm(f, r.company); }
    modal.open('mCompany');
  }
  $('cForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const d = {}; e.target.querySelectorAll('[name]').forEach(i => d[i.name] = i.value.trim() || null);
    if (editingCompany) delete d.plan;
    const r = editingCompany ? await api.put('/api/admin/companies/' + editingCompany, d) : await api.post('/api/admin/companies', d);
    if (!r.success) { toast(r.error, 'error'); return; }
    modal.close('mCompany'); pl && pl.reload();
    if (!editingCompany) App.showCredentials('Gestor de ' + r.name, r.username, r.temp_password, 'Código da empresa: ' + r.code);
    else toast(r.message, 'success');
  });

  // ---------- plano ----------
  let planCompany = null;
  function planForm(id, plan, name) {
    planCompany = id;
    const f = $('pForm'); f.reset();
    App.fillForm(f, { plan: plan || 'basic', reason: '' });
    $('pTitle').textContent = 'Plano de ' + (name || 'empresa');
    modal.open('mPlan');
  }
  $('pForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const d = App.formData(e.target);
    const r = await api.post(`/api/admin/companies/${planCompany}/plan`, { plan: d.plan, reason: d.reason });
    if (!r.success) { toast(r.error, 'error'); return; }
    modal.close('mPlan'); toast(r.message, 'success');
    if ($('mDetail').classList.contains('show')) companyDetail(planCompany);
    pl && pl.reload();
  });

  // ---------- utilizador ----------
  let editingUser = null;
  async function userForm(id) {
    editingUser = id;
    const rows = (pl && pl.data && pl.data.items) || [];
    const u = rows.find(x => String(x.id) === String(id));
    App.fillForm($('uForm'), u);
    $('uTitle').textContent = u ? `${u.name} (${u.username})` : 'Utilizador';
    modal.open('mUser');
  }
  $('uForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const d = {}; e.target.querySelectorAll('[name]').forEach(i => d[i.name] = i.value.trim());
    const r = await api.put('/api/admin/users/' + editingUser, d);
    if (!r.success) { toast(r.error, 'error'); return; }
    modal.close('mUser'); toast(r.message, 'success'); pl.reload();
  });

  // ---------- histórico de pagamentos de um cliente ----------
  async function history_(id) {
    const r = await api.get(`/api/admin/customers/${id}/history`);
    if (!r.success) { toast(r.error, 'error'); return; }
    const c = r.customer || {};
    const payCols = [['Recibo', 'receipt_number'], ['Data', x => fmt.datetime(x.paid_at)], ['Método', x => App.METHODS[x.method] || x.method], ['Referência', 'reference'],
      ['Faturas', 'invoices'], ['Operador', 'cashier'], ['Estado', x => st(x.status)], ['Valor', x => fmt.amount(x.amount), 'n']];
    const invCols = [['Fatura', 'number'], ['Conta', 'account_number'], ['Mês', x => fmt.period(x.period)], ['Leituras', x => x.kind === 'manual' ? x.description : `${x.previous_value} → ${x.current_value}`],
      ['Total', x => fmt.amount(x.total), 'n'], ['Pago', x => fmt.amount(x.paid), 'n'], ['Saldo', x => fmt.amount(x.balance), 'n'], ['Estado', x => st(x.status)]];
    $('mTitle').innerHTML = `${esc(c.name)} <span class="muted">${esc(c.code)} · ${esc(r.company_name)}</span>`;
    $('mBody').innerHTML = `<div class="stats-grid"><div class="stat-card top"><div class="stat-label">Total pago</div><h3>${fmt.moneyHtml(c.total_paid)}</h3></div>
      <div class="stat-card top red"><div class="stat-label">Em dívida</div><h3>${fmt.moneyHtml(c.debt)}</h3></div>
      <div class="stat-card top blue"><div class="stat-label">Contas</div><h3>${(r.accounts || []).length}</h3></div></div>
      <div class="dl"><div><small>Telefone</small><span>${esc(c.phone || '—')}</span></div><div><small>Email</small><span>${esc(c.email || '—')}</span></div>
        <div><small>Documento</small><span>${esc(c.document || '—')}</span></div><div><small>Plano da empresa</small><span>${esc(App.PLANS[r.company_plan] || '—')}</span></div></div>
      <div class="panel-header" style="margin-bottom:8px"><h2 style="font-size:15px">Histórico de pagamentos</h2><button class="btn-secondary" id="hPrint">${icon('print')} Imprimir histórico</button></div>
      <div class="table-wrap">${App.tableHtml(payCols, r.payments || []).replace('class="t"', 'class="table"')}</div>
      <h2 style="font-size:15px;margin:16px 0 8px">Faturas</h2><div class="table-wrap">${App.tableHtml(invCols, r.invoices || []).replace('class="t"', 'class="table"')}</div>`;
    $('hPrint').onclick = () => App.printHtml('Histórico de pagamentos', `<p><b>${esc(c.name)}</b> (${esc(c.code)}) · ${esc(r.company_name)} · Tel. ${esc(c.phone || '—')}</p>
      <p>Total pago: <b>${fmt.money(c.total_paid)}</b> · Em dívida: <b>${fmt.money(c.debt)}</b></p>
      <h2>Pagamentos</h2>${App.tableHtml(payCols, r.payments || [], ['Total', '', '', '', '', '', '', fmt.amount(App.sum((r.payments || []).filter(p => p.status === 'confirmed'), 'amount'))])}
      <h2>Faturas</h2>${App.tableHtml(invCols, r.invoices || [])}`, { landscape: true });
    modal.open('mDetail');
  }

  // ================= RELATÓRIOS =================
  $('rCompany').innerHTML = companyOptions('');
  $('rPeriod').innerHTML = App.monthOptions(24, App.thisPeriod());
  $('rFrom').value = App.today().slice(0, 8) + '01'; $('rTo').value = App.today();
  const REPORTS = [
    ['Pagamentos recebidos', 'cash', () => ({ url: '/api/admin/payments', params: { company: $('rCompany').value, from: $('rFrom').value, to: $('rTo').value, status: 'confirmed' }, ...LISTS.payments.export })],
    ['Clientes que não pagam', 'alert', () => ({ url: '/api/admin/debtors', params: { company: $('rCompany').value }, ...LISTS.debtors.export })],
    ['Clientes e histórico', 'users', () => ({ url: '/api/admin/customers', params: { company: $('rCompany').value }, ...LISTS.customers.export })],
    ['Empresas e uso', 'building', () => ({ url: '/api/admin/companies', params: {}, ...LISTS.companies.export })],
    ['Planos das empresas', 'star', () => ({ url: '/api/admin/companies', params: {}, ...LISTS.plans.export })],
    ['Gestores', 'user', () => ({ url: '/api/admin/users', params: { company: $('rCompany').value }, ...LISTS.users.export, title: 'Gestores' })],
    ['Gestores sem email', 'key', () => ({ url: '/api/admin/users', params: { company: $('rCompany').value, missingEmail: true }, ...LISTS.users.export, title: 'Gestores sem email' })],
    ['Resumo mensal (12 meses)', 'chart', () => ({ url: '/api/admin/dashboard', params: { period: $('rPeriod').value, company: $('rCompany').value }, title: 'Resumo mensal', pick: (r) => r.monthly || [],
      columns: [['Mês', x => fmt.period(x.period)], ['Faturado', x => fmt.amount(x.billed), 'n'], ['Recebido', x => fmt.amount(x.collected), 'n'], ['Acessos', 'logins', 'n'], ['Novos clientes', 'customers', 'n']] })],
    ['Auditoria', 'shield', () => ({ url: '/api/admin/audit', params: { company: $('rCompany').value, from: $('rFrom').value, to: $('rTo').value }, ...LISTS.audit.export })]
  ];
  $('rList').innerHTML = REPORTS.map((r, i) => `<div class="shortcut">${icon(r[1])}<div style="margin-bottom:10px">${esc(r[0])}</div>
    <div style="display:flex;gap:6px;justify-content:center"><button class="btn-secondary" data-rp="${i}" data-m="print">Imprimir</button><button class="btn-secondary" data-rp="${i}" data-m="csv">CSV</button></div></div>`).join('');
  $('rList').addEventListener('click', (e) => {
    const b = e.target.closest('[data-rp]'); if (!b) return;
    const cfg = REPORTS[Number(b.dataset.rp)][2]();
    const comp = $('rCompany').value ? $('rCompany').selectedOptions[0].textContent : 'Todas as empresas';
    cfg.filters = `${comp} · ${fmt.date($('rFrom').value)} a ${fmt.date($('rTo').value)}`;
    cfg.landscape = true;
    App.exportList(cfg, b.dataset.m);
  });

  // ================= NAVEGAÇÃO (#secção) =================
  const TITLES = { dashboard: 'Painel', companies: 'Empresas', plans: 'Planos', users: 'Gestores', customers: 'Clientes', payments: 'Pagamentos', debtors: 'Devedores', reports: 'Relatórios', resets: 'Recuperar senhas', audit: 'Auditoria' };
  function route() {
    let key = (location.hash || '#dashboard').slice(1);
    if (!TITLES[key]) key = 'dashboard';
    document.querySelectorAll('.adm').forEach(s => s.style.display = 'none');
    App.setTitle(TITLES[key]);
    document.querySelectorAll('.sidebar .menu-item').forEach(a => a.classList.toggle('active', a.getAttribute('href') === '/admin#' + key));
    if (key === 'dashboard') { $('s-dashboard').style.display = ''; loadDashboard(); }
    else if (key === 'reports') $('s-reports').style.display = '';
    else { $('s-list').style.display = ''; openList(key); }
    const goto = sessionStorage.getItem('agua.goto');
    if (goto) {
      sessionStorage.removeItem('agua.goto');
      const c = $('lChips').querySelector(`.chip[data-f="${goto}"]`); if (c) c.click();
    }
  }
  document.addEventListener('click', (e) => { const g = e.target.closest('[data-goto]'); if (g) sessionStorage.setItem('agua.goto', g.dataset.goto); });
  window.addEventListener('hashchange', route);
  route();
})();
