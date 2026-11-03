-- Painel do gestor, relatórios da empresa e painel do administrador.
-- :cid empresa · :period AAAA-MM · :from/:to datas AAAA-MM-DD · :company (admin: 0 = todas)

-- name: dash.kpis
SELECT
  (SELECT COALESCE(SUM(total_invoice), 0) FROM invoices WHERE id_company_invoice = :cid
     AND period_invoice = :period AND status_invoice <> 'cancelled') AS billed,
  (SELECT COUNT(*) FROM invoices WHERE id_company_invoice = :cid
     AND period_invoice = :period AND status_invoice <> 'cancelled') AS invoices,
  (SELECT COALESCE(SUM(consumption_invoice), 0) FROM invoices WHERE id_company_invoice = :cid
     AND period_invoice = :period AND status_invoice <> 'cancelled') AS consumption,
  (SELECT COALESCE(SUM(amount_payment), 0) FROM payments WHERE id_company_payment = :cid AND status_payment = 'confirmed'
     AND to_char(paid_at_payment, 'YYYY-MM') = :period) AS collected,
  (SELECT COUNT(DISTINCT id_customer_payment) FROM payments WHERE id_company_payment = :cid AND status_payment = 'confirmed'
     AND to_char(paid_at_payment, 'YYYY-MM') = :period) AS payers,
  (SELECT COUNT(*) FROM payments WHERE id_company_payment = :cid AND status_payment = 'pending') AS pending_payments,
  (SELECT COALESCE(SUM(total_invoice - paid_amount_invoice), 0) FROM invoices WHERE id_company_invoice = :cid
     AND status_invoice <> 'cancelled') AS debt,
  (SELECT COALESCE(SUM(total_invoice - paid_amount_invoice), 0) FROM invoices WHERE id_company_invoice = :cid
     AND status_invoice <> 'cancelled' AND due_date_invoice < CURRENT_DATE) AS overdue_debt,
  (SELECT COUNT(DISTINCT id_customer_invoice) FROM invoices WHERE id_company_invoice = :cid
     AND status_invoice <> 'cancelled' AND total_invoice > paid_amount_invoice) AS debtors,
  (SELECT COUNT(*) FROM customers WHERE id_company_customer = :cid AND status_customer = 'active') AS customers,
  (SELECT COUNT(*) FROM accounts WHERE id_company_account = :cid AND status_account = 'active') AS accounts,
  (SELECT COUNT(*) FROM readings WHERE id_company_reading = :cid AND period_reading = :period
     AND status_reading <> 'cancelled') AS readings,
  (SELECT COUNT(*) FROM readings WHERE id_company_reading = :cid AND status_reading = 'pending') AS pending_readings,
  (SELECT COUNT(*) FROM customers WHERE id_company_customer = :cid AND to_char(created_at, 'YYYY-MM') = :period) AS new_customers;

-- name: dash.monthly
-- Últimos 12 meses até :period — faturado (por período) e recebido (por data de pagamento)
SELECT to_char(m, 'YYYY-MM') AS period,
       (SELECT COALESCE(SUM(total_invoice), 0) FROM invoices WHERE id_company_invoice = :cid
          AND period_invoice = to_char(m, 'YYYY-MM') AND status_invoice <> 'cancelled') AS billed,
       (SELECT COALESCE(SUM(amount_payment), 0) FROM payments WHERE id_company_payment = :cid AND status_payment = 'confirmed'
          AND paid_at_payment >= m AND paid_at_payment < m + INTERVAL '1 month') AS collected,
       (SELECT COALESCE(SUM(consumption_invoice), 0) FROM invoices WHERE id_company_invoice = :cid
          AND period_invoice = to_char(m, 'YYYY-MM') AND status_invoice <> 'cancelled') AS consumption
FROM generate_series(CAST(:period || '-01' AS date) - INTERVAL '11 months', CAST(:period || '-01' AS date), INTERVAL '1 month') m
ORDER BY m;

-- name: dash.payers
-- Clientes que pagaram no mês
SELECT c.id_customer AS id, c.code_customer AS code, c.name_customer AS name, c.phone_customer AS phone,
       COUNT(*) AS payments, SUM(p.amount_payment) AS amount, to_char(MAX(p.paid_at_payment), 'YYYY-MM-DD') AS last_payment,
       (SELECT COALESCE(SUM(i.total_invoice - i.paid_amount_invoice), 0) FROM invoices i
         WHERE i.id_customer_invoice = c.id_customer AND i.status_invoice <> 'cancelled') AS debt
