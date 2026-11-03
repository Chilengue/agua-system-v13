package mz.agua.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import mz.agua.common.ApiException;
import mz.agua.common.Text;
import mz.agua.domain.Company;
import mz.agua.domain.CompanySetting;
import mz.agua.domain.TariffTier;
import mz.agua.dto.Dto;
import mz.agua.repository.CompanyRepository;
import mz.agua.repository.CompanySettingRepository;
import mz.agua.repository.TariffTierRepository;
import mz.agua.security.Plans;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/** Configurações de cada empresa: perfil e logótipo, faturação, tarifa, multas/juros e recibo. */
@Service
@RequiredArgsConstructor
public class SettingsService {

    private static final int MAX_LOGO = 700_000; // ~500 KB em base64

    private final CompanyRepository companies;
    private final CompanySettingRepository settingsRepo;
    private final TariffTierRepository tiers;
    private final PricingService pricing;
    private final AuditService audit;
    private final ObjectMapper mapper;
    private final MessageGateway gateway;

    @Transactional(readOnly = true)
    public Map<String, Object> all(Long cid) {
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("company", companyView(company(cid), true));
        out.put("settings", mapper.convertValue(pricing.settings(cid), Map.class));
        out.put("tiers", tierViews(cid));
        out.put("messaging", messagingView(cid));
        return out;
    }

    /** Estado das mensagens: plano, tokens guardados (sem os mostrar), modelos por omissão. */
    public Map<String, Object> messagingView(Long cid) {
        CompanySetting s = pricing.settings(cid);
        Company c = company(cid);
        Map<String, Object> m = new LinkedHashMap<>(Plans.features(c.getPlan()));
        m.put("whatsapp_token_set", !Text.blank(s.getWhatsappToken()));
        m.put("sms_token_set", !Text.blank(s.getSmsApiToken()));
        m.put("whatsapp_api_ready", gateway.apiReady(s, "whatsapp"));
        m.put("sms_api_ready", gateway.apiReady(s, "sms"));
        m.put("default_invoice_template", MessageService.DEFAULT_INVOICE);
        m.put("default_payment_template", MessageService.DEFAULT_PAYMENT);
        m.put("default_reminder_template", MessageService.DEFAULT_REMINDER);
        return m;
    }

