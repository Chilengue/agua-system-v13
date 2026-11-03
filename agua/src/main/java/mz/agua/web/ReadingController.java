package mz.agua.web;

import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import mz.agua.common.Resp;
import mz.agua.dto.Dto;
import mz.agua.security.CurrentUser;
import mz.agua.security.Roles;
import mz.agua.security.SessionUser;
import mz.agua.service.BillingService;
import mz.agua.service.ReadingService;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.Map;

/** Leituras: lista (gestor; o mediador vê só as suas), registo, envio offline, correção e anulação. */
@RestController
@RequiredArgsConstructor
public class ReadingController {

    private final ReadingService readings;
    private final BillingService billing;

    @GetMapping("/api/readings")
    public Map<String, Object> list(@RequestParam(required = false) String q, @RequestParam(required = false) String period,
                                    @RequestParam(required = false) String status, @RequestParam(required = false) Long readerId,
                                    @RequestParam(required = false) Long accountId,
                                    @RequestParam(required = false) Integer page, @RequestParam(required = false) Integer size) {
        SessionUser u = CurrentUser.require(Roles.MANAGER, Roles.READER);
        Long reader = u.is(Roles.READER) ? u.id() : readerId;
        return readings.list(u.companyId(), q, period, status, reader, accountId, page, size);
    }

    @PostMapping("/api/readings")
    public Map<String, Object> create(@Valid @RequestBody Dto.Reading body) {
        SessionUser u = CurrentUser.require(Roles.MANAGER, Roles.READER);
        Dto.Reading d = u.is(Roles.READER) && Boolean.TRUE.equals(body.bill())
                ? new Dto.Reading(body.accountId(), body.currentValue(), body.period(), body.readAt(), body.notes(), body.clientUuid(), false)
                : body;
        return Resp.ok("reading", readings.record(u.companyId(), d, u.is(Roles.MANAGER) ? "manual" : "online"));
    }

    @PostMapping("/api/readings/sync")
    public Map<String, Object> sync(@Valid @RequestBody Dto.SyncBatch body) {
        Long cid = CurrentUser.companyOf(Roles.MANAGER, Roles.READER);
        List<Map<String, Object>> results = readings.sync(cid, body.items());
        long ok = results.stream().filter(r -> Boolean.TRUE.equals(r.get("ok"))).count();
        return Resp.ok().with("results", results).with("accepted", ok).with("rejected", results.size() - ok).build();
    }

    @PutMapping("/api/readings/{id}")
    public Map<String, Object> edit(@PathVariable Long id, @Valid @RequestBody Dto.ReadingEdit body) {
        readings.edit(CurrentUser.manager(), id, body);
        return Resp.message("Leitura corrigida.");
    }

    @PostMapping("/api/readings/{id}/cancel")
    public Map<String, Object> cancel(@PathVariable Long id, @Valid @RequestBody Dto.Reason body) {
        readings.cancel(CurrentUser.manager(), id, body.reason());
        return Resp.message("Leitura anulada.");
    }

    @PostMapping("/api/readings/{id}/bill")
    public Map<String, Object> bill(@PathVariable Long id) {
        var i = billing.billReading(CurrentUser.manager(), id);
        return Resp.ok().with("invoice_id", i.getId()).with("invoice_number", i.getNumber()).with("total", i.getTotal()).build();
    }

    @PostMapping("/api/readings/bill-period")
    public Map<String, Object> billPeriod(@RequestParam(required = false) String period) {
        return Resp.ok().withAll(billing.billPeriod(CurrentUser.manager(), period)).build();
    }
}
