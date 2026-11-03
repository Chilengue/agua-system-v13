package mz.agua.service;

import lombok.RequiredArgsConstructor;
import mz.agua.common.ApiException;
import mz.agua.common.Db;
import mz.agua.common.Periods;
import mz.agua.common.Q;
import mz.agua.common.Text;
import mz.agua.domain.Account;
import mz.agua.domain.Company;
import mz.agua.domain.Customer;
import mz.agua.domain.Meter;
import mz.agua.domain.Reading;
import mz.agua.domain.User;
import mz.agua.dto.Dto;
import mz.agua.repository.AccountRepository;
import mz.agua.repository.CompanyRepository;
import mz.agua.repository.CustomerRepository;
import mz.agua.repository.InvoiceRepository;
import mz.agua.repository.MeterRepository;
import mz.agua.repository.PaymentRepository;
import mz.agua.repository.ReadingRepository;
import mz.agua.repository.UserRepository;
import mz.agua.security.Roles;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;

/**
 * Clientes e contas (contratos). Regras:
 * - o mesmo cliente não pode ser registado duas vezes na mesma empresa (documento, NUIT ou telefone);
 * - um cliente pode ter várias contas, cada uma com o seu contador e as suas faturas;
 * - ao registar, o acesso ao portal é criado automaticamente (login = código do cliente).
 */
@Service
@RequiredArgsConstructor
public class CustomerService {

    private final CustomerRepository customers;
    private final AccountRepository accounts;
    private final MeterRepository meters;
    private final ReadingRepository readings;
    private final InvoiceRepository invoices;
    private final PaymentRepository payments;
    private final CompanyRepository companies;
    private final UserRepository users;
    private final UserFactory userFactory;
    private final SequenceService seq;
    private final AuditService audit;
    private final Db db;
    private final SettingsService settings;

    // ---------------- Consultas ----------------
    public Map<String, Object> list(Long cid, String q, String status, String debt, String neighborhood, String sort,
                                    Integer page, Integer size) {
        Q p = Q.company(cid).search(q).str("status", status).str("debt", debt)
                .str("neighborhood", Text.lower(neighborhood)).str("sort", sort).paging(page, size);
        Map<String, Object> out = db.page("customers.list", p);
        out.put("stats", db.one("customers.stats", Q.company(cid).map()));
        return out;
    }

    public Map<String, Object> detail(Long cid, Long id) {
        Q p = Q.company(cid).id("id", id);
        Map<String, Object> c = db.require("customers.detail", p.map(), "Cliente não encontrado.");
        c.put("accounts", db.list("customers.accounts", p.map()));
        return c;
    }

    public List<Map<String, Object>> neighborhoods(Long cid) {
        return db.list("customers.neighborhoods", Q.company(cid).map());
    }

    /** Aviso imediato no formulário: telefone, documento ou NUIT já usados por outro cliente. */
    public List<Map<String, Object>> check(Long cid, String phone, String document, String nuit, Long exceptId) {
        String pk = Text.phoneKey(phone);
        return db.list("customers.check", Q.company(cid)
                .str("phone", pk == null || pk.length() < 6 ? "" : pk)
                .str("doc", Text.clean(document) == null ? "" : Text.clean(document).toLowerCase())
                .str("nuit", Text.clean(nuit) == null ? "" : Text.clean(nuit).toLowerCase())
                .id("exceptId", exceptId).map());
    }

    public List<Map<String, Object>> searchAccounts(Long cid, String q, int limit) {
        return db.list("accounts.search", Q.company(cid).search(q).limit(Math.min(Math.max(limit, 1), 100)).map());
    }

    public Map<String, Object> readerBundle(Long cid) {
        String period = Periods.current();
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("period", period);
        out.put("accounts", db.list("reader.bundle", Q.company(cid).period(period).map()));
        out.put("tariff", settings.tariff(cid));     // para calcular o valor a pagar no telemóvel, sem internet
        out.put("generated_at", java.time.LocalDateTime.now().toString());
        return out;
    }

