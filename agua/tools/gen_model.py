#!/usr/bin/env python3
"""
Gera as entidades JPA (src/main/java/mz/agua/domain) e a migração Flyway V1
a partir de UMA especificação, para que o código Java e a base de dados
nunca fiquem diferentes.

Convenção (igual ao bip-pme):
  tabela no plural em inglês        -> customers
  chave primária                    -> id_customer
  coluna                            -> <campo>_<entidade>   ex.: name_customer
  chave estrangeira (campo xxxId)   -> id_<xxx>_<entidade>  ex.: id_company_customer
  created_at / updated_at sem sufixo

Tipos: S<n> varchar(n) · T text · L bigint · I integer · D numeric(14,2) · B boolean · DATE · TS
Opções: nn (not null) · u (único) · d=<default sql> · j (não sai no JSON) · ck=a|b|c (valores permitidos)
        v2 (campo/tabela criado na migração V2 — não entra no V1, que nunca muda depois de aplicado)

As migrações novas (V2__..., V3__...) são escritas à mão em src/main/resources/db/migration.
"""
import re, pathlib

ROOT = pathlib.Path(__file__).resolve().parent.parent
JAVA = ROOT / "src/main/java/mz/agua/domain"
SQL = ROOT / "src/main/resources/db/migration/V1__schema.sql"

