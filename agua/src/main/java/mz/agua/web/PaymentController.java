package mz.agua.web;

import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import mz.agua.common.Resp;
import mz.agua.dto.Dto;
import mz.agua.security.CurrentUser;
import mz.agua.service.PaymentService;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.Map;

/** Caixa e pagamentos (gestor): dívida do cliente, pagar (total ou parcial), validar, anular, recibo. */
@RestController
@RequiredArgsConstructor
public class PaymentController {

    private final PaymentService payments;

    @GetMapping("/api/payments")
    public Map<String, Object> list(@RequestParam(required = false) String q, @RequestParam(required = false) String status,
                                    @RequestParam(required = false) String method, @RequestParam(required = false) Long customerId,
                                    @RequestParam(required = false) String from, @RequestParam(required = false) String to,
                                    @RequestParam(required = false) Integer page, @RequestParam(required = false) Integer size) {
        return payments.list(CurrentUser.manager(), q, status, method, customerId, from, to, page, size);
    }

    @GetMapping("/api/customers/{id}/open-invoices")
    public Map<String, Object> openInvoices(@PathVariable Long id, @RequestParam(required = false) Long accountId) {
        return Resp.ok().withAll(payments.openInvoices(CurrentUser.manager(), id, accountId)).build();
    }

    @PostMapping("/api/payments")
    public Map<String, Object> pay(@Valid @RequestBody Dto.Payment body) {
        return Resp.ok("payment", payments.pay(CurrentUser.manager(), body, false));
    }

    /** Pagamentos registados na caixa sem internet. */
    @PostMapping("/api/payments/sync")
    public Map<String, Object> sync(@Valid @RequestBody Dto.PaymentBatch body) {
        List<Map<String, Object>> results = payments.sync(CurrentUser.manager(), body.items());
        long ok = results.stream().filter(r -> Boolean.TRUE.equals(r.get("ok"))).count();
        return Resp.ok().with("results", results).with("accepted", ok).with("rejected", results.size() - ok).build();
    }

    @GetMapping("/api/payments/{id}")
    public Map<String, Object> detail(@PathVariable Long id) {
        return Resp.ok("payment", payments.detail(CurrentUser.manager(), id));
    }

    @GetMapping("/api/payments/{id}/receipt")
    public Map<String, Object> receipt(@PathVariable Long id) {
        return Resp.ok("receipt", payments.receipt(CurrentUser.manager(), id));
    }

    @PostMapping("/api/payments/{id}/validate")
    public Map<String, Object> validate(@PathVariable Long id) {
        payments.validate(CurrentUser.manager(), id);
        return Resp.message("Pagamento validado.");
    }

    /** "Apagar" pagamento: anula com motivo e devolve o saldo às faturas. */
    @PostMapping("/api/payments/{id}/void")
    public Map<String, Object> voidPayment(@PathVariable Long id, @Valid @RequestBody Dto.Reason body) {
        payments.voidPayment(CurrentUser.manager(), id, body.reason());
        return Resp.message("Pagamento anulado. O valor voltou a ficar em dívida nas faturas.");
    }
}