    // ---------------- Registo ----------------
    @Transactional
    public Map<String, Object> create(Long cid, Dto.Customer d) {
        String uuid = Text.clean(d.clientUuid());
        if (uuid != null) {
            Customer existing = customers.findByClientUuid(uuid).orElse(null);
            if (existing != null) {
                if (!Objects.equals(existing.getCompanyId(), cid)) throw ApiException.conflict("Identificador repetido.");
                Map<String, Object> out = new LinkedHashMap<>();
                out.put("id", existing.getId());
                out.put("code", existing.getCode());
                out.put("name", existing.getName());
                out.put("duplicate", true);
                return out;
            }
        }
        Company company = companies.findById(cid).orElseThrow(() -> ApiException.notFound("Empresa não encontrada."));
        Customer c = new Customer();
        c.setCompanyId(cid);
        apply(c, d);
        checkDuplicate(cid, c, 0L);
        String email = userFactory.checkEmail(c.getEmail(), null);
        c.setEmail(email);
        c.setCode(seq.customerCode(cid, company.getCode()));
        c.setStatus("active");
        c.setClientUuid(uuid);
        c = customers.saveAndFlush(c);

        Dto.Account a = d.account() == null
                ? new Dto.Account(null, "residential", null, null, null, null, null, null, null, null, null, 0, null) : d.account();
        Account account = createAccount(company, c, a);

        UserFactory.Created login = userFactory.create(cid, c.getId(), Roles.CUSTOMER, c.getName(), c.getCode(),
                email, c.getPhone());
        audit.log("CUSTOMER_CREATE", "customers/" + c.getId(), c.getCode() + " " + c.getName());

        Map<String, Object> out = new LinkedHashMap<>();
        out.put("id", c.getId());
        out.put("code", c.getCode());
        out.put("name", c.getName());
        out.put("account_id", account.getId());
        out.put("account_number", account.getNumber());
        out.put("username", login.user().getUsername());
        out.put("temp_password", login.tempPassword());
        return out;
    }

    @Transactional
    public void update(Long cid, Long id, Dto.Customer d) {
        Customer c = customer(cid, id);
        apply(c, d);
        checkDuplicate(cid, c, c.getId());
        User u = users.findFirstByCustomerId(c.getId()).orElse(null);
        c.setEmail(userFactory.checkEmail(c.getEmail(), u == null ? null : u.getId()));
        if (d.status() != null && !d.status().isBlank()) c.setStatus(d.status());
        customers.save(c);
        if (u != null) {
            u.setName(c.getName());
            u.setEmail(c.getEmail());
            u.setPhone(c.getPhone());
            users.save(u);
        }
        audit.log("CUSTOMER_UPDATE", "customers/" + id, null);
    }

    private void apply(Customer c, Dto.Customer d) {
        String name = Text.clean(d.name());
        if (name == null || name.length() < 3) throw ApiException.badRequest("Indique o nome completo do cliente.");
        c.setName(name);
        c.setNameKey(Text.key(name));
        c.setDocumentType(Text.blank(d.documentType()) ? "bi" : d.documentType());
        c.setDocument(Text.clean(d.document()) == null ? null : Text.clean(d.document()).toUpperCase());
        c.setNuit(Text.clean(d.nuit()));
        c.setGender(Text.blank(d.gender()) ? null : d.gender());
        c.setBirthDate(parseDate(d.birthDate(), "Data de nascimento inválida."));
        if (c.getBirthDate() != null && c.getBirthDate().isAfter(LocalDate.now())) {
            throw ApiException.badRequest("A data de nascimento não pode ser no futuro.");
        }
        c.setOccupation(Text.clean(d.occupation()));
        c.setPhone(Text.clean(d.phone()));
        c.setPhoneKey(Text.phoneKey(d.phone()));
        if (c.getPhoneKey() == null || c.getPhoneKey().length() < 6) throw ApiException.badRequest("Indique um telefone válido.");
        c.setPhone2(Text.clean(d.phone2()));
        c.setEmail(Text.email(d.email()));
        c.setAddress(Text.clean(d.address()));
        c.setNeighborhood(Text.clean(d.neighborhood()));
        c.setBlock(Text.clean(d.block()));
        c.setHouseNumber(Text.clean(d.houseNumber()));
        c.setDistrict(Text.clean(d.district()));
        c.setCity(Text.clean(d.city()));
        c.setNotes(Text.clean(d.notes()));
    }

    /** Recusa clientes repetidos com uma mensagem clara (antes de chegar aos índices únicos). */
    private void checkDuplicate(Long cid, Customer c, Long exceptId) {
        Map<String, Object> dup = db.one("customers.duplicate", Q.company(cid)
                .str("doc", c.getDocument() == null ? "" : c.getDocument().toLowerCase())
                .str("docType", c.getDocumentType())
                .str("phone", c.getPhoneKey())
                .str("nuit", c.getNuit() == null ? "" : c.getNuit().toLowerCase())
                .id("exceptId", exceptId).map());
        if (dup != null) {
            String why = switch (String.valueOf(dup.get("reason"))) {
                case "document" -> "o mesmo documento";
                case "phone" -> "o mesmo telefone";
                default -> "o mesmo NUIT";
            };
            throw ApiException.conflict("Este cliente já está registado: " + dup.get("name") + " (" + dup.get("code")
                    + ") tem " + why + ". Para outra casa/contrato, adicione uma nova conta a esse cliente.");
        }
    }