ENTITIES = [
    ("Company", "companies", "company", "Empresa / provedor de água (tenant). code = AGUA-XXXX-XXXX", [
        ("code", "S20", "nn u"), ("name", "S180", "nn"), ("nuit", "S32", ""), ("phone", "S40", ""),
        ("email", "S150", ""), ("address", "T", ""), ("city", "S120", ""), ("province", "S120", ""),
        ("slogan", "S200", ""), ("logo", "T", "j"),
        ("status", "S12", "nn d='pending' ck=pending|active|suspended|rejected"),
        ("selfRegistered", "B", "nn d=false"), ("approvedAt", "TS", ""), ("notes", "T", ""),
        ("plan", "S12", "nn d='basic' ck=basic|standard|enterprise v2"), ("planChangedAt", "TS", "v2"),
    ]),
    ("CompanySetting", "company_settings", "company_setting", "Regras de cada empresa: faturação, multas, juros e recibo", [
        ("companyId", "L", "nn u"), ("configured", "B", "nn d=false"),
        ("currency", "S10", "nn d='MZN'"), ("invoiceDueDays", "I", "nn d=15"), ("readingDay", "I", "nn d=25"),
        ("autoBill", "B", "nn d=false"), ("minimumCharge", "D", "nn d=0"), ("fixedFee", "D", "nn d=0"),
        ("sewerPercent", "D", "nn d=0"),
        ("tariffMode", "S12", "nn d='minimum' ck=minimum|tiers"),
        ("minimumM3", "I", "nn d=5"), ("pricePerM3", "D", "nn d=0"),
        ("fineEnabled", "B", "nn d=false"), ("fineType", "S10", "nn d='percent' ck=percent|fixed"),
        ("fineValue", "D", "nn d=0"), ("fineGraceDays", "I", "nn d=0"),
        ("interestEnabled", "B", "nn d=false"), ("interestMonthlyPercent", "D", "nn d=0"),
        ("requirePaymentValidation", "B", "nn d=false"),
        ("invoicePrefix", "S10", "nn d='FT'"), ("receiptPrefix", "S10", "nn d='RC'"),
        ("receiptFormat", "S20", "nn d='a5' ck=thermal58|thermal80|a5|a4"),
        ("receiptOrientation", "S12", "nn d='landscape' ck=portrait|landscape"),
        ("receiptCopies", "I", "nn d=1"), ("receiptTitle", "S60", "nn d='RECIBO'"),
        ("receiptAccent", "S10", "nn d='#0f766e'"),
        ("receiptShowLogo", "B", "nn d=true"), ("receiptShowReadings", "B", "nn d=true"),
        ("receiptShowDebt", "B", "nn d=true"), ("receiptShowSignature", "B", "nn d=true"),
        ("receiptHeader", "T", ""), ("receiptFooter", "T", ""), ("receiptNotes", "T", ""),
        ("paymentInstructions", "T", ""),
        ("allowOfflineReadings", "B", "nn d=true"), ("consumptionAlert", "I", "nn d=100"),
        # V2 — mensagens (WhatsApp no plano Standard; WhatsApp + SMS no Enterprise)
        ("whatsappNumber", "S40", "v2"), ("whatsappMode", "S10", "nn d='link' ck=link|api v2"),
        ("whatsappPhoneId", "S60", "v2"), ("whatsappToken", "T", "j v2"),
        ("smsNumber", "S40", "v2"), ("smsMode", "S10", "nn d='link' ck=link|api v2"),
        ("smsApiUrl", "S300", "v2"), ("smsApiToken", "T", "j v2"),
        ("msgChannel", "S10", "nn d='whatsapp' ck=whatsapp|sms|both v2"),
        ("msgOnInvoice", "B", "nn d=false v2"), ("msgOnPayment", "B", "nn d=false v2"),
        ("msgInvoiceTemplate", "T", "v2"), ("msgPaymentTemplate", "T", "v2"), ("msgReminderTemplate", "T", "v2"),
    ]),
    ("TariffTier", "tariff_tiers", "tariff_tier", "Escalão de preço por m3 (to_m3 nulo = sem limite)", [
        ("companyId", "L", "nn"), ("category", "S20", "nn d='residential' ck=residential|commercial|public|industrial"),
        ("fromM3", "I", "nn"), ("toM3", "I", ""), ("priceM3", "D", "nn"), ("description", "S150", ""),
        ("active", "B", "nn d=true"),
    ]),
    ("User", "users", "user", "Utilizador. company_id nulo = administrador da plataforma. Email único", [
        ("companyId", "L", ""), ("customerId", "L", ""), ("name", "S150", "nn"), ("username", "S60", "nn u"),
        ("email", "S150", ""), ("phone", "S40", ""), ("password", "S255", "nn j"),
        ("role", "S12", "nn ck=admin|manager|reader|customer"),
        ("status", "S12", "nn d='active' ck=active|blocked"),
        ("mustChangePassword", "B", "nn d=false"), ("lastLogin", "TS", ""),
    ]),
    ("PasswordReset", "password_resets", "password_reset", "Pedido de recuperação de senha (código por email ou tratado pelo admin)", [
        ("userId", "L", "nn"), ("codeHash", "S100", "nn j"), ("expiresAt", "TS", "nn"), ("usedAt", "TS", ""),
        ("channel", "S10", "nn ck=email|admin"), ("status", "S12", "nn d='pending' ck=pending|done|expired|cancelled"),
        ("attempts", "I", "nn d=0"), ("ip", "S45", ""), ("handledBy", "L", ""),
    ]),
    ("Customer", "customers", "customer", "Cliente. Não se repete na mesma empresa (documento ou telefone)", [
        ("companyId", "L", "nn"), ("code", "S30", "nn"), ("name", "S180", "nn"), ("nameKey", "S180", "nn j"),
        ("documentType", "S20", "nn d='bi' ck=bi|passport|dire|nuit|other"), ("document", "S50", ""),
        ("nuit", "S32", ""), ("gender", "S1", "ck=M|F"), ("birthDate", "DATE", ""), ("occupation", "S120", ""),
        ("phone", "S40", ""), ("phoneKey", "S20", "j"), ("phone2", "S40", ""), ("email", "S150", ""),
        ("address", "T", ""), ("neighborhood", "S120", ""), ("block", "S40", ""), ("houseNumber", "S40", ""),
        ("district", "S120", ""), ("city", "S120", ""), ("status", "S12", "nn d='active' ck=active|inactive"), ("notes", "T", ""),
        ("clientUuid", "S40", "u"),
    ]),
    ("Account", "accounts", "account", "Conta / contrato de água de um cliente (um cliente pode ter várias)", [
        ("companyId", "L", "nn"), ("customerId", "L", "nn"), ("number", "S30", "nn"),
        ("category", "S20", "nn d='residential' ck=residential|commercial|public|industrial"),
        ("address", "T", ""), ("neighborhood", "S120", ""), ("block", "S40", ""), ("houseNumber", "S40", ""),
        ("landmark", "S200", ""), ("gps", "S60", ""), ("latitude", "S20", ""), ("longitude", "S20", ""),
        ("status", "S12", "nn d='active' ck=active|suspended|closed"), ("openedAt", "DATE", ""), ("notes", "T", ""),
    ]),
    ("Meter", "meters", "meter", "Contador da conta (troca de contador mantém histórico)", [
        ("companyId", "L", "nn"), ("accountId", "L", "nn"), ("number", "S50", "nn"),
        ("initialReading", "I", "nn d=0"), ("installedAt", "DATE", ""), ("removedAt", "DATE", ""),
        ("status", "S12", "nn d='active' ck=active|replaced"),
    ]),
    ("Reading", "readings", "reading", "Leitura mensal. client_uuid evita duplicados vindos do modo offline", [
        ("companyId", "L", "nn"), ("accountId", "L", "nn"), ("meterId", "L", "nn"), ("customerId", "L", "nn"),
        ("period", "S7", "nn"), ("previousValue", "I", "nn"), ("currentValue", "I", "nn"), ("consumption", "I", "nn"),
        ("readAt", "TS", "nn"), ("status", "S12", "nn d='pending' ck=pending|billed|cancelled"),
        ("source", "S10", "nn d='online' ck=online|offline|manual"), ("clientUuid", "S40", "u"),
        ("anomaly", "B", "nn d=false"), ("notes", "T", ""), ("userId", "L", ""),
        ("editedBy", "L", ""), ("editedAt", "TS", ""),
    ]),
    ("Invoice", "invoices", "invoice", "Fatura de uma conta (consumo ou manual)", [
        ("companyId", "L", "nn"), ("customerId", "L", "nn"), ("accountId", "L", "nn"), ("readingId", "L", ""),
        ("kind", "S12", "nn d='consumption' ck=consumption|manual"),
        ("number", "S30", "nn"), ("period", "S7", "nn"), ("description", "S200", ""),
        ("previousValue", "I", ""), ("currentValue", "I", ""), ("consumption", "I", "nn d=0"),
        ("waterAmount", "D", "nn d=0"), ("sewerAmount", "D", "nn d=0"), ("fixedFee", "D", "nn d=0"),
        ("otherAmount", "D", "nn d=0"), ("fineAmount", "D", "nn d=0"), ("interestAmount", "D", "nn d=0"),
        ("discount", "D", "nn d=0"), ("total", "D", "nn d=0"), ("paidAmount", "D", "nn d=0"),
        ("status", "S12", "nn d='open' ck=open|partial|paid|overdue|cancelled"),
        ("issueDate", "DATE", "nn"), ("dueDate", "DATE", "nn"), ("paidAt", "DATE", ""), ("lastChargeDate", "DATE", ""),
        ("notes", "T", ""), ("cancelReason", "T", ""), ("userId", "L", ""),
    ]),
    ("Payment", "payments", "payment", "Pagamento (total ou parcial) com recibo; pode cobrir várias faturas", [
        ("companyId", "L", "nn"), ("customerId", "L", "nn"), ("receiptNumber", "S30", "nn"),
        ("amount", "D", "nn"), ("method", "S20", "nn d='cash' ck=cash|mpesa|emola|mkesh|bank|card|other"),
        ("reference", "S120", ""), ("paidAt", "TS", "nn"), ("clientUuid", "S40", "u"),
        ("status", "S12", "nn d='confirmed' ck=pending|confirmed|voided"), ("notes", "T", ""), ("userId", "L", ""),
        ("validatedBy", "L", ""), ("validatedAt", "TS", ""), ("voidedBy", "L", ""), ("voidedAt", "TS", ""),
        ("voidReason", "T", ""),
    ]),
    ("PaymentAllocation", "payment_allocations", "payment_allocation", "Parte de um pagamento aplicada a uma fatura", [
        ("companyId", "L", "nn"), ("paymentId", "L", "nn"), ("invoiceId", "L", "nn"), ("accountId", "L", "nn"),
        ("amount", "D", "nn"), ("balanceBefore", "D", "nn d=0"), ("balanceAfter", "D", "nn d=0"),
    ]),
    ("Sequence", "sequences", "sequence", "Numeração por empresa (faturas, recibos, clientes, contas, mediadores)", [
        ("companyId", "L", "nn"), ("name", "S30", "nn"), ("year", "I", "nn"), ("value", "L", "nn d=0"),
    ]),
    ("Message", "messages", "message", "Mensagem WhatsApp/SMS enviada (ou preparada) para um cliente", [
        ("companyId", "L", "nn"), ("customerId", "L", ""), ("channel", "S10", "nn ck=whatsapp|sms"),
        ("kind", "S12", "nn d='custom' ck=invoice|payment|reminder|custom"), ("refId", "L", ""),
        ("toPhone", "S40", "nn"), ("body", "T", "nn"),
        ("status", "S10", "nn d='queued' ck=queued|manual|sent|failed|cancelled"),
        ("attempts", "I", "nn d=0"), ("error", "T", ""), ("providerRef", "S120", ""), ("sentAt", "TS", ""),
        ("userId", "L", ""),
    ], "v2"),
    ("AuditLog", "audit_logs", "audit_log", "Quem fez o quê e quando", [
        ("companyId", "L", ""), ("userId", "L", ""), ("username", "S60", ""), ("action", "S60", "nn"),
        ("resource", "S120", ""), ("payload", "T", ""), ("ip", "S45", ""),
    ]),
]

