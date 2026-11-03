/* Empresa e recibo: dados e logótipo do provedor, regras de faturação/multas/juros, editor do recibo com pré-visualização. */
(async function () {
  const { api, esc, toast } = App;
  await App.boot({ title: 'Empresa e recibo', roles: ['manager'] });
  const $ = (id) => document.getElementById(id);
  let company = {}, settings = {};

  document.getElementById('tabs').addEventListener('click', (e) => {
    const t = e.target.closest('.tab'); if (!t) return;
    document.querySelectorAll('#tabs .tab').forEach(x => x.classList.toggle('active', x === t));
    document.querySelectorAll('.tab-panel').forEach(p => p.classList.toggle('active', p.id === 'tab-' + t.dataset.t));
    history.replaceState(null, '', '#' + t.dataset.t);
  });
  if (location.hash) { const t = document.querySelector(`#tabs .tab[data-t="${location.hash.slice(1)}"]`); if (t) t.click(); }

  async function load() {
    const r = await api.get('/api/settings');
    if (!r.success) { toast(r.error, 'error'); return; }
    company = r.company; settings = r.settings;
    App.fillForm($('companyForm'), company);
    ['billingForm', 'receiptForm', 'paymentsForm'].forEach(f => App.fillForm($(f), settings));
    logo();
    preview();
    messaging(r.messaging || {});
  }

  // ---------- mensagens (planos Standard / Enterprise) ----------
  function messaging(m) {
    const f = $('messagingForm');
    if (!m.whatsapp) {
      f.style.display = 'none';
      $('msgLocked').style.display = '';
      $('msgLocked').innerHTML = `<div class="locked">${App.icon('lock')}<h3>Plano ${esc(m.plan_label || 'Básico')}</h3>
        <p class="muted">O envio de faturas, recibos e lembretes por <b>WhatsApp</b> faz parte do plano <b>Standard</b>;
        <b>WhatsApp e SMS</b> do plano <b>Enterprise</b>.<br>Fale com o administrador da plataforma para mudar de plano.</p></div>`;
      return;
    }
    $('msgLocked').style.display = 'none'; f.style.display = '';
    $('planTag').textContent = m.plan_label; $('planTag').className = 'plan-tag ' + m.plan;
    $('planInfo').textContent = App.PLAN_INFO[m.plan] || '';
    App.fillForm(f, Object.assign({}, settings, { whatsapp_token: '', sms_api_token: '' }));
    f.msg_invoice_template.placeholder = m.default_invoice_template || '';
    f.msg_payment_template.placeholder = m.default_payment_template || '';
    f.msg_reminder_template.placeholder = m.default_reminder_template || '';
    $('waTokenInfo').textContent = m.whatsapp_token_set ? 'Token guardado ✓' : 'Sem token.';
    $('smsTokenInfo').textContent = m.sms_token_set ? 'Chave guardada ✓' : '';
    $('smsSection').style.display = m.sms ? '' : 'none';
    if (!m.sms) { [...$('msgChannel').options].forEach(o => { if (o.value !== 'whatsapp') o.remove(); }); }
    modes();
  }
  function modes() {
    const f = $('messagingForm');
    f.querySelectorAll('.wa-api').forEach(el => el.style.display = f.whatsapp_mode.value === 'api' ? '' : 'none');
    f.querySelectorAll('.sms-api').forEach(el => el.style.display = f.sms_mode.value === 'api' ? '' : 'none');
  }
  $('messagingForm').addEventListener('change', (e) => { if (e.target.name === 'whatsapp_mode' || e.target.name === 'sms_mode') modes(); });
  document.querySelectorAll('#messagingForm .tpl-vars').forEach(box => {
    box.innerHTML = box.textContent.trim().split(/\s+/).map(v => `<code data-v="${v}">{${v}}</code>`).join('');
    box.addEventListener('click', (e) => {
      const c = e.target.closest('[data-v]'); if (!c) return;
      const ta = $('messagingForm')[box.dataset.for];
      if (!ta.value && ta.placeholder) ta.value = ta.placeholder;
      const pos = ta.selectionStart || ta.value.length;
      ta.value = ta.value.slice(0, pos) + '{' + c.dataset.v + '}' + ta.value.slice(pos); ta.focus();
    });
  });
  $('messagingForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const d = App.formData(e.target);
    if (!d.whatsapp_number) { toast('Indique o número de WhatsApp da empresa.', 'error'); return; }
    ['msg_invoice_template', 'msg_payment_template', 'msg_reminder_template', 'sms_api_url', 'whatsapp_phone_id', 'sms_number'].forEach(k => { if (d[k] == null) d[k] = ''; });
    const r = await api.put('/api/settings/messaging', d);
    if (!r.success) { toast(r.error, 'error'); return; }
    toast(r.message, 'success'); load();
  });
  function logo() {
    $('logoBox').innerHTML = company.logo ? `<img src="${esc(company.logo)}" alt="">` : App.icon('drop', 36);
  }

  // ---------- empresa ----------
  $('companyForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const d = {}; e.target.querySelectorAll('[name]').forEach(el => d[el.name] = el.value.trim());
    const r = await api.put('/api/settings/company', d);
    if (!r.success) { toast(r.error, 'error'); return; }
    App.refreshBranding(); toast(r.message, 'success');
    setTimeout(() => location.reload(), 600);
  });
  $('btnLogo').addEventListener('click', () => $('logoFile').click());
  $('logoFile').addEventListener('change', async () => {
    const f = $('logoFile').files[0]; if (!f) return;
    const dataUrl = await shrink(f, 360);
    const r = await api.put('/api/settings/logo', { logo: dataUrl });
    if (!r.success) { toast(r.error, 'error'); return; }
    company.logo = dataUrl; logo(); preview(); App.refreshBranding(); toast(r.message, 'success');
  });
  $('btnLogoDel').addEventListener('click', async () => {
    if (!await App.ask('Remover o logótipo?')) return;
    const r = await api.put('/api/settings/logo', { logo: '' });
    if (!r.success) { toast(r.error, 'error'); return; }
    company.logo = null; logo(); preview(); App.refreshBranding(); toast(r.message, 'success');
  });
  /** Reduz a imagem (máx. size px) e devolve PNG/JPEG em data URL, para o logótipo ficar leve. */
  function shrink(file, size) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        const k = Math.min(1, size / Math.max(img.width, img.height));
        const c = document.createElement('canvas'); c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
        c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
        resolve(c.toDataURL(file.type === 'image/jpeg' ? 'image/jpeg' : 'image/png', .9));
        URL.revokeObjectURL(img.src);
      };
      img.onerror = () => reject(new Error('Imagem inválida'));
      img.src = URL.createObjectURL(file);
    });
  }

  // ---------- regras / recibo / pagamentos ----------
  /** Campos de texto vão como texto ("" apaga), checkboxes como true/false, números como números. */
  function read(form) {
    const o = {};
    form.querySelectorAll('[name]').forEach(el => {
      if (el.type === 'checkbox') o[el.name] = el.checked;
      else if (el.type === 'number') o[el.name] = el.value === '' ? null : Number(el.value);
      else o[el.name] = el.value;
    });
    return o;
  }
  async function save(form, msg) {
    const d = read(form);
    if (d.invoice_prefix) d.invoice_prefix = d.invoice_prefix.toUpperCase();
    if (d.receipt_prefix) d.receipt_prefix = d.receipt_prefix.toUpperCase();
    const r = await api.put('/api/settings', d);
    if (!r.success) { toast(r.error, 'error'); return; }
    settings = r.settings; App.refreshBranding(); toast(msg, 'success'); preview();
  }
  $('billingForm').addEventListener('submit', (e) => { e.preventDefault(); save(e.target, 'Regras de faturação guardadas.'); });
  $('receiptForm').addEventListener('submit', (e) => { e.preventDefault(); save(e.target, 'Recibo guardado.'); });
  $('paymentsForm').addEventListener('submit', (e) => { e.preventDefault(); save(e.target, 'Configuração de pagamentos guardada.'); });
  $('receiptForm').addEventListener('input', preview);
  $('receiptForm').addEventListener('change', preview);

  function preview() {
    const s = Object.assign({}, settings, read($('receiptForm')), { payment_instructions: $('paymentsForm').payment_instructions.value });
    s.receipt_copies = 1;
    const sample = {
      receipt_number: (s.receipt_prefix || 'RC') + '-' + new Date().getFullYear() + '-000123', paid_at: new Date().toISOString(), status: 'confirmed',
      amount: 650, method: 'mpesa', reference: '9F8K2L1', cashier: 'Operador', customer_name: 'João Exemplo Macuácua', customer_code: 'CLI-XXXX-00001',
      phone: '84 123 4567', address: 'Bairro Central, Q. 12, casa 5', debt_now: 210,
      allocations: [
        { invoice_number: 'FT-2026-000101', account_number: 'CT-XXXX-00001', meter_number: 'M-001', period: '2026-09', previous_value: 120, current_value: 128, consumption: 8, balance_before: 560, amount: 560, balance_after: 0 },
        { invoice_number: 'FT-2026-000154', account_number: 'CT-XXXX-00002', meter_number: 'M-002', period: '2026-10', previous_value: 40, current_value: 44, consumption: 4, balance_before: 300, amount: 90, balance_after: 210 }]
    };
    sample.company = Object.assign({}, company, { settings: s });
    const box = $('preview');
    box.innerHTML = `<div id="pvInner">${PrintDocs.receipt(sample)}</div>`;
    const thermal = String(s.receipt_format || '').startsWith('thermal');
    const inner = $('pvInner');
    inner.style.width = thermal ? '' : (s.receipt_orientation === 'portrait' ? '560px' : '790px');
    const k = thermal ? 1 : Math.min(1, (box.clientWidth - 28) / parseInt(inner.style.width, 10));
    inner.style.zoom = k;
  }
  load();
})();
