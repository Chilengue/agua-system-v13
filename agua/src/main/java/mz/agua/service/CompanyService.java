package mz.agua.service;

import lombok.RequiredArgsConstructor;
import mz.agua.common.ApiException;
import mz.agua.common.Codes;
import mz.agua.common.Text;
import mz.agua.config.AppProperties;
import mz.agua.domain.Company;
import mz.agua.domain.CompanySetting;
import mz.agua.domain.User;
import mz.agua.dto.Dto;
import mz.agua.repository.CompanyRepository;
import mz.agua.repository.CompanySettingRepository;
import mz.agua.repository.UserRepository;
import mz.agua.security.Plans;
import mz.agua.security.Roles;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.LinkedHashMap;
import java.util.Map;

/**
 * Empresas (provedores de água). Cada empresa recebe o código AGUA-XXXX-XXXX, que é também o
 * login do gestor. Registo pelo login → fica "pendente" até o administrador aprovar.
 */
@Service
@RequiredArgsConstructor
public class CompanyService {

    private final CompanyRepository companies;
    private final CompanySettingRepository settings;
    private final UserRepository users;
    private final UserFactory userFactory;
    private final AuditService audit;
    private final AppProperties props;

    /** Registo público (botão "Registar empresa" no login). */
    @Transactional
    public Map<String, Object> register(Dto.Company d) {
        String status = props.autoApproveCompanies() ? "active" : "pending";
        Map<String, Object> out = create(d, status, true);
        audit.logAs((Long) out.get("company_id"), null, (String) out.get("username"), "COMPANY_SELF_REGISTER",
                "companies/" + out.get("company_id"), (String) out.get("name"));
        return out;
    }

    /** Criada pelo administrador: fica logo ativa. */
    @Transactional
    public Map<String, Object> createByAdmin(Dto.Company d) {
        Map<String, Object> out = create(d, "active", false);
        audit.log("COMPANY_CREATE", "companies/" + out.get("company_id"), (String) out.get("name"));
        return out;
    }

    private Map<String, Object> create(Dto.Company d, String status, boolean self) {
        String managerEmail = userFactory.checkEmail(d.managerEmail(), null);
        if (managerEmail == null) throw ApiException.badRequest("Indique o email do gestor.");
        String code;
        int tries = 0;
        do {
            code = Codes.companyCode();
            if (++tries > 20) throw new IllegalStateException("Não foi possível gerar um código de empresa.");
        } while (companies.existsByCode(code) || users.findByUsernameIgnoreCase(code).isPresent());

        Company c = new Company();
        c.setCode(code);
        c.setName(Text.clean(d.name()));
        c.setNuit(Text.clean(d.nuit()));
        c.setPhone(Text.clean(d.phone()));
        c.setEmail(Text.email(d.email()));
        c.setAddress(Text.clean(d.address()));
        c.setCity(Text.clean(d.city()));
        c.setProvince(Text.clean(d.province()));
        c.setSlogan(Text.clean(d.slogan()));
        c.setStatus(status);
        c.setSelfRegistered(self);
        // registo pelo login → sempre Básico; o administrador pode escolher o plano ao criar
        c.setPlan(!self && d.plan() != null && Plans.valid(d.plan()) ? d.plan() : Plans.BASIC);
        c.setPlanChangedAt(LocalDateTime.now());
        if ("active".equals(status)) c.setApprovedAt(LocalDateTime.now());
        c = companies.saveAndFlush(c);

        settings.saveAndFlush(defaultSettings(c.getId()));
        UserFactory.Created m = userFactory.create(c.getId(), null, Roles.MANAGER, Text.clean(d.managerName()), code,
                managerEmail, d.managerPhone());

        Map<String, Object> out = new LinkedHashMap<>();
        out.put("company_id", c.getId());
        out.put("code", code);
        out.put("name", c.getName());
        out.put("status", status);
        out.put("plan", c.getPlan());
        out.put("username", code);
        out.put("manager_name", m.user().getName());
        out.put("manager_email", managerEmail);
        out.put("temp_password", m.tempPassword());
        out.put("support_phone", props.supportPhone());
        out.put("support_name", props.supportName());
        return out;
    }

