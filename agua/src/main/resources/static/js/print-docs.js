/* ============================================================
   Modelos de impressão: recibo (térmico 58/80 mm, A5, A4, vertical
   ou HORIZONTAL), fatura e extrato. Logótipo, nome, localização,
   cor e textos especiais vêm de "Empresa e recibo" (configurações).
   ============================================================ */
(function () {
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const amount = (v) => { const n = Number(v || 0); const [i, d] = Math.abs(n).toFixed(2).split('.'); return (n < 0 ? '−' : '') + i.replace(/\B(?=(\d{3})+(?!\d))/g, ' ') + ',' + d; };
  const money = (v, cur) => amount(v) + ' ' + (cur || 'MZN');
  const date = (v) => { const m = String(v || '').match(/^(\d{4})-(\d{2})-(\d{2})/); return m ? `${m[3]}/${m[2]}/${m[1]}` : '—'; };
  const dt = (v) => { const m = String(v || '').match(/^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})/); return m ? `${m[3]}/${m[2]}/${m[1]} ${m[4]}:${m[5]}` : date(v); };
  const MONTHS = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
  const period = (p) => { if (!p) return '—'; const [y, m] = String(p).split('-'); return MONTHS[Number(m) - 1] + '/' + y; };
  const nl2br = (s) => esc(s).replace(/\n/g, '<br>');
  const METHODS = { cash: 'Numerário', mpesa: 'M-Pesa', emola: 'e-Mola', mkesh: 'mKesh', bank: 'Transferência', card: 'Cartão', other: 'Outro' };
  const WIDTH = { thermal58: '58mm', thermal80: '80mm' };
  const SIZE = { a5: { portrait: '148mm 210mm', landscape: '210mm 148mm' }, a4: { portrait: '210mm 297mm', landscape: '297mm 210mm' } };
  const loc = (c) => [c.address, c.city, c.province].filter(Boolean).join(', ');
  const S = (c) => (c && c.settings) || {};

  /** Valor por extenso em português: 1250,50 → "mil duzentos e cinquenta meticais e cinquenta centavos". */
  function words(value, cur) {
    const U = ['zero', 'um', 'dois', 'três', 'quatro', 'cinco', 'seis', 'sete', 'oito', 'nove', 'dez', 'onze', 'doze', 'treze', 'catorze',
      'quinze', 'dezasseis', 'dezassete', 'dezoito', 'dezanove'];
    const T = ['', '', 'vinte', 'trinta', 'quarenta', 'cinquenta', 'sessenta', 'setenta', 'oitenta', 'noventa'];
    const H = ['', 'cento', 'duzentos', 'trezentos', 'quatrocentos', 'quinhentos', 'seiscentos', 'setecentos', 'oitocentos', 'novecentos'];
    const upTo999 = (n) => {
      if (n === 0) return '';
      if (n === 100) return 'cem';
      const h = Math.floor(n / 100), r = n % 100, parts = [];
      if (h) parts.push(H[h]);
      if (r) parts.push(r < 20 ? U[r] : T[Math.floor(r / 10)] + (r % 10 ? ' e ' + U[r % 10] : ''));
      return parts.join(' e ');
    };
    const int = (n) => {
      if (n === 0) return 'zero';
      const groups = [[1e9, 'mil milhões', 'mil milhões'], [1e6, 'milhão', 'milhões'], [1e3, 'mil', 'mil']];
      const out = []; let rest = n;
      for (const [div, one, many] of groups) {
        const q = Math.floor(rest / div); rest %= div;
        if (!q) continue;
        if (div === 1e3) out.push(q === 1 ? 'mil' : upTo999(q) + ' mil');
        else out.push(upTo999(q) + ' ' + (q === 1 ? one : many));
      }
      if (rest) out.push(upTo999(rest));
      // "e" antes do último grupo quando é < 100 ou centena redonda
      if (out.length > 1 && (rest < 100 || rest % 100 === 0) && rest) out.splice(out.length - 1, 0, 'e');
      return out.join(' ').replace(/ e e /g, ' e ');
    };
    const n = Math.round(Math.abs(Number(value || 0)) * 100);
    const i = Math.floor(n / 100), c = n % 100;
    const big = (cur || 'MZN') === 'MZN' ? (i === 1 ? 'metical' : 'meticais') : (cur || '');
    let s = int(i) + (i >= 1e6 && i % 1e6 === 0 ? ' de ' : ' ') + big;   // um milhão DE meticais
    if (c) s += ' e ' + int(c) + (c === 1 ? ' centavo' : ' centavos');
    return s.charAt(0).toUpperCase() + s.slice(1);
  }

  /** CSS de página (@page) para o recibo, conforme o formato e a orientação escolhidos. */
  function receiptPageCss(company) {
    const s = S(company), f = s.receipt_format || 'a5', o = s.receipt_orientation || 'landscape';
    if (f.startsWith('thermal')) return `@page{size:${WIDTH[f]} auto;margin:0}body{margin:0}`;
    return `@page{size:${(SIZE[f] || SIZE.a5)[o] || SIZE.a5.landscape};margin:7mm}`;
  }

  function companyBlock(c, s, small) {
    return `<div class="rc-co">
      ${s.receipt_show_logo !== false && c.logo ? `<img src="${esc(c.logo)}" alt="" class="rc-logo">` : ''}
      <div><div class="rc-name">${esc(c.name)}</div>
      ${c.slogan && !small ? `<div class="rc-mut">${esc(c.slogan)}</div>` : ''}
      ${loc(c) ? `<div>${esc(loc(c))}</div>` : ''}
      <div>${[c.nuit ? 'NUIT ' + esc(c.nuit) : '', c.phone ? 'Tel. ' + esc(c.phone) : '', c.email ? esc(c.email) : ''].filter(Boolean).join(' · ')}</div>
      ${s.receipt_header ? `<div class="rc-mut">${nl2br(s.receipt_header)}</div>` : ''}</div></div>`;
  }

  // ---------------- Recibo ----------------
  function receipt(r) {
    const c = r.company || {}, s = S(c), cur = s.currency || 'MZN';
    const f = s.receipt_format || 'a5', thermal = f.startsWith('thermal');
    const land = !thermal && (s.receipt_orientation || 'landscape') === 'landscape';
    const accent = s.receipt_accent || '#0f766e';
    const allocs = r.allocations || [];
    const voided = r.status === 'voided', pending = r.status === 'pending';
    const copies = Math.max(1, Math.min(3, Number(s.receipt_copies || 1)));
    const showRead = s.receipt_show_readings !== false, showDebt = s.receipt_show_debt !== false;
    const fs = f === 'thermal58' ? 10 : thermal ? 11.5 : f === 'a4' ? 12.5 : 11.5;

    const css = `<style>
      .rc{background:#fff;color:#111;font:${fs}px/1.4 ${thermal ? "'Courier New',monospace" : "'Segoe UI',Arial,sans-serif"};position:relative;margin:0 auto 14px;
          ${thermal ? `width:${WIDTH[f]};padding:6px 5px` : `max-width:${land ? (f === 'a4' ? '285mm' : '200mm') : (f === 'a4' ? '200mm' : '138mm')};border:1px solid #d6dde3;border-radius:6px;padding:14px 16px;border-top:5px solid ${accent}`};page-break-after:always;break-after:page}
      .rc:last-child{page-break-after:auto;break-after:auto}
      .rc-co{display:flex;gap:10px;align-items:center}.rc-logo{max-height:${thermal ? 38 : 58}px;max-width:${thermal ? '60%' : '110px'}}
      .rc-name{font-weight:800;font-size:${fs + 3}px;color:${thermal ? '#000' : accent}}.rc-mut{color:#555;font-size:${fs - 1}px}
      .rc-title{display:flex;justify-content:space-between;align-items:flex-end;gap:8px;margin:10px 0 8px;padding:6px 0;border-top:1px solid #e3e8ec;border-bottom:1px solid #e3e8ec}
      .rc-title h2{margin:0;font-size:${fs + 4}px;letter-spacing:.5px;color:${thermal ? '#000' : accent}}
      .rc-kv{width:100%;border-collapse:collapse}.rc-kv td{padding:2px 0;vertical-align:top}.rc-kv td:last-child{text-align:right;font-weight:600}
      .rc-tb{width:100%;border-collapse:collapse;margin:6px 0}.rc-tb th{background:${thermal ? '#fff' : '#f3f6f8'};font-size:${fs - 2}px;text-transform:uppercase;text-align:left;padding:4px 5px;border-bottom:1px solid #cfd8de}
      .rc-tb td{padding:4px 5px;border-bottom:1px solid #eef2f4}.rc-tb .n{text-align:right;white-space:nowrap}
      .rc-total{display:flex;justify-content:space-between;align-items:center;background:${thermal ? '#fff' : accent};color:${thermal ? '#000' : '#fff'};padding:7px 10px;border-radius:5px;font-weight:800;font-size:${fs + 3}px;margin:6px 0;${thermal ? 'border:1px dashed #000' : ''}}
      .rc-notes{border:1px dashed #b9c4cc;border-radius:5px;padding:6px 8px;margin-top:6px;font-size:${fs - 1}px}
      .rc-sign{display:flex;gap:30px;margin-top:22px}.rc-sign div{flex:1;border-top:1px solid #333;text-align:center;padding-top:3px;font-size:${fs - 1.5}px;color:#444}
      .rc-cols{display:grid;grid-template-columns:${land ? '1fr 1.55fr' : '1fr'};gap:16px}
      .rc-stamp{position:absolute;top:40%;left:50%;transform:translate(-50%,-50%) rotate(-18deg);font-size:46px;font-weight:900;color:rgba(220,38,38,.25);border:5px solid rgba(220,38,38,.25);padding:4px 18px;border-radius:10px;pointer-events:none}
      .rc-foot{text-align:center;color:#555;font-size:${fs - 1.5}px;margin-top:8px}
      .rc-words{font-style:italic;font-size:${fs - 1}px;color:#333;margin:-2px 0 6px;padding:0 2px}
      .rc-sum td{border-top:1px dotted #d6dde3;padding:3px 0}.rc-sum .rc-strong td{font-weight:800;border-top:1px solid #333;font-size:${fs + 0.5}px}
      .rc-badge{display:inline-block;border:1px solid ${accent};color:${accent};border-radius:99px;padding:1px 8px;font-size:${fs - 2}px;font-weight:700;letter-spacing:.3px}
      ${thermal ? '.rc-co{flex-direction:column;text-align:center}.rc-title{flex-direction:column;align-items:center}' : ''}
    </style>`;

    const one = (copy) => {
      const left = `${companyBlock(c, s)}
        <div class="rc-title"><div><span class="rc-badge">PAGAMENTO DE ÁGUA</span><h2>${esc(s.receipt_title || 'RECIBO')} Nº ${esc(r.receipt_number)}</h2></div>
          <div style="text-align:right">${copies > 1 ? `<b>${copy === 1 ? 'Original' : copy + '.ª via'}</b><br>` : ''}${dt(r.paid_at)}</div></div>
        <table class="rc-kv">
          <tr><td>Cliente</td><td>${esc(r.customer_name)}</td></tr>
          <tr><td>Código</td><td>${esc(r.customer_code)}</td></tr>
          ${r.phone ? `<tr><td>Telefone</td><td>${esc(r.phone)}</td></tr>` : ''}
          ${r.customer_nuit ? `<tr><td>NUIT</td><td>${esc(r.customer_nuit)}</td></tr>` : ''}
          ${r.address ? `<tr><td>Morada</td><td>${esc(r.address)}</td></tr>` : ''}
          <tr><td>Pagamento</td><td>${esc(METHODS[r.method] || r.method)}${r.reference ? ' · ' + esc(r.reference) : ''}</td></tr>
          <tr><td>Operador</td><td>${esc(r.cashier || '—')}</td></tr>
        </table>`;
      const rows = allocs.map(a => thermal
        ? `<tr><td colspan="2"><b>${esc(a.invoice_number)}</b> · ${period(a.period)} · Conta ${esc(a.account_number)}
            ${showRead && a.current_value != null ? `<br>Leitura: ${esc(a.previous_value)} → ${esc(a.current_value)} (${esc(a.consumption)} m³)` : ''}
            ${a.kind === 'manual' && a.description ? `<br>${esc(a.description)}` : ''}</td></tr>
           <tr><td>Pago${showDebt ? ` · falta ${amount(a.balance_after)}` : ''}</td><td class="n"><b>${amount(a.amount)}</b></td></tr>`
        : `<tr><td><b>${esc(a.invoice_number)}</b><br><span class="rc-mut">Conta ${esc(a.account_number)}${a.meter_number ? ' · Cont. ' + esc(a.meter_number) : ''}</span></td>
            <td>${period(a.period)}${a.kind === 'manual' && a.description ? `<br><span class="rc-mut">${esc(a.description)}</span>` : ''}</td>
            ${showRead ? `<td class="n">${a.current_value != null ? esc(a.previous_value) : '—'}</td><td class="n">${a.current_value != null ? esc(a.current_value) : '—'}</td><td class="n">${a.current_value != null ? esc(a.consumption) + ' m³' : '—'}</td>` : ''}
            <td class="n">${amount(a.balance_before)}</td><td class="n"><b>${amount(a.amount)}</b></td>${showDebt ? `<td class="n">${amount(a.balance_after)}</td>` : ''}</tr>`).join('');
      const head = thermal ? '' : `<thead><tr><th>Fatura</th><th>Mês</th>${showRead ? '<th class="n">Leit. anterior</th><th class="n">Leit. atual</th><th class="n">Consumo</th>' : ''}
          <th class="n">Em dívida</th><th class="n">Pago</th>${showDebt ? '<th class="n">Falta</th>' : ''}</tr></thead>`;
      const before = allocs.reduce((a, x) => a + Number(x.balance_before || 0), 0);
      const after = allocs.reduce((a, x) => a + Number(x.balance_after || 0), 0);
      const right = `<table class="rc-tb">${head}<tbody>${rows}</tbody></table>
        <div class="rc-total"><span>TOTAL PAGO</span><span>${money(r.amount, cur)}</span></div>
        <div class="rc-words">${esc(words(r.amount, cur))}</div>
        ${showDebt ? `<table class="rc-kv rc-sum">
          <tr><td>Em dívida nas faturas pagas (antes)</td><td>${money(before, cur)}</td></tr>
          <tr><td>Pago agora</td><td>− ${money(r.amount, cur)}</td></tr>
          <tr><td>Falta pagar nestas faturas</td><td>${money(after, cur)}</td></tr>
          <tr class="rc-strong"><td>Dívida total do cliente após este pagamento</td><td>${money(r.debt_now, cur)}</td></tr></table>` : ''}
        ${pending ? '<div class="rc-notes"><b>Pagamento a aguardar validação.</b></div>' : ''}
        ${r.notes ? `<div class="rc-notes">${nl2br(r.notes)}</div>` : ''}
        ${s.receipt_notes ? `<div class="rc-notes">${nl2br(s.receipt_notes)}</div>` : ''}
        ${s.payment_instructions ? `<div class="rc-notes"><b>Como pagar:</b> ${nl2br(s.payment_instructions)}</div>` : ''}
        ${s.receipt_show_signature !== false && !thermal ? '<div class="rc-sign"><div>O cliente</div><div>O operador</div></div>' : ''}
        <div class="rc-foot">${s.receipt_footer ? nl2br(s.receipt_footer) : 'Obrigado pelo pagamento.'}</div>`;
      return `<div class="rc">${voided ? '<div class="rc-stamp">ANULADO</div>' : ''}<div class="rc-cols"><div>${left}</div><div>${right}</div></div></div>`;
    };
    let html = css;
    for (let i = 1; i <= copies; i++) html += one(i);
    return html;
  }

  // ---------------- Fatura ----------------
  function invoice(data) {
    const i = data.invoice || {}, c = data.company || {}, s = S(c), cur = s.currency || 'MZN';
    const accent = s.receipt_accent || '#0f766e';
    const line = (k, v) => Number(v) ? `<tr><td>${k}</td><td class="n">${money(v, cur)}</td></tr>` : '';
    const balance = Number(i.total || 0) - Number(i.paid || 0);
    return `<style>
      .iv{background:#fff;color:#111;font:12.5px/1.45 'Segoe UI',Arial,sans-serif;border:1px solid #d6dde3;border-top:6px solid ${accent};border-radius:6px;padding:20px 22px;max-width:190mm;margin:0 auto}
      .iv .rc-co{display:flex;gap:12px;align-items:center}.iv .rc-logo{max-height:62px;max-width:120px}.iv .rc-name{font-weight:800;font-size:17px;color:${accent}}.iv .rc-mut{color:#555}
      .iv-top{display:flex;justify-content:space-between;gap:16px;align-items:flex-start;border-bottom:1px solid #e3e8ec;padding-bottom:12px;margin-bottom:12px}
      .iv h2{margin:0;color:${accent};font-size:20px}.iv-grid{display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:12px}
      .iv-box{border:1px solid #e3e8ec;border-radius:6px;padding:10px 12px}.iv-box small{display:block;color:#64748b;text-transform:uppercase;font-size:10px;letter-spacing:.4px;margin-bottom:3px}
      .iv table{width:100%;border-collapse:collapse}.iv td{padding:5px 4px;border-bottom:1px solid #eef2f4}.iv .n{text-align:right;white-space:nowrap}
      .iv-read{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin:10px 0}.iv-read div{background:#f3f6f8;border-radius:6px;padding:8px;text-align:center}.iv-read b{display:block;font-size:17px}
      .iv-total{display:flex;justify-content:space-between;background:${accent};color:#fff;font-weight:800;font-size:16px;padding:9px 12px;border-radius:6px;margin-top:10px}
      .iv-notes{border:1px dashed #b9c4cc;border-radius:6px;padding:8px 10px;margin-top:10px;font-size:11.5px}
    </style>
    <div class="iv">
      <div class="iv-top">${companyBlock(c, s)}
        <div style="text-align:right"><h2>FATURA</h2><b>${esc(i.number)}</b><br>Mês: ${period(i.period)}<br>Emissão: ${date(i.issue_date)}<br>
          <b>Vencimento: ${date(i.due_date)}</b>${i.status === 'cancelled' ? '<br><b style="color:#dc2626">ANULADA</b>' : ''}</div></div>
      <div class="iv-grid">
        <div class="iv-box"><small>Cliente</small><b>${esc(i.customer_name)}</b><br>Código ${esc(i.customer_code)}${i.phone ? ' · ' + esc(i.phone) : ''}${i.customer_nuit ? '<br>NUIT ' + esc(i.customer_nuit) : ''}</div>
        <div class="iv-box"><small>Conta / local</small><b>${esc(i.account_number)}</b>${i.meter_number ? ' · Contador ' + esc(i.meter_number) : ''}<br>${esc(i.address || '')}</div>
      </div>
      ${i.kind === 'consumption' ? `<div class="iv-read"><div>Leitura anterior<b>${esc(i.previous_value)}</b></div><div>Leitura atual<b>${esc(i.current_value)}</b></div><div>Consumo<b>${esc(i.consumption)} m³</b></div></div>` : ''}
      <table>
        ${i.kind === 'manual' ? `<tr><td>${esc(i.description || 'Serviço')}</td><td class="n">${money(i.other_amount, cur)}</td></tr>` : line('Água (' + esc(i.consumption) + ' m³)', i.water_amount)}
        ${line('Saneamento', i.sewer_amount)}${line('Taxa fixa', i.fixed_fee)}${i.kind !== 'manual' ? line('Outros', i.other_amount) : ''}
        ${line('Multa por atraso', i.fine_amount)}${line('Juros de mora', i.interest_amount)}
        ${Number(i.discount) ? `<tr><td>Desconto</td><td class="n">− ${money(i.discount, cur)}</td></tr>` : ''}
        <tr><td><b>Total da fatura</b></td><td class="n"><b>${money(i.total, cur)}</b></td></tr>
        ${Number(i.paid) ? `<tr><td>Já pago</td><td class="n">− ${money(i.paid, cur)}</td></tr>` : ''}
      </table>
      <div class="iv-total"><span>A PAGAR</span><span>${money(balance, cur)}</span></div>
      ${s.payment_instructions ? `<div class="iv-notes"><b>Como pagar:</b> ${nl2br(s.payment_instructions)}</div>` : ''}
      ${s.receipt_notes ? `<div class="iv-notes">${nl2br(s.receipt_notes)}</div>` : ''}
      <div style="text-align:center;color:#64748b;font-size:11px;margin-top:12px">${s.receipt_footer ? nl2br(s.receipt_footer) : ''}</div>
    </div>`;
  }

  // ---------------- Extrato ----------------
  function statement(st) {
    const c = st.company || {}, s = S(c), cur = s.currency || 'MZN', cu = st.customer || {};
    const accent = s.receipt_accent || '#0f766e';
    const sections = (st.sections || []).map((sec, idx) => {
      const a = sec.account;
      const rows = (sec.movements || []).map(m => `<tr>
        <td>${date(m.date)}</td><td>${m.type === 'invoice' ? 'Fatura' : m.type === 'payment' ? 'Pagamento' : esc(m.type)}</td>
        <td>${esc(m.document)}</td><td>${esc(m.description || '')}${m.account_number && !a ? `<br><small>Conta ${esc(m.account_number)}</small>` : ''}</td>
        <td>${m.period ? period(m.period) : ''}</td>
        <td class="n">${m.current_value != null ? esc(m.previous_value) + ' → ' + esc(m.current_value) : ''}</td>
        <td class="n">${m.consumption != null && m.type === 'invoice' ? esc(m.consumption) + ' m³' : ''}</td>
        <td class="n">${Number(m.debit) ? amount(m.debit) : ''}</td><td class="n">${Number(m.credit) ? amount(m.credit) : ''}</td>
        <td class="n"><b>${amount(m.balance)}</b></td></tr>`).join('');
      return `<div class="st-sec" style="${idx > 0 ? 'page-break-before:always;break-before:page;margin-top:28px;padding-top:18px;border-top:2px dashed #cbd5e1' : ''}">
        ${idx > 0 ? head() : ''}
        <h3>${a ? `Conta ${esc(a.number)} · ${esc(({ residential: 'Doméstico', commercial: 'Comercial', public: 'Público', industrial: 'Industrial' })[a.category] || a.category || '')}
            ${a.meter_number ? ' · Contador ' + esc(a.meter_number) : ''}<br><small>${esc(a.address || '')}</small>` : 'Todas as contas'}</h3>
        <table class="st"><thead><tr><th>Data</th><th>Tipo</th><th>Documento</th><th>Descrição</th><th>Mês</th><th class="n">Leituras</th><th class="n">Consumo</th>
          <th class="n">Débito</th><th class="n">Crédito</th><th class="n">Saldo</th></tr></thead>
          <tbody><tr><td colspan="9"><i>Saldo anterior a ${date(st.from)}</i></td><td class="n"><b>${amount(sec.opening)}</b></td></tr>${rows ||
            '<tr><td colspan="10">Sem movimentos no período.</td></tr>'}</tbody>
          <tfoot><tr><td colspan="7">Totais do período</td><td class="n">${amount(sec.total_debit)}</td><td class="n">${amount(sec.total_credit)}</td><td class="n">${amount(sec.closing)}</td></tr></tfoot></table>
        <div class="st-close">Saldo em dívida em ${date(st.to)}: <b>${money(sec.closing, cur)}</b></div></div>`;
    }).join('');
    function head() {
      return `<div class="st-top">${companyBlock(c, s)}<div style="text-align:right"><h2>EXTRATO DE CONTA</h2>De ${date(st.from)} a ${date(st.to)}<br><small>Emitido em ${dt(st.generated_at)}</small></div></div>
        <div class="st-cu"><div><small>Cliente</small><b>${esc(cu.name)}</b> · ${esc(cu.code)}</div><div><small>Contacto</small>${esc(cu.phone || '—')}</div>
          <div><small>Documento</small>${esc(cu.document || '—')}</div><div><small>Morada</small>${esc([cu.address, cu.neighborhood].filter(Boolean).join(', ') || '—')}</div></div>`;
    }
    return `<style>
      .stw{background:#fff;color:#111;font:11.5px/1.4 'Segoe UI',Arial,sans-serif;max-width:277mm;margin:0 auto}
      .stw .rc-co{display:flex;gap:12px;align-items:center}.stw .rc-logo{max-height:56px;max-width:110px}.stw .rc-name{font-weight:800;font-size:16px;color:${accent}}.stw .rc-mut{color:#555}
      .st-top{display:flex;justify-content:space-between;gap:14px;border-bottom:3px solid ${accent};padding-bottom:10px;margin-bottom:10px}.st-top h2{margin:0;color:${accent};font-size:18px}
      .st-cu{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;background:#f3f6f8;border-radius:6px;padding:8px 10px;margin-bottom:10px}.st-cu small{display:block;color:#64748b;font-size:10px;text-transform:uppercase}
      .stw h3{font-size:13px;margin:12px 0 6px;color:${accent}}.stw h3 small{color:#555;font-weight:400}
      table.st{width:100%;border-collapse:collapse}table.st th{background:#f3f6f8;font-size:10px;text-transform:uppercase;text-align:left;padding:5px;border-bottom:1px solid #cfd8de}
      table.st td{padding:4px 5px;border-bottom:1px solid #eef2f4;vertical-align:top}table.st .n{text-align:right;white-space:nowrap}table.st tfoot td{font-weight:700;background:#f8fafc;border-top:2px solid #cfd8de}
      .st-close{text-align:right;margin-top:8px;font-size:13px}
    </style><div class="stw">${head()}${sections}</div>`;
  }

  // ---------------- Recibo em PDF (para baixar / enviar) ----------------
  function hexRgb(h) { const m = String(h || '#0f766e').match(/^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i); return m ? [1, 2, 3].map(i => parseInt(m[i], 16)) : [15, 118, 110]; }
  /** Gera o PDF de um recibo (A5 vertical) e descarrega-o: Recibo-RC-2026-000123.pdf */
  function receiptPdf(r) {
    if (!window.jspdf || !window.jspdf.jsPDF) { alert('Não foi possível gerar o PDF. Use Imprimir → Guardar como PDF.'); return; }
    const { jsPDF } = window.jspdf;
    const c = r.company || {}, s = S(c), cur = s.currency || 'MZN', acc = hexRgb(s.receipt_accent);
    const doc = new jsPDF({ unit: 'mm', format: 'a5' });
    const W = 148, M = 10;
    let y = 12;
    doc.setFillColor(...acc); doc.rect(0, 0, W, 4, 'F');
    let x = M;
    if (s.receipt_show_logo !== false && c.logo && /^data:image\/(png|jpe?g)/i.test(c.logo)) {
      try { doc.addImage(c.logo, /png/i.test(c.logo) ? 'PNG' : 'JPEG', M, y - 2, 18, 18, undefined, 'FAST'); x = M + 21; } catch (_) { /* logótipo inválido */ }
    }
    doc.setTextColor(...acc); doc.setFont('helvetica', 'bold'); doc.setFontSize(13); doc.text(String(c.name || ''), x, y + 2);
    doc.setTextColor(80); doc.setFont('helvetica', 'normal'); doc.setFontSize(8);
    const info = [loc(c), [c.nuit ? 'NUIT ' + c.nuit : '', c.phone ? 'Tel. ' + c.phone : '', c.email || ''].filter(Boolean).join(' · ')].filter(Boolean);
    info.forEach((l, i) => doc.text(doc.splitTextToSize(l, W - x - M)[0], x, y + 7 + i * 4));
    y = Math.max(y + 18, y + 7 + info.length * 4 + 2);
    doc.setDrawColor(220); doc.line(M, y, W - M, y); y += 7;
    doc.setTextColor(...acc); doc.setFont('helvetica', 'bold'); doc.setFontSize(14);
    doc.text(`${s.receipt_title || 'RECIBO'} Nº ${r.receipt_number}`, M, y);
    doc.setFontSize(9); doc.setTextColor(60); doc.text(dt(r.paid_at), W - M, y, { align: 'right' }); y += 4;
    if (r.status === 'voided' || r.status === 'pending') {
      doc.setTextColor(220, 38, 38); doc.setFontSize(9); doc.text(r.status === 'voided' ? 'ANULADO' : 'A AGUARDAR VALIDAÇÃO', W - M, y + 1, { align: 'right' });
    }
    y += 4;
    // cliente
    doc.setFillColor(243, 246, 248); doc.roundedRect(M, y, W - 2 * M, 22, 2, 2, 'F');
    const kv = (k, v, yy, xx) => { doc.setFont('helvetica', 'normal'); doc.setTextColor(100); doc.setFontSize(7.5); doc.text(k.toUpperCase(), xx, yy);
      doc.setFont('helvetica', 'bold'); doc.setTextColor(20); doc.setFontSize(9.5); doc.text(doc.splitTextToSize(String(v || '—'), 60)[0], xx, yy + 4); };
    kv('Cliente', r.customer_name, y + 5, M + 3); kv('Código', r.customer_code, y + 5, M + 72);
    kv('Pagamento', (METHODS[r.method] || r.method) + (r.reference ? ' · ' + r.reference : ''), y + 14, M + 3); kv('Telefone', r.phone, y + 14, M + 72);
    y += 28;
    // faturas pagas (colunas: [x, alinhamento])
    const C = [[M + 1.5, 'left'], [M + 30, 'left'], [M + 48, 'left'], [M + 88, 'right'], [M + 110, 'right'], [W - M - 1.5, 'right']];
    const cell = (txt, i, yy) => doc.text(String(txt), C[i][0], yy, { align: C[i][1] });
    doc.setFillColor(...acc); doc.rect(M, y, W - 2 * M, 6, 'F');
    doc.setTextColor(255); doc.setFont('helvetica', 'bold'); doc.setFontSize(7.5);
    ['FATURA', 'MÊS', 'LEITURAS', 'CONSUMO', 'PAGO', 'FALTA'].forEach((h, i) => cell(h, i, y + 4));
    y += 6;
    doc.setFont('helvetica', 'normal'); doc.setTextColor(30); doc.setFontSize(8.5);
    (r.allocations || []).forEach((a, i) => {
      if (y > 175) { doc.addPage(); y = 15; }
      if (i % 2) { doc.setFillColor(248, 250, 251); doc.rect(M, y, W - 2 * M, 6.5, 'F'); }
      cell(a.invoice_number || '', 0, y + 4.4);
      cell(period(a.period), 1, y + 4.4);
      cell(a.current_value != null ? `${a.previous_value} -> ${a.current_value}` : String(a.description || '—').slice(0, 20), 2, y + 4.4);
      cell(a.current_value != null ? a.consumption + ' m3' : '—', 3, y + 4.4);
      cell(amount(a.amount), 4, y + 4.4);
      cell(amount(a.balance_after), 5, y + 4.4);
      y += 6.5;
    });
    y += 3;
    // total
    doc.setFillColor(...acc); doc.roundedRect(M, y, W - 2 * M, 10, 2, 2, 'F');
    doc.setTextColor(255); doc.setFont('helvetica', 'bold'); doc.setFontSize(11);
    doc.text('TOTAL PAGO', M + 4, y + 6.6); doc.text(money(r.amount, cur), W - M - 4, y + 6.6, { align: 'right' });
    y += 14;
    doc.setTextColor(60); doc.setFont('helvetica', 'italic'); doc.setFontSize(8.5);
    doc.splitTextToSize(words(r.amount, cur), W - 2 * M).forEach(l => { doc.text(l, M, y); y += 4; });
    y += 2;
    if (s.receipt_show_debt !== false) {
      doc.setFont('helvetica', 'bold'); doc.setTextColor(20); doc.setFontSize(10);
      doc.text('Dívida total após este pagamento', M, y); doc.text(money(r.debt_now, cur), W - M, y, { align: 'right' }); y += 7;
    }
    doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(70);
    [r.notes, s.receipt_notes, s.payment_instructions ? 'Como pagar: ' + s.payment_instructions : ''].filter(Boolean).forEach(n => {
      doc.splitTextToSize(String(n).replace(/\n/g, ' '), W - 2 * M).forEach(l => { if (y < 195) { doc.text(l, M, y); y += 3.8; } });
      y += 1.5;
    });
    doc.text('Operador: ' + (r.cashier || '—'), M, 200);
    doc.setTextColor(120); doc.text(String(s.receipt_footer || 'Obrigado pelo pagamento.').replace(/\n/g, ' ').slice(0, 110), W / 2, 205, { align: 'center' });
    doc.save(`Recibo-${r.receipt_number}.pdf`);
  }

  window.PrintDocs = { receipt, receiptPageCss, receiptPdf, words, invoice, statement, money, amount, date, period };
})();
