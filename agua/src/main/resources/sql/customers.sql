-- Clientes e contas. Parâmetros comuns:
--   :cid  empresa · :q texto normalizado ('' = sem filtro) · :qd só dígitos · :qr texto em minúsculas

-- name: customers.list
SELECT c.id_customer AS id, c.code_customer AS code, c.name_customer AS name, c.phone_customer AS phone,
       c.email_customer AS email, c.document_type_customer AS document_type, c.document_customer AS document,
       c.neighborhood_customer AS neighborhood, c.city_customer AS city, c.status_customer AS status,
       to_char(c.created_at, 'YYYY-MM-DD') AS created_at,
       COALESCE(a.accounts, 0) AS accounts, COALESCE(a.numbers, '') AS account_numbers,
       COALESCE(d.debt, 0) AS debt, COALESCE(d.open_invoices, 0) AS open_invoices, COALESCE(d.overdue, 0) AS overdue_invoices,
       to_char(p.last_payment, 'YYYY-MM-DD') AS last_payment,
       c.block_customer AS block, c.house_number_customer AS house_number, c.gender_customer AS gender,
       u.username_user AS login,
       COUNT(*) OVER () AS total_rows
FROM customers c
LEFT JOIN (SELECT id_customer_account AS cid, COUNT(*) AS accounts, string_agg(number_account, ', ' ORDER BY number_account) AS numbers
           FROM accounts WHERE id_company_account = :cid GROUP BY id_customer_account) a ON a.cid = c.id_customer
LEFT JOIN (SELECT id_customer_invoice AS cid, SUM(total_invoice - paid_amount_invoice) AS debt, COUNT(*) AS open_invoices,
                  COUNT(*) FILTER (WHERE due_date_invoice < CURRENT_DATE) AS overdue
           FROM invoices WHERE id_company_invoice = :cid AND status_invoice <> 'cancelled' AND total_invoice > paid_amount_invoice
           GROUP BY id_customer_invoice) d ON d.cid = c.id_customer
LEFT JOIN (SELECT id_customer_payment AS cid, MAX(paid_at_payment) AS last_payment
           FROM payments WHERE id_company_payment = :cid AND status_payment = 'confirmed' GROUP BY id_customer_payment) p ON p.cid = c.id_customer
LEFT JOIN users u ON u.id_customer_user = c.id_customer
WHERE c.id_company_customer = :cid
  AND (:status = '' OR c.status_customer = :status)
  AND (:debt = '' OR (:debt = 'debtor' AND COALESCE(d.debt, 0) > 0) OR (:debt = 'clear' AND COALESCE(d.debt, 0) = 0)
       OR (:debt = 'overdue' AND COALESCE(d.overdue, 0) > 0) OR (:debt = 'noaccess' AND u.id_user IS NULL))
  AND (:neighborhood = '' OR LOWER(COALESCE(c.neighborhood_customer, '')) = :neighborhood)
  AND (:q = '' OR c.name_key_customer LIKE '%' || :q || '%' OR LOWER(c.code_customer) LIKE '%' || :qr || '%'
       OR LOWER(COALESCE(c.document_customer, '')) LIKE '%' || :qr || '%'
       OR (:qd <> '' AND COALESCE(c.phone_key_customer, '') LIKE '%' || :qd || '%')
       OR LOWER(COALESCE(a.numbers, '')) LIKE '%' || :qr || '%'
       OR EXISTS (SELECT 1 FROM invoices i WHERE i.id_customer_invoice = c.id_customer AND LOWER(i.number_invoice) = :qr))
ORDER BY CASE WHEN :sort = 'debt' THEN COALESCE(d.debt, 0) END DESC NULLS LAST,
         CASE WHEN :sort = 'recent' THEN c.created_at END DESC NULLS LAST,
         CASE WHEN :sort = 'code' THEN c.code_customer END,
         c.name_customer
LIMIT :limit OFFSET :offset;