    @Transactional
    public void updateMessaging(Long cid, Dto.Messaging d) {
        Company c = company(cid);
        if (!Plans.whatsapp(c.getPlan())) {
            throw ApiException.forbidden("O módulo de mensagens faz parte dos planos Standard e Enterprise.");
        }
        CompanySetting s = pricing.settings(cid);
        if (d.whatsappNumber() != null) s.setWhatsappNumber(Text.clean(d.whatsappNumber()));
        if (d.whatsappMode() != null) s.setWhatsappMode(d.whatsappMode());
        if (d.whatsappPhoneId() != null) s.setWhatsappPhoneId(Text.clean(d.whatsappPhoneId()));
        if (!Text.blank(d.whatsappToken())) s.setWhatsappToken(d.whatsappToken().trim());
        if (Boolean.TRUE.equals(d.clearWhatsappToken())) s.setWhatsappToken(null);
        if (Plans.sms(c.getPlan())) {
            if (d.smsNumber() != null) s.setSmsNumber(Text.clean(d.smsNumber()));
            if (d.smsMode() != null) s.setSmsMode(d.smsMode());
            if (d.smsApiUrl() != null) s.setSmsApiUrl(Text.clean(d.smsApiUrl()));
            if (!Text.blank(d.smsApiToken())) s.setSmsApiToken(d.smsApiToken().trim());
            if (Boolean.TRUE.equals(d.clearSmsApiToken())) s.setSmsApiToken(null);
        }
        if (d.msgChannel() != null) {
            if (!Plans.sms(c.getPlan()) && !"whatsapp".equals(d.msgChannel())) {
                throw ApiException.forbidden("O SMS faz parte do plano Enterprise: escolha WhatsApp.");
            }
            s.setMsgChannel(d.msgChannel());
        }
        if (d.msgOnInvoice() != null) s.setMsgOnInvoice(d.msgOnInvoice());
        if (d.msgOnPayment() != null) s.setMsgOnPayment(d.msgOnPayment());
        if (d.msgInvoiceTemplate() != null) s.setMsgInvoiceTemplate(Text.clean(d.msgInvoiceTemplate()) == null ? null : d.msgInvoiceTemplate().trim());
        if (d.msgPaymentTemplate() != null) s.setMsgPaymentTemplate(Text.clean(d.msgPaymentTemplate()) == null ? null : d.msgPaymentTemplate().trim());
        if (d.msgReminderTemplate() != null) s.setMsgReminderTemplate(Text.clean(d.msgReminderTemplate()) == null ? null : d.msgReminderTemplate().trim());
        if ("api".equals(s.getWhatsappMode()) && (Text.blank(s.getWhatsappPhoneId()) || Text.blank(s.getWhatsappToken()))) {
            throw ApiException.badRequest("Para enviar pela API do WhatsApp indique o \"Phone number ID\" e o token, ou escolha \"Abrir no WhatsApp do telemóvel\".");
        }
        if ("api".equals(s.getSmsMode()) && !gateway.apiReady(s, "sms")) {
            throw ApiException.badRequest("Para enviar SMS pela API indique o endereço do gateway (ou peça ao administrador para configurar o da plataforma).");
        }
        settingsRepo.save(s);
        audit.log("MESSAGING_UPDATE", "company_settings/" + cid, null);
    }

    /** Dados para cabeçalhos de recibos, faturas, extratos e relatórios. */
    @Transactional(readOnly = true)
    public Map<String, Object> branding(Long cid) {
        Company c = company(cid);
        CompanySetting s = pricing.settings(cid);
        Map<String, Object> out = companyView(c, true);
        out.put("settings", mapper.convertValue(s, Map.class));
        out.put("features", Plans.features(c.getPlan()));
        return out;
    }