FROM payments p JOIN customers c ON c.id_customer = p.id_customer_payment
WHERE p.id_company_payment = :cid AND p.status_payment = 'confirmed' AND to_char(p.paid_at_payment, 'YYYY-MM') = :period
GROUP BY c.id_customer, c.code_customer, c.name_customer, c.phone_customer
ORDER BY amount DESC
LIMIT :limit;

-- name: dash.methods
SELECT method_payment AS method, COUNT(*) AS count, SUM(amount_payment) AS amount
FROM payments WHERE id_company_payment = :cid AND status_payment = 'confirmed' AND to_char(paid_at_payment, 'YYYY-MM') = :period
GROUP BY method_payment ORDER BY amount DESC;

-- name: debtors.list
-- Devedores (clientes com saldo), com antiguidade da dívida. :company 0 = todas (admin)
SELECT c.id_customer AS id, c.code_customer AS code, c.name_customer AS name, c.phone_customer AS phone,
       COALESCE(c.neighborhood_customer, '') AS neighborhood, co.name_company AS company_name, co.id_company AS company_id,
       COUNT(*) AS invoices, SUM(i.total_invoice - i.paid_amount_invoice) AS debt,
       SUM(CASE WHEN i.due_date_invoice >= CURRENT_DATE THEN i.total_invoice - i.paid_amount_invoice ELSE 0 END) AS not_due,
       SUM(CASE WHEN i.due_date_invoice < CURRENT_DATE AND i.due_date_invoice >= CURRENT_DATE - 30 THEN i.total_invoice - i.paid_amount_invoice ELSE 0 END) AS d30,
       SUM(CASE WHEN i.due_date_invoice < CURRENT_DATE - 30 AND i.due_date_invoice >= CURRENT_DATE - 90 THEN i.total_invoice - i.paid_amount_invoice ELSE 0 END) AS d90,
       SUM(CASE WHEN i.due_date_invoice < CURRENT_DATE - 90 THEN i.total_invoice - i.paid_amount_invoice ELSE 0 END) AS d90plus,
       to_char(MIN(i.due_date_invoice), 'YYYY-MM-DD') AS oldest_due,
       GREATEST(CURRENT_DATE - MIN(i.due_date_invoice), 0) AS days_late,
       (SELECT to_char(MAX(p.paid_at_payment), 'YYYY-MM-DD') FROM payments p
         WHERE p.id_customer_payment = c.id_customer AND p.status_payment = 'confirmed') AS last_payment,
       COUNT(*) OVER () AS total_rows
FROM invoices i
JOIN customers c ON c.id_customer = i.id_customer_invoice
JOIN companies co ON co.id_company = i.id_company_invoice
WHERE (:company = 0 OR i.id_company_invoice = :company)
  AND i.status_invoice <> 'cancelled' AND i.total_invoice > i.paid_amount_invoice
  AND (:overdueOnly = 0 OR i.due_date_invoice < CURRENT_DATE)
  AND (:q = '' OR c.name_key_customer LIKE '%' || :q || '%' OR LOWER(c.code_customer) LIKE '%' || :qr || '%'
       OR (:qd <> '' AND COALESCE(c.phone_key_customer, '') LIKE '%' || :qd || '%'))
GROUP BY c.id_customer, c.code_customer, c.name_customer, c.phone_customer, c.neighborhood_customer, co.name_company, co.id_company
HAVING SUM(i.total_invoice - i.paid_amount_invoice) >= :minDebt
ORDER BY debt DESC
LIMIT :limit OFFSET :offset;

-- name: rep.billing
-- Faturação por período (mês a mês) entre :fromPeriod e :toPeriod
SELECT i.period_invoice AS period, COUNT(*) AS invoices, SUM(i.consumption_invoice) AS consumption,
       SUM(i.water_amount_invoice) AS water, SUM(i.sewer_amount_invoice) AS sewer, SUM(i.fixed_fee_invoice) AS fixed_fee,
       SUM(i.other_amount_invoice) AS other, SUM(i.fine_amount_invoice + i.interest_amount_invoice) AS late_charges,
       SUM(i.discount_invoice) AS discount, SUM(i.total_invoice) AS total, SUM(i.paid_amount_invoice) AS paid,
       SUM(i.total_invoice - i.paid_amount_invoice) AS balance
