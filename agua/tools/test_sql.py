#!/usr/bin/env python3
"""Executa todas as consultas de src/main/resources/sql contra um PostgreSQL de teste (com dados de exemplo).
Uso: python3 tools/test_sql.py  (precisa de psql e de uma base 'agua' com o esquema V1 + V2)."""
import os, pathlib, re, subprocess, sys
ROOT = pathlib.Path(__file__).resolve().parent.parent
SEED = """
TRUNCATE companies, users, customers RESTART IDENTITY CASCADE;
INSERT INTO companies(code_company,name_company,status_company) VALUES ('AGUA-VJA3-VGRA','Águas Teste','active');
INSERT INTO company_settings(id_company_company_setting) VALUES (1);
INSERT INTO users(id_company_user,name_user,username_user,email_user,password_user,role_user) VALUES (1,'Gestor','AGUA-VJA3-VGRA','g@x.mz','x','manager'),(NULL,'Admin','admin','a@x.mz','x','admin');
INSERT INTO customers(id_company_customer,code_customer,name_customer,name_key_customer,phone_customer,phone_key_customer) VALUES (1,'CLI-VJA3-00001','João Maria','joao maria','84 123 4567','841234567');
INSERT INTO accounts(id_company_account,id_customer_account,number_account) VALUES (1,1,'CT-VJA3-00001'),(1,1,'CT-VJA3-00002');
INSERT INTO meters(id_company_meter,id_account_meter,number_meter) VALUES (1,1,'M1'),(1,2,'M2');
INSERT INTO readings(id_company_reading,id_account_reading,id_meter_reading,id_customer_reading,period_reading,previous_value_reading,current_value_reading,consumption_reading,read_at_reading,status_reading,id_user_reading) VALUES (1,1,1,1,'2026-10',0,12,12,now(),'billed',1),(1,2,2,1,'2026-10',0,3,3,now(),'pending',1);
INSERT INTO invoices(id_company_invoice,id_customer_invoice,id_account_invoice,id_reading_invoice,number_invoice,period_invoice,consumption_invoice,total_invoice,paid_amount_invoice,issue_date_invoice,due_date_invoice) VALUES (1,1,1,1,'FT-2026-000001','2026-10',12,840,100,CURRENT_DATE-40,CURRENT_DATE-10),(1,1,2,NULL,'FT-2026-000002','2026-11',0,300,0,CURRENT_DATE,CURRENT_DATE+15);
INSERT INTO payments(id_company_payment,id_customer_payment,receipt_number_payment,amount_payment,paid_at_payment,id_user_payment) VALUES (1,1,'RC-2026-000001',100,now(),1);
INSERT INTO payment_allocations(id_company_payment_allocation,id_payment_payment_allocation,id_invoice_payment_allocation,id_account_payment_allocation,amount_payment_allocation) VALUES (1,1,1,1,100);
INSERT INTO password_resets(id_user_password_reset,code_hash_password_reset,expires_at_password_reset,channel_password_reset) VALUES (1,'h',now(),'admin');
INSERT INTO audit_logs(id_company_audit_log,action_audit_log) VALUES (1,'LOGIN');
UPDATE companies SET plan_company = 'standard';
INSERT INTO messages(id_company_message,id_customer_message,channel_message,kind_message,to_phone_message,body_message,status_message) VALUES (1,1,'whatsapp','reminder','841234567','Olá','manual');
"""
VALS = {"cid": "1", "company": "0", "q": "''", "qr": "''", "qd": "''", "status": "''", "debt": "''", "limit": "50",
        "offset": "0", "id": "1", "period": "'2026-10'", "from": "'1900-01-01'", "to": "'2999-12-31'",
        "customerId": "1", "accountId": "0", "readerId": "0", "meterId": "1", "exceptId": "0", "doc": "''",
        "docType": "'bi'", "phone": "'841234567'", "nuit": "''", "method": "''", "role": "''", "missing": "0",
        "minDebt": "0", "overdueOnly": "0", "fromPeriod": "'2026-01'", "toPeriod": "'2026-12'",
        "plan": "''", "sort": "'debt'", "neighborhood": "''", "channel": "''", "kind": "''", "debtorsOnly": "1"}
def psql(sql):
    return subprocess.run(["psql", "-h", "localhost", "-U", "postgres", "-d", os.environ.get("TEST_DB", "agua"), "-v", "ON_ERROR_STOP=1", "-qAt", "-c", sql],
                          capture_output=True, text=True)
r = psql(SEED)
if r.returncode: print(r.stderr); sys.exit(1)
fails = 0; total = 0
for f in sorted((ROOT / "src/main/resources/sql").glob("*.sql")):
    for name, body in re.findall(r"--\s*name:\s*(\S+)\s*\n(.*?)(?=\n--\s*name:|\Z)", f.read_text(), re.S):
        total += 1
        parts = body.strip().rstrip(";").split("'")   # como o Spring: não substitui dentro de 'texto'
        sql = "'".join(re.sub(r"(?<!:):([a-zA-Z]\w*)", lambda m: VALS.get(m.group(1), "__MISSING_" + m.group(1)), p) if i % 2 == 0 else p
                       for i, p in enumerate(parts))
        r = psql(sql)
        rows = len([l for l in r.stdout.splitlines() if l])
        if r.returncode or "__MISSING_" in sql:
            fails += 1; print("FALHOU", name, r.stderr.strip()[:300], re.findall(r"__MISSING_\w+", sql))
        else:
            print("ok", name, rows, "linhas")
print(f"{total - fails}/{total} consultas OK"); sys.exit(1 if fails else 0)
