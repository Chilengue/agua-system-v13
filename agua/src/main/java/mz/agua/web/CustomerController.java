package mz.agua.web;

import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import mz.agua.common.Resp;
import mz.agua.dto.Dto;
import mz.agua.security.CurrentUser;
import mz.agua.security.Roles;
import mz.agua.service.CustomerService;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

/** Clientes e contas (gestor). Pesquisa de contas e pacote offline também para o mediador. */
@RestController
@RequiredArgsConstructor
public class CustomerController {

    private final CustomerService customers;

    @GetMapping("/api/customers")
    public Map<String, Object> list(@RequestParam(required = false) String q, @RequestParam(required = false) String status,
                                    @RequestParam(required = false) String debt, @RequestParam(required = false) String neighborhood,
                                    @RequestParam(required = false) String sort,
                                    @RequestParam(required = false) Integer page, @RequestParam(required = false) Integer size) {
        return customers.list(CurrentUser.manager(), q, status, debt, neighborhood, sort, page, size);
    }

    @GetMapping("/api/customers/neighborhoods")
    public Map<String, Object> neighborhoods() {
        return Resp.ok("items", customers.neighborhoods(CurrentUser.manager()));
    }

    /** Verificação de duplicados enquanto o gestor preenche o formulário. */
    @GetMapping("/api/customers/check")
    public Map<String, Object> check(@RequestParam(required = false) String phone, @RequestParam(required = false) String document,
                                     @RequestParam(required = false) String nuit, @RequestParam(required = false) Long exceptId) {
        return Resp.ok("items", customers.check(CurrentUser.manager(), phone, document, nuit, exceptId));
    }

    @GetMapping("/api/customers/{id}")
    public Map<String, Object> detail(@PathVariable Long id) {
        return Resp.ok("customer", customers.detail(CurrentUser.manager(), id));
    }

    @PostMapping("/api/customers")
    public Map<String, Object> create(@Valid @RequestBody Dto.Customer body) {
        return Resp.ok().withAll(customers.create(CurrentUser.manager(), body)).build();
    }

    @PutMapping("/api/customers/{id}")
    public Map<String, Object> update(@PathVariable Long id, @Valid @RequestBody Dto.Customer body) {
        customers.update(CurrentUser.manager(), id, body);
        return Resp.message("Cliente atualizado.");
    }

    @DeleteMapping("/api/customers/{id}")
    public Map<String, Object> delete(@PathVariable Long id) {
        return Resp.message(customers.delete(CurrentUser.manager(), id));
    }

    @PostMapping("/api/customers/{id}/reset-access")
    public Map<String, Object> resetAccess(@PathVariable Long id) {
        return Resp.ok().withAll(customers.resetAccess(CurrentUser.manager(), id)).build();
    }

    // ---------------- Contas ----------------
    @PostMapping("/api/customers/{id}/accounts")
    public Map<String, Object> addAccount(@PathVariable Long id, @Valid @RequestBody Dto.Account body) {
        return Resp.ok().withAll(customers.addAccount(CurrentUser.manager(), id, body)).build();
    }

    @PutMapping("/api/accounts/{id}")
    public Map<String, Object> updateAccount(@PathVariable Long id, @Valid @RequestBody Dto.Account body) {
        customers.updateAccount(CurrentUser.manager(), id, body);
        return Resp.message("Conta atualizada.");
    }

    @PostMapping("/api/accounts/{id}/status/{status}")
    public Map<String, Object> accountStatus(@PathVariable Long id, @PathVariable String status) {
        customers.setAccountStatus(CurrentUser.manager(), id, status);
        return Resp.message("Estado da conta atualizado.");
    }

    @PostMapping("/api/accounts/{id}/meter")
    public Map<String, Object> replaceMeter(@PathVariable Long id, @Valid @RequestBody Dto.MeterReplace body) {
        customers.replaceMeter(CurrentUser.manager(), id, body);
        return Resp.message("Contador substituído.");
    }

    @GetMapping("/api/accounts/{id}/meters")
    public Map<String, Object> meters(@PathVariable Long id) {
        return Resp.ok("items", customers.meterHistory(CurrentUser.manager(), id));
    }

    /** Pesquisa por nome, código, telefone, nº de conta, nº de contador ou nº de fatura. */
    @GetMapping("/api/accounts/search")
    public Map<String, Object> search(@RequestParam(required = false) String q, @RequestParam(defaultValue = "20") int limit) {
        Long cid = CurrentUser.companyOf(Roles.MANAGER, Roles.READER);
        return Resp.ok("items", customers.searchAccounts(cid, q, limit));
    }

    /** Contas ativas para o mediador guardar no telemóvel e trabalhar sem internet. */
    @GetMapping("/api/reader/bundle")
    public Map<String, Object> bundle() {
        Long cid = CurrentUser.companyOf(Roles.MANAGER, Roles.READER);
        return Resp.ok().withAll(customers.readerBundle(cid)).build();
    }
}
