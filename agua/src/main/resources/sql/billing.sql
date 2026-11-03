-- Leituras, faturas, pagamentos e extratos.
-- Estado calculado de uma fatura (sempre correto, mesmo antes da tarefa diária):
--   cancelled · paid (saldo 0) · overdue (vencida com saldo) · partial (pagou parte) · open

-- name: readings.list
SELECT r.id_reading AS id, r.period_reading AS period, r.previous_value_reading AS previous_value,
       r.current_value_reading AS current_value, r.consumption_reading AS consumption, r.status_reading AS status,
       r.source_reading AS source, r.anomaly_reading AS anomaly, r.notes_reading AS notes,
       to_char(r.read_at_reading, 'YYYY-MM-DD HH24:MI') AS read_at,
       to_char(r.edited_at_reading, 'YYYY-MM-DD HH24:MI') AS edited_at,
       a.id_account AS account_id, a.number_account AS account_number, a.category_account AS category,
       c.id_customer AS customer_id, c.code_customer AS customer_code, c.name_customer AS customer_name,
       m.number_meter AS meter_number, u.name_user AS reader_name,
       i.id_invoice AS invoice_id, i.number_invoice AS invoice_number,
       COALESCE(i.paid_amount_invoice, 0) AS invoice_paid,
       COUNT(*) OVER () AS total_rows
FROM readings r
JOIN accounts a ON a.id_account = r.id_account_reading
JOIN customers c ON c.id_customer = r.id_customer_reading
JOIN meters m ON m.id_meter = r.id_meter_reading
LEFT JOIN users u ON u.id_user = r.id_user_reading
LEFT JOIN invoices i ON i.id_reading_invoice = r.id_reading AND i.status_invoice <> 'cancelled'
WHERE r.id_company_reading = :cid
  AND (:period = '' OR r.period_reading = :period)
  AND (:status = '' OR r.status_reading = :status OR (:status = 'anomaly' AND r.anomaly_reading))
  AND (:readerId = 0 OR r.id_user_reading = :readerId)
  AND (:accountId = 0 OR r.id_account_reading = :accountId)
  AND (:q = '' OR c.name_key_customer LIKE '%' || :q || '%' OR LOWER(c.code_customer) LIKE '%' || :qr || '%'
       OR LOWER(a.number_account) LIKE '%' || :qr || '%' OR LOWER(m.number_meter) LIKE '%' || :qr || '%')
ORDER BY r.read_at_reading DESC, r.id_reading DESC
LIMIT :limit OFFSET :offset;

-- name: readings.stats
SELECT COUNT(*) FILTER (WHERE status_reading <> 'cancelled') AS total,
       COUNT(*) FILTER (WHERE status_reading = 'pending') AS pending,
       COUNT(*) FILTER (WHERE status_reading = 'billed') AS billed,
       COUNT(*) FILTER (WHERE anomaly_reading AND status_reading <> 'cancelled') AS anomalies,
       COALESCE(SUM(consumption_reading) FILTER (WHERE status_reading <> 'cancelled'), 0) AS consumption,
       (SELECT COUNT(*) FROM accounts a JOIN meters m ON m.id_account_meter = a.id_account AND m.status_meter = 'active'
         WHERE a.id_company_account = :cid AND a.status_account = 'active'
           AND NOT EXISTS (SELECT 1 FROM readings r2 WHERE r2.id_meter_reading = m.id_meter
                           AND r2.period_reading = :period AND r2.status_reading <> 'cancelled')) AS missing
FROM readings WHERE id_company_reading = :cid AND (:period = '' OR period_reading = :period);

-- name: readings.pending_ids
SELECT id_reading AS id FROM readings
WHERE id_company_reading = :cid AND status_reading = 'pending' AND (:period = '' OR period_reading = :period)
ORDER BY id_reading;