FROM invoices i
WHERE i.id_company_invoice = :cid AND i.status_invoice <> 'cancelled'
  AND i.period_invoice BETWEEN :fromPeriod AND :toPeriod
GROUP BY i.period_invoice ORDER BY i.period_invoice;

-- name: rep.collections
-- Recebimentos por dia e método
SELECT to_char(p.paid_at_payment, 'YYYY-MM-DD') AS day, p.method_payment AS method,
       COUNT(*) AS payments, SUM(p.amount_payment) AS amount
FROM payments p
WHERE p.id_company_payment = :cid AND p.status_payment = 'confirmed'
  AND p.paid_at_payment >= CAST(:from AS date) AND p.paid_at_payment < CAST(:to AS date) + 1
GROUP BY 1, 2 ORDER BY 1, 2;

-- name: rep.consumption
-- Consumo por categoria entre períodos
SELECT a.category_account AS category, COUNT(DISTINCT i.id_account_invoice) AS accounts, COUNT(*) AS invoices,
       SUM(i.consumption_invoice) AS consumption, SUM(i.total_invoice) AS total,
       ROUND(AVG(i.consumption_invoice), 1) AS average
FROM invoices i JOIN accounts a ON a.id_account = i.id_account_invoice
WHERE i.id_company_invoice = :cid AND i.status_invoice <> 'cancelled' AND i.kind_invoice = 'consumption'
  AND i.period_invoice BETWEEN :fromPeriod AND :toPeriod
GROUP BY a.category_account ORDER BY consumption DESC;

-- name: rep.readers
-- Produtividade dos mediadores
SELECT COALESCE(u.name_user, 'Escritório') AS reader, COALESCE(u.username_user, '') AS username,
       COUNT(*) AS readings, COUNT(*) FILTER (WHERE r.source_reading = 'offline') AS offline,
       COUNT(*) FILTER (WHERE r.anomaly_reading) AS anomalies, SUM(r.consumption_reading) AS consumption,
       to_char(MAX(r.read_at_reading), 'YYYY-MM-DD HH24:MI') AS last_reading
FROM readings r LEFT JOIN users u ON u.id_user = r.id_user_reading
WHERE r.id_company_reading = :cid AND r.status_reading <> 'cancelled'
  AND r.period_reading BETWEEN :fromPeriod AND :toPeriod
GROUP BY u.name_user, u.username_user ORDER BY readings DESC;

-- name: rep.cashiers
SELECT COALESCE(u.name_user, '—') AS cashier, COUNT(*) AS payments, SUM(p.amount_payment) AS amount,
       COUNT(*) FILTER (WHERE p.status_payment = 'voided') AS voided
FROM payments p LEFT JOIN users u ON u.id_user = p.id_user_payment
WHERE p.id_company_payment = :cid AND p.status_payment <> 'pending'
  AND p.paid_at_payment >= CAST(:from AS date) AND p.paid_at_payment < CAST(:to AS date) + 1
GROUP BY u.name_user ORDER BY amount DESC;

-- name: admin.kpis
SELECT
  (SELECT COUNT(*) FROM companies) AS companies,
  (SELECT COUNT(*) FROM companies WHERE status_company = 'active') AS active_companies,
  (SELECT COUNT(*) FROM companies WHERE status_company = 'pending') AS pending_companies,
  (SELECT COUNT(*) FROM users WHERE role_user = 'manager') AS managers,
  (SELECT COUNT(*) FROM users WHERE role_user = 'manager' AND status_user = 'active') AS active_managers,
  (SELECT COUNT(*) FROM users WHERE role_user IN ('admin', 'manager') AND (email_user IS NULL OR email_user = '')) AS users_without_email,
  (SELECT COUNT(*) FROM companies WHERE plan_company = 'basic') AS plan_basic,
  (SELECT COUNT(*) FROM companies WHERE plan_company = 'standard') AS plan_standard,
  (SELECT COUNT(*) FROM companies WHERE plan_company = 'enterprise') AS plan_enterprise,
  (SELECT COUNT(*) FROM customers) AS customers,
  (SELECT COUNT(*) FROM accounts WHERE status_account = 'active') AS accounts,
  (SELECT COALESCE(SUM(amount_payment), 0) FROM payments WHERE status_payment = 'confirmed'
     AND to_char(paid_at_payment, 'YYYY-MM') = :period) AS collected_month,
  (SELECT COALESCE(SUM(amount_payment), 0) FROM payments WHERE status_payment = 'confirmed') AS collected_total,
  (SELECT COALESCE(SUM(total_invoice), 0) FROM invoices WHERE status_invoice <> 'cancelled' AND period_invoice = :period) AS billed_month,
  (SELECT COALESCE(SUM(total_invoice - paid_amount_invoice), 0) FROM invoices WHERE status_invoice <> 'cancelled') AS debt,
  (SELECT COUNT(DISTINCT id_customer_invoice) FROM invoices WHERE status_invoice <> 'cancelled'
     AND total_invoice > paid_amount_invoice AND due_date_invoice < CURRENT_DATE) AS late_customers,
  (SELECT COUNT(*) FROM password_resets r JOIN users u ON u.id_user = r.id_user_password_reset
     WHERE r.status_password_reset = 'pending' AND r.channel_password_reset = 'admin'
       AND u.role_user IN ('admin', 'manager')) AS pending_resets,
  (SELECT COUNT(*) FROM audit_logs WHERE action_audit_log = 'LOGIN' AND created_at >= CURRENT_DATE - 30) AS logins_30d;

