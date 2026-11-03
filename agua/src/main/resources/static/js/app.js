/* ============================================================
   AguaSystem v13 — núcleo partilhado por todas as telas
   API, sessão, menu por perfil (com nome e logótipo do provedor),
   formatação, modais, listas paginadas, imprimir/exportar com filtros
   e fila de operações feitas sem internet.
   ============================================================ */
(function () {
  'use strict';

  // ---------------- Ícones (SVG simples) ----------------
  const P = {
    home: '<path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/>',
    users: '<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
    user: '<path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>',
    drop: '<path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z"/>',
    file: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/>',
    cash: '<rect x="2" y="6" width="20" height="12" rx="2"/><circle cx="12" cy="12" r="2"/><path d="M6 12h.01M18 12h.01"/>',
    receipt: '<path d="M4 2v20l3-2 3 2 2-2 2 2 3-2 3 2V2l-3 2-3-2-2 2-2-2-3 2z"/><line x1="8" y1="9" x2="16" y2="9"/><line x1="8" y1="13" x2="14" y2="13"/>',
    list: '<line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/>',
    chart: '<line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/>',
    team: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><line x1="19" y1="8" x2="19" y2="14"/><line x1="22" y1="11" x2="16" y2="11"/>',
    tag: '<path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/><line x1="7" y1="7" x2="7.01" y2="7"/>',
    gear: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>',
    gauge: '<circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>',
    building: '<rect x="4" y="2" width="16" height="20" rx="2"/><path d="M9 22v-4h6v4M8 6h.01M16 6h.01M12 6h.01M12 10h.01M12 14h.01M16 10h.01M16 14h.01M8 10h.01M8 14h.01"/>',
    logout: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/>',
    menu: '<line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/>',
    check: '<path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/>',
    ok: '<polyline points="20 6 9 17 4 12"/>',
    alert: '<circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>',
    plus: '<line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>',
    print: '<polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/>',
    download: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>',
    sync: '<polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>',
    eye: '<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>',
    edit: '<path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.12 2.12 0 0 1 3 3L12 15l-4 1 1-4z"/>',
    trash: '<polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>',
    x: '<line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>',
    key: '<path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.78 7.78 5.5 5.5 0 0 1 7.78-7.78zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4"/>',
    whatsapp: '<path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/>',
    shield: '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>',
    history: '<path d="M3 3v5h5"/><path d="M3.05 13A9 9 0 1 0 6 5.3L3 8"/><polyline points="12 7 12 12 15 15"/>',
    sms: '<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/><line x1="8" y1="9" x2="16" y2="9"/><line x1="8" y1="13" x2="13" y2="13"/>',
    send: '<line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/>',
    star: '<polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>',
    pdf: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><path d="M12 18v-6"/><polyline points="9 15 12 18 15 15"/>',
    lock: '<rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>',
    unlock: '<rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 9.9-1"/>'
  };
  const icon = (name, size) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"${size ? ` width="${size}" height="${size}"` : ''}>${P[name] || ''}</svg>`;

  // ---------------- Menus por perfil ----------------
  const MENUS = {
    admin: [
      ['Plataforma', [['/admin#dashboard', 'Painel', 'home'], ['/admin#companies', 'Empresas', 'building'],
                      ['/admin#plans', 'Planos', 'star'], ['/admin#users', 'Gestores', 'users'], ['/admin#customers', 'Clientes', 'user']]],
      ['Financeiro', [['/admin#payments', 'Pagamentos', 'cash'], ['/admin#debtors', 'Devedores', 'alert'],
                      ['/admin#reports', 'Relatórios', 'chart']]],
      ['Segurança', [['/admin#resets', 'Recuperar senhas', 'key'], ['/admin#audit', 'Auditoria', 'shield']]]
    ],
    manager: [
      ['Operação', [['/dashboard', 'Painel', 'home'], ['/customers', 'Clientes', 'users'], ['/readings', 'Leituras', 'drop'],
                    ['/invoices', 'Faturas', 'file']]],
      ['Financeiro', [['/cashier', 'Caixa', 'cash'], ['/payments', 'Pagamentos', 'receipt'], ['/statements', 'Extratos', 'list'],
                      ['/debtors', 'Devedores', 'alert']]],
      ['Comunicação', [['/messages', 'Mensagens', 'whatsapp', 'messages']]],
      ['Gestão', [['/reports', 'Relatórios', 'chart'], ['/tariffs', 'Tarifas', 'tag'], ['/team', 'Utilizadores', 'team'],
                  ['/settings', 'Empresa e recibo', 'gear']]],
      ['Campo', [['/reader', 'Modo leitura', 'gauge']]]
    ],
    reader: [['Campo', [['/reader', 'Leituras', 'gauge']]]],
    customer: [['Minha conta', [['/portal', 'Faturas e extrato', 'file']]]]
  };

  // ---------------- API ----------------
  async function request(method, url, body) {
    const opts = { method, credentials: 'same-origin', headers: { Accept: 'application/json' } };
    if (body !== undefined && method !== 'GET') {
      opts.headers['Content-Type'] = 'application/json';
      opts.body = JSON.stringify(body);
    }
    try {
      const res = await fetch(url, opts);
      const text = await res.text();
      let data = {};
      try { data = text ? JSON.parse(text) : {}; } catch (_) { data = { success: false, error: 'Resposta inválida do servidor.' }; }
      if (res.status === 401 && !url.startsWith('/api/auth/') && !location.pathname.startsWith('/reader')) {
        try { sessionStorage.setItem('agua.expired', data.error || 'A sua sessão expirou. Entre novamente.'); } catch (_) { /* */ }
        location.href = '/login';
      }
      if (!res.ok) { data.success = false; data.error = data.error || ('Erro ' + res.status); data.status = res.status; }
      return data;
    } catch (e) {
      return { success: false, error: 'Sem ligação ao servidor.', offline: true };
    }
  }
  const api = {
    get: (u) => request('GET', u),
    post: (u, b) => request('POST', u, b || {}),
    put: (u, b) => request('PUT', u, b || {}),
    del: (u) => request('DELETE', u)
  };
  const query = (o) => {
    const p = new URLSearchParams();
    Object.entries(o || {}).forEach(([k, v]) => { if (v !== undefined && v !== null && v !== '') p.set(k, v); });
    const s = p.toString();
    return s ? '?' + s : '';
  };

  // ---------------- Formatação ----------------
  let currency = 'MZN';
  const MONTHS = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
  const MONTHS_FULL = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
  const fmt = {
    /** 1 234 567,89 MZN (separador de milhares sempre presente). */
    money(v, cur) { return fmt.amount(v) + ' ' + (cur || currency); },
    amount(v) {
      const n = Number(v || 0);
      const [i, d] = Math.abs(n).toFixed(2).split('.');
      return (n < 0 ? '−' : '') + i.replace(/\B(?=(\d{3})+(?!\d))/g, ' ') + ',' + d;
    },
    moneyHtml(v, cur) { return fmt.amount(v) + ' <small>' + (cur || currency) + '</small>'; },
    num: (v) => String(Math.round(Number(v || 0))).replace(/\B(?=(\d{3})+(?!\d))/g, ' '),
    date(v) {
      if (!v) return '—';
      const s = String(v);
      const m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
      return m ? `${m[3]}/${m[2]}/${m[1]}` : '—';
    },
    datetime(v) {
      if (!v) return '—';
      const m = String(v).match(/^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})/);
      return m ? `${m[3]}/${m[2]}/${m[1]} ${m[4]}:${m[5]}` : fmt.date(v);
    },
    period(p) {
      if (!p) return '—';
      const [y, m] = String(p).split('-');
      return MONTHS[Number(m) - 1] + '/' + y;
    },
    periodLong(p) {
      if (!p) return '—';
      const [y, m] = String(p).split('-');
      return MONTHS_FULL[Number(m) - 1] + ' de ' + y;
    },
    periodShort(p) {
      if (!p) return '—';
      const [y, m] = String(p).split('-');
      return MONTHS[Number(m) - 1] + '/' + y.slice(2);
    }
  };
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const today = () => { const d = new Date(); return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10); };
  const thisPeriod = () => today().slice(0, 7);

  const STATUS = {
    open: ['Pendente', 'orange'], partial: ['Parcial', 'blue'], paid: ['Paga', 'green'], overdue: ['Vencida', 'red'],
    cancelled: ['Anulada', 'gray'], pending: ['Pendente', 'orange'], billed: ['Faturada', 'green'], confirmed: ['Confirmado', 'green'],
    voided: ['Anulado', 'gray'], active: ['Ativo', 'green'], inactive: ['Inativo', 'gray'], suspended: ['Suspensa', 'red'],
    blocked: ['Bloqueado', 'red'], closed: ['Encerrada', 'gray'], replaced: ['Substituído', 'gray'], rejected: ['Rejeitada', 'red'],
    done: ['Tratado', 'green'], expired: ['Expirado', 'gray'],
    queued: ['Na fila', 'blue'], manual: ['Por abrir', 'orange'], sent: ['Enviada', 'green'], failed: ['Falhou', 'red']
  };
  const PLANS = { basic: 'Básico', standard: 'Standard', enterprise: 'Enterprise' };
  const PLAN_INFO = {
    basic: 'Faturação, leituras, caixa e portal do cliente. Sem WhatsApp e sem SMS.',
    standard: 'Tudo do Básico + avisos de faturas, recibos e lembretes por WhatsApp.',
    enterprise: 'Tudo do Standard + mensagens por SMS.'
  };
  const badge = (s, label) => { const [l, c] = STATUS[s] || [s, 'gray']; return `<span class="badge ${c}">${esc(label || l)}</span>`; };
  const METHODS = { cash: 'Numerário', mpesa: 'M-Pesa', emola: 'e-Mola', mkesh: 'mKesh', bank: 'Transferência / depósito', card: 'Cartão (POS)', other: 'Outro' };
  const CATEGORIES = { residential: 'Doméstico', commercial: 'Comercial', public: 'Público', industrial: 'Industrial' };
  const ROLES = { admin: 'Administrador', manager: 'Gestor', reader: 'Mediador', customer: 'Cliente' };
  const DOCS = { bi: 'BI', passport: 'Passaporte', dire: 'DIRE', nuit: 'NUIT', other: 'Outro' };

  // ---------------- Tarifa: valor a pagar enquanto se escreve a leitura ----------------
  /**
   * Igual ao TariffCalculator do servidor. t = /api/tariff (ou o pacote do mediador).
   * Devolve { consumption, water, sewer, fixed, total, lines }.
   */
  function tariffPrice(t, consumption, category) {
    const r2 = (v) => Math.round(Number(v || 0) * 100) / 100;
    const c = Math.max(0, Math.floor(Number(consumption) || 0));
    let water = 0; const lines = [];
    if (!t) return null;
    if (t.mode === 'tiers') {
      const all = (t.tiers || []);
      let mine = all.filter(x => x.category === (category || 'residential'));
      if (!mine.length) mine = all.filter(x => x.category === 'residential');
      if (!mine.length) return null;
      mine = mine.slice().sort((a, b) => a.from_m3 - b.from_m3);
      let charged = 0;
      for (const x of mine) {
        if (charged >= c) break;
        const limit = x.to_m3 == null ? Infinity : x.to_m3;
        const units = Math.min(c, limit) - charged;
        if (units <= 0) continue;
        const amount = r2(units * Number(x.price_m3));
        lines.push({ units, price: Number(x.price_m3), amount }); water += amount; charged += units;
      }
      if (charged < c) { const last = mine[mine.length - 1]; const amount = r2((c - charged) * Number(last.price_m3)); lines.push({ units: c - charged, price: Number(last.price_m3), amount }); water += amount; }
      water = r2(Math.max(water, Number(t.minimum_charge || 0)));
    } else {
      const min = Math.max(Number(t.minimum_m3 || 0), 0);
      water = r2(t.minimum_charge);
      lines.push({ units: Math.min(c, min), price: null, amount: water });
      if (c > min) { const amount = r2((c - min) * Number(t.price_per_m3 || 0)); lines.push({ units: c - min, price: Number(t.price_per_m3), amount }); water = r2(water + amount); }
    }
    const sewer = r2(water * Number(t.sewer_percent || 0) / 100), fixed = r2(t.fixed_fee);
    return { consumption: c, water, sewer, fixed, total: r2(water + sewer + fixed), lines };
  }

  // ---------------- Mensagens WhatsApp / SMS (planos Standard e Enterprise) ----------------
  /** Botões "WhatsApp"/"SMS" conforme o plano. attrs = atributos data-* comuns. */
  function msgButtons(attrs, titleWa, titleSms) {
    let h = '';
    if (features.whatsapp) h += `<button class="act green" data-msg="whatsapp" ${attrs} title="${esc(titleWa || 'Enviar por WhatsApp')}">${icon('whatsapp')}</button>`;
    if (features.sms) h += `<button class="act blue" data-msg="sms" ${attrs} title="${esc(titleSms || 'Enviar por SMS')}">${icon('sms')}</button>`;
    return h;
  }
  /** Mostra o resultado de um envio: enviada pela API, ou abre o WhatsApp/SMS do telemóvel com o texto pronto. */
  async function deliverMessage(m) {
    if (!m) return;
    if (m.status === 'sent') { toast('Mensagem enviada' + (m.channel === 'sms' ? ' por SMS.' : ' por WhatsApp.'), 'success'); return; }
    if (m.status === 'queued') { toast('Mensagem na fila de envio.', 'success'); return; }
    if (m.status === 'failed') { toast('Falhou: ' + (m.error || 'erro do fornecedor'), 'error'); return; }
    if (m.link) {
      window.open(m.link, '_blank', 'noopener');
      api.post(`/api/messages/${m.id}/opened`);
    }
  }
  /** Envia o aviso de uma fatura ou o recibo de um pagamento. kind = invoice | payment. */
  async function sendMessage(kind, id, channel) {
    const r = await api.post(`/api/messages/${kind}/${id}?channel=${channel || 'whatsapp'}`);
    if (!r.success) { toast(r.error, 'error'); return null; }
    await deliverMessage(r.message);
    return r.message;
  }

  // ---------------- Avisos e modais ----------------
  function toast(msg, type) {
    let box = document.getElementById('toasts');
    if (!box) { box = document.createElement('div'); box.id = 'toasts'; document.body.appendChild(box); }
    const t = document.createElement('div');
    t.className = 'toast ' + (type || '');
    t.textContent = msg;
    box.appendChild(t);
    setTimeout(() => t.remove(), 4500);
  }
  const modal = {
    open(id) { document.getElementById(id).classList.add('show'); },
    close(id) { document.getElementById(id).classList.remove('show'); }
  };
  document.addEventListener('click', (e) => {
    const c = e.target.closest('[data-close]');
    if (c) modal.close(c.dataset.close);
    if (e.target.classList && e.target.classList.contains('modal') && !e.target.hasAttribute('data-static')) e.target.classList.remove('show');
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') document.querySelectorAll('.modal.show').forEach(m => { if (!m.hasAttribute('data-static')) m.classList.remove('show'); });
  });

  /** Pergunta simples (com campo de texto opcional, ex.: motivo). Devolve null se cancelar. */
  function ask(title, opts) {
    const o = opts || {};
    return new Promise((resolve) => {
      let m = document.getElementById('askModal');
      if (!m) {
        m = document.createElement('div');
        m.className = 'modal'; m.id = 'askModal';
        m.innerHTML = '<div class="modal-content" style="max-width:460px"><h2 id="askTitle"></h2><p class="muted" id="askText"></p>' +
          '<div class="field" id="askField" style="margin-top:12px"><label id="askLabel"></label><textarea id="askInput" rows="3"></textarea></div>' +
          '<div class="form-actions"><button class="btn-secondary" id="askNo">Cancelar</button><button class="btn-primary" id="askYes">Confirmar</button></div></div>';
        document.body.appendChild(m);
      }
      m.querySelector('#askTitle').textContent = title;
      m.querySelector('#askText').textContent = o.text || '';
      const field = m.querySelector('#askField'), input = m.querySelector('#askInput');
      field.style.display = o.input ? '' : 'none';
      m.querySelector('#askLabel').textContent = o.input || '';
      input.value = o.value || '';
      const yes = m.querySelector('#askYes');
      yes.textContent = o.confirm || 'Confirmar';
      yes.className = o.danger ? 'btn-danger' : 'btn-primary';
      const done = (v) => { m.classList.remove('show'); yes.onclick = null; m.querySelector('#askNo').onclick = null; resolve(v); };
      yes.onclick = () => {
        if (o.input && o.required !== false && !input.value.trim()) { input.focus(); return; }
        done(o.input ? input.value.trim() : true);
      };
      m.querySelector('#askNo').onclick = () => done(null);
      m.classList.add('show');
      if (o.input) setTimeout(() => input.focus(), 50);
    });
  }

  /** Mostra utilizador e senha temporária gerados (gestor, mediador ou cliente). */
  function showCredentials(title, username, password, note) {
    let m = document.getElementById('credModal');
    if (!m) {
      m = document.createElement('div');
      m.className = 'modal'; m.id = 'credModal';
      m.innerHTML = '<div class="modal-content" style="max-width:460px"><h2 id="credTitle"></h2><p class="muted" id="credNote"></p>' +
        '<div class="cred"><div><span>Utilizador</span><code id="credUser"></code></div><div><span>Senha temporária</span><code id="credPass"></code></div></div>' +
        '<p class="muted">Guarde estes dados: a senha não volta a ser mostrada. No primeiro acesso é obrigatório criar uma nova senha.</p>' +
        '<div class="form-actions"><button class="btn-secondary" id="credPrint">Imprimir</button><button class="btn-primary" data-close="credModal">Fechar</button></div></div>';
      document.body.appendChild(m);
      m.querySelector('#credPrint').addEventListener('click', () => {
        printHtml('Credenciais', `<h2>${esc(m.querySelector('#credTitle').textContent)}</h2>
          <table class="t"><tr><th>Utilizador</th><td style="font:700 16px monospace">${esc(m.querySelector('#credUser').textContent)}</td></tr>
          <tr><th>Senha temporária</th><td style="font:700 16px monospace">${esc(m.querySelector('#credPass').textContent)}</td></tr>
          <tr><th>Endereço</th><td>${esc(location.origin)}</td></tr></table>
          <p>No primeiro acesso será pedida uma nova senha.</p>`);
      });
    }
    m.querySelector('#credTitle').textContent = title;
    m.querySelector('#credNote').textContent = note || '';
    m.querySelector('#credUser').textContent = username;
    m.querySelector('#credPass').textContent = password;
    modal.open('credModal');
  }

  const debounce = (fn, ms) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms || 300); }; };
  const qs = (name) => new URLSearchParams(location.search).get(name);
  /** Lê um formulário: campos vazios → null; checkbox → boolean; data-num → número. */
  const formData = (form) => {
    const o = {};
    form.querySelectorAll('[name]').forEach(el => {
      if (el.type === 'checkbox') o[el.name] = el.checked;
      else if (el.type === 'radio') { if (el.checked) o[el.name] = el.value; }
      else if (el.value === '') o[el.name] = null;
      else o[el.name] = el.dataset.num !== undefined || el.type === 'number' ? Number(el.value) : el.value;
    });
    return o;
  };
  const fillForm = (form, data) => {
    form.querySelectorAll('[name]').forEach(el => {
      const v = data ? data[el.name] : null;
      if (el.type === 'checkbox') el.checked = !!v;
      else if (el.type === 'radio') el.checked = String(v) === el.value;
      else el.value = v == null ? '' : (el.type === 'date' ? String(v).slice(0, 10) : v);
    });
  };
  const busy = (btn, on, text) => {
    if (!btn) return;
    if (on) { btn.dataset.label = btn.innerHTML; btn.disabled = true; btn.textContent = text || 'Aguarde…'; }
    else { btn.disabled = false; if (btn.dataset.label) btn.innerHTML = btn.dataset.label; }
  };
  const waLink = (phone, text) => {
    let d = String(phone || '').replace(/\D/g, '');
    if (d.length === 9) d = '258' + d;
    return d ? `https://wa.me/${d}?text=${encodeURIComponent(text || '')}` : null;
  };
  /** Opções de mês (AAAA-MM) dos últimos n meses. */
  function monthOptions(n, selected) {
    const out = [];
    const d = new Date(); d.setDate(1);
    for (let i = 0; i < (n || 18); i++) {
      const p = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
      out.push(`<option value="${p}" ${p === selected ? 'selected' : ''}>${fmt.periodLong(p)}</option>`);
      d.setMonth(d.getMonth() - 1);
    }
    return out.join('');
  }

  // ---------------- Lista paginada ----------------
  /**
   * cfg: { url, params(): {}, tbody, pager, cols, row(r), empty, onData(data) }
   * Devolve { load(page), reload(), data }.
   */
  function pagedList(cfg) {
    const st = { page: 1, size: cfg.size || 20, data: null };
    const tbody = typeof cfg.tbody === 'string' ? document.getElementById(cfg.tbody) : cfg.tbody;
    const pager = typeof cfg.pager === 'string' ? document.getElementById(cfg.pager) : cfg.pager;
    async function load(page) {
      st.page = page || 1;
      tbody.innerHTML = `<tr><td colspan="${cfg.cols}"><div class="spinner"></div></td></tr>`;
      const r = await api.get(cfg.url + query(Object.assign({}, cfg.params ? cfg.params() : {}, { page: st.page, size: st.size })));
      if (!r.success) { tbody.innerHTML = `<tr><td colspan="${cfg.cols}" class="empty-state">${esc(r.error)}</td></tr>`; return; }
      st.data = r;
      const items = r.items || [];
      tbody.innerHTML = items.length ? items.map(cfg.row).join('') : `<tr><td colspan="${cfg.cols}" class="empty-state">${esc(cfg.empty || 'Sem resultados.')}</td></tr>`;
      if (pager) renderPager(pager, r, load);
      if (cfg.onData) cfg.onData(r);
    }
    return { load, reload: () => load(st.page), setSize: (n) => { st.size = n || 20; }, get data() { return st.data; } };
  }
  function renderPager(el, r, go) {
    const pages = r.pages || 1, page = r.page || 1;
    const nums = [];
    for (let i = Math.max(1, page - 2); i <= Math.min(pages, page + 2); i++) nums.push(i);
    el.innerHTML = `<span>Página ${page} de ${pages} (${fmt.num(r.total || 0)} registos)</span>
      <div class="pages"><button data-p="${page - 1}" ${page <= 1 ? 'disabled' : ''}>‹</button>
      ${nums.map(n => `<button data-p="${n}" class="${n === page ? 'active' : ''}">${n}</button>`).join('')}
      <button data-p="${page + 1}" ${page >= pages ? 'disabled' : ''}>›</button></div>`;
    el.querySelectorAll('button[data-p]').forEach(b => b.addEventListener('click', () => go(Number(b.dataset.p))));
  }

  // ---------------- Imprimir / exportar (com os filtros aplicados) ----------------
  let branding = null;
  let features = { plan: 'basic', plan_label: 'Básico', whatsapp: false, sms: false, messages: false };
  function brandHeader(title, subtitle) {
    const c = branding || {};
    return `<div class="ph">
      ${c.logo ? `<img src="${esc(c.logo)}" alt="">` : ''}
      <div><strong>${esc(c.name || 'AguaSystem')}</strong>
      <span>${esc([c.address, c.city, c.province].filter(Boolean).join(', '))}</span>
      <span>${esc([c.nuit ? 'NUIT ' + c.nuit : '', c.phone ? 'Tel. ' + c.phone : '', c.email].filter(Boolean).join(' · '))}</span></div>
      <div class="pt"><h1>${esc(title)}</h1>${subtitle ? `<span>${esc(subtitle)}</span>` : ''}<span>Emitido em ${fmt.datetime(new Date().toISOString())}</span></div>
    </div>`;
  }
  const PRINT_CSS = `*{box-sizing:border-box;font-family:'Segoe UI',Arial,sans-serif}body{margin:0;padding:18px;color:#111;font-size:12px}
    .ph{display:flex;gap:14px;align-items:center;border-bottom:2px solid #0f766e;padding-bottom:10px;margin-bottom:14px}
    .ph img{max-height:56px;max-width:120px}.ph strong{display:block;font-size:16px}.ph span{display:block;color:#555;font-size:11px}
    .ph .pt{margin-left:auto;text-align:right}.ph h1{margin:0;font-size:17px;color:#0f766e}
    table.t{width:100%;border-collapse:collapse;margin-top:8px}table.t th{background:#f1f5f9;text-align:left;font-size:10.5px;text-transform:uppercase;letter-spacing:.3px}
    table.t th,table.t td{border:1px solid #d9e0e5;padding:5px 7px;vertical-align:top}table.t td.n,table.t th.n{text-align:right;white-space:nowrap}
    table.t tfoot td{font-weight:700;background:#f8fafc}.flt{color:#555;font-size:11px;margin:4px 0 8px}
    h2{font-size:14px;margin:16px 0 6px}@page{size:A4;margin:10mm}@media print{body{padding:0}.noprint{display:none}}`;
  function printHtml(title, body, opts) {
    const o = opts || {};
    const w = window.open('', '_blank');
    if (!w) { toast('Permita janelas pop-up para imprimir.', 'error'); return; }
    w.document.write(`<!DOCTYPE html><html lang="pt"><head><meta charset="utf-8"><title>${esc(title)}</title>
      <style>${PRINT_CSS}${o.landscape ? '@page{size:A4 landscape;margin:8mm}' : ''}${o.css || ''}</style></head>
      <body>${o.noHeader ? '' : brandHeader(title, o.subtitle)}${body}
      <div class="noprint" style="margin-top:16px"><button onclick="window.print()">Imprimir</button></div></body></html>`);
    w.document.close();
    setTimeout(() => { try { w.focus(); w.print(); } catch (_) { /* */ } }, 400);
  }
  /** columns: [[título, chave | função(row), 'n' para números/valores]] */
  function tableHtml(columns, rows, totals) {
    const val = (c, r) => typeof c[1] === 'function' ? c[1](r) : (r[c[1]] == null ? '' : r[c[1]]);
    return `<table class="t"><thead><tr>${columns.map(c => `<th class="${c[2] || ''}">${esc(c[0])}</th>`).join('')}</tr></thead>
      <tbody>${rows.map(r => `<tr>${columns.map(c => `<td class="${c[2] || ''}">${esc(val(c, r))}</td>`).join('')}</tr>`).join('') ||
      `<tr><td colspan="${columns.length}">Sem registos.</td></tr>`}</tbody>
      ${totals ? `<tfoot><tr>${columns.map((c, i) => `<td class="${c[2] || ''}">${esc(totals[i] == null ? '' : totals[i])}</td>`).join('')}</tr></tfoot>` : ''}</table>`;
  }
  function downloadCsv(filename, columns, rows) {
    const val = (c, r) => typeof c[1] === 'function' ? c[1](r) : (r[c[1]] == null ? '' : r[c[1]]);
    const cell = (v) => { const s = String(v == null ? '' : v); return /[";\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
    const lines = [columns.map(c => cell(c[0])).join(';')].concat(rows.map(r => columns.map(c => cell(val(c, r))).join(';')));
    const blob = new Blob(['﻿' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = filename.replace(/[^\w.-]+/g, '_') + '.csv';
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }
  /**
   * Imprime ou exporta TODOS os registos de uma lista com os filtros atuais.
   * cfg: { url, params, title, filters (texto), columns, totals(rows) → array, landscape }
   */
  async function exportList(cfg, mode) {
    toast('A preparar ' + (mode === 'csv' ? 'o ficheiro' : 'a impressão') + '…');
    const r = await api.get(cfg.url + query(Object.assign({}, cfg.params || {}, { page: 1, size: 5000 })));
    if (!r.success) { toast(r.error, 'error'); return; }
    const rows = cfg.pick ? cfg.pick(r) : (r.items || r.rows || []);
    if (mode === 'csv') { downloadCsv(cfg.title + ' ' + today(), cfg.columns, rows); return; }
    const totals = cfg.totals ? cfg.totals(rows, r) : null;
    printHtml(cfg.title, (cfg.filters ? `<div class="flt">Filtros: ${esc(cfg.filters)}</div>` : '') +
      tableHtml(cfg.columns, rows, totals) + `<div class="flt">${fmt.num(rows.length)} registo(s)</div>`, { landscape: cfg.landscape, subtitle: cfg.subtitle });
  }
  const sum = (rows, key) => rows.reduce((a, r) => a + Number(typeof key === 'function' ? key(r) : r[key] || 0), 0);

  // ---------------- Fila de operações sem internet (caixa e registo de clientes) ----------------
  const OUTBOX = 'agua.outbox';
  const outbox = {
    all() { try { return JSON.parse(localStorage.getItem(OUTBOX) || '[]'); } catch (_) { return []; } },
    save(list) { try { localStorage.setItem(OUTBOX, JSON.stringify(list)); } catch (_) { toast('Não foi possível guardar no aparelho.', 'error'); } updateOutbox(); },
    add(kind, body, label) {
      const list = outbox.all();
      body.client_uuid = body.client_uuid || uuid();
      list.push({ kind, body, label, at: new Date().toISOString() });
      outbox.save(list);
      return body.client_uuid;
    },
    async flush(silent) {
      const list = outbox.all();
      if (!list.length || !navigator.onLine) return;
      const keep = [];
      let sent = 0, failed = 0;
      const pays = list.filter(i => i.kind === 'payment');
      if (pays.length) {
        const r = await api.post('/api/payments/sync', { items: pays.map(i => i.body) });
        if (r.offline) keep.push(...pays);
        else if (!r.success) { failed += pays.length; keep.push(...pays.map(p => Object.assign(p, { error: r.error }))); }
        else (r.results || []).forEach((res, idx) => {
          if (res.ok) sent++; else { failed++; keep.push(Object.assign(pays[idx], { error: res.error })); }
        });
      }
      for (const item of list.filter(i => i.kind === 'customer')) {
        const r = await api.post('/api/customers', item.body);
        if (r.success) sent++;
        else if (r.offline) keep.push(item);
        else { failed++; keep.push(Object.assign(item, { error: r.error })); }
      }
      outbox.save(keep);
      if (!silent && (sent || failed)) toast(`Sincronização: ${sent} enviado(s)` + (failed ? `, ${failed} com erro (veja a fila)` : '.'), failed ? 'error' : 'success');
      document.dispatchEvent(new CustomEvent('outbox-flushed', { detail: { sent, failed } }));
    },
    remove(uuidValue) { outbox.save(outbox.all().filter(i => i.body.client_uuid !== uuidValue)); }
  };
  function uuid() {
    if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
    const b = new Uint8Array(16); crypto.getRandomValues(b);
    b[6] = (b[6] & 0x0f) | 0x40; b[8] = (b[8] & 0x3f) | 0x80;
    const h = [...b].map(x => x.toString(16).padStart(2, '0')).join('');
    return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
  }
  function updateOutbox() {
    const el = document.getElementById('outboxBtn');
    if (!el) return;
    const n = outbox.all().length;
    el.style.display = n ? '' : 'none';
    el.textContent = n + ' por enviar';
  }
  function showOutbox() {
    const list = outbox.all();
    let m = document.getElementById('outboxModal');
    if (!m) { m = document.createElement('div'); m.className = 'modal'; m.id = 'outboxModal'; document.body.appendChild(m); }
    m.innerHTML = `<div class="modal-content wide"><div class="modal-head"><h2>Operações guardadas sem internet</h2><button class="x-close" data-close="outboxModal">×</button></div>
      <p class="muted">Ficam neste aparelho e são enviadas sozinhas quando a internet voltar.</p>
      <div class="table-wrap"><table class="table"><thead><tr><th>Tipo</th><th>Descrição</th><th>Data</th><th>Estado</th><th></th></tr></thead><tbody>
      ${list.map(i => `<tr><td>${i.kind === 'payment' ? 'Pagamento' : 'Cliente'}</td><td>${esc(i.label || '')}</td><td>${fmt.datetime(i.at)}</td>
        <td>${i.error ? `<span class="badge red">${esc(i.error)}</span>` : '<span class="badge orange">Por enviar</span>'}</td>
        <td class="actions"><button class="act red" data-del="${esc(i.body.client_uuid)}" title="Remover">${icon('trash')}</button></td></tr>`).join('') ||
        '<tr><td colspan="5" class="empty-state">Nada por enviar.</td></tr>'}</tbody></table></div>
      <div class="form-actions"><button class="btn-secondary" data-close="outboxModal">Fechar</button><button class="btn-primary" id="outboxSend">${icon('sync')} Enviar agora</button></div></div>`;
    m.querySelectorAll('[data-del]').forEach(b => b.addEventListener('click', async () => {
      if (await ask('Remover esta operação?', { text: 'Não será enviada ao servidor.', danger: true, confirm: 'Remover' })) { outbox.remove(b.dataset.del); showOutbox(); }
    }));
    m.querySelector('#outboxSend').addEventListener('click', async () => { await outbox.flush(); showOutbox(); });
    modal.open('outboxModal');
  }

  // ---------------- Sessão e layout ----------------
  function cachedUser() {
    try { return JSON.parse(localStorage.getItem('agua.user') || 'null'); } catch (_) { return null; }
  }
  async function session() {
    const r = await api.get('/api/auth/session');
    if (r.success && r.user) {
      try { localStorage.setItem('agua.user', JSON.stringify(r.user)); } catch (_) { /* */ }
      return r.user;
    }
    if (r.offline) return cachedUser();
    return null;
  }
  async function logout() {
    await api.post('/api/auth/logout');
    try { localStorage.removeItem('agua.user'); sessionStorage.removeItem('agua.brand'); } catch (_) { /* */ }
    location.href = '/login';
  }
  async function loadBranding(user) {
    if (!user.company_id) return null;
    let cached = null;
    try {
      const c = JSON.parse(sessionStorage.getItem('agua.brand') || 'null');
      if (c && c.id === user.company_id) cached = c;
      // o plano pode mudar (administrador): renova os dados de 2 em 2 minutos
      if (cached && Date.now() - (cached._at || 0) < 120000) return cached;
    } catch (_) { /* */ }
    const r = await api.get('/api/branding');
    if (r.success) {
      r.company._at = Date.now();
      try { sessionStorage.setItem('agua.brand', JSON.stringify(r.company)); } catch (_) { /* logótipo grande */ }
      return r.company;
    }
    return cached;
  }
  function refreshBranding() { try { sessionStorage.removeItem('agua.brand'); } catch (_) { /* */ } }

  function renderLayout(user, title) {
    const sidebar = document.querySelector('.sidebar');
    const b = branding || {};
    if (sidebar) {
      const groups = MENUS[user.role] || [];
      const here = location.pathname + (location.pathname === '/admin' ? (location.hash || '#dashboard') : '');
      sidebar.innerHTML = `
        <div class="sidebar-header">
          <div class="logo-small">${b.logo ? `<img src="${esc(b.logo)}" alt="">` : icon('drop')}</div>
          <div class="company"><strong title="${esc(b.name || user.company_name || '')}">${esc(b.name || user.company_name || 'AguaSystem')}</strong>
            <small>${esc(user.company_code || 'Administração da plataforma')}${user.company_id && features.plan_label && user.role === 'manager' ? ` · <span class="plan-tag ${esc(features.plan)}">${esc(features.plan_label)}</span>` : ''}</small></div>
        </div>
        <nav>${groups.map(([section, all]) => {
            const items = all.filter(i => !i[3] || features[i[3]]);          // módulos do plano (ex.: mensagens)
            return items.length ? `<div class="menu-section">${esc(section)}</div>` +
              items.map(([href, label, ic]) => `<a class="menu-item ${here === href ? 'active' : ''}" href="${href}">${icon(ic)}<span>${esc(label)}</span></a>`).join('') : '';
          }).join('')}
          <div class="menu-section">Conta</div>
          <a class="menu-item ${here === '/change-password' ? 'active' : ''}" href="/change-password">${icon('key')}<span>Alterar senha</span></a>
        </nav>
        <div class="sidebar-footer"><button class="btn-logout" id="btnLogout">${icon('logout')} Sair</button></div>`;
      sidebar.querySelector('#btnLogout').addEventListener('click', logout);
      sidebar.querySelectorAll('.menu-item').forEach(a => a.addEventListener('click', () => {
        document.querySelector('.app').classList.remove('menu-open');
        if (location.pathname === '/admin' && a.getAttribute('href').startsWith('/admin#')) {
          sidebar.querySelectorAll('.menu-item').forEach(x => x.classList.toggle('active', x === a));
        }
      }));
      if (!document.querySelector('.backdrop')) {
        const bd = document.createElement('div'); bd.className = 'backdrop';
        bd.addEventListener('click', () => document.querySelector('.app').classList.remove('menu-open'));
        document.querySelector('.app').appendChild(bd);
      }
    }
    const top = document.querySelector('.topbar');
    if (top) {
      top.innerHTML = `
        <div class="topbar-left"><button class="menu-toggle" aria-label="Menu">${icon('menu')}</button><h1 id="pageTitle">${esc(title)}</h1></div>
        <div class="user-info"><button class="outbox" id="outboxBtn" style="display:none"></button><span class="net" id="netStatus">Online</span>
          <span class="name">${esc(user.name)}</span><div class="avatar" title="${esc(ROLES[user.role] || '')}">${esc((user.name || '?').trim().charAt(0).toUpperCase())}</div></div>`;
      top.querySelector('.menu-toggle').addEventListener('click', () => document.querySelector('.app').classList.toggle('menu-open'));
      top.querySelector('#outboxBtn').addEventListener('click', showOutbox);
      updateNet(); updateOutbox();
    }
    document.title = title + ' · ' + (b.name || 'AguaSystem');
  }
  function setTitle(t) { const h = document.getElementById('pageTitle'); if (h) h.textContent = t; }

  function updateNet() {
    const el = document.getElementById('netStatus');
    if (!el) return;
    el.textContent = navigator.onLine ? 'Online' : 'Sem internet';
    el.classList.toggle('off', !navigator.onLine);
  }
  window.addEventListener('online', () => { updateNet(); outbox.flush(); });
  window.addEventListener('offline', () => { updateNet(); toast('Sem internet: as operações ficam guardadas e serão enviadas depois.'); });

  /**
   * Arranque de uma tela: confirma a sessão e o perfil, desenha o menu e devolve o utilizador.
   * opts: { title, roles: ['manager'] }
   */
  async function boot(opts) {
    const user = await session();
    if (!user) { location.href = '/login'; return new Promise(() => {}); }
    if (user.must_change_password && location.pathname !== '/change-password') { location.href = '/change-password'; return new Promise(() => {}); }
    if (opts.roles && !opts.roles.includes(user.role)) { location.href = user.home || '/'; return new Promise(() => {}); }
    branding = await loadBranding(user);
    if (branding && branding.settings && branding.settings.currency) currency = branding.settings.currency;
    if (branding && branding.features) features = branding.features;
    if (opts.feature && !features[opts.feature]) { location.href = user.home || '/'; return new Promise(() => {}); }
    renderLayout(user, opts.title);
    if (navigator.onLine) setTimeout(() => outbox.flush(true), 800);
    return user;
  }

  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => navigator.serviceWorker.register('/sw.js').catch(() => {}));
  }

  window.App = {
    api, query, fmt, esc, badge, toast, modal, ask, icon, boot, logout, showCredentials, debounce, qs, formData, fillForm, busy,
    waLink, monthOptions, pagedList, printHtml, tableHtml, downloadCsv, exportList, sum, outbox, uuid, today, thisPeriod, setTitle,
    refreshBranding, get branding() { return branding; }, get currency() { return currency; }, get features() { return features; },
    tariffPrice, msgButtons, sendMessage, deliverMessage,
    METHODS, CATEGORIES, STATUS, ROLES, DOCS, PLANS, PLAN_INFO
  };
})();