    // ---------------- Contas ----------------
    @Transactional
    public Map<String, Object> addAccount(Long cid, Long customerId, Dto.Account d) {
        Company company = companies.findById(cid).orElseThrow(() -> ApiException.notFound("Empresa não encontrada."));
        Customer c = customer(cid, customerId);
        Account a = createAccount(company, c, d);
        audit.log("ACCOUNT_CREATE", "accounts/" + a.getId(), a.getNumber());
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("id", a.getId());
        out.put("number", a.getNumber());
        return out;
    }

    private Account createAccount(Company company, Customer c, Dto.Account d) {
        Account a = new Account();
        a.setCompanyId(company.getId());
        a.setCustomerId(c.getId());
        String number = Text.clean(d.number());
        a.setNumber(number == null ? seq.accountNumber(company.getId(), company.getCode()) : number.toUpperCase());
        applyAccount(a, d, c);
        a.setStatus("active");
        a = accounts.saveAndFlush(a);

        Meter m = new Meter();
        m.setCompanyId(company.getId());
        m.setAccountId(a.getId());
        String meterNumber = Text.clean(d.meterNumber());
        m.setNumber(meterNumber == null ? a.getNumber() : meterNumber.toUpperCase());
        m.setInitialReading(d.initialReading() == null ? 0 : d.initialReading());
        m.setInstalledAt(a.getOpenedAt() == null ? LocalDate.now() : a.getOpenedAt());
        m.setStatus("active");
        meters.saveAndFlush(m);
        return a;
    }

    @Transactional
    public void updateAccount(Long cid, Long accountId, Dto.Account d) {
        Account a = account(cid, accountId);
        Customer c = customer(cid, a.getCustomerId());
        String number = Text.clean(d.number());
        if (number != null) a.setNumber(number.toUpperCase());
        applyAccount(a, d, c);
        accounts.save(a);
        audit.log("ACCOUNT_UPDATE", "accounts/" + accountId, null);
    }

    private void applyAccount(Account a, Dto.Account d, Customer c) {
        a.setCategory(Text.blank(d.category()) ? "residential" : d.category());
        String address = Text.clean(d.address());
        a.setAddress(address == null ? c.getAddress() : address);
        String nb = Text.clean(d.neighborhood());
        a.setNeighborhood(nb == null ? c.getNeighborhood() : nb);
        a.setBlock(Text.clean(d.block()) == null ? c.getBlock() : Text.clean(d.block()));
        a.setHouseNumber(Text.clean(d.houseNumber()) == null ? c.getHouseNumber() : Text.clean(d.houseNumber()));
        a.setLandmark(Text.clean(d.landmark()));
        a.setLatitude(Text.clean(d.latitude()));
        a.setLongitude(Text.clean(d.longitude()));
        LocalDate opened = parseDate(d.openedAt(), "Data de ligação inválida.");
        a.setOpenedAt(opened == null ? (a.getOpenedAt() == null ? LocalDate.now() : a.getOpenedAt()) : opened);
        a.setNotes(Text.clean(d.notes()));
    }

    @Transactional
    public void setAccountStatus(Long cid, Long accountId, String status) {
        if (!"active".equals(status) && !"suspended".equals(status) && !"closed".equals(status)) {
            throw ApiException.badRequest("Estado inválido.");
        }
        Account a = account(cid, accountId);
        a.setStatus(status);
        accounts.save(a);
        audit.log("ACCOUNT_" + status.toUpperCase(), "accounts/" + accountId, null);
    }

    /** Troca de contador: o antigo fica no histórico; as próximas leituras partem da leitura inicial do novo. */
    @Transactional
    public void replaceMeter(Long cid, Long accountId, Dto.MeterReplace d) {
        Account a = account(cid, accountId);
        meters.findFirstByAccountIdAndStatus(a.getId(), "active").ifPresent(old -> {
            old.setStatus("replaced");
            old.setRemovedAt(LocalDate.now());
            meters.saveAndFlush(old);
        });
        Meter m = new Meter();
        m.setCompanyId(cid);
        m.setAccountId(a.getId());
        m.setNumber(d.number().trim().toUpperCase());
        m.setInitialReading(d.initialReading());
        m.setInstalledAt(LocalDate.now());
        m.setStatus("active");
        meters.saveAndFlush(m);
        audit.log("METER_REPLACE", "accounts/" + accountId, d.number());
    }

