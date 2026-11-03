/* ============================================================
   Modo leitura do mediador — funciona com e sem internet.
   1. "Atualizar lista" descarrega os clientes ativos para o telemóvel.
   2. Cada leitura fica guardada no telemóvel (fila) com um identificador único.
   3. Com internet, a fila é enviada ao servidor; leituras repetidas não duplicam.
   ============================================================ */
(async function () {
  const { api, esc, toast, modal, fmt } = App;
  const user = await App.boot({ title: 'Leituras', roles: ['reader', 'manager'] });
  const $ = (id) => document.getElementById(id);
  const store = window.OfflineStore;
  const period = () => App.thisPeriod();
  let customers = [], queue = [], selected = null, syncing = false;
  let tariff = null;     // regras de preço da empresa: o valor a pagar é calculado mesmo sem internet
  try { tariff = JSON.parse(localStorage.getItem('agua.tariff.' + user.company_id) || 'null'); } catch (_) { /* */ }

  // ---------------- dados locais ----------------
  async function loadLocal() {
    const cache = await store.getCustomers();
    if (cache && cache.companyId && cache.companyId !== user.company_id) {
      await store.clearAll();                      // outro utilizador/empresa neste telemóvel
      customers = [];
    } else {
      customers = cache ? cache.rows : [];
    }
    $('cacheInfo').textContent = cache ? `${customers.length} contas · lista de ${fmt.datetime(cache.at)}` : 'Lista de clientes ainda não descarregada';
    queue = (await store.queueAll()).sort((a, b) => String(b.read_at).localeCompare(String(a.read_at)));
    renderQueue();
    render();
  }

  async function download(silent) {
    const r = await api.get('/api/reader/bundle');
    if (!r.success) { if (!silent) toast(r.offline ? 'Sem internet: a usar a lista guardada.' : r.error, 'error'); return; }
    const rows = (r.accounts || []).map(a => Object.assign({}, a, { id: a.account_id, name: a.customer_name, code: a.customer_code,
      invoices: String(a.invoice_numbers || '').split(',').map(x => x.trim()).filter(Boolean) }));
    await store.saveCustomers(user.company_id, rows);
    if (r.tariff) { tariff = r.tariff; try { localStorage.setItem('agua.tariff.' + user.company_id, JSON.stringify(r.tariff)); } catch (_) { /* */ } }
    if (!silent) toast(`${rows.length} contas guardadas no telemóvel.`, 'success');
    await loadLocal();
  }

  // ---------------- pesquisa ----------------
  function readNow(c) {
    return c.read_this_period || queue.some(q => q.account_id === c.id && q.period === period() && q.state !== 'rejected');
  }

  function render() {
    const q = $('q').value.trim().toLowerCase();
    const only = $('onlyMissing').checked;
    let list = customers.filter(c => !only || !readNow(c));
    if (q) {
      list = list.filter(c => (c.name || '').toLowerCase().includes(q) || (c.code || '').toLowerCase().includes(q)
        || (c.phone || '').replace(/\s/g, '').includes(q.replace(/\s/g, '')) || (c.meter_number || '').toLowerCase().includes(q)
        || (c.account_number || '').toLowerCase().includes(q) || (c.neighborhood || '').toLowerCase().includes(q)
        || (c.invoices || []).some(n => n.toLowerCase().includes(q)));
    }
    if (!customers.length) {
      $('list').innerHTML = '<div class="empty-state">Toque em <strong>Atualizar lista</strong> (com internet) para descarregar as contas dos clientes.</div>';
      return;
    }
    $('list').innerHTML = list.slice(0, 80).map(c => `
      <div class="cust-item" data-id="${c.id}">
        <div><div class="name">${esc(c.name)}</div>
          <div class="muted">Conta ${esc(c.account_number)} · Cont. ${esc(c.meter_number || '—')} · ${esc(c.phone || 'sem telefone')}</div>
          <div class="muted">${esc([c.address, c.neighborhood, c.block && 'Q. ' + c.block, c.house_number && 'casa ' + c.house_number, c.landmark].filter(Boolean).join(', '))}</div></div>
        <div style="text-align:right">${readNow(c) ? '<span class="badge green">Lido</span>' : '<span class="badge orange">Por ler</span>'}
          <div class="muted">Ant.: ${fmt.num(c.last_value)}</div></div>
      </div>`).join('') || '<div class="empty-state">Nenhuma conta encontrada.</div>';
  }

  // ---------------- registar leitura ----------------
  function open(c) {
    selected = c;
    $('rName').textContent = c.name;
    $('rCode').textContent = c.code + ' · conta ' + c.account_number;
    $('rMeter').textContent = c.meter_number;
    $('rLast').textContent = fmt.num(c.last_value);
    $('rCons').textContent = '—';
    $('rLastWhen').textContent = c.last_period ? fmt.period(c.last_period) : 'leitura inicial';
    $('rPay').style.display = Number(c.debt) ? '' : 'none';
    $('rPay').className = 'pay-box';
    $('rPay').innerHTML = Number(c.debt) ? `<div class="row"><span>Dívida anterior</span><b>${fmt.money(c.debt)}</b></div>` : '';
    $('rValue').value = ''; $('rNotes').value = ''; $('rWarn').textContent = readNow(c) ? 'Atenção: esta conta já tem leitura este mês.' : '';
    modal.open('readModal');
    setTimeout(() => $('rValue').focus(), 150);
  }

  $('rValue').addEventListener('input', () => {
    const v = Number($('rValue').value);
    if ($('rValue').value === '') { $('rCons').textContent = '—'; return; }
    const cons = v - Number(selected.last_value || 0);
    $('rCons').textContent = cons + ' m³';
    $('rCons').style.color = cons < 0 ? 'var(--danger)' : '';
    $('rWarn').textContent = cons < 0 ? 'A leitura é menor que a anterior. Confirme o valor.' : '';
    const box = $('rPay');
    if (cons < 0) { box.style.display = 'none'; return; }
    const p = App.tariffPrice(tariff, cons, selected.category);
    const debt = Number(selected.debt || 0);
    if (!p) { box.style.display = 'none'; return; }
    box.style.display = '';
    box.className = 'pay-box' + (tariff.consumption_alert && cons > Number(tariff.consumption_alert) ? ' warn' : '');
    box.innerHTML = `<div class="row"><span>Água (${cons} m³)</span><b>${fmt.money(p.water)}</b></div>
      ${p.sewer ? `<div class="row"><span>Saneamento</span><b>${fmt.money(p.sewer)}</b></div>` : ''}${p.fixed ? `<div class="row"><span>Taxa fixa</span><b>${fmt.money(p.fixed)}</b></div>` : ''}
      <div class="big"><span>Valor a pagar</span><b>${fmt.money(p.total)}</b></div>
      ${debt ? `<div class="row"><span>Dívida anterior</span><b>${fmt.money(debt)}</b></div><div class="row"><span><b>Total em dívida</b></span><b style="color:var(--danger)">${fmt.money(debt + p.total)}</b></div>` : ''}
      <div class="muted">Valor estimado; a fatura oficial é emitida pelo escritório.</div>`;
  });

  $('readForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const v = Number($('rValue').value);
    if (!Number.isInteger(v) || v < 0) return toast('Leitura inválida.', 'error');
    if (v < Number(selected.last_value || 0)) return toast('A leitura não pode ser menor que a anterior.', 'error');
    const item = {
      client_uuid: store.uuid(), account_id: selected.id, customer_id: selected.customer_id, current_value: v, account_number: selected.account_number,
      notes: $('rNotes').value || null, read_at: new Date().toISOString(), period: period(),
      customer_name: selected.name, customer_code: selected.code, previous: selected.last_value, state: 'pending'
    };
    await store.enqueue(item);
    selected.last_value = v; selected.read_this_period = true;    // atualiza a lista local
    modal.close('readModal');
    toast('Leitura guardada no telemóvel.', 'success');
    await loadLocal();
    sync(true);
  });

  // ---------------- sincronização ----------------
  async function sync(silent) {
    if (syncing) return;
    const pending = (await store.queueAll()).filter(q => q.state !== 'rejected');
    if (!pending.length) { if (!silent) toast('Nada por enviar.'); return; }
    if (!navigator.onLine) { if (!silent) toast('Sem internet. As leituras ficam guardadas e serão enviadas depois.'); return; }
    syncing = true; $('btnSync').disabled = true;
    const r = await api.post('/api/readings/sync', {
      items: pending.map(q => ({ client_uuid: q.client_uuid, account_id: q.account_id,
        current_value: q.current_value, notes: q.notes, read_at: q.read_at, period: q.period }))
    });
    syncing = false; $('btnSync').disabled = false;
    if (!r.success) {
      if (!silent) toast(r.status === 401 ? 'Sessão expirada: entre novamente para enviar (as leituras estão guardadas).' : r.error, 'error');
      return;
    }
    let ok = 0, bad = 0;
    for (const res of r.results) {
      const item = pending.find(q => q.client_uuid === res.client_uuid);
      if (!item) continue;
      if (res.ok) { await store.remove(item.client_uuid); ok++; }
      else { item.state = 'rejected'; item.error = res.error; await store.enqueue(item); bad++; }
    }
    toast(`${ok} leitura(s) enviadas${bad ? ` · ${bad} rejeitada(s), veja o motivo` : ''}.`, bad ? 'error' : 'success');
    await loadLocal();
  }

  function renderQueue() {
    const pending = queue.filter(q => q.state !== 'rejected').length;
    $('queueInfo').textContent = pending ? `${pending} leitura(s) por enviar` : 'Tudo enviado ✓';
    $('queueList').innerHTML = queue.length ? queue.map(q => `
      <div class="cust-item" style="cursor:default">
        <div><div class="name">${esc(q.customer_name)}</div>
          <div class="muted">Conta ${esc(q.account_number || '')} · ${fmt.datetime(q.read_at)} · ${fmt.num(q.previous)} → <strong>${fmt.num(q.current_value)}</strong></div>
          ${q.state === 'rejected' ? `<div style="color:var(--danger);font-size:12.5px;margin-top:4px">${esc(q.error)}</div>` : ''}</div>
        <div>${q.state === 'rejected' ? `<span class="badge red">Rejeitada</span><br><button class="btn-icon" data-drop="${q.client_uuid}" style="margin-top:6px">Apagar</button>`
          : '<span class="badge orange">Por enviar</span>'}</div>
      </div>`).join('') : '<p class="muted">Sem leituras pendentes neste telemóvel.</p>';
  }

  $('queueList').addEventListener('click', async (e) => {
    const d = e.target.closest('[data-drop]');
    if (d && await App.ask('Apagar esta leitura rejeitada?', { text: 'Pode registá-la novamente.', danger: true, confirm: 'Apagar' })) { await store.remove(d.dataset.drop); loadLocal(); }
  });
  $('list').addEventListener('click', (e) => { const it = e.target.closest('[data-id]'); if (it) open(customers.find(c => String(c.id) === it.dataset.id)); });
  $('q').addEventListener('input', App.debounce(render, 150));
  $('onlyMissing').addEventListener('change', render);
  $('btnSync').addEventListener('click', () => sync(false));
  $('btnDownload').addEventListener('click', () => download(false));
  window.addEventListener('online', () => sync(true));
  setInterval(() => sync(true), 60000);

  await loadLocal();
  if (!customers.length && navigator.onLine) await download(true);
  else if (navigator.onLine) download(true);
  sync(true);
})();
