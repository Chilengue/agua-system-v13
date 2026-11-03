/* Impressão: /print?type=receipt|invoice&id=…  ou  /print?type=statement&customer=…&mode=all|each|single&account=…&from=…&to=…
   O cliente (portal) usa as mesmas telas, mas só vê os seus documentos. */
(async function () {
  const { api, qs, esc } = App;
  const type = qs('type'), id = qs('id');
  const doc = document.getElementById('doc'), css = document.getElementById('pageSize');
  const s = await api.get('/api/auth/session');
  if (!s.success || !s.user) { location.href = '/login'; return; }
  const portal = s.user.role === 'customer';
  let r;
  if (type === 'receipt') r = await api.get(portal ? `/api/portal/receipts/${id}` : `/api/payments/${id}/receipt`);
  else if (type === 'invoice') r = await api.get(portal ? `/api/portal/invoices/${id}` : `/api/invoices/${id}/print`);
  else if (type === 'statement') {
    const q = App.query({ accountId: qs('account'), mode: qs('mode') || 'all', from: qs('from'), to: qs('to') });
    r = await api.get(portal ? `/api/portal/statement${q}` : `/api/customers/${qs('customer')}/statement${q}`);
  } else r = { success: false, error: 'Documento desconhecido.' };
  if (!r.success) { doc.innerHTML = `<p class="empty-state">${esc(r.error)}</p>`; return; }
  if (type === 'receipt') {
    doc.innerHTML = PrintDocs.receipt(r.receipt);
    css.textContent = PrintDocs.receiptPageCss(r.receipt.company);
    document.title = 'Recibo ' + r.receipt.receipt_number;
    const pdf = document.getElementById('btnPdf');
    pdf.style.display = '';
    pdf.onclick = () => PrintDocs.receiptPdf(r.receipt);
    if (qs('pdf') === '1') { PrintDocs.receiptPdf(r.receipt); return; }
  } else if (type === 'invoice') {
    doc.innerHTML = PrintDocs.invoice(r);
    css.textContent = '@page{size:A4;margin:10mm}';
    document.title = 'Fatura ' + r.invoice.number;
  } else {
    doc.innerHTML = PrintDocs.statement(r.statement);
    css.textContent = '@page{size:A4 landscape;margin:8mm}';
    document.title = 'Extrato ' + (r.statement.customer || {}).name;
  }
  if (qs('auto') !== '0') setTimeout(() => window.print(), 500);
})();