-- name: admin.monthly
SELECT to_char(m, 'YYYY-MM') AS period,
       (SELECT COALESCE(SUM(amount_payment), 0) FROM payments WHERE status_payment = 'confirmed'
          AND (:company = 0 OR id_company_payment = :company)
          AND paid_at_payment >= m AND paid_at_payment < m + INTERVAL '1 month') AS collected,
       (SELECT COALESCE(SUM(total_invoice), 0) FROM invoices WHERE status_invoice <> 'cancelled'
          AND (:company = 0 OR id_company_invoice = :company) AND period_invoice = to_char(m, 'YYYY-MM')) AS billed,
       (SELECT COUNT(*) FROM audit_logs WHERE action_audit_log = 'LOGIN'
          AND (:company = 0 OR id_company_audit_log = :company)
          AND created_at >= m AND created_at < m + INTERVAL '1 month') AS logins,
       (SELECT COUNT(*) FROM customers WHERE (:company = 0 OR id_company_customer = :company)
          AND created_at < m + INTERVAL '1 month') AS customers
FROM generate_series(CAST(:period || '-01' AS date) - INTERVAL '11 months', CAST(:period || '-01' AS date), INTERVAL '1 month') m
ORDER BY m;

-- name: admin.companies
SELECT co.id_company AS id, co.code_company AS code, co.name_company AS name, co.nuit_company AS nuit,
       co.phone_company AS phone, co.email_company AS email, co.city_company AS city, co.province_company AS province,
       co.address_company AS address, co.status_company AS status, co.self_registered_company AS self_registered,
       co.plan_company AS plan, to_char(co.plan_changed_at_company, 'YYYY-MM-DD') AS plan_changed_at,
       (SELECT COUNT(*) FROM accounts a WHERE a.id_company_account = co.id_company AND a.status_account = 'active') AS accounts,
       (SELECT COUNT(*) FROM messages ms WHERE ms.id_company_message = co.id_company AND ms.status_message = 'sent'
          AND to_char(ms.created_at, 'YYYY-MM') = :period) AS messages_month,
       to_char(co.created_at, 'YYYY-MM-DD') AS created_at, to_char(co.approved_at_company, 'YYYY-MM-DD') AS approved_at,
       (co.logo_company IS NOT NULL AND co.logo_company <> '') AS has_logo,
       mg.name_user AS manager_name, mg.email_user AS manager_email, mg.phone_user AS manager_phone,
       (SELECT COUNT(*) FROM customers c WHERE c.id_company_customer = co.id_company) AS customers,
       (SELECT COUNT(*) FROM users u WHERE u.id_company_user = co.id_company AND u.role_user = 'reader') AS readers,
       (SELECT COALESCE(SUM(amount_payment), 0) FROM payments p WHERE p.id_company_payment = co.id_company
          AND p.status_payment = 'confirmed' AND to_char(p.paid_at_payment, 'YYYY-MM') = :period) AS collected_month,
       (SELECT COALESCE(SUM(total_invoice - paid_amount_invoice), 0) FROM invoices i WHERE i.id_company_invoice = co.id_company
          AND i.status_invoice <> 'cancelled') AS debt,
       (SELECT to_char(MAX(created_at), 'YYYY-MM-DD HH24:MI') FROM audit_logs l WHERE l.id_company_audit_log = co.id_company) AS last_activity,
       COUNT(*) OVER () AS total_rows