    public List<Map<String, Object>> meterHistory(Long cid, Long accountId) {
        account(cid, accountId);
        return db.list("meters.history", Q.company(cid).id("accountId", accountId).map());
    }

    // ---------------- Acesso e remoção ----------------
    @Transactional
    public Map<String, Object> resetAccess(Long cid, Long id) {
        Customer c = customer(cid, id);
        User u = users.findFirstByCustomerId(c.getId()).orElse(null);
        Map<String, Object> out = new LinkedHashMap<>();
        if (u == null) {
            UserFactory.Created created = userFactory.create(cid, c.getId(), Roles.CUSTOMER, c.getName(), c.getCode(),
                    c.getEmail(), c.getPhone());
            out.put("username", created.user().getUsername());
            out.put("temp_password", created.tempPassword());
        } else {
            u.setStatus("active");
            out.put("username", u.getUsername());
            out.put("temp_password", userFactory.resetPassword(u));
        }
        out.put("name", c.getName());
        audit.log("CUSTOMER_ACCESS_RESET", "customers/" + id, null);
        return out;
    }

    /**
     * Apaga só clientes que nunca tiveram operações (leituras, faturas, pagamentos ou mensagens).
     * Um cliente com operações NUNCA é apagado: fica inativo, o acesso ao portal é bloqueado e
     * todo o histórico se mantém (as chaves estrangeiras da base de dados também o impedem).
     */
    @Transactional
    public String delete(Long cid, Long id) {
        Customer c = customer(cid, id);
        Long ops = db.longValue("SELECT (SELECT COUNT(*) FROM readings WHERE id_customer_reading = :id)"
                + " + (SELECT COUNT(*) FROM invoices WHERE id_customer_invoice = :id)"
                + " + (SELECT COUNT(*) FROM payments WHERE id_customer_payment = :id)"
                + " + (SELECT COUNT(*) FROM messages WHERE id_customer_message = :id)", Map.of("id", id));
        if (ops != null && ops > 0) {
            c.setStatus("inactive");
            customers.save(c);
            users.findFirstByCustomerId(id).ifPresent(u -> {
                u.setStatus("blocked");
                users.save(u);
            });
            for (Account a : accounts.findByCustomerIdOrderByIdAsc(id)) {
                if ("active".equals(a.getStatus())) {
                    a.setStatus("suspended");
                    accounts.save(a);
                }
            }
            audit.log("CUSTOMER_DEACTIVATE", "customers/" + id, c.getCode() + " " + c.getName());
            return "O cliente já teve operações (leituras, faturas ou pagamentos): não pode ser apagado. "
                    + "Foi desativado, as contas suspensas e o acesso ao portal bloqueado — todo o histórico mantém-se.";
        }
        users.findFirstByCustomerId(id).ifPresent(u -> {
            db.update("DELETE FROM password_resets WHERE id_user_password_reset = :id", Map.of("id", u.getId()));
            users.delete(u);
        });
        for (Account a : accounts.findByCustomerIdOrderByIdAsc(id)) {
            meters.deleteAll(meters.findByAccountId(a.getId()));
            accounts.delete(a);
        }
        customers.delete(c);
        audit.log("CUSTOMER_DELETE", "customers/" + id, c.getCode() + " " + c.getName());
        return "Cliente apagado.";
    }

    // ---------------- Auxiliares ----------------
    public Customer customer(Long cid, Long id) {
        Customer c = customers.findById(id).orElseThrow(() -> ApiException.notFound("Cliente não encontrado."));
        if (!Objects.equals(c.getCompanyId(), cid)) throw ApiException.notFound("Cliente não encontrado.");
        return c;
    }

    public Account account(Long cid, Long id) {
        Account a = accounts.findById(id).orElseThrow(() -> ApiException.notFound("Conta não encontrada."));
        if (!Objects.equals(a.getCompanyId(), cid)) throw ApiException.notFound("Conta não encontrada.");
        return a;
    }

    static LocalDate parseDate(String v, String error) {
        if (v == null || v.isBlank()) return null;
        try {
            return LocalDate.parse(v.trim().substring(0, Math.min(10, v.trim().length())));
        } catch (Exception e) {
            throw ApiException.badRequest(error);
        }
    }
}