    public static Map<String, Object> companyView(Company c, boolean withLogo) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("id", c.getId());
        m.put("code", c.getCode());
        m.put("name", c.getName());
        m.put("nuit", c.getNuit());
        m.put("phone", c.getPhone());
        m.put("email", c.getEmail());
        m.put("address", c.getAddress());
        m.put("city", c.getCity());
        m.put("province", c.getProvince());
        m.put("slogan", c.getSlogan());
        m.put("status", c.getStatus());
        m.put("plan", c.getPlan());
        m.put("plan_label", Plans.label(c.getPlan()));
        if (withLogo) m.put("logo", c.getLogo());
        return m;
    }

    @Transactional
    public Company updateProfile(Long cid, Dto.CompanyProfile d) {
        Company c = company(cid);
        CompanyService.applyProfile(c, d);
        audit.log("COMPANY_PROFILE", "companies/" + cid, null);
        return companies.save(c);
    }

    @Transactional
    public void updateLogo(Long cid, String logo) {
        Company c = company(cid);
        if (logo == null || logo.isBlank()) {
            c.setLogo(null);
        } else {
            if (!logo.matches("^data:image/(png|jpeg|jpg|webp);base64,[A-Za-z0-9+/=]+$")) {
                throw ApiException.badRequest("Logótipo inválido: use uma imagem PNG, JPG ou WEBP.");
            }
            if (logo.length() > MAX_LOGO) throw ApiException.badRequest("Logótipo demasiado grande (máximo 500 KB).");
            c.setLogo(logo);
        }
        companies.save(c);
        audit.log("COMPANY_LOGO", "companies/" + cid, null);
    }

    @Transactional
    public CompanySetting update(Long cid, Dto.Settings d) {
        CompanySetting s = pricing.settings(cid);
        if (d.currency() != null) s.setCurrency(d.currency().trim().toUpperCase());
        if (d.invoiceDueDays() != null) s.setInvoiceDueDays(d.invoiceDueDays());
        if (d.readingDay() != null) s.setReadingDay(d.readingDay());
        if (d.autoBill() != null) s.setAutoBill(d.autoBill());
        if (d.tariffMode() != null) s.setTariffMode(d.tariffMode());
        if (d.minimumM3() != null) s.setMinimumM3(d.minimumM3());
        if (d.minimumCharge() != null) s.setMinimumCharge(d.minimumCharge());
        if (d.pricePerM3() != null) s.setPricePerM3(d.pricePerM3());
        if (d.fixedFee() != null) s.setFixedFee(d.fixedFee());
        if (d.sewerPercent() != null) s.setSewerPercent(d.sewerPercent());
        if (d.fineEnabled() != null) s.setFineEnabled(d.fineEnabled());
        if (d.fineType() != null) s.setFineType(d.fineType());
        if (d.fineValue() != null) s.setFineValue(d.fineValue());
        if (d.fineGraceDays() != null) s.setFineGraceDays(d.fineGraceDays());
        if (d.interestEnabled() != null) s.setInterestEnabled(d.interestEnabled());
        if (d.interestMonthlyPercent() != null) s.setInterestMonthlyPercent(d.interestMonthlyPercent());
        if (d.requirePaymentValidation() != null) s.setRequirePaymentValidation(d.requirePaymentValidation());
        if (d.invoicePrefix() != null) s.setInvoicePrefix(d.invoicePrefix());
        if (d.receiptPrefix() != null) s.setReceiptPrefix(d.receiptPrefix());
        if (d.receiptFormat() != null) s.setReceiptFormat(d.receiptFormat());
        if (d.receiptOrientation() != null) s.setReceiptOrientation(d.receiptOrientation());
        if (d.receiptCopies() != null) s.setReceiptCopies(d.receiptCopies());
        if (d.receiptTitle() != null) s.setReceiptTitle(Text.blank(d.receiptTitle()) ? "RECIBO" : d.receiptTitle().trim());
        if (d.receiptAccent() != null) s.setReceiptAccent(d.receiptAccent());
        if (d.receiptShowLogo() != null) s.setReceiptShowLogo(d.receiptShowLogo());
        if (d.receiptShowReadings() != null) s.setReceiptShowReadings(d.receiptShowReadings());
        if (d.receiptShowDebt() != null) s.setReceiptShowDebt(d.receiptShowDebt());
        if (d.receiptShowSignature() != null) s.setReceiptShowSignature(d.receiptShowSignature());
        if (d.receiptHeader() != null) s.setReceiptHeader(Text.clean(d.receiptHeader()) == null ? null : d.receiptHeader().trim());
        if (d.receiptFooter() != null) s.setReceiptFooter(Text.clean(d.receiptFooter()) == null ? null : d.receiptFooter().trim());
        if (d.receiptNotes() != null) s.setReceiptNotes(Text.clean(d.receiptNotes()) == null ? null : d.receiptNotes().trim());
        if (d.paymentInstructions() != null) s.setPaymentInstructions(Text.clean(d.paymentInstructions()) == null ? null : d.paymentInstructions().trim());
        if (d.allowOfflineReadings() != null) s.setAllowOfflineReadings(d.allowOfflineReadings());
        if (d.consumptionAlert() != null) s.setConsumptionAlert(d.consumptionAlert());
        if ("percent".equals(s.getFineType()) && s.getFineValue().compareTo(new BigDecimal("100")) > 0) {
            throw ApiException.badRequest("A multa em percentagem não pode passar de 100%.");
        }
        s.setConfigured(true);
        audit.log("SETTINGS_UPDATE", "company_settings/" + cid, null);
        return settingsRepo.save(s);
    }

    @Transactional
    public List<Map<String, Object>> replaceTiers(Long cid, List<Dto.Tier> list) {
        List<Dto.Tier> sorted = new ArrayList<>(list);
        sorted.sort(Comparator.comparing((Dto.Tier t) -> t.category() == null ? "residential" : t.category())
                .thenComparing(Dto.Tier::fromM3));
        String cat = null;
        Integer lastTo = null;
        for (Dto.Tier t : sorted) {
            String c = t.category() == null ? "residential" : t.category();
            if (!c.equals(cat)) {
                cat = c;
                lastTo = null;
            } else if (lastTo == null) {
                throw ApiException.badRequest("Escalão sem limite \"até\" tem de ser o último da categoria.");
            } else if (t.fromM3() < lastTo) {
                throw ApiException.badRequest("Escalões sobrepostos na categoria " + c + " (a partir de " + t.fromM3() + " m³).");
            }
            if (t.toM3() != null && t.toM3() <= t.fromM3()) {
                throw ApiException.badRequest("Escalão inválido: \"até\" tem de ser maior que \"de\" (" + t.fromM3() + " m³).");
            }
            lastTo = t.toM3();
        }
        tiers.deleteAll(tiers.findByCompanyIdOrderByCategoryAscFromM3Asc(cid));
        tiers.flush();
        for (Dto.Tier t : sorted) {
            TariffTier e = new TariffTier();
            e.setCompanyId(cid);
            e.setCategory(t.category() == null ? "residential" : t.category());
            e.setFromM3(t.fromM3());
            e.setToM3(t.toM3());
            e.setPriceM3(t.priceM3());
            e.setDescription(Text.clean(t.description()));
            e.setActive(true);
            tiers.save(e);
        }
        audit.log("TARIFF_TIERS_UPDATE", "tariff_tiers", sorted.size() + " escalões");
        return tierViews(cid);
    }

    public List<Map<String, Object>> tierViews(Long cid) {
        List<Map<String, Object>> out = new ArrayList<>();
        for (TariffTier t : tiers.findByCompanyIdOrderByCategoryAscFromM3Asc(cid)) {
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("id", t.getId());
            m.put("category", t.getCategory());
            m.put("from_m3", t.getFromM3());
            m.put("to_m3", t.getToM3());
            m.put("price_m3", t.getPriceM3());
            m.put("description", t.getDescription());
            out.add(m);
        }
        return out;
    }

    /** Regras de preço para calcular "valor a pagar" no ecrã de leitura (também sem internet, no telemóvel). */
    @Transactional(readOnly = true)
    public Map<String, Object> tariff(Long cid) {
        CompanySetting s = pricing.settings(cid);
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("mode", s.getTariffMode());
        m.put("currency", s.getCurrency());
        m.put("minimum_m3", s.getMinimumM3());
        m.put("minimum_charge", s.getMinimumCharge());
        m.put("price_per_m3", s.getPricePerM3());
        m.put("sewer_percent", s.getSewerPercent());
        m.put("fixed_fee", s.getFixedFee());
        m.put("consumption_alert", s.getConsumptionAlert());
        m.put("tiers", tiers.findByCompanyIdOrderByCategoryAscFromM3Asc(cid).stream()
                .filter(x -> Boolean.TRUE.equals(x.getActive()))
                .map(x -> {
                    Map<String, Object> r = new LinkedHashMap<>();
                    r.put("category", x.getCategory());
                    r.put("from_m3", x.getFromM3());
                    r.put("to_m3", x.getToM3());
                    r.put("price_m3", x.getPriceM3());
                    return r;
                }).toList());
        return m;
    }

    @Transactional(readOnly = true)
    public TariffCalculator.Result simulate(Long cid, int consumption, String category) {
        return pricing.price(cid, consumption, category == null || category.isBlank() ? "residential" : category);
    }

    private Company company(Long cid) {
        return companies.findById(cid).orElseThrow(() -> ApiException.notFound("Empresa não encontrada."));
    }
}
