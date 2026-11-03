package mz.agua.service;

import lombok.RequiredArgsConstructor;
import mz.agua.common.Db;
import mz.agua.common.Q;
import org.springframework.stereotype.Service;

import java.util.LinkedHashMap;
import java.util.Map;

/** Portal do cliente: as suas contas, faturas, pagamentos e consumo (sempre o cliente da sessão). */
@Service
@RequiredArgsConstructor
public class PortalService {

    private final Db db;
    private final SettingsService settings;

    public Map<String, Object> overview(Long cid, Long customerId) {
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("customer", db.one("customers.detail", Q.company(cid).id("id", customerId).map()));
        out.put("company", settings.branding(cid));
        out.put("accounts", db.list("portal.accounts", Q.of().id("customerId", customerId).map()));
        out.put("invoices", db.list("invoices.list", Q.company(cid).id("customerId", customerId).id("accountId", 0L).limit(200).map()));
        out.put("payments", db.list("payments.list", Q.company(cid).id("customerId", customerId).str("method", "")
                .str("status", "confirmed").limit(200).map()));
        out.put("consumption", db.list("portal.consumption", Q.of().id("customerId", customerId).map()));
        return out;
    }
}