FROM companies co
LEFT JOIN LATERAL (SELECT u.name_user, u.email_user, u.phone_user FROM users u
                   WHERE u.id_company_user = co.id_company AND u.role_user = 'manager' ORDER BY u.id_user LIMIT 1) mg ON TRUE
WHERE (:status = '' OR co.status_company = :status)
  AND (:plan = '' OR co.plan_company = :plan)
  AND (:q = '' OR LOWER(co.name_company) LIKE '%' || :qr || '%' OR LOWER(co.code_company) LIKE '%' || :qr || '%'
       OR LOWER(COALESCE(co.nuit_company, '')) LIKE '%' || :qr || '%' OR LOWER(COALESCE(co.city_company, '')) LIKE '%' || :qr || '%')
ORDER BY CASE co.status_company WHEN 'pending' THEN 0 ELSE 1 END, co.name_company
LIMIT :limit OFFSET :offset;

-- name: admin.users
-- Utilizadores que o administrador gere: só administradores e gestores das empresas
SELECT u.id_user AS id, u.name_user AS name, u.username_user AS username, u.email_user AS email,
       u.phone_user AS phone, u.role_user AS role, u.status_user AS status,
       u.must_change_password_user AS must_change_password,
       to_char(u.last_login_user, 'YYYY-MM-DD HH24:MI') AS last_login, to_char(u.created_at, 'YYYY-MM-DD') AS created_at,
       co.id_company AS company_id, co.name_company AS company_name, co.code_company AS company_code,
       COUNT(*) OVER () AS total_rows
FROM users u LEFT JOIN companies co ON co.id_company = u.id_company_user
WHERE u.role_user IN ('admin', 'manager')     -- mediadores e clientes são geridos pelo gestor de cada empresa
  AND (:company = 0 OR u.id_company_user = :company)
  AND (:role = '' OR u.role_user = :role)
  AND (:status = '' OR u.status_user = :status)
  AND (:missing = 0 OR u.email_user IS NULL OR u.email_user = '')
  AND (:q = '' OR LOWER(u.name_user) LIKE '%' || :qr || '%' OR LOWER(u.username_user) LIKE '%' || :qr || '%'
       OR LOWER(COALESCE(u.email_user, '')) LIKE '%' || :qr || '%' OR COALESCE(u.phone_user, '') LIKE '%' || :qd || '%' AND :qd <> '')
ORDER BY CASE u.role_user WHEN 'admin' THEN 0 WHEN 'manager' THEN 1 WHEN 'reader' THEN 2 ELSE 3 END, u.name_user
LIMIT :limit OFFSET :offset;

-- name: admin.customers
SELECT c.id_customer AS id, c.code_customer AS code, c.name_customer AS name, c.phone_customer AS phone,
       c.email_customer AS email, c.status_customer AS status, co.name_company AS company_name, co.id_company AS company_id,
       co.plan_company AS plan,
       (SELECT COUNT(*) FROM accounts a WHERE a.id_customer_account = c.id_customer) AS accounts,
       (SELECT COALESCE(SUM(amount_payment), 0) FROM payments p WHERE p.id_customer_payment = c.id_customer
          AND p.status_payment = 'confirmed') AS total_paid,
       (SELECT COUNT(*) FROM payments p WHERE p.id_customer_payment = c.id_customer AND p.status_payment = 'confirmed') AS payments,
       (SELECT to_char(MAX(paid_at_payment), 'YYYY-MM-DD') FROM payments p WHERE p.id_customer_payment = c.id_customer
          AND p.status_payment = 'confirmed') AS last_payment,
       (SELECT COALESCE(SUM(total_invoice - paid_amount_invoice), 0) FROM invoices i WHERE i.id_customer_invoice = c.id_customer
          AND i.status_invoice <> 'cancelled') AS debt,
       COUNT(*) OVER () AS total_rows
FROM customers c JOIN companies co ON co.id_company = c.id_company_customer
WHERE (:company = 0 OR c.id_company_customer = :company)
  AND (:plan = '' OR co.plan_company = :plan)
  AND (:q = '' OR c.name_key_customer LIKE '%' || :q || '%' OR LOWER(c.code_customer) LIKE '%' || :qr || '%'
       OR (:qd <> '' AND COALESCE(c.phone_key_customer, '') LIKE '%' || :qd || '%'))
