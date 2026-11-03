-- Mensagens WhatsApp/SMS (planos Standard e Enterprise) e planos das empresas.

-- name: messages.list
SELECT m.id_message AS id, m.channel_message AS channel, m.kind_message AS kind, m.id_ref_message AS ref_id,
       m.to_phone_message AS to_phone, m.body_message AS body, m.status_message AS status,
       m.attempts_message AS attempts, m.error_message AS error,
       to_char(m.created_at, 'YYYY-MM-DD HH24:MI') AS created_at, to_char(m.sent_at_message, 'YYYY-MM-DD HH24:MI') AS sent_at,
       c.id_customer AS customer_id, c.code_customer AS customer_code, c.name_customer AS customer_name,
       u.name_user AS user_name,
       COUNT(*) OVER () AS total_rows
FROM messages m
LEFT JOIN customers c ON c.id_customer = m.id_customer_message
LEFT JOIN users u ON u.id_user = m.id_user_message
WHERE m.id_company_message = :cid
  AND (:status = '' OR m.status_message = :status)
  AND (:channel = '' OR m.channel_message = :channel)
  AND (:kind = '' OR m.kind_message = :kind)
  AND m.created_at >= CAST(:from AS date) AND m.created_at < CAST(:to AS date) + 1
  AND (:q = '' OR COALESCE(c.name_key_customer, '') LIKE '%' || :q || '%' OR LOWER(COALESCE(c.code_customer, '')) LIKE '%' || :qr || '%'
       OR (:qd <> '' AND m.to_phone_message LIKE '%' || :qd || '%') OR LOWER(m.body_message) LIKE '%' || :qr || '%')
ORDER BY m.id_message DESC
LIMIT :limit OFFSET :offset;

-- name: messages.stats
SELECT COUNT(*) AS total,
       COUNT(*) FILTER (WHERE status_message = 'sent') AS sent,
       COUNT(*) FILTER (WHERE status_message = 'manual') AS manual,
       COUNT(*) FILTER (WHERE status_message = 'queued') AS queued,
       COUNT(*) FILTER (WHERE status_message = 'failed') AS failed,
       COUNT(*) FILTER (WHERE channel_message = 'whatsapp' AND status_message = 'sent') AS whatsapp,
       COUNT(*) FILTER (WHERE channel_message = 'sms' AND status_message = 'sent') AS sms
FROM messages
WHERE id_company_message = :cid
  AND created_at >= CAST(:from AS date) AND created_at < CAST(:to AS date) + 1;

-- name: messages.customer
-- Dados de um cliente para montar uma mensagem (nome, telefone, dívida e faturas por pagar)
SELECT c.id_customer AS id, c.code_customer AS code, c.name_customer AS name, c.phone_customer AS phone,
       COALESCE(d.debt, 0) AS debt, COALESCE(d.invoices, 0) AS invoices
FROM customers c
LEFT JOIN (SELECT id_customer_invoice AS cid, SUM(total_invoice - paid_amount_invoice) AS debt, COUNT(*) AS invoices
           FROM invoices WHERE id_company_invoice = :cid AND status_invoice <> 'cancelled' AND total_invoice > paid_amount_invoice
           GROUP BY id_customer_invoice) d ON d.cid = c.id_customer
WHERE c.id_customer = :id AND c.id_company_customer = :cid;

-- name: messages.debtors
-- Destinatários de lembretes: clientes ativos com dívida (ou todos os ativos se :debtorsOnly = 0)
SELECT c.id_customer AS id, c.code_customer AS code, c.name_customer AS name, c.phone_customer AS phone,
       COALESCE(d.debt, 0) AS debt, COALESCE(d.invoices, 0) AS invoices
FROM customers c
LEFT JOIN (SELECT id_customer_invoice AS cid, SUM(total_invoice - paid_amount_invoice) AS debt, COUNT(*) AS invoices,
                  MIN(due_date_invoice) AS oldest_due
           FROM invoices WHERE id_company_invoice = :cid AND status_invoice <> 'cancelled' AND total_invoice > paid_amount_invoice
           GROUP BY id_customer_invoice) d ON d.cid = c.id_customer
WHERE c.id_company_customer = :cid AND c.status_customer = 'active'
  AND (:debtorsOnly = 0 OR COALESCE(d.debt, 0) > 0)
  AND (:overdueOnly = 0 OR d.oldest_due < CURRENT_DATE)
  AND COALESCE(d.debt, 0) >= :minDebt
ORDER BY c.name_customer
LIMIT :limit;

-- name: admin.plans
-- Empresas e clientes por plano (painel do administrador)
SELECT p.plan,
       COUNT(co.id_company) AS companies,
       COUNT(co.id_company) FILTER (WHERE co.status_company = 'active') AS active_companies,
       COALESCE(SUM((SELECT COUNT(*) FROM customers c WHERE c.id_company_customer = co.id_company)), 0) AS customers,
       COALESCE(SUM((SELECT COUNT(*) FROM accounts a WHERE a.id_company_account = co.id_company AND a.status_account = 'active')), 0) AS accounts,
       COALESCE(SUM((SELECT COUNT(*) FROM messages m WHERE m.id_company_message = co.id_company AND m.status_message = 'sent'
                       AND to_char(m.created_at, 'YYYY-MM') = :period)), 0) AS messages_month
FROM (VALUES ('basic', 1), ('standard', 2), ('enterprise', 3)) AS p(plan, ord)
LEFT JOIN companies co ON co.plan_company = p.plan
GROUP BY p.plan, p.ord
ORDER BY p.ord;