-- name: invoices.list
SELECT x.*, COUNT(*) OVER () AS total_rows FROM (
  SELECT i.id_invoice AS id, i.number_invoice AS number, i.period_invoice AS period, i.kind_invoice AS kind,
         i.description_invoice AS description, i.consumption_invoice AS consumption,
         i.previous_value_invoice AS previous_value, i.current_value_invoice AS current_value,
         i.total_invoice AS total, i.paid_amount_invoice AS paid, (i.total_invoice - i.paid_amount_invoice) AS balance,
         to_char(i.issue_date_invoice, 'YYYY-MM-DD') AS issue_date, to_char(i.due_date_invoice, 'YYYY-MM-DD') AS due_date,
         CASE WHEN i.status_invoice = 'cancelled' THEN 'cancelled'
              WHEN i.total_invoice <= i.paid_amount_invoice THEN 'paid'
              WHEN i.due_date_invoice < CURRENT_DATE THEN 'overdue'
              WHEN i.paid_amount_invoice > 0 THEN 'partial' ELSE 'open' END AS status,
         a.id_account AS account_id, a.number_account AS account_number,
         c.id_customer AS customer_id, c.code_customer AS customer_code, c.name_customer AS customer_name,
         c.phone_customer AS phone, c.name_key_customer AS name_key, c.phone_key_customer AS phone_key
  FROM invoices i
  JOIN accounts a ON a.id_account = i.id_account_invoice
  JOIN customers c ON c.id_customer = i.id_customer_invoice
  WHERE i.id_company_invoice = :cid
    AND (:period = '' OR i.period_invoice = :period)
    AND (:customerId = 0 OR i.id_customer_invoice = :customerId)
    AND (:accountId = 0 OR i.id_account_invoice = :accountId)
    AND i.issue_date_invoice BETWEEN CAST(:from AS date) AND CAST(:to AS date)
) x
WHERE (:status = '' OR x.status = :status
       OR (:status = 'debt' AND x.balance > 0 AND x.status <> 'cancelled')
       OR (:status = 'pending' AND x.status IN ('open', 'partial'))
       OR (:status = 'partial' AND x.paid > 0 AND x.balance > 0 AND x.status <> 'cancelled'))
  AND (:q = '' OR x.name_key LIKE '%' || :q || '%' OR LOWER(x.number) LIKE '%' || :qr || '%'
       OR LOWER(x.customer_code) LIKE '%' || :qr || '%' OR LOWER(x.account_number) LIKE '%' || :qr || '%'
       OR (:qd <> '' AND COALESCE(x.phone_key, '') LIKE '%' || :qd || '%'))
ORDER BY x.issue_date DESC, x.id DESC
LIMIT :limit OFFSET :offset;

-- name: invoices.stats
SELECT COUNT(*) FILTER (WHERE status_invoice <> 'cancelled') AS total,
       COUNT(*) FILTER (WHERE status_invoice <> 'cancelled' AND total_invoice > paid_amount_invoice
                        AND due_date_invoice >= CURRENT_DATE) AS pending,
       COUNT(*) FILTER (WHERE status_invoice <> 'cancelled' AND total_invoice <= paid_amount_invoice) AS paid,
       COUNT(*) FILTER (WHERE status_invoice <> 'cancelled' AND total_invoice > paid_amount_invoice
                        AND due_date_invoice < CURRENT_DATE) AS overdue,
       COUNT(*) FILTER (WHERE status_invoice <> 'cancelled' AND paid_amount_invoice > 0
                        AND total_invoice > paid_amount_invoice) AS partial,
       COALESCE(SUM(total_invoice) FILTER (WHERE status_invoice <> 'cancelled'), 0) AS billed,
       COALESCE(SUM(paid_amount_invoice) FILTER (WHERE status_invoice <> 'cancelled'), 0) AS collected,
       COALESCE(SUM(total_invoice - paid_amount_invoice) FILTER (WHERE status_invoice <> 'cancelled'), 0) AS debt
FROM invoices
WHERE id_company_invoice = :cid AND (:period = '' OR period_invoice = :period);