ORDER BY c.name_customer
LIMIT :limit OFFSET :offset;

-- name: admin.customer_payments
-- Histórico de pagamentos de qualquer cliente (admin)
SELECT p.id_payment AS id, p.receipt_number_payment AS receipt_number, p.amount_payment AS amount,
       p.method_payment AS method, p.reference_payment AS reference, p.status_payment AS status,
       to_char(p.paid_at_payment, 'YYYY-MM-DD HH24:MI') AS paid_at, u.name_user AS cashier,
       (SELECT string_agg(DISTINCT i.number_invoice || ' (' || i.period_invoice || ')', ', ') FROM payment_allocations pa
          JOIN invoices i ON i.id_invoice = pa.id_invoice_payment_allocation
         WHERE pa.id_payment_payment_allocation = p.id_payment) AS invoices
FROM payments p LEFT JOIN users u ON u.id_user = p.id_user_payment
WHERE p.id_customer_payment = :customerId
ORDER BY p.paid_at_payment DESC;

-- name: admin.payments
SELECT p.id_payment AS id, p.receipt_number_payment AS receipt_number, p.amount_payment AS amount,
       p.method_payment AS method, p.status_payment AS status, to_char(p.paid_at_payment, 'YYYY-MM-DD HH24:MI') AS paid_at,
       c.id_customer AS customer_id, c.name_customer AS customer_name, c.code_customer AS customer_code,
       co.name_company AS company_name, co.id_company AS company_id,
       COUNT(*) OVER () AS total_rows
FROM payments p
JOIN customers c ON c.id_customer = p.id_customer_payment
JOIN companies co ON co.id_company = p.id_company_payment
WHERE (:company = 0 OR p.id_company_payment = :company)
  AND p.paid_at_payment >= CAST(:from AS date) AND p.paid_at_payment < CAST(:to AS date) + 1
  AND (:status = '' OR p.status_payment = :status)
  AND (:method = '' OR p.method_payment = :method)
  AND (:q = '' OR c.name_key_customer LIKE '%' || :q || '%' OR LOWER(p.receipt_number_payment) LIKE '%' || :qr || '%'
       OR LOWER(c.code_customer) LIKE '%' || :qr || '%')
ORDER BY p.paid_at_payment DESC
LIMIT :limit OFFSET :offset;

-- name: admin.payments_stats
SELECT COALESCE(SUM(amount_payment) FILTER (WHERE status_payment = 'confirmed'), 0) AS confirmed,
       COUNT(*) FILTER (WHERE status_payment = 'confirmed') AS confirmed_count,
       COUNT(DISTINCT id_customer_payment) FILTER (WHERE status_payment = 'confirmed') AS customers
FROM payments
WHERE (:company = 0 OR id_company_payment = :company)
  AND paid_at_payment >= CAST(:from AS date) AND paid_at_payment < CAST(:to AS date) + 1;

-- name: admin.resets
SELECT r.id_password_reset AS id, r.channel_password_reset AS channel, r.status_password_reset AS status,
       to_char(r.created_at, 'YYYY-MM-DD HH24:MI') AS created_at, r.ip_password_reset AS ip,
       u.id_user AS user_id, u.name_user AS name, u.username_user AS username, u.email_user AS email,
       u.phone_user AS phone, u.role_user AS role, co.name_company AS company_name
FROM password_resets r JOIN users u ON u.id_user = r.id_user_password_reset
LEFT JOIN companies co ON co.id_company = u.id_company_user
WHERE u.role_user IN ('admin', 'manager')
  AND (:status = '' OR r.status_password_reset = :status)
ORDER BY r.created_at DESC
LIMIT :limit;

-- name: audit.list
SELECT l.id_audit_log AS id, to_char(l.created_at, 'YYYY-MM-DD HH24:MI:SS') AS created_at, l.username_audit_log AS username,
       l.action_audit_log AS action, l.resource_audit_log AS resource, l.payload_audit_log AS payload, l.ip_audit_log AS ip,
       co.name_company AS company_name, COUNT(*) OVER () AS total_rows