FKS = [
    ("company_settings", "id_company_company_setting", "companies", "id_company"),
    ("tariff_tiers", "id_company_tariff_tier", "companies", "id_company"),
    ("users", "id_company_user", "companies", "id_company"),
    ("users", "id_customer_user", "customers", "id_customer"),
    ("password_resets", "id_user_password_reset", "users", "id_user"),
    ("customers", "id_company_customer", "companies", "id_company"),
    ("accounts", "id_company_account", "companies", "id_company"),
    ("accounts", "id_customer_account", "customers", "id_customer"),
    ("meters", "id_company_meter", "companies", "id_company"),
    ("meters", "id_account_meter", "accounts", "id_account"),
    ("readings", "id_company_reading", "companies", "id_company"),
    ("readings", "id_account_reading", "accounts", "id_account"),
    ("readings", "id_meter_reading", "meters", "id_meter"),
    ("readings", "id_customer_reading", "customers", "id_customer"),
    ("invoices", "id_company_invoice", "companies", "id_company"),
    ("invoices", "id_customer_invoice", "customers", "id_customer"),
    ("invoices", "id_account_invoice", "accounts", "id_account"),
    ("invoices", "id_reading_invoice", "readings", "id_reading"),
    ("payments", "id_company_payment", "companies", "id_company"),
    ("payments", "id_customer_payment", "customers", "id_customer"),
    ("payment_allocations", "id_payment_payment_allocation", "payments", "id_payment"),
    ("payment_allocations", "id_invoice_payment_allocation", "invoices", "id_invoice"),
    ("payment_allocations", "id_account_payment_allocation", "accounts", "id_account"),
    ("sequences", "id_company_sequence", "companies", "id_company"),
]