-- name: customers.neighborhoods
-- Bairros já usados (sugestões no formulário e filtro da lista)
SELECT n AS neighborhood, COUNT(*) AS customers FROM (
  SELECT TRIM(neighborhood_customer) AS n FROM customers WHERE id_company_customer = :cid AND neighborhood_customer IS NOT NULL
) x WHERE n <> '' GROUP BY n ORDER BY n LIMIT 300;

-- name: customers.check
-- Aviso imediato no formulário: já existe cliente com este telefone, documento ou NUIT?
SELECT c.id_customer AS id, c.code_customer AS code, c.name_customer AS name, c.phone_customer AS phone,
       CASE WHEN :phone <> '' AND c.phone_key_customer = :phone THEN 'phone'
            WHEN :doc <> '' AND LOWER(COALESCE(c.document_customer, '')) = :doc THEN 'document'
            ELSE 'nuit' END AS reason
FROM customers c
WHERE c.id_company_customer = :cid AND c.id_customer <> :exceptId
  AND ((:phone <> '' AND c.phone_key_customer = :phone)
       OR (:doc <> '' AND LOWER(COALESCE(c.document_customer, '')) = :doc)
       OR (:nuit <> '' AND LOWER(COALESCE(c.nuit_customer, '')) = :nuit))
LIMIT 3;

-- name: customers.stats
SELECT COUNT(*) AS customers,
       COUNT(*) FILTER (WHERE status_customer = 'active') AS active,
       (SELECT COUNT(*) FROM accounts WHERE id_company_account = :cid AND status_account = 'active') AS accounts,
       (SELECT COUNT(DISTINCT id_customer_invoice) FROM invoices WHERE id_company_invoice = :cid
          AND status_invoice <> 'cancelled' AND total_invoice > paid_amount_invoice) AS debtors,
       (SELECT COALESCE(SUM(total_invoice - paid_amount_invoice), 0) FROM invoices WHERE id_company_invoice = :cid
          AND status_invoice <> 'cancelled') AS debt
FROM customers WHERE id_company_customer = :cid;

-- name: customers.detail
SELECT c.id_customer AS id, c.code_customer AS code, c.name_customer AS name,
       c.document_type_customer AS document_type, c.document_customer AS document, c.nuit_customer AS nuit,
       c.gender_customer AS gender, to_char(c.birth_date_customer, 'YYYY-MM-DD') AS birth_date,
       c.occupation_customer AS occupation, c.phone_customer AS phone, c.phone2_customer AS phone2,
       c.email_customer AS email, c.address_customer AS address, c.neighborhood_customer AS neighborhood,
       c.block_customer AS block, c.house_number_customer AS house_number, c.district_customer AS district,
       c.city_customer AS city, c.status_customer AS status, c.notes_customer AS notes,
       to_char(c.created_at, 'YYYY-MM-DD') AS created_at,
       u.id_user AS user_id, u.username_user AS login, u.status_user AS login_status,
       to_char(u.last_login_user, 'YYYY-MM-DD HH24:MI') AS last_login,
       (SELECT COALESCE(SUM(total_invoice - paid_amount_invoice), 0) FROM invoices
         WHERE id_customer_invoice = c.id_customer AND status_invoice <> 'cancelled') AS debt,
       (SELECT COALESCE(SUM(amount_payment), 0) FROM payments
         WHERE id_customer_payment = c.id_customer AND status_payment = 'confirmed') AS total_paid
FROM customers c
LEFT JOIN users u ON u.id_customer_user = c.id_customer
WHERE c.id_customer = :id AND c.id_company_customer = :cid;

