/* Tarifas: modo "valor mínimo + preço por m³" (ex.: 350 até 5 m³, 70 por m³ acima) ou escalões por categoria; simulador. */
(async function () {
  const { api, fmt, esc, toast } = App;
  await App.boot({ title: 'Tarifas', roles: ['manager'] });
  const $ = (id) => document.getElementById(id);
  const form = $('tariffForm');
  let mode = 'minimum';
  const CAT = Object.entries(App.CATEGORIES).map(([k, v]) => `<option value="${k}">${esc(v)}</option>`).join('');
  const r = await api.get('/api/settings');
  if (!r.success) { toast(r.error, 'error'); return; }
  const s = r.settings;
  mode = s.tariff_mode || 'minimum';
  ['minimum_m3', 'minimum_charge', 'price_per_m3', 'fixed_fee', 'sewer_percent', 'consumption_alert'].forEach(k => form[k].value = s[k] ?? '');
  form.minimum_charge_t.value = s.minimum_charge ?? '';
  (r.tiers || []).forEach(addTier);
  if (!(r.tiers || []).length) addTier({ category: 'residential', from_m3: 0, to_m3: 10, price_m3: '' });
  setMode(mode);

  function setMode(m) {
    mode = m;
    document.querySelectorAll('#modeTabs .tab').forEach(t => t.classList.toggle('active', t.dataset.m === m));
    $('minBox').style.display = m === 'minimum' ? '' : 'none';
    $('tiersBox').style.display = m === 'tiers' ? '' : 'none';
  }
  $('modeTabs').addEventListener('click', (e) => { const t = e.target.closest('.tab'); if (t) setMode(t.dataset.m); });
  function addTier(t) {
    const tr = document.createElement('tr');
    tr.innerHTML = `<td><select class="t-cat">${CAT}</select></td>
      <td class="num"><input type="number" class="t-from" min="0" value="${t.from_m3 ?? ''}" style="width:90px"></td>
      <td class="num"><input type="number" class="t-to" min="0" value="${t.to_m3 ?? ''}" style="width:90px" placeholder="sem limite"></td>
      <td class="num"><input type="number" class="t-price" min="0" step="0.01" value="${t.price_m3 ?? ''}" style="width:110px"></td>
      <td><input type="text" class="t-desc" value="${esc(t.description || '')}"></td>
      <td><button type="button" class="act red" title="Remover">${App.icon('trash')}</button></td>`;
    tr.querySelector('.t-cat').value = t.category || 'residential';
    tr.querySelector('button').addEventListener('click', () => tr.remove());
    $('tiers').appendChild(tr);
  }
  $('btnAddTier').addEventListener('click', () => {
    const rows = [...$('tiers').querySelectorAll('tr')];
    const last = rows[rows.length - 1];
    addTier({ category: last ? last.querySelector('.t-cat').value : 'residential', from_m3: last ? last.querySelector('.t-to').value : 0 });
  });
  const num = (v) => v === '' || v == null ? null : Number(v);
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const body = { tariff_mode: mode, fixed_fee: num(form.fixed_fee.value) ?? 0, sewer_percent: num(form.sewer_percent.value) ?? 0,
      consumption_alert: num(form.consumption_alert.value) };
    if (mode === 'minimum') {
      Object.assign(body, { minimum_m3: num(form.minimum_m3.value) ?? 0, minimum_charge: num(form.minimum_charge.value) ?? 0, price_per_m3: num(form.price_per_m3.value) ?? 0 });
    } else {
      body.minimum_charge = num(form.minimum_charge_t.value) ?? 0;
      const tiers = [...$('tiers').querySelectorAll('tr')].map(tr => ({
        category: tr.querySelector('.t-cat').value, from_m3: num(tr.querySelector('.t-from').value), to_m3: num(tr.querySelector('.t-to').value),
        price_m3: num(tr.querySelector('.t-price').value), description: tr.querySelector('.t-desc').value || null }));
      if (!tiers.length) { toast('Adicione pelo menos um escalão.', 'error'); return; }
      const t = await api.put('/api/settings/tiers', { tiers });
      if (!t.success) { toast(t.error, 'error'); return; }
    }
    const u = await api.put('/api/settings', body);
    if (!u.success) { toast(u.error, 'error'); return; }
    App.refreshBranding();
    toast('Tarifas guardadas.', 'success');
    simulate();
  });
  async function simulate() {
    const res = await api.get('/api/settings/simulate' + App.query({ consumption: $('simC').value || 0, category: $('simCat').value }));
    if (!res.success) { $('simOut').innerHTML = `<div class="alert warning">${esc(res.error)}</div>`; return; }
    const x = res.result;
    $('simOut').innerHTML = `<div class="table-wrap"><table class="table"><thead><tr><th>Faixa</th><th class="num">m³</th><th class="num">Preço</th><th class="num">Valor</th></tr></thead><tbody>
      ${(x.lines || []).map(l => `<tr><td>${l.to == null ? 'Acima de ' + (l.from - 1 < 0 ? 0 : l.from - 1) : l.from + ' – ' + l.to} m³</td><td class="num">${l.units}</td><td class="num">${l.price == null ? 'valor mínimo' : fmt.amount(l.price)}</td><td class="num">${fmt.amount(l.amount)}</td></tr>`).join('')}
      <tr><td colspan="3">Água</td><td class="num">${fmt.money(x.water)}</td></tr>
      ${Number(x.sewer) ? `<tr><td colspan="3">Saneamento</td><td class="num">${fmt.money(x.sewer)}</td></tr>` : ''}
      ${Number(x.fixed_fee) ? `<tr><td colspan="3">Taxa fixa</td><td class="num">${fmt.money(x.fixed_fee)}</td></tr>` : ''}
      <tr><td colspan="3" class="strong">Total da fatura para ${x.consumption} m³</td><td class="num strong">${fmt.money(x.total)}</td></tr></tbody></table></div>`;
  }
  $('btnSim').addEventListener('click', simulate);
  $('simC').addEventListener('change', simulate);
  simulate();
})();