UNIQUES = [
    ("sequences", ["id_company_sequence", "name_sequence", "year_sequence"]),
    ("customers", ["id_company_customer", "code_customer"]),
    ("accounts", ["id_company_account", "number_account"]),
    ("invoices", ["id_company_invoice", "number_invoice"]),
    ("payments", ["id_company_payment", "receipt_number_payment"]),
]

# Índices únicos parciais e índices de pesquisa (SQL direto)
EXTRA_SQL = """
-- Email de login único (sem diferença entre maiúsculas e minúsculas)
CREATE UNIQUE INDEX uq_users_email ON users (LOWER(email_user)) WHERE email_user IS NOT NULL AND email_user <> '';
-- O mesmo cliente não pode ser registado duas vezes na mesma empresa
CREATE UNIQUE INDEX uq_customers_document ON customers (id_company_customer, document_type_customer, LOWER(document_customer))
    WHERE document_customer IS NOT NULL AND document_customer <> '';
CREATE UNIQUE INDEX uq_customers_phone ON customers (id_company_customer, phone_key_customer)
    WHERE phone_key_customer IS NOT NULL AND phone_key_customer <> '';
-- Um contador ativo por número; uma leitura válida por contador e período
CREATE UNIQUE INDEX uq_meters_active ON meters (id_company_meter, LOWER(number_meter)) WHERE status_meter = 'active';
CREATE UNIQUE INDEX uq_readings_meter_period ON readings (id_meter_reading, period_reading) WHERE status_reading <> 'cancelled';
-- Uma fatura de consumo por leitura
CREATE UNIQUE INDEX uq_invoices_reading ON invoices (id_reading_invoice) WHERE id_reading_invoice IS NOT NULL AND status_invoice <> 'cancelled';

CREATE INDEX ix_users_company ON users (id_company_user, role_user);
CREATE INDEX ix_customers_company_name ON customers (id_company_customer, name_key_customer);
CREATE INDEX ix_accounts_customer ON accounts (id_customer_account);
CREATE INDEX ix_meters_account ON meters (id_account_meter, status_meter);
CREATE INDEX ix_readings_company_period ON readings (id_company_reading, period_reading, status_reading);
CREATE INDEX ix_readings_account ON readings (id_account_reading, read_at_reading);
CREATE INDEX ix_invoices_company_period ON invoices (id_company_invoice, period_invoice, status_invoice);
CREATE INDEX ix_invoices_customer ON invoices (id_customer_invoice, status_invoice);
CREATE INDEX ix_invoices_account ON invoices (id_account_invoice, issue_date_invoice);
CREATE INDEX ix_invoices_due ON invoices (status_invoice, due_date_invoice);
CREATE INDEX ix_payments_company_date ON payments (id_company_payment, paid_at_payment);
CREATE INDEX ix_payments_customer ON payments (id_customer_payment, paid_at_payment);
CREATE INDEX ix_allocations_payment ON payment_allocations (id_payment_payment_allocation);
CREATE INDEX ix_allocations_invoice ON payment_allocations (id_invoice_payment_allocation);
CREATE INDEX ix_resets_user ON password_resets (id_user_password_reset, status_password_reset);
CREATE INDEX ix_audit_company_date ON audit_logs (id_company_audit_log, created_at);
"""

