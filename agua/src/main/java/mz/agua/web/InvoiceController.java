package mz.agua.web;

import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import mz.agua.common.Resp;
import mz.agua.domain.Invoice;
import mz.agua.dto.Dto;
import mz.agua.security.CurrentUser;
import mz.agua.service.BillingService;
import mz.agua.service.SettingsService;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

/** Faturas (gestor): lista com filtros, detalhe, fatura avulsa, anular, desconto, multas e impressão. */
@RestController
@RequiredArgsConstructor
public class InvoiceController {

    private final BillingService billing;
    private final SettingsService settings;

    @GetMapping("/api/invoices")
    public Map<String, Object> list(@RequestParam(required = false) String q, @RequestParam(required = false) String period,
                                    @RequestParam(required = false) String status, @RequestParam(required = false) Long customerId,
                                    @RequestParam(required = false) Long accountId,
                                    @RequestParam(required = false) String from, @RequestParam(required = false) String to,
                                    @RequestParam(required = false) Integer page, @RequestParam(required = false) Integer size) {
        return billing.list(CurrentUser.manager(), q, period, status, customerId, accountId, from, to, page, size);
    }

    @GetMapping("/api/invoices/{id}")
    public Map<String, Object> detail(@PathVariable Long id) {
        return Resp.ok("invoice", billing.detail(CurrentUser.manager(), id));
    }

    /** Fatura + dados da empresa para imprimir. */
    @GetMapping("/api/invoices/{id}/print")
    public Map<String, Object> print(@PathVariable Long id) {
        Long cid = CurrentUser.manager();
        return Resp.ok().with("invoice", billing.detail(cid, id)).with("company", settings.branding(cid)).build();
    }

    @PostMapping("/api/invoices")
    public Map<String, Object> manual(@Valid @RequestBody Dto.ManualInvoice body) {
        Invoice i = billing.createManual(CurrentUser.manager(), body);
        return Resp.ok().with("id", i.getId()).with("number", i.getNumber()).with("total", i.getTotal()).build();
    }

    @PostMapping("/api/invoices/{id}/cancel")
    public Map<String, Object> cancel(@PathVariable Long id, @Valid @RequestBody Dto.Reason body) {
        billing.cancel(CurrentUser.manager(), id, body.reason());
        return Resp.message("Fatura anulada.");
    }

    @PostMapping("/api/invoices/{id}/discount")
    public Map<String, Object> discount(@PathVariable Long id, @Valid @RequestBody Dto.Discount body) {
        billing.discount(CurrentUser.manager(), id, body.amount(), body.reason());
        return Resp.message("Desconto aplicado.");
    }

    @PostMapping("/api/invoices/late-charges")
    public Map<String, Object> lateCharges() {
        int n = billing.applyLateCharges(CurrentUser.manager());
        return Resp.ok().with("updated", n).with("message", "Multas e juros atualizados em " + n + " faturas.").build();
    }
}
