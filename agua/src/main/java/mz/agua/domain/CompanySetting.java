package mz.agua.domain;

import com.fasterxml.jackson.annotation.JsonIgnore;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.math.BigDecimal;
import java.time.LocalDateTime;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

/** Regras de cada empresa: faturação, multas, juros e recibo. Tabela company_settings. Gerado por tools/gen_model.py — não editar à mão. */
@Entity
@Table(name = "company_settings")
@Getter
@Setter
@NoArgsConstructor
public class CompanySetting {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "id_company_setting")
    private Long id;

    @Column(name = "id_company_company_setting", nullable = false)
    private Long companyId;

    @Column(name = "configured_company_setting", nullable = false)
    private Boolean configured = false;

    @Column(name = "currency_company_setting", nullable = false)
    private String currency = "MZN";

    @Column(name = "invoice_due_days_company_setting", nullable = false)
    private Integer invoiceDueDays = 15;

    @Column(name = "reading_day_company_setting", nullable = false)
    private Integer readingDay = 25;

    @Column(name = "auto_bill_company_setting", nullable = false)
    private Boolean autoBill = false;

    @Column(name = "minimum_charge_company_setting", nullable = false)
    private BigDecimal minimumCharge = BigDecimal.ZERO;

    @Column(name = "fixed_fee_company_setting", nullable = false)
    private BigDecimal fixedFee = BigDecimal.ZERO;

    @Column(name = "sewer_percent_company_setting", nullable = false)
    private BigDecimal sewerPercent = BigDecimal.ZERO;

    @Column(name = "tariff_mode_company_setting", nullable = false)
    private String tariffMode = "minimum";

    @Column(name = "minimum_m3_company_setting", nullable = false)
    private Integer minimumM3 = 5;

    @Column(name = "price_per_m3_company_setting", nullable = false)
    private BigDecimal pricePerM3 = BigDecimal.ZERO;

    @Column(name = "fine_enabled_company_setting", nullable = false)
    private Boolean fineEnabled = false;

    @Column(name = "fine_type_company_setting", nullable = false)
    private String fineType = "percent";

    @Column(name = "fine_value_company_setting", nullable = false)
    private BigDecimal fineValue = BigDecimal.ZERO;

    @Column(name = "fine_grace_days_company_setting", nullable = false)
    private Integer fineGraceDays = 0;

    @Column(name = "interest_enabled_company_setting", nullable = false)
    private Boolean interestEnabled = false;

    @Column(name = "interest_monthly_percent_company_setting", nullable = false)
    private BigDecimal interestMonthlyPercent = BigDecimal.ZERO;

    @Column(name = "require_payment_validation_company_setting", nullable = false)
    private Boolean requirePaymentValidation = false;

    @Column(name = "invoice_prefix_company_setting", nullable = false)
    private String invoicePrefix = "FT";

    @Column(name = "receipt_prefix_company_setting", nullable = false)
    private String receiptPrefix = "RC";

    @Column(name = "receipt_format_company_setting", nullable = false)
    private String receiptFormat = "a5";

    @Column(name = "receipt_orientation_company_setting", nullable = false)
    private String receiptOrientation = "landscape";

    @Column(name = "receipt_copies_company_setting", nullable = false)
    private Integer receiptCopies = 1;

    @Column(name = "receipt_title_company_setting", nullable = false)
    private String receiptTitle = "RECIBO";

    @Column(name = "receipt_accent_company_setting", nullable = false)
    private String receiptAccent = "#0f766e";

    @Column(name = "receipt_show_logo_company_setting", nullable = false)
    private Boolean receiptShowLogo = true;

    @Column(name = "receipt_show_readings_company_setting", nullable = false)
    private Boolean receiptShowReadings = true;

    @Column(name = "receipt_show_debt_company_setting", nullable = false)
    private Boolean receiptShowDebt = true;

    @Column(name = "receipt_show_signature_company_setting", nullable = false)
    private Boolean receiptShowSignature = true;

    @Column(name = "receipt_header_company_setting")
    private String receiptHeader;

    @Column(name = "receipt_footer_company_setting")
    private String receiptFooter;

    @Column(name = "receipt_notes_company_setting")
    private String receiptNotes;

    @Column(name = "payment_instructions_company_setting")
    private String paymentInstructions;

    @Column(name = "allow_offline_readings_company_setting", nullable = false)
    private Boolean allowOfflineReadings = true;

    @Column(name = "consumption_alert_company_setting", nullable = false)
    private Integer consumptionAlert = 100;

    @Column(name = "whatsapp_number_company_setting")
    private String whatsappNumber;

    @Column(name = "whatsapp_mode_company_setting", nullable = false)
    private String whatsappMode = "link";

    @Column(name = "whatsapp_phone_id_company_setting")
    private String whatsappPhoneId;

    @JsonIgnore
    @Column(name = "whatsapp_token_company_setting")
    private String whatsappToken;

    @Column(name = "sms_number_company_setting")
    private String smsNumber;

    @Column(name = "sms_mode_company_setting", nullable = false)
    private String smsMode = "link";

    @Column(name = "sms_api_url_company_setting")
    private String smsApiUrl;

    @JsonIgnore
    @Column(name = "sms_api_token_company_setting")
    private String smsApiToken;

    @Column(name = "msg_channel_company_setting", nullable = false)
    private String msgChannel = "whatsapp";

    @Column(name = "msg_on_invoice_company_setting", nullable = false)
    private Boolean msgOnInvoice = false;

    @Column(name = "msg_on_payment_company_setting", nullable = false)
    private Boolean msgOnPayment = false;

    @Column(name = "msg_invoice_template_company_setting")
    private String msgInvoiceTemplate;

    @Column(name = "msg_payment_template_company_setting")
    private String msgPaymentTemplate;

    @Column(name = "msg_reminder_template_company_setting")
    private String msgReminderTemplate;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt;
}