def snake(s):
    return re.sub(r"(?<!^)(?=[A-Z])", "_", s).lower()

def column(field, suffix, t="L"):
    if field.endswith("Id") and field != "id" and t == "L":     # só BIGINT é chave estrangeira
        return f"id_{snake(field[:-2])}_{suffix}"
    return f"{snake(field)}_{suffix}"

def jtype(t):
    return {"T": "String", "L": "Long", "I": "Integer", "D": "BigDecimal", "B": "Boolean",
            "DATE": "LocalDate", "TS": "LocalDateTime"}.get(t, "String")

def sqltype(t):
    if t.startswith("S"): return f"VARCHAR({t[1:]})"
    return {"T": "TEXT", "L": "BIGINT", "I": "INTEGER", "D": "NUMERIC(14,2)", "B": "BOOLEAN",
            "DATE": "DATE", "TS": "TIMESTAMP"}[t]

def opts(o):
    return o.split()

def default_java(t, o):
    m = re.search(r"d=('[^']*'|\S+)", o)
    if not m: return ""
    v = m.group(1)
    if t == "B": return f" = {v}"
    if t == "D": return " = BigDecimal.ZERO" if v == "0" else f' = new BigDecimal("{v}")'
    if t == "I": return f" = {v}"
    if t == "L": return f" = {v}L"
    if t.startswith("S") or t == "T": return f' = "{v.strip(chr(39))}"'
    return ""