-- name: invoices.detail
SELECT i.id_invoice AS id, i.number_invoice AS number, i.period_invoice AS period, i.kind_invoice AS kind,
       i.description_invoice AS description, i.previous_value_invoice AS previous_value,
       i.current_value_invoice AS current_value, i.consumption_invoice AS consumption,
       i.water_amount_invoice AS water_amount, i.sewer_amount_invoice AS sewer_amount, i.fixed_fee_invoice AS fixed_fee,
       i.other_amount_invoice AS other_amount, i.fine_amount_invoice AS fine_amount,
       i.interest_amount_invoice AS interest_amount, i.discount_invoice AS discount, i.total_invoice AS total,
       i.paid_amount_invoice AS paid, (i.total_invoice - i.paid_amount_invoice) AS balance,
       CASE WHEN i.status_invoice = 'cancelled' THEN 'cancelled'
            WHEN i.total_invoice <= i.paid_amount_invoice THEN 'paid'
            WHEN i.due_date_invoice < CURRENT_DATE THEN 'overdue'
            WHEN i.paid_amount_invoice > 0 THEN 'partial' ELSE 'open' END AS status,
       to_char(i.issue_date_invoice, 'YYYY-MM-DD') AS issue_date, to_char(i.due_date_invoice, 'YYYY-MM-DD') AS due_date,
       to_char(i.paid_at_invoice, 'YYYY-MM-DD') AS paid_at, i.notes_invoice AS notes, i.cancel_reason_invoice AS cancel_reason,
       i.id_reading_invoice AS reading_id,
       a.id_account AS account_id, a.number_account AS account_number, a.category_account AS category,
       COALESCE(a.address_account, c.address_customer) AS address,
       c.id_customer AS customer_id, c.code_customer AS customer_code, c.name_customer AS customer_name,
       c.phone_customer AS phone, c.nuit_customer AS customer_nuit,
       m.number_meter AS meter_number, u.name_user AS created_by
FROM invoices i
JOIN accounts a ON a.id_account = i.id_account_invoice
JOIN customers c ON c.id_customer = i.id_customer_invoice
LEFT JOIN readings r ON r.id_reading = i.id_reading_invoice
LEFT JOIN meters m ON m.id_meter = r.id_meter_reading
LEFT JOIN users u ON u.id_user = i.id_user_invoice
WHERE i.id_invoice = :id AND i.id_company_invoice = :cid;

-- name: invoices.payments
SELECT pa.amount_payment_allocation AS amount, pa.balance_after_payment_allocation AS balance_after,
       p.id_payment AS payment_id, p.receipt_number_payment AS receipt_number, p.method_payment AS method,
       p.reference_payment AS reference, p.status_payment AS status,
       to_char(p.paid_at_payment, 'YYYY-MM-DD HH24:MI') AS paid_at, u.name_user AS cashier
FROM payment_allocations pa
JOIN payments p ON p.id_payment = pa.id_payment_payment_allocation
LEFT JOIN users u ON u.id_user = p.id_user_payment
WHERE pa.id_invoice_payment_allocation = :id AND pa.id_company_payment_allocation = :cid
ORDER BY p.paid_at_payment;

-- name: invoices.open_for_customer
-- Faturas com saldo, das mais antigas para as mais recentes (ordem de liquidação)
SELECT i.id_invoice AS id, i.number_invoice AS number, i.period_invoice AS period, i.kind_invoice AS kind,
       i.description_invoice AS description, i.consumption_invoice AS consumption,
       i.previous_value_invoice AS previous_value, i.current_value_invoice AS current_value,
       i.total_invoice AS total, i.paid_amount_invoice AS paid, (i.total_invoice - i.paid_amount_invoice) AS balance,
       to_char(i.due_date_invoice, 'YYYY-MM-DD') AS due_date, (i.due_date_invoice < CURRENT_DATE) AS overdue,
       a.id_account AS account_id, a.number_account AS account_number
FROM invoices i JOIN accounts a ON a.id_account = i.id_account_invoice
WHERE i.id_company_invoice = :cid AND i.id_customer_invoice = :customerId
  AND (:accountId = 0 OR i.id_account_invoice = :accountId)
  AND i.status_invoice <> 'cancelled' AND i.total_invoice > i.paid_amount_invoice
ORDER BY i.due_date_invoice, i.id_invoice;

-- name: invoices.overdue_for_charges
SELECT id_invoice AS id FROM invoices
WHERE status_invoice <> 'cancelled' AND total_invoice > paid_amount_invoice AND due_date_invoice < CURRENT_DATE
  AND (:cid = 0 OR id_company_invoice = :cid)
  AND (last_charge_date_invoice IS NULL OR last_charge_date_invoice < CURRENT_DATE);