-- name: customers.accounts
SELECT a.id_account AS id, a.number_account AS number, a.category_account AS category,
       a.address_account AS address, a.neighborhood_account AS neighborhood, a.landmark_account AS landmark, a.block_account AS block, a.house_number_account AS house_number, a.notes_account AS notes,
       a.latitude_account AS latitude, a.longitude_account AS longitude,
       a.status_account AS status, to_char(a.opened_at_account, 'YYYY-MM-DD') AS opened_at,
       m.id_meter AS meter_id, m.number_meter AS meter_number, m.initial_reading_meter AS initial_reading,
       COALESCE((SELECT r.current_value_reading FROM readings r WHERE r.id_meter_reading = m.id_meter
                 AND r.status_reading <> 'cancelled' ORDER BY r.period_reading DESC, r.id_reading DESC LIMIT 1),
                m.initial_reading_meter) AS last_value,
       (SELECT r.period_reading FROM readings r WHERE r.id_meter_reading = m.id_meter
         AND r.status_reading <> 'cancelled' ORDER BY r.period_reading DESC, r.id_reading DESC LIMIT 1) AS last_period,
       (SELECT COALESCE(SUM(i.total_invoice - i.paid_amount_invoice), 0) FROM invoices i
         WHERE i.id_account_invoice = a.id_account AND i.status_invoice <> 'cancelled') AS debt,
       (SELECT COUNT(*) FROM invoices i WHERE i.id_account_invoice = a.id_account AND i.status_invoice <> 'cancelled'
         AND i.total_invoice > i.paid_amount_invoice) AS open_invoices
FROM accounts a
LEFT JOIN meters m ON m.id_account_meter = a.id_account AND m.status_meter = 'active'
WHERE a.id_customer_account = :id AND a.id_company_account = :cid
ORDER BY a.number_account;

-- name: customers.duplicate
SELECT c.id_customer AS id, c.code_customer AS code, c.name_customer AS name,
       CASE WHEN :doc <> '' AND c.document_type_customer = :docType AND LOWER(COALESCE(c.document_customer, '')) = :doc THEN 'document'
            WHEN :phone <> '' AND c.phone_key_customer = :phone THEN 'phone'
            ELSE 'name' END AS reason
FROM customers c
WHERE c.id_company_customer = :cid AND c.id_customer <> :exceptId
  AND ((:doc <> '' AND c.document_type_customer = :docType AND LOWER(COALESCE(c.document_customer, '')) = :doc)
       OR (:phone <> '' AND c.phone_key_customer = :phone)
       OR (:nuit <> '' AND LOWER(COALESCE(c.nuit_customer, '')) = :nuit))
LIMIT 1;

-- name: accounts.search
-- Pesquisa de contas para caixa, faturas manuais e leituras (nome, código, telefone, nº de conta, nº de fatura, contador)
SELECT a.id_account AS id, a.number_account AS number, a.category_account AS category, a.status_account AS status,
       a.address_account AS address, a.neighborhood_account AS neighborhood,
       c.id_customer AS customer_id, c.code_customer AS customer_code, c.name_customer AS customer_name,
       c.phone_customer AS phone,
       m.id_meter AS meter_id, m.number_meter AS meter_number,
       COALESCE((SELECT r.current_value_reading FROM readings r WHERE r.id_meter_reading = m.id_meter
                 AND r.status_reading <> 'cancelled' ORDER BY r.period_reading DESC, r.id_reading DESC LIMIT 1),
                m.initial_reading_meter) AS last_value,
       (SELECT COALESCE(SUM(i.total_invoice - i.paid_amount_invoice), 0) FROM invoices i
         WHERE i.id_account_invoice = a.id_account AND i.status_invoice <> 'cancelled') AS debt,
       (SELECT r.period_reading FROM readings r WHERE r.id_meter_reading = m.id_meter AND r.status_reading <> 'cancelled'
         ORDER BY r.period_reading DESC, r.id_reading DESC LIMIT 1) AS last_period,
       (SELECT r.consumption_reading FROM readings r WHERE r.id_meter_reading = m.id_meter AND r.status_reading <> 'cancelled'
         ORDER BY r.period_reading DESC, r.id_reading DESC LIMIT 1) AS last_consumption