FROM audit_logs l LEFT JOIN companies co ON co.id_company = l.id_company_audit_log
WHERE (:company = 0 OR l.id_company_audit_log = :company)
  AND (:q = '' OR LOWER(l.action_audit_log) LIKE '%' || :qr || '%' OR LOWER(COALESCE(l.username_audit_log, '')) LIKE '%' || :qr || '%'
       OR LOWER(COALESCE(l.resource_audit_log, '')) LIKE '%' || :qr || '%')
  AND l.created_at >= CAST(:from AS date) AND l.created_at < CAST(:to AS date) + 1
ORDER BY l.id_audit_log DESC
LIMIT :limit OFFSET :offset;

-- name: team.readers
SELECT u.id_user AS id, u.name_user AS name, u.username_user AS username, u.email_user AS email, u.phone_user AS phone,
       u.status_user AS status, u.must_change_password_user AS must_change_password,
       to_char(u.last_login_user, 'YYYY-MM-DD HH24:MI') AS last_login,
       (SELECT COUNT(*) FROM readings r WHERE r.id_user_reading = u.id_user AND r.period_reading = :period
          AND r.status_reading <> 'cancelled') AS readings_month,
       (SELECT COUNT(*) FROM readings r WHERE r.id_user_reading = u.id_user) AS readings_total
FROM users u WHERE u.id_company_user = :cid AND u.role_user = 'reader' ORDER BY u.name_user;

-- name: team.customer_users
-- Acessos ao portal dos clientes da empresa (o gestor bloqueia, desbloqueia, gera senha ou remove o acesso)
SELECT u.id_user AS id, u.name_user AS name, u.username_user AS username, u.email_user AS email, u.phone_user AS phone,
       u.status_user AS status, u.must_change_password_user AS must_change_password,
       to_char(u.last_login_user, 'YYYY-MM-DD HH24:MI') AS last_login, to_char(u.created_at, 'YYYY-MM-DD') AS created_at,
       c.id_customer AS customer_id, c.code_customer AS customer_code, c.status_customer AS customer_status,
       COUNT(*) OVER () AS total_rows
FROM users u JOIN customers c ON c.id_customer = u.id_customer_user
WHERE u.id_company_user = :cid AND u.role_user = 'customer'
  AND (:status = '' OR u.status_user = :status OR (:status = 'never' AND u.last_login_user IS NULL))
  AND (:q = '' OR c.name_key_customer LIKE '%' || :q || '%' OR LOWER(u.username_user) LIKE '%' || :qr || '%'
       OR LOWER(COALESCE(u.email_user, '')) LIKE '%' || :qr || '%'
       OR (:qd <> '' AND COALESCE(c.phone_key_customer, '') LIKE '%' || :qd || '%'))
ORDER BY u.name_user
LIMIT :limit OFFSET :offset;

-- name: team.resets
-- Pedidos de recuperação de senha de mediadores e clientes da empresa (tratados pelo gestor)
SELECT r.id_password_reset AS id, r.status_password_reset AS status, to_char(r.created_at, 'YYYY-MM-DD HH24:MI') AS created_at,
       u.id_user AS user_id, u.name_user AS name, u.username_user AS username, u.email_user AS email,
       u.phone_user AS phone, u.role_user AS role
FROM password_resets r JOIN users u ON u.id_user = r.id_user_password_reset
WHERE u.id_company_user = :cid AND u.role_user IN ('reader', 'customer')
  AND r.channel_password_reset = 'admin' AND (:status = '' OR r.status_password_reset = :status)
ORDER BY r.created_at DESC
LIMIT :limit;

-- name: portal.accounts
SELECT a.id_account AS id, a.number_account AS number, a.category_account AS category, a.status_account AS status,
       COALESCE(a.address_account, '') AS address, m.number_meter AS meter_number,
       (SELECT COALESCE(SUM(i.total_invoice - i.paid_amount_invoice), 0) FROM invoices i
         WHERE i.id_account_invoice = a.id_account AND i.status_invoice <> 'cancelled') AS debt
FROM accounts a LEFT JOIN meters m ON m.id_account_meter = a.id_account AND m.status_meter = 'active'
WHERE a.id_customer_account = :customerId ORDER BY a.number_account;

-- name: portal.consumption
SELECT i.period_invoice AS period, SUM(i.consumption_invoice) AS consumption, SUM(i.total_invoice) AS total
FROM invoices i
WHERE i.id_customer_invoice = :customerId AND i.status_invoice <> 'cancelled' AND i.kind_invoice = 'consumption'
GROUP BY i.period_invoice ORDER BY i.period_invoice DESC LIMIT 12;