-- name: payments.list
SELECT p.id_payment AS id, p.receipt_number_payment AS receipt_number, p.amount_payment AS amount,
       p.method_payment AS method, p.reference_payment AS reference, p.status_payment AS status,
       to_char(p.paid_at_payment, 'YYYY-MM-DD HH24:MI') AS paid_at, p.notes_payment AS notes,
       p.void_reason_payment AS void_reason,
       c.id_customer AS customer_id, c.code_customer AS customer_code, c.name_customer AS customer_name,
       c.phone_customer AS phone, u.name_user AS cashier,
       (SELECT string_agg(DISTINCT i.number_invoice, ', ') FROM payment_allocations pa
          JOIN invoices i ON i.id_invoice = pa.id_invoice_payment_allocation
         WHERE pa.id_payment_payment_allocation = p.id_payment) AS invoices,
       (SELECT string_agg(DISTINCT a.number_account, ', ') FROM payment_allocations pa
          JOIN accounts a ON a.id_account = pa.id_account_payment_allocation
         WHERE pa.id_payment_payment_allocation = p.id_payment) AS accounts,
       COUNT(*) OVER () AS total_rows
FROM payments p
JOIN customers c ON c.id_customer = p.id_customer_payment
LEFT JOIN users u ON u.id_user = p.id_user_payment
WHERE p.id_company_payment = :cid
  AND p.paid_at_payment >= CAST(:from AS date) AND p.paid_at_payment < CAST(:to AS date) + 1
  AND (:status = '' OR p.status_payment = :status)
  AND (:method = '' OR p.method_payment = :method)
  AND (:customerId = 0 OR p.id_customer_payment = :customerId)
  AND (:q = '' OR c.name_key_customer LIKE '%' || :q || '%' OR LOWER(p.receipt_number_payment) LIKE '%' || :qr || '%'
       OR LOWER(c.code_customer) LIKE '%' || :qr || '%' OR LOWER(COALESCE(p.reference_payment, '')) LIKE '%' || :qr || '%'
       OR (:qd <> '' AND COALESCE(c.phone_key_customer, '') LIKE '%' || :qd || '%'))
ORDER BY p.paid_at_payment DESC, p.id_payment DESC
LIMIT :limit OFFSET :offset;

-- name: payments.stats
SELECT COALESCE(SUM(amount_payment) FILTER (WHERE status_payment = 'confirmed'), 0) AS confirmed,
       COUNT(*) FILTER (WHERE status_payment = 'confirmed') AS confirmed_count,
       COALESCE(SUM(amount_payment) FILTER (WHERE status_payment = 'pending'), 0) AS pending,
       COUNT(*) FILTER (WHERE status_payment = 'pending') AS pending_count,
       COUNT(*) FILTER (WHERE status_payment = 'voided') AS voided_count,
       COUNT(DISTINCT id_customer_payment) FILTER (WHERE status_payment = 'confirmed') AS customers
FROM payments
WHERE id_company_payment = :cid
  AND paid_at_payment >= CAST(:from AS date) AND paid_at_payment < CAST(:to AS date) + 1;

-- name: payments.detail
SELECT p.id_payment AS id, p.receipt_number_payment AS receipt_number, p.amount_payment AS amount,
       p.method_payment AS method, p.reference_payment AS reference, p.status_payment AS status,
       to_char(p.paid_at_payment, 'YYYY-MM-DD HH24:MI') AS paid_at, p.notes_payment AS notes,
       p.void_reason_payment AS void_reason, to_char(p.voided_at_payment, 'YYYY-MM-DD HH24:MI') AS voided_at,
       to_char(p.validated_at_payment, 'YYYY-MM-DD HH24:MI') AS validated_at,
       c.id_customer AS customer_id, c.code_customer AS customer_code, c.name_customer AS customer_name,
       c.phone_customer AS phone, c.nuit_customer AS customer_nuit,
       COALESCE(c.address_customer, '') AS address, u.name_user AS cashier,
       (SELECT COALESCE(SUM(i.total_invoice - i.paid_amount_invoice), 0) FROM invoices i
         WHERE i.id_customer_invoice = c.id_customer AND i.status_invoice <> 'cancelled') AS debt_now
FROM payments p
JOIN customers c ON c.id_customer = p.id_customer_payment
LEFT JOIN users u ON u.id_user = p.id_user_payment
WHERE p.id_payment = :id AND p.id_company_payment = :cid;