FROM accounts a
JOIN customers c ON c.id_customer = a.id_customer_account
LEFT JOIN meters m ON m.id_account_meter = a.id_account AND m.status_meter = 'active'
WHERE a.id_company_account = :cid
  AND (:q = '' OR c.name_key_customer LIKE '%' || :q || '%' OR LOWER(c.code_customer) LIKE '%' || :qr || '%'
       OR LOWER(a.number_account) LIKE '%' || :qr || '%' OR LOWER(COALESCE(m.number_meter, '')) LIKE '%' || :qr || '%'
       OR (:qd <> '' AND COALESCE(c.phone_key_customer, '') LIKE '%' || :qd || '%')
       OR EXISTS (SELECT 1 FROM invoices i WHERE i.id_account_invoice = a.id_account AND LOWER(i.number_invoice) = :qr))
ORDER BY c.name_customer, a.number_account
LIMIT :limit;

-- name: reader.bundle
-- Contas ativas para o mediador trabalhar sem internet
SELECT a.id_account AS account_id, a.number_account AS account_number, a.category_account AS category,
       COALESCE(a.address_account, c.address_customer) AS address,
       COALESCE(a.neighborhood_account, c.neighborhood_customer) AS neighborhood, a.landmark_account AS landmark, a.block_account AS block, a.house_number_account AS house_number, a.notes_account AS notes,
       c.id_customer AS customer_id, c.code_customer AS customer_code, c.name_customer AS customer_name,
       c.phone_customer AS phone, m.id_meter AS meter_id, m.number_meter AS meter_number,
       COALESCE(lr.current_value_reading, m.initial_reading_meter) AS last_value, lr.period_reading AS last_period,
       lr.consumption_reading AS last_consumption,
       (SELECT COALESCE(SUM(i.total_invoice - i.paid_amount_invoice), 0) FROM invoices i
         WHERE i.id_account_invoice = a.id_account AND i.status_invoice <> 'cancelled') AS debt,
       (SELECT string_agg(i.number_invoice, ' ') FROM invoices i WHERE i.id_account_invoice = a.id_account
         AND i.status_invoice <> 'cancelled' AND i.issue_date_invoice > CURRENT_DATE - 400) AS invoice_numbers,
       EXISTS (SELECT 1 FROM readings r2 WHERE r2.id_meter_reading = m.id_meter AND r2.period_reading = :period
               AND r2.status_reading <> 'cancelled') AS read_this_period
FROM accounts a
JOIN customers c ON c.id_customer = a.id_customer_account
JOIN meters m ON m.id_account_meter = a.id_account AND m.status_meter = 'active'
LEFT JOIN LATERAL (SELECT r.current_value_reading, r.period_reading, r.consumption_reading FROM readings r
                   WHERE r.id_meter_reading = m.id_meter AND r.status_reading <> 'cancelled'
                   ORDER BY r.period_reading DESC, r.id_reading DESC LIMIT 1) lr ON TRUE
WHERE a.id_company_account = :cid AND a.status_account = 'active' AND c.status_customer = 'active'
ORDER BY c.name_customer, a.number_account;

-- name: meters.last_value
SELECT COALESCE((SELECT r.current_value_reading FROM readings r WHERE r.id_meter_reading = m.id_meter
                 AND r.status_reading <> 'cancelled' AND r.id_reading <> :exceptId
                 AND r.period_reading < :period
                 ORDER BY r.period_reading DESC, r.id_reading DESC LIMIT 1), m.initial_reading_meter) AS value
FROM meters m WHERE m.id_meter = :meterId;

-- name: meters.history
SELECT m.id_meter AS id, m.number_meter AS number, m.initial_reading_meter AS initial_reading,
       to_char(m.installed_at_meter, 'YYYY-MM-DD') AS installed_at, to_char(m.removed_at_meter, 'YYYY-MM-DD') AS removed_at,
       m.status_meter AS status
FROM meters m WHERE m.id_account_meter = :accountId AND m.id_company_meter = :cid ORDER BY m.id_meter DESC;
