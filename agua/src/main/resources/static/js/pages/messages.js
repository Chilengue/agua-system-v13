/* Mensagens WhatsApp / SMS (planos Standard e Enterprise): histórico, mensagens por abrir, envio a devedores ou a clientes escolhidos. */
(async function () {
  const { api, fmt, esc, icon, toast, modal } = App;
  await App.boot({ title: 'Mensagens', roles: ['manager'], feature: 'messages' });
  const $ = (id) => document.getElementById(id);
  const F = App.features;
  let filter = '', picked = new Map();
  const KINDS = { invoice: 'Fatura', payment: 'Recibo', reminder: 'Lembrete', custom: 'Mensagem' };
  const ch = (c) => `<span class="ch-badge ${c}">${icon(c === 'sms' ? 'sms' : 'whatsapp')} ${c === 'sms' ? 'SMS' : 'WhatsApp'}</span>`;

  $('smsHint').textContent = F.sms ? ' e SMS' : '';
  if (!F.sms) $('channel').querySelector('option[value=sms]').remove();
  $('sChannel').innerHTML = '<option value="whatsapp">WhatsApp</option>' + (F.sms ? '<option value="sms">SMS</option>' : '');

  const st = await api.get('/api/settings');
  if (st.success) {
    const m = st.messaging || {};
    const parts = [];
    if (!m.whatsapp_api_ready) parts.push('WhatsApp: as mensagens <b>abrem no seu WhatsApp</b> com o texto pronto (sem custos). Para envio automático configure a API em <a href="/settings#messages">Empresa e recibo → Mensagens</a>.');
    if (F.sms && !m.sms_api_ready) parts.push('SMS: abrem na aplicação de SMS do telemóvel até configurar o gateway.');
    if (parts.length) { $('modeInfo').innerHTML = `<span>${parts.join('<br>')}</span>`; $('modeInfo').style.display = ''; }
  }

  const params = () => ({ q: $('q').value.trim(), channel: $('channel').value, kind: $('kind').value, from: $('from').value, to: $('to').value, status: filter });
  const list = App.pagedList({
    url: '/api/messages', params, tbody: 'rows', pager: 'pager', cols: 6, empty: 'Ainda sem mensagens.',
    row: (m) => `<tr>
      <td><span class="strong">${esc(m.customer_name || '—')}</span><br><span class="muted msg-phone">${esc(m.to_phone)}</span> <span class="pill">${esc(KINDS[m.kind] || m.kind)}</span></td>
      <td>${ch(m.channel)}</td>
      <td class="hide-sm"><div class="msg-body">${esc(m.body)}</div>${m.error ? `<div class="muted" style="color:var(--danger)">${esc(m.error)}</div>` : ''}</td>
      <td class="hide-sm">${fmt.datetime(m.created_at)}${m.sent_at ? `<br><span class="muted">enviada ${fmt.datetime(m.sent_at)}</span>` : ''}<br><span class="muted">${esc(m.user_name || 'automática')}</span></td>
      <td>${App.badge(m.status)}</td>
      <td class="actions"><div class="acts">
        ${m.status === 'manual' || m.status === 'failed' ? `<button class="act green" data-open="${m.id}" title="Abrir no ${m.channel === 'sms' ? 'SMS' : 'WhatsApp'}">${icon('send')}</button>` : ''}
        ${m.status === 'failed' || m.status === 'cancelled' ? `<button class="act blue" data-retry="${m.id}" title="Tentar de novo">${icon('sync')}</button>` : ''}
        ${m.status !== 'sent' && m.status !== 'cancelled' ? `<button class="act red" data-cancel="${m.id}" title="Cancelar">${icon('x')}</button>` : ''}
      </div></td></tr>`,
    onData: (r) => {
      const s = r.stats || {};
      $('stats').innerHTML = `
        <div class="stat-card top"><div class="stat-label">Enviadas</div><h3>${fmt.num(s.sent)}</h3><div class="stat-sub">${fmt.num(s.whatsapp)} WhatsApp${F.sms ? ' · ' + fmt.num(s.sms) + ' SMS' : ''}</div></div>
        <div class="stat-card top orange"><div class="stat-label">Por abrir</div><h3>${fmt.num(s.manual)}</h3><div class="stat-sub"><a href="#" id="openAll">Abrir uma a uma</a></div></div>
        <div class="stat-card top blue"><div class="stat-label">Na fila</div><h3>${fmt.num(s.queued)}</h3><div class="stat-sub">envio automático</div></div>
        <div class="stat-card top red"><div class="stat-label">Com falha</div><h3>${fmt.num(s.failed)}</h3><div class="stat-sub">tente de novo</div></div>`;
      const oa = $('openAll'); if (oa) oa.onclick = (e) => { e.preventDefault(); openQueue(); };
    }
  });
  $('rows').addEventListener('click', async (e) => {
    const o = e.target.closest('[data-open]'), rt = e.target.closest('[data-retry]'), cn = e.target.closest('[data-cancel]');
    const items = (list.data && list.data.items) || [];
    if (o) {
      const m = items.find(x => String(x.id) === o.dataset.open);
      window.open(linkOf(m), '_blank', 'noopener');
      await api.post(`/api/messages/${m.id}/opened`); list.reload();
    }
    if (rt) { const r = await api.post(`/api/messages/${rt.dataset.retry}/retry`); r.success ? (await App.deliverMessage(r.message), list.reload()) : toast(r.error, 'error'); }
    if (cn) { const r = await api.post(`/api/messages/${cn.dataset.cancel}/cancel`); r.success ? list.reload() : toast(r.error, 'error'); }
  });
  function linkOf(m) {
    let d = String(m.to_phone || '').replace(/\D/g, '');
    if (d.startsWith('00')) d = d.slice(2);
    if (d.length === 9 && d[0] === '8') d = '258' + d;
    const t = encodeURIComponent(m.body || '');
    return m.channel === 'sms' ? `sms:+${d}?body=${t}` : `https://wa.me/${d}?text=${t}`;
  }
  ['channel', 'kind', 'from', 'to'].forEach(id => $(id).addEventListener('change', () => list.load(1)));
  $('q').addEventListener('input', App.debounce(() => list.load(1), 350));
  $('btnClear').addEventListener('click', () => { ['q', 'channel', 'kind', 'from', 'to'].forEach(id => $(id).value = ''); setChip(''); });
  $('chips').addEventListener('click', (e) => { const c = e.target.closest('.chip'); if (c) setChip(c.dataset.f); });
  function setChip(f) { filter = f; document.querySelectorAll('#chips .chip').forEach(c => c.classList.toggle('active', c.dataset.f === f)); list.load(1); }
  $('btnPrint').addEventListener('click', () => App.exportList({
    url: '/api/messages', params: params(), title: 'Mensagens enviadas', landscape: true,
    filters: [$('channel').value, $('kind').value && KINDS[$('kind').value], filter && (App.STATUS[filter] || [filter])[0], $('from').value && 'De ' + fmt.date($('from').value), $('to').value && 'a ' + fmt.date($('to').value)].filter(Boolean).join(' · ') || 'Todas',
    columns: [['Data', r => fmt.datetime(r.created_at)], ['Cliente', 'customer_name'], ['Telefone', 'to_phone'], ['Canal', r => r.channel === 'sms' ? 'SMS' : 'WhatsApp'],
      ['Tipo', r => KINDS[r.kind] || r.kind], ['Mensagem', 'body'], ['Estado', r => (App.STATUS[r.status] || [r.status])[0]]]
  }, 'print'));

  // ---------- mensagens por abrir (uma a uma) ----------
  async function openQueue(items) {
    let rows = items;
    if (!rows) { const r = await api.get('/api/messages?status=manual&size=200'); rows = r.items || []; }
    $('openRows').innerHTML = rows.map(m => `<tr data-row="${m.id}"><td class="strong">${esc(m.customer_name || '—')}</td><td class="msg-phone">${esc(m.to_phone)}</td>
      <td class="hide-sm"><div class="msg-body">${esc(m.body)}</div></td>
      <td class="actions"><button class="btn-primary" data-go="${m.id}">${icon('send')} Abrir</button></td></tr>`).join('') || '<tr><td colspan="4" class="empty-state">Nada por abrir.</td></tr>';
    $('openRows').onclick = async (e) => {
      const b = e.target.closest('[data-go]'); if (!b) return;
      const m = rows.find(x => String(x.id) === b.dataset.go);
      window.open(m.link || linkOf(m), '_blank', 'noopener');
      await api.post(`/api/messages/${m.id}/opened`);
      b.closest('tr').style.opacity = .45; b.textContent = 'Aberta ✓'; b.className = 'btn-secondary';
    };
    modal.open('openModal');
  }
  document.querySelector('#openModal [data-close]').addEventListener('click', () => list.reload());

  // ---------- enviar ----------
  const VARS = ['cliente', 'nome', 'codigo', 'divida', 'faturas', 'empresa', 'telefone_empresa', 'como_pagar'];
  $('sVars').innerHTML = VARS.map(v => `<code data-v="${v}">{${v}}</code>`).join('');
  $('sVars').addEventListener('click', (e) => {
    const c = e.target.closest('[data-v]'); if (!c) return;
    const ta = $('sText'), pos = ta.selectionStart || ta.value.length;
    ta.value = ta.value.slice(0, pos) + '{' + c.dataset.v + '}' + ta.value.slice(pos); ta.focus();
  });
  $('btnNew').addEventListener('click', () => { $('sendForm').reset(); picked.clear(); renderPicked(); $('pickBox').style.display = 'none'; $('minField').style.display = ''; modal.open('sendModal'); });
  $('sTarget').addEventListener('change', () => {
    const pick = $('sTarget').value === 'pick';
    $('pickBox').style.display = pick ? '' : 'none';
    $('minField').style.display = pick || $('sTarget').value === 'all' ? 'none' : '';
  });
  $('pickQ').addEventListener('input', App.debounce(async () => {
    const q = $('pickQ').value.trim();
    if (q.length < 2) { $('pickResults').innerHTML = ''; return; }
    const r = await api.get('/api/customers?size=15&status=active&q=' + encodeURIComponent(q));
    $('pickResults').innerHTML = (r.items || []).map(c => `<div class="cust-item" data-pick='${esc(JSON.stringify({ id: c.id, name: c.name }))}'>
      <div><div class="name">${esc(c.name)}</div><div class="muted">${esc(c.code)} · ${esc(c.phone || 'sem telefone')}</div></div><div class="muted">${fmt.money(c.debt)}</div></div>`).join('') || '<div class="muted">Nada encontrado.</div>';
  }, 300));
  $('pickResults').addEventListener('click', (e) => { const it = e.target.closest('[data-pick]'); if (!it) return; const c = JSON.parse(it.dataset.pick); picked.set(c.id, c.name); renderPicked(); });
  $('picked').addEventListener('click', (e) => { const x = e.target.closest('[data-unpick]'); if (x) { picked.delete(Number(x.dataset.unpick)); renderPicked(); } });
  function renderPicked() {
    $('picked').innerHTML = [...picked.entries()].map(([id, n]) => `<button type="button" class="chip active" data-unpick="${id}">${esc(n)} ×</button>`).join('');
  }
  $('sendForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const f = e.target, target = f.target.value;
    const body = { channel: f.channel.value, text: f.text.value.trim() || null };
    if (target === 'pick') {
      if (!picked.size) { toast('Escolha pelo menos um cliente.', 'error'); return; }
      body.customer_ids = [...picked.keys()];
    } else {
      body.debtors_only = target !== 'all';
      body.overdue_only = target === 'overdue';
      body.min_debt = f.min_debt.value ? Number(f.min_debt.value) : null;
      if (target === 'all' && !body.text) { toast('Para todos os clientes escreva a mensagem.', 'error'); return; }
    }
    if (!await App.ask('Enviar as mensagens?', { text: target === 'pick' ? picked.size + ' cliente(s).' : 'Para os clientes do filtro escolhido.' })) return;
    App.busy($('btnSend'), true, 'A preparar…');
    const r = await api.post('/api/messages/bulk', body);
    App.busy($('btnSend'), false);
    if (!r.success) { toast(r.error, 'error'); return; }
    modal.close('sendModal');
    toast(`${r.created} mensagem(ns) criada(s)` + (r.skipped ? `, ${r.skipped} cliente(s) sem telefone.` : '.'), 'success');
    list.reload();
    if (!r.api && (r.manual || []).length) openQueue(r.manual);
  });

  if (App.qs('status')) setChip(App.qs('status')); else list.load(1);
})();