-- name: payments.allocations
SELECT pa.id_invoice_payment_allocation AS invoice_id, pa.amount_payment_allocation AS amount,
       pa.balance_before_payment_allocation AS balance_before, pa.balance_after_payment_allocation AS balance_after,
       i.number_invoice AS invoice_number, i.period_invoice AS period, i.kind_invoice AS kind,
       i.description_invoice AS description, i.total_invoice AS total,
       i.previous_value_invoice AS previous_value, i.current_value_invoice AS current_value,
       i.consumption_invoice AS consumption, to_char(i.due_date_invoice, 'YYYY-MM-DD') AS due_date,
       a.number_account AS account_number, m.number_meter AS meter_number
FROM payment_allocations pa
JOIN invoices i ON i.id_invoice = pa.id_invoice_payment_allocation
JOIN accounts a ON a.id_account = pa.id_account_payment_allocation
LEFT JOIN readings r ON r.id_reading = i.id_reading_invoice
LEFT JOIN meters m ON m.id_meter = r.id_meter_reading
WHERE pa.id_payment_payment_allocation = :id AND pa.id_company_payment_allocation = :cid
ORDER BY i.due_date_invoice, i.id_invoice;

-- name: statement.opening
-- Saldo antes da data inicial (faturas emitidas − pagamentos confirmados aplicados)
SELECT COALESCE((SELECT SUM(i.total_invoice) FROM invoices i
                  WHERE i.id_customer_invoice = :customerId AND i.id_company_invoice = :cid
                    AND i.status_invoice <> 'cancelled' AND (:accountId = 0 OR i.id_account_invoice = :accountId)
                    AND i.issue_date_invoice < CAST(:from AS date)), 0)
     - COALESCE((SELECT SUM(pa.amount_payment_allocation) FROM payment_allocations pa
                  JOIN payments p ON p.id_payment = pa.id_payment_payment_allocation
                  JOIN invoices i ON i.id_invoice = pa.id_invoice_payment_allocation
                  WHERE i.id_customer_invoice = :customerId AND pa.id_company_payment_allocation = :cid
                    AND p.status_payment = 'confirmed' AND (:accountId = 0 OR pa.id_account_payment_allocation = :accountId)
                    AND p.paid_at_payment < CAST(:from AS date)), 0) AS opening;

-- name: statement.movements
-- Movimentos de uma conta (ou de todas): faturas a débito, pagamentos a crédito
SELECT * FROM (
  SELECT i.issue_date_invoice AS sort_date, 1 AS sort_kind, i.id_invoice AS sort_id,
         to_char(i.issue_date_invoice, 'YYYY-MM-DD') AS date, 'invoice' AS type, i.number_invoice AS document,
         CASE WHEN i.kind_invoice = 'manual' THEN COALESCE(i.description_invoice, 'Fatura avulsa')
              ELSE 'Consumo ' || i.period_invoice END AS description,
         a.number_account AS account_number, i.period_invoice AS period,
         i.previous_value_invoice AS previous_value, i.current_value_invoice AS current_value,
         i.consumption_invoice AS consumption, i.total_invoice AS debit, CAST(0 AS numeric) AS credit
  FROM invoices i JOIN accounts a ON a.id_account = i.id_account_invoice
  WHERE i.id_customer_invoice = :customerId AND i.id_company_invoice = :cid AND i.status_invoice <> 'cancelled'
    AND (:accountId = 0 OR i.id_account_invoice = :accountId)
    AND i.issue_date_invoice BETWEEN CAST(:from AS date) AND CAST(:to AS date)
  UNION ALL
  SELECT CAST(p.paid_at_payment AS date), 2, p.id_payment,
         to_char(p.paid_at_payment, 'YYYY-MM-DD'), 'payment', p.receipt_number_payment,
         'Pagamento ' || i.number_invoice, a.number_account, i.period_invoice,
         NULL, NULL, NULL, CAST(0 AS numeric), pa.amount_payment_allocation
  FROM payment_allocations pa
  JOIN payments p ON p.id_payment = pa.id_payment_payment_allocation
  JOIN invoices i ON i.id_invoice = pa.id_invoice_payment_allocation
  JOIN accounts a ON a.id_account = pa.id_account_payment_allocation
  WHERE i.id_customer_invoice = :customerId AND pa.id_company_payment_allocation = :cid AND p.status_payment = 'confirmed'
    AND (:accountId = 0 OR pa.id_account_payment_allocation = :accountId)
    AND CAST(p.paid_at_payment AS date) BETWEEN CAST(:from AS date) AND CAST(:to AS date)
) m
ORDER BY sort_date, sort_kind, sort_id;
