/* Login, registo de empresa (com PDF de credenciais) e recuperação de senha por email + nome. */
(function () {
  'use strict';
  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  let info = { support_phone: '861544303', support_name: 'Gestora Paula Zacarias', version: '13.0.0' };
  let lastReg = null;

  // ---------------- utilitários ----------------
  async function call(method, url, body) {
    try {
      const res = await fetch(url, { method, credentials: 'same-origin', headers: { 'Content-Type': 'application/json', Accept: 'application/json' }, body: body ? JSON.stringify(body) : undefined });
      const t = await res.text();
      let d = {}; try { d = t ? JSON.parse(t) : {}; } catch (_) { d = { success: false, error: 'Resposta inválida do servidor.' }; }
      if (!res.ok) { d.success = false; d.error = d.error || 'Erro ' + res.status; }
      return d;
    } catch (_) { return { success: false, error: 'Sem ligação ao servidor. Verifique a internet.' }; }
  }
  function msg(id, type, text) {
    const el = $(id);
    const ic = type === 'error' ? 'exclamation-circle' : type === 'warning' ? 'exclamation-triangle' : 'check-circle';
    el.className = 'msg ' + type;
    el.innerHTML = `<i class="fas fa-${ic}"></i><span>${esc(text)}</span>`;
  }
  const hide = (id) => { $(id).className = 'msg hidden'; $(id).innerHTML = ''; };
  function busy(btn, on, text) {
    if (on) { btn.dataset.html = btn.innerHTML; btn.disabled = true; btn.innerHTML = `<i class="fas fa-spinner spin"></i> ${text || 'Aguarde…'}`; }
    else { btn.disabled = false; if (btn.dataset.html) btn.innerHTML = btn.dataset.html; }
  }
  function openOv(id) { $(id).classList.add('open'); document.body.classList.add('modal-open'); }
  function closeOv(el) { el.classList.remove('open'); if (!document.querySelector('.ov.open')) document.body.classList.remove('modal-open'); }
  document.querySelectorAll('[data-ov-close]').forEach(b => b.addEventListener('click', () => closeOv(b.closest('.ov'))));
  document.querySelectorAll('.ov').forEach(o => o.addEventListener('click', (e) => { if (e.target === o) closeOv(o); }));
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') document.querySelectorAll('.ov.open').forEach(closeOv); });
  document.querySelectorAll('[data-eye]').forEach(b => b.addEventListener('click', () => {
    const i = $(b.dataset.eye); const show = i.type === 'password';
    i.type = show ? 'text' : 'password';
    b.querySelector('i').className = show ? 'fas fa-eye-slash' : 'fas fa-eye';
  }));
  document.querySelectorAll('[data-copy]').forEach(b => b.addEventListener('click', async () => {
    const text = $(b.dataset.copy).textContent.trim();
    try { await navigator.clipboard.writeText(text); } catch (_) {
      const ta = document.createElement('textarea'); ta.value = text; document.body.appendChild(ta); ta.select();
      try { document.execCommand('copy'); } catch (__) { /* */ } ta.remove();
    }
    const h = b.innerHTML; b.classList.add('done'); b.innerHTML = '<i class="fas fa-check"></i> Copiado';
    setTimeout(() => { b.classList.remove('done'); b.innerHTML = h; }, 1600);
  }));

  function particles() {
    if (window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const box = $('particles'); const n = innerWidth < 640 ? 22 : 45;
    for (let i = 0; i < n; i++) {
      const p = document.createElement('div'); const s = Math.random() * 12 + 2;
      p.className = 'particle'; p.style.cssText = `width:${s}px;height:${s}px;left:${Math.random() * 100}%;bottom:-10px;animation-duration:${Math.random() * 28 + 16}s;animation-delay:${Math.random() * 22}s;opacity:${Math.random() * .3 + .02}`;
      box.appendChild(p);
    }
  }

  // ---------------- login ----------------
  $('loginForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const username = $('username').value.trim(), password = $('password').value;
    if (!username || !password) { msg('loginMsg', 'error', 'Preencha o utilizador e a senha.'); return; }
    const btn = $('loginBtn'); busy(btn, true, 'A entrar…'); hide('loginMsg');
    const r = await call('POST', '/api/auth/login', { username, password });
    if (r.success && r.user) {
      try {
        localStorage.setItem('agua.user', JSON.stringify(r.user));
        sessionStorage.removeItem('agua.brand');
        if ($('remember').checked) localStorage.setItem('agua.remember', username); else localStorage.removeItem('agua.remember');
      } catch (_) { /* */ }
      msg('loginMsg', 'success', `Bem-vindo, ${r.user.name}! A abrir…`);
      setTimeout(() => location.replace(r.redirect || r.user.home || '/'), 400);
      return;
    }
    msg('loginMsg', 'error', r.error || 'Utilizador ou senha incorretos.');
    busy(btn, false);
  });

  // ---------------- recuperar senha ----------------
  function fStep(n) { ['fStep1', 'fStep2', 'fStep3'].forEach((id, i) => $(id).classList.toggle('hidden', i !== n - 1)); }
  $('openForgot').addEventListener('click', () => {
    fStep(1); hide('fMsg'); hide('rMsg');
    $('fEmail').value = /@/.test($('username').value) ? $('username').value.trim() : '';
    openOv('forgotModal'); setTimeout(() => $('fEmail').focus(), 80);
  });
  $('forgotForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = $('fEmail').value.trim(), name = $('fName').value.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) { msg('fMsg', 'error', 'Indique um email válido.'); return; }
    if (name.length < 3) { msg('fMsg', 'error', 'Indique o nome completo usado no registo.'); return; }
    const btn = $('fBtn'); busy(btn, true, 'A verificar…'); hide('fMsg');
    const r = await call('POST', '/api/auth/forgot', { email, name });
    busy(btn, false);
    if (!r.success) { msg('fMsg', 'error', r.error); return; }
    if (r.channel === 'admin') {
      fStep(3);
      $('fDoneTitle').textContent = 'Pedido registado';
      $('fDoneText').textContent = r.message;
      document.querySelector('#fStep3 .ok-ic i').className = 'fas fa-user-shield';
      return;
    }
    fStep(2);
    $('fStep2Text').textContent = r.message + ' Insira o código e defina a nova senha.';
    if (r.dev_code) $('rCode').value = r.dev_code;
    setTimeout(() => $('rCode').focus(), 80);
  });
  $('rBack').addEventListener('click', () => fStep(1));
  $('resetForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const code = $('rCode').value.trim(), p1 = $('rPass').value, p2 = $('rPass2').value;
    if (!/^\d{6}$/.test(code)) { msg('rMsg', 'error', 'O código tem 6 dígitos.'); return; }
    if (p1.length < 6) { msg('rMsg', 'error', 'A nova senha deve ter pelo menos 6 caracteres.'); return; }
    if (p1 !== p2) { msg('rMsg', 'error', 'As senhas não coincidem.'); return; }
    const btn = $('rBtn'); busy(btn, true, 'A guardar…'); hide('rMsg');
    const r = await call('POST', '/api/auth/reset', { email: $('fEmail').value.trim(), code, new_password: p1 });
    busy(btn, false);
    if (!r.success) { msg('rMsg', 'error', r.error); return; }
    $('fDoneTitle').textContent = 'Senha alterada!';
    $('fDoneText').textContent = 'Já pode entrar com a nova senha.';
    fStep(3);
  });
  $('fFinish').addEventListener('click', () => {
    closeOv($('forgotModal'));
    if ($('fEmail').value) { $('username').value = $('fEmail').value.trim(); $('password').value = ''; setTimeout(() => $('password').focus(), 200); }
  });

  // ---------------- registar empresa ----------------
  $('openRegister').addEventListener('click', () => {
    $('gStep1').classList.remove('hidden'); $('gStep2').classList.add('hidden');
    $('registerForm').reset(); hide('gMsg'); lastReg = null;
    openOv('registerModal'); setTimeout(() => document.querySelector('#registerForm [name=name]').focus(), 80);
  });
  $('registerForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const d = {};
    e.target.querySelectorAll('[name]').forEach(i => { d[i.name] = i.value.trim() || null; });
    if (!d.name || !d.phone) { msg('gMsg', 'error', 'Indique o nome e o telefone da empresa.'); return; }
    if (!d.manager_name || !d.manager_email) { msg('gMsg', 'error', 'Indique o nome completo e o email do gestor.'); return; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(d.manager_email)) { msg('gMsg', 'error', 'Email do gestor inválido.'); return; }
    const btn = $('gBtn'); busy(btn, true, 'A registar…'); hide('gMsg');
    const r = await call('POST', '/api/auth/register-company', d);
    busy(btn, false);
    if (!r.success) { msg('gMsg', 'error', r.error || 'Não foi possível registar a empresa.'); return; }
    lastReg = Object.assign({}, d, r);
    $('gCode').textContent = r.username || r.code;
    $('gPass').textContent = r.temp_password;
    $('gEmail').textContent = r.manager_email || d.manager_email;
    const pending = r.status === 'pending';
    $('gWait').classList.toggle('hidden', !pending);
    $('gPendingNote').textContent = pending ? 'A conta fica ativa depois da aprovação do administrador.' : 'A conta já está ativa.';
    $('gSupport').textContent = `${r.support_phone || info.support_phone} (${r.support_name || info.support_name})`;
    $('gStep1').classList.add('hidden'); $('gStep2').classList.remove('hidden');
    try { downloadPdf(lastReg); } catch (err) { console.error(err); }
  });
  $('gLogin').addEventListener('click', () => {
    closeOv($('registerModal'));
    if (lastReg) { $('username').value = lastReg.username || lastReg.code; $('password').value = ''; setTimeout(() => $('password').focus(), 200); }
  });
  $('gCsv').addEventListener('click', () => lastReg && downloadCsv(lastReg));
  $('gPdf').addEventListener('click', () => {
    if (!lastReg) return;
    try { downloadPdf(lastReg); } catch (err) { console.error(err); msg('gMsg', 'error', 'Não foi possível gerar o PDF. Use o CSV.'); }
  });

  const fileName = (n) => String(n || 'empresa').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-zA-Z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 60) || 'empresa';

  function downloadCsv(r) {
    const rows = [['Campo', 'Valor'], ['=== EMPRESA ===', ''], ['Nome', r.name], ['NUIT', r.nuit], ['Telefone', r.phone], ['Email', r.email],
      ['Endereço', [r.address, r.city, r.province].filter(Boolean).join(', ')], ['Código da empresa', r.code],
      ['', ''], ['=== ACESSO DO GESTOR ===', ''], ['Nome', r.manager_name], ['Email', r.manager_email], ['Telefone', r.manager_phone],
      ['Utilizador', r.username], ['Senha temporária', r.temp_password], ['Primeiro acesso', 'Obrigatório definir nova senha'],
      ['', ''], ['Estado', r.status === 'pending' ? 'PENDENTE DE APROVAÇÃO' : 'ATIVA'],
      ['Suporte', `${r.support_phone || info.support_phone} (${r.support_name || info.support_name})`],
      ['Data de registo', new Date().toLocaleString('pt-PT')], ['Endereço do sistema', location.origin]];
    const csv = rows.map(row => row.map(v => { const s = v == null ? '' : String(v); return /[",;\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; }).join(';')).join('\r\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' }));
    a.download = `AguaSistema_Credenciais_${fileName(r.name)}.csv`;
    document.body.appendChild(a); a.click(); a.remove();
  }

  // ---------------- PDF: credenciais + documento administrativo ----------------
  function downloadPdf(r) {
    if (!window.jspdf || !window.jspdf.jsPDF) { downloadCsv(r); return; }
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ unit: 'mm', format: 'a4' });
    const W = doc.internal.pageSize.getWidth(), H = doc.internal.pageSize.getHeight(), M = 15, CW = W - 2 * M;
    const primary = [0, 119, 190], dark = [10, 40, 64], text = [45, 45, 45], gray = [120, 120, 120];
    const now = new Date().toLocaleString('pt-PT');
    const ref = 'DOC-' + String(r.code || 'EMP').replace(/[^A-Z0-9]/gi, '') + '-' + Date.now().toString().slice(-6);
    const support = `${r.support_phone || info.support_phone} (${r.support_name || info.support_name})`;
    let y = M;

    const header = () => {
      doc.setFillColor(...dark); doc.rect(0, 0, W, 34, 'F');
      doc.setFillColor(...primary); doc.roundedRect(M, 8, 16, 16, 3, 3, 'F');
      doc.setTextColor(255, 255, 255); doc.setFont('helvetica', 'bold'); doc.setFontSize(18); doc.text('AguaSistema', M + 22, 15);
      doc.setFont('helvetica', 'normal'); doc.setFontSize(8.5); doc.setTextColor(200, 220, 240);
      doc.text('Sistema de Gestão de Água', M + 22, 20); doc.text('Registo de empresa e termos de utilização', M + 22, 25);
      doc.text('Ref: ' + ref, W - M, 15, { align: 'right' }); doc.text('Emitido: ' + now, W - M, 20, { align: 'right' });
      y = 44;
    };
    const ensure = (h) => { if (y + (h || 18) > H - 18) { doc.addPage(); header(); } };
    const title = (n, t) => { ensure(16); doc.setFillColor(...primary); doc.rect(M, y - 4, 1.5, 6, 'F'); doc.setTextColor(...dark); doc.setFont('helvetica', 'bold'); doc.setFontSize(11); doc.text(n + '. ' + t, M + 4, y); y += 7; };
    const para = (t) => {
      doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(...text);
      doc.splitTextToSize(t, CW - 6).forEach(l => { ensure(6); doc.text(l, M + 4, y); y += 4.4; }); y += 1.5;
    };
    const bullet = (t) => {
      doc.setFont('helvetica', 'normal'); doc.setFontSize(9);
      doc.splitTextToSize(t, CW - 10).forEach((l, i) => { ensure(6); if (!i) { doc.setTextColor(...primary); doc.text('•', M + 5, y); } doc.setTextColor(...text); doc.text(l, M + 9, y); y += 4.4; }); y += .8;
    };
    const field = (k, v, big) => {
      ensure(7); doc.setFont('helvetica', 'bold'); doc.setFontSize(9); doc.setTextColor(...dark); doc.text(k + ':', M + 4, y);
      doc.setFont(big ? 'courier' : 'helvetica', big ? 'bold' : 'normal'); doc.setFontSize(big ? 12 : 9); doc.setTextColor(...(big ? primary : text));
      doc.text(String(v || '—'), M + 62, y); y += big ? 6.5 : 5;
    };
    const box = (kind, t, lines) => {
      const bg = kind === 'danger' ? [254, 226, 226] : kind === 'success' ? [220, 252, 231] : [255, 243, 205];
      const fg = kind === 'danger' ? [153, 27, 27] : kind === 'success' ? [22, 101, 52] : [133, 100, 4];
      const h = 9 + lines.length * 5; ensure(h + 4);
      doc.setFillColor(...bg); doc.roundedRect(M, y - 2, CW, h, 3, 3, 'F');
      doc.setTextColor(...fg); doc.setFont('helvetica', 'bold'); doc.setFontSize(10); doc.text(t, M + 5, y + 4);
      doc.setFont('helvetica', 'normal'); doc.setFontSize(8.5); lines.forEach((l, i) => doc.text(l, M + 5, y + 10 + i * 5));
      y += h + 4;
    };

    // Capa
    doc.setFillColor(...dark); doc.rect(0, 0, W, H, 'F');
    doc.setFillColor(...primary); doc.circle(W / 2, 62, 18, 'F');
    doc.setTextColor(255, 255, 255); doc.setFont('helvetica', 'bold'); doc.setFontSize(30); doc.text('AguaSistema', W / 2, 115, { align: 'center' });
    doc.setFont('helvetica', 'normal'); doc.setFontSize(12); doc.setTextColor(200, 220, 240); doc.text('Sistema de Gestão de Água', W / 2, 125, { align: 'center' });
    doc.setDrawColor(...primary); doc.setLineWidth(.5); doc.line(W / 2 - 40, 134, W / 2 + 40, 134);
    doc.setFont('helvetica', 'bold'); doc.setFontSize(16); doc.setTextColor(255, 255, 255);
    doc.text('REGISTO DE EMPRESA', W / 2, 152, { align: 'center' }); doc.setFontSize(12); doc.text('Credenciais de acesso e termos de utilização', W / 2, 161, { align: 'center' });
    doc.setFontSize(11); doc.setTextColor(...primary); doc.text('Empresa: ' + (r.name || '—'), W / 2, 185, { align: 'center' });
    doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(200, 220, 240);
    doc.text('Código: ' + (r.code || '—'), W / 2, 193, { align: 'center' }); doc.text('Gestor: ' + (r.manager_name || '—'), W / 2, 200, { align: 'center' });
    doc.text('Ref.: ' + ref + '  ·  ' + now, W / 2, 207, { align: 'center' });
    doc.setFontSize(8); doc.setTextColor(150, 170, 190);
    doc.text('Documento confidencial: contém a senha temporária de acesso.', W / 2, 272, { align: 'center' });
    doc.text('Suporte: ' + support, W / 2, 278, { align: 'center' });

    // Credenciais
    doc.addPage(); header();
    doc.setTextColor(...primary); doc.setFont('helvetica', 'bold'); doc.setFontSize(14); doc.text('PARTE I — IDENTIFICAÇÃO E ACESSO', M, y); y += 9;
    title('1', 'DADOS DA EMPRESA');
    field('Nome da empresa', r.name); field('NUIT', r.nuit); field('Telefone', r.phone); field('Email', r.email);
    field('Localização', [r.address, r.city, r.province].filter(Boolean).join(', ')); field('Código da empresa', r.code, true); field('Data de registo', now);
    y += 3;
    title('2', 'ACESSO DO GESTOR');
    field('Nome completo', r.manager_name); field('Email', r.manager_email); field('Telefone', r.manager_phone);
    field('Utilizador', r.username || r.code, true); field('Senha temporária', r.temp_password, true); field('Endereço', location.origin);
    box('warning', 'SENHA TEMPORÁRIA — MUDANÇA OBRIGATÓRIA', [
      'No primeiro acesso o sistema obriga a definir uma nova senha pessoal.',
      'Guarde este documento em local seguro e não partilhe a senha com terceiros.',
      'Se esquecer a senha, use "Esqueceu a senha?" com o email e o nome do gestor.']);
    title('3', 'ESTADO DA CONTA');
    if (r.status === 'pending') box('warning', 'PENDENTE DE APROVAÇÃO', ['O acesso fica disponível depois da validação pela administração.', 'Para acelerar: ' + support]);
    else box('success', 'CONTA ATIVA', ['Já pode entrar no sistema com o utilizador e a senha temporária acima.']);
    y += 2;
    title('4', 'PRIMEIROS PASSOS');
    ['Entrar com o código da empresa e a senha temporária; definir a nova senha.',
      'Em "Empresa e recibo": logótipo, localização, textos do recibo e regras de multas e juros.',
      'Em "Tarifas": valor mínimo (ex.: 350 MZN até 5 m³) e preço por m³ acima do mínimo, ou escalões.',
      'Em "Mediadores": criar os leitores de contadores (funcionam também sem internet).',
      'Em "Clientes": registar clientes e as suas contas/contratos; o acesso do cliente é gerado automaticamente.']
      .forEach(bullet);

    // Termos (resumo do regulamento)
    doc.addPage(); header();
    doc.setTextColor(...primary); doc.setFont('helvetica', 'bold'); doc.setFontSize(14); doc.text('PARTE II — TERMOS E REGULAMENTO', M, y); y += 9;
    title('5', 'OBJETO E ÂMBITO');
    para('O presente documento estabelece os termos administrativos, financeiros e operacionais aplicáveis à utilização da plataforma AguaSistema ("Plataforma"), regulando a relação entre a AguaSistema, enquanto entidade gestora da solução tecnológica, e o Utilizador Gestor responsável pela conta da empresa registada. Abrange ativação e desativação de contas, mensalidades, multas, faturação, controlo de pagamentos, gestão de consumos e relatórios.');
    title('6', 'ATIVAÇÃO DA CONTA');
    ['Registo: preenchimento dos dados da empresa e do gestor.', 'Validação dos dados fornecidos (NUIT, telefone, email, endereço).',
      'Aprovação pela administração da AguaSistema (prazo médio de 48 horas úteis).', 'Ativação técnica e comunicação ao Utilizador.'].forEach(bullet);
    title('7', 'DESATIVAÇÃO E REATIVAÇÃO');
    para('O Utilizador pode pedir a desativação voluntária por escrito ao suporte; os valores em dívida continuam exigíveis. A falta de pagamento da mensalidade pode levar à suspensão do acesso:');
    ['5 dias de atraso: notificação de mora.', '15 dias de atraso: aplicação de multa.', '30 dias de atraso: suspensão temporária do acesso.',
      '60 dias de atraso: desativação definitiva, com comunicação formal.'].forEach(bullet);
    para('A reativação exige o pagamento integral dos valores em atraso, multas e juros aplicáveis, e nova validação administrativa.');
    title('8', 'MENSALIDADES');
    para('A utilização da Plataforma está sujeita a uma mensalidade definida pelo plano contratado, a pagar até ao dia 10 de cada mês, por transferência, depósito ou carteira móvel (M-Pesa, e-Mola). A falta de receção da fatura não dispensa o pagamento.');
    title('9', 'MULTAS POR ATRASO');
    box('danger', 'REGIME DE MULTAS', ['Até 5 dias: sem multa (tolerância).', '6 a 15 dias: 5% sobre o valor em dívida.',
      '16 a 30 dias: 10% sobre o valor em dívida.', 'Mais de 30 dias: 15% + suspensão do acesso.']);
    title('10', 'REGRAS DE ACESSO E SEGURANÇA');
    ['As credenciais são pessoais e intransmissíveis: não as partilhe.', 'Não aceda a partir de dispositivos públicos ou de terceiros.',
      'Não tente contornar mecanismos de autenticação ou segurança.', 'Comunique de imediato qualquer suspeita de uso indevido da conta.',
      'Mantenha os dados dos consumidores atualizados e trate-os com confidencialidade.'].forEach(bullet);
    title('11', 'PRIVACIDADE E PROTEÇÃO DE DADOS');
    para('Os dados são tratados apenas para prestar o serviço, faturar e cumprir obrigações legais. Não são vendidos nem cedidos a terceiros para fins comerciais. A Plataforma usa ligações cifradas, controlo de acessos por perfil, registo de auditoria e cópias de segurança.');
    title('12', 'CONTACTOS E SUPORTE');
    para('Telefone: ' + support + '. Horário: segunda a sexta, das 8h00 às 17h00.');
    title('13', 'ACEITAÇÃO');
    para('Ao prosseguir com o registo e a utilização da Plataforma, o Utilizador declara ter lido, compreendido e aceite integralmente estes termos.');
    y += 8; ensure(30);
    doc.setDrawColor(...gray); doc.setLineWidth(.3); doc.line(M, y + 10, M + 80, y + 10); doc.line(M + 90, y + 10, M + 170, y + 10);
    doc.setFontSize(8); doc.setTextColor(...gray); doc.text(r.name || '—', M, y + 14); doc.text(r.manager_name || '—', M + 90, y + 14);

    const total = doc.internal.getNumberOfPages();
    for (let i = 2; i <= total; i++) {
      doc.setPage(i); doc.setDrawColor(...primary); doc.setLineWidth(.2); doc.line(M, H - 14, W - M, H - 14);
      doc.setFontSize(7.5); doc.setTextColor(...gray); doc.setFont('helvetica', 'normal');
      doc.text('AguaSistema — documento confidencial', M, H - 9); doc.text(ref, W / 2, H - 9, { align: 'center' });
      doc.text('Página ' + i + ' de ' + total, W - M, H - 9, { align: 'right' });
    }
    doc.save(`AguaSistema_Registo_${fileName(r.name)}.pdf`);
  }

  // ---------------- arranque ----------------
  async function init() {
    particles();
    $('year').textContent = new Date().getFullYear();
    try { const u = localStorage.getItem('agua.remember'); if (u) $('username').value = u; } catch (_) { /* */ }
    try {
      const reason = sessionStorage.getItem('agua.expired');
      if (reason) { sessionStorage.removeItem('agua.expired'); $('bannerText').textContent = reason; $('banner').classList.add('show'); setTimeout(() => $('banner').classList.remove('show'), 6000); }
    } catch (_) { /* */ }
    const s = await call('GET', '/api/auth/session');
    if (s.success && s.user) { location.replace(s.user.home || '/'); return; }
    const r = await call('GET', '/api/public/info');
    if (r.success) {
      info = r;
      $('version').textContent = 'Versão ' + r.version;
      if (r.support_phone) { $('supportPhone').textContent = r.support_phone.replace(/(\d{2,3})(\d{3})(\d{3,4})$/, '$1 $2 $3'); $('supportPhone').href = 'tel:' + r.support_phone; }
      $('supportName').textContent = r.support_name ? '— ' + r.support_name : '';
    }
  }
  init();
})();