def gen_entity(cls, table, suffix, doc, fields):
    imports = {"jakarta.persistence.Column", "jakarta.persistence.Entity", "jakarta.persistence.GeneratedValue",
               "jakarta.persistence.GenerationType", "jakarta.persistence.Id", "jakarta.persistence.Table",
               "lombok.Getter", "lombok.Setter", "lombok.NoArgsConstructor", "java.time.LocalDateTime",
               "org.hibernate.annotations.CreationTimestamp"}
    body = [f'    @Id\n    @GeneratedValue(strategy = GenerationType.IDENTITY)\n    @Column(name = "id_{suffix}")\n    private Long id;\n']
    for f, t, o in fields:
        jt = jtype(t)
        if jt == "BigDecimal": imports.add("java.math.BigDecimal")
        if jt == "LocalDate": imports.add("java.time.LocalDate")
        ann = []
        if "j" in opts(o):
            ann.append("@JsonIgnore"); imports.add("com.fasterxml.jackson.annotation.JsonIgnore")
        extra = ", nullable = false" if "nn" in opts(o) else ""
        ann.append(f'@Column(name = "{column(f, suffix, t)}"{extra})')
        body.append("    " + "\n    ".join(ann) + f"\n    private {jt} {f}{default_java(t, o)};\n")
    body.append('    @CreationTimestamp\n    @Column(name = "created_at", nullable = false, updatable = false)\n    private LocalDateTime createdAt;\n')
    if cls != "AuditLog":
        imports.add("org.hibernate.annotations.UpdateTimestamp")
        body.append('    @UpdateTimestamp\n    @Column(name = "updated_at", nullable = false)\n    private LocalDateTime updatedAt;\n')
    imps = "\n".join(f"import {i};" for i in sorted(imports))
    return f'''package mz.agua.domain;

{imps}

/** {doc}. Tabela {table}. Gerado por tools/gen_model.py — não editar à mão. */
@Entity
@Table(name = "{table}")
@Getter
@Setter
@NoArgsConstructor
public class {cls} {{

{chr(10).join(body)}}}
'''

def gen_sql():
    out = ["-- ============================================================",
           "-- AguaSystem v12 — esquema PostgreSQL (gerado por tools/gen_model.py)",
           "-- Convenção: tabela no plural, id_<entidade>, coluna <campo>_<entidade>",
           "-- ============================================================", ""]
    for e in ENTITIES:
        cls, table, suffix, doc, fields = e[:5]
        if len(e) > 5 and e[5] == "v2": continue        # tabela criada no V2
        cols = [f"    id_{suffix} BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY"]
        checks = []
        for f, t, o in fields:
            if "v2" in opts(o): continue                 # coluna criada no V2
            c = column(f, suffix, t)
            line = f"    {c} {sqltype(t)}"
            if "nn" in opts(o): line += " NOT NULL"
            m = re.search(r"d=('[^']*'|\S+)", o)
            if m: line += f" DEFAULT {m.group(1)}"
            if "u" in opts(o): line += " UNIQUE"
            cols.append(line)
            m = re.search(r"ck=(\S+)", o)
            if m:
                vals = ", ".join(f"'{v}'" for v in m.group(1).split("|"))
                checks.append(f"    CONSTRAINT ck_{c} CHECK ({c} IN ({vals}))")
        cols.append("    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP")
        if cls != "AuditLog": cols.append("    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP")
        out.append(f"-- {doc}")
        out.append(f"CREATE TABLE {table} (\n" + ",\n".join(cols + checks) + "\n);\n")
    for i, (table, cols) in enumerate(UNIQUES):
        out.append(f"ALTER TABLE {table} ADD CONSTRAINT uq_{table}_{i} UNIQUE ({', '.join(cols)});")
    out.append("")
    for t, c, rt, rc in FKS:
        out.append(f"ALTER TABLE {t} ADD CONSTRAINT fk_{c} FOREIGN KEY ({c}) REFERENCES {rt}({rc});")
    out.append(EXTRA_SQL)
    return "\n".join(out)

if __name__ == "__main__":
    JAVA.mkdir(parents=True, exist_ok=True)
    for e in ENTITIES:
        (JAVA / f"{e[0]}.java").write_text(gen_entity(*e[:5]))
    SQL.parent.mkdir(parents=True, exist_ok=True)
    SQL.write_text(gen_sql())
    print("entidades:", len(ENTITIES))