    /** Valores iniciais: tarifa com consumo mínimo (até 5 m³ = 350; acima, 70 por m³). O gestor ajusta. */
    static CompanySetting defaultSettings(Long companyId) {
        CompanySetting s = new CompanySetting();
        s.setCompanyId(companyId);
        s.setTariffMode("minimum");
        s.setMinimumM3(5);
        s.setMinimumCharge(new BigDecimal("350.00"));
        s.setPricePerM3(new BigDecimal("70.00"));
        s.setReceiptFooter("Obrigado pela preferência.");
        s.setReceiptNotes("Conserve este recibo. Poupe água!");
        return s;
    }

    @Transactional
    public void setStatus(Long id, String status, String reason) {
        Company c = companies.findById(id).orElseThrow(() -> ApiException.notFound("Empresa não encontrada."));
        if (!status.matches("active|suspended|rejected")) throw ApiException.badRequest("Estado inválido.");
        if ("active".equals(status) && c.getApprovedAt() == null) c.setApprovedAt(LocalDateTime.now());
        c.setStatus(status);
        if (reason != null && !reason.isBlank()) c.setNotes(reason.trim());
        companies.save(c);
        audit.log("COMPANY_" + status.toUpperCase(), "companies/" + id, reason);
    }

    /** Administrador muda o plano (Básico, Standard, Enterprise). Descer de plano desliga logo WhatsApp/SMS. */
    @Transactional
    public void setPlan(Long id, String plan, String reason) {
        if (!Plans.valid(plan)) throw ApiException.badRequest("Plano inválido.");
        Company c = companies.findById(id).orElseThrow(() -> ApiException.notFound("Empresa não encontrada."));
        String old = c.getPlan();
        if (plan.equals(old)) return;
        c.setPlan(plan);
        c.setPlanChangedAt(LocalDateTime.now());
        companies.save(c);
        CompanySetting s = settings.findByCompanyId(id).orElse(null);
        if (s != null) {
            if (!Plans.whatsapp(plan)) {            // Básico: desliga os envios automáticos
                s.setMsgOnInvoice(false);
                s.setMsgOnPayment(false);
            }
            if (!Plans.sms(plan) && !"whatsapp".equals(s.getMsgChannel())) s.setMsgChannel("whatsapp");
            settings.save(s);
        }
        audit.log("COMPANY_PLAN", "companies/" + id, Plans.label(old) + " → " + Plans.label(plan)
                + (reason == null || reason.isBlank() ? "" : ": " + reason.trim()));
    }

    @Transactional
    public void update(Long id, Dto.CompanyProfile d) {
        Company c = companies.findById(id).orElseThrow(() -> ApiException.notFound("Empresa não encontrada."));
        applyProfile(c, d);
        companies.save(c);
        audit.log("COMPANY_UPDATE", "companies/" + id, null);
    }

    static void applyProfile(Company c, Dto.CompanyProfile d) {
        c.setName(Text.clean(d.name()));
        c.setNuit(Text.clean(d.nuit()));
        c.setPhone(Text.clean(d.phone()));
        c.setEmail(Text.email(d.email()));
        c.setAddress(Text.clean(d.address()));
        c.setCity(Text.clean(d.city()));
        c.setProvince(Text.clean(d.province()));
        c.setSlogan(Text.clean(d.slogan()));
    }

    /** Nova senha temporária para o gestor principal. */
    @Transactional
    public Map<String, Object> resetManager(Long id) {
        Company c = companies.findById(id).orElseThrow(() -> ApiException.notFound("Empresa não encontrada."));
        User m = users.findFirstByCompanyIdAndRoleOrderByIdAsc(id, Roles.MANAGER)
                .orElseThrow(() -> ApiException.notFound("Gestor não encontrado."));
        String temp = userFactory.resetPassword(m);
        audit.log("MANAGER_PASSWORD_RESET", "companies/" + id, null);
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("username", m.getUsername());
        out.put("name", m.getName());
        out.put("company", c.getName());
        out.put("temp_password", temp);
        return out;
    }
}
