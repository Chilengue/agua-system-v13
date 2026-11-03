package mz.agua.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.PositiveOrZero;
import jakarta.validation.constraints.Size;

import java.math.BigDecimal;
import java.util.List;

/**
 * Pedidos recebidos pela API (JSON em snake_case: current_value, account_id…).
 * As anotações de validação dão a mensagem que aparece ao utilizador.
 */
public final class Dto {

    private Dto() {
    }

    private static final String PHONE = "^$|^[+0-9 ()-]{6,20}$";

    // ---------------- Sessão ----------------
    public record Login(@NotBlank(message = "Indique o utilizador ou email.") String username,
                        @NotBlank(message = "Indique a senha.") String password) {
    }

    public record ChangePassword(String currentPassword,
                                 @NotBlank(message = "Indique a nova senha.")
                                 @Size(min = 6, max = 72, message = "A nova senha deve ter entre 6 e 72 caracteres.") String newPassword) {
    }

    public record Forgot(@NotBlank(message = "Indique o email.") @Email(message = "Email inválido.") String email,
                         @NotBlank(message = "Indique o nome completo usado no registo.") String name) {
    }

    public record Reset(@NotBlank(message = "Indique o email.") @Email(message = "Email inválido.") String email,
                        @NotBlank(message = "Indique o código recebido.") String code,
                        @NotBlank(message = "Indique a nova senha.")
                        @Size(min = 6, max = 72, message = "A nova senha deve ter entre 6 e 72 caracteres.") String newPassword) {
    }

    public record Setup(@NotBlank(message = "Indique o nome.") String name,
                        @NotBlank(message = "Indique o utilizador.")
                        @Pattern(regexp = "^[A-Za-z0-9._-]{3,40}$", message = "Utilizador: 3 a 40 letras, números, . _ -") String username,
                        @NotBlank(message = "Indique o email.") @Email(message = "Email inválido.") String email,
                        @NotBlank @Size(min = 8, max = 72, message = "A senha do administrador deve ter pelo menos 8 caracteres.") String password) {
    }

    // ---------------- Empresas ----------------
    public record Company(@NotBlank(message = "Indique o nome da empresa.") @Size(max = 180) String name,
                          @Size(max = 32) String nuit,
                          @NotBlank(message = "Indique o telefone da empresa.") @Pattern(regexp = PHONE, message = "Telefone inválido.") String phone,
                          @Email(message = "Email da empresa inválido.") String email,
                          String address, @Size(max = 120) String city, @Size(max = 120) String province,
                          @Size(max = 200) String slogan,
                          @NotBlank(message = "Indique o nome completo do gestor.") @Size(max = 150) String managerName,
                          @NotBlank(message = "Indique o email do gestor.") @Email(message = "Email do gestor inválido.") String managerEmail,
                          @Pattern(regexp = PHONE, message = "Telefone do gestor inválido.") String managerPhone,
                          /** Só o administrador escolhe; no registo pelo login fica sempre "basic". */
                          @Pattern(regexp = "^$|^(basic|standard|enterprise)$", message = "Plano inválido.") String plan) {
    }

    /** Mudança de plano feita pelo administrador. */
    public record Plan(@NotBlank(message = "Escolha o plano.")
                       @Pattern(regexp = "^(basic|standard|enterprise)$", message = "Plano inválido.") String plan,
                       @Size(max = 500) String reason) {
    }

    public record CompanyProfile(@NotBlank(message = "Indique o nome da empresa.") @Size(max = 180) String name,
                                 @Size(max = 32) String nuit,
                                 @Pattern(regexp = PHONE, message = "Telefone inválido.") String phone,
                                 @Email(message = "Email inválido.") String email,
                                 String address, @Size(max = 120) String city, @Size(max = 120) String province,
                                 @Size(max = 200) String slogan) {
    }

    /** Logótipo em data URL (PNG/JPEG/WEBP, até ~500 KB). Vazio = remover. */
    public record Logo(String logo) {
    }

    public record UserUpdate(@NotBlank(message = "Indique o nome.") @Size(max = 150) String name,
                             @Email(message = "Email inválido.") String email,
                             @Pattern(regexp = PHONE, message = "Telefone inválido.") String phone,
                             @Pattern(regexp = "^$|^(active|blocked)$", message = "Estado inválido.") String status) {
    }

    public record Reader(@NotBlank(message = "Indique o nome do mediador.") @Size(max = 150) String name,
                         @Pattern(regexp = PHONE, message = "Telefone inválido.") String phone,
                         @Email(message = "Email inválido.") String email) {
    }

    public record Reason(@NotBlank(message = "Indique o motivo.") @Size(max = 500) String reason) {
    }

    // ---------------- Clientes ----------------
    public record Account(@Size(max = 30) String number,
                          @Pattern(regexp = "^$|^(residential|commercial|public|industrial)$", message = "Categoria inválida.") String category,
                          String address, @Size(max = 120) String neighborhood, @Size(max = 40) String block,
                          @Size(max = 40) String houseNumber, @Size(max = 200) String landmark,
                          @Size(max = 20) String latitude, @Size(max = 20) String longitude,
                          String openedAt, @Size(max = 50) String meterNumber,
                          @PositiveOrZero(message = "A leitura inicial não pode ser negativa.") Integer initialReading,
                          String notes) {
    }

    public record Customer(@NotBlank(message = "Indique o nome do cliente.") @Size(min = 3, max = 180, message = "Nome do cliente: 3 a 180 caracteres.") String name,
                           @Pattern(regexp = "^$|^(bi|passport|dire|nuit|other)$", message = "Tipo de documento inválido.") String documentType,
                           @Size(max = 50) String document, @Size(max = 32) String nuit,
                           @Pattern(regexp = "^$|^[MF]$", message = "Género inválido.") String gender,
                           String birthDate, @Size(max = 120) String occupation,
                           @NotBlank(message = "Indique o telefone do cliente.") @Pattern(regexp = PHONE, message = "Telefone inválido.") String phone,
                           @Pattern(regexp = PHONE, message = "Telefone alternativo inválido.") String phone2,
                           @Email(message = "Email inválido.") String email,
                           String address, @Size(max = 120) String neighborhood, @Size(max = 40) String block,
                           @Size(max = 40) String houseNumber, @Size(max = 120) String district, @Size(max = 120) String city,
                           @Pattern(regexp = "^$|^(active|inactive)$", message = "Estado inválido.") String status,
                           String notes,
                           /** Só no registo: primeira conta (contrato) do cliente. */
                           @Valid Account account,
                           /** Identificador gerado no navegador (registo feito sem internet): evita duplicar. */
                           @Size(max = 40) String clientUuid) {
    }

    public record MeterReplace(@NotBlank(message = "Indique o número do novo contador.") @Size(max = 50) String number,
                               @NotNull(message = "Indique a leitura inicial do novo contador.")
                               @PositiveOrZero(message = "A leitura inicial não pode ser negativa.") Integer initialReading) {
    }

    // ---------------- Leituras e faturas ----------------
    public record Reading(@NotNull(message = "Escolha a conta.") Long accountId,
                          @NotNull(message = "Indique a leitura atual.") @PositiveOrZero(message = "A leitura não pode ser negativa.") Integer currentValue,
                          String period, String readAt, @Size(max = 500) String notes,
                          @Size(max = 40) String clientUuid, Boolean bill) {
    }

    public record ReadingEdit(@NotNull(message = "Indique a leitura atual.") @PositiveOrZero(message = "A leitura não pode ser negativa.") Integer currentValue,
                              @Size(max = 500) String notes) {
    }

    public record ManualInvoice(@NotNull(message = "Escolha a conta.") Long accountId,
                                @NotBlank(message = "Indique a descrição.") @Size(max = 200) String description,
                                @NotNull(message = "Indique o valor.") @Positive(message = "O valor deve ser maior que zero.") BigDecimal amount,
                                String period, String dueDate, String notes) {
    }

    public record Discount(@NotNull(message = "Indique o valor.") @Positive(message = "O desconto deve ser maior que zero.") BigDecimal amount,
                           @NotBlank(message = "Indique o motivo do desconto.") String reason) {
    }

    public record Payment(@NotNull(message = "Escolha o cliente.") Long customerId,
                          Long accountId, List<Long> invoiceIds,
                          @NotNull(message = "Indique o valor.") @Positive(message = "O valor deve ser maior que zero.") BigDecimal amount,
                          @NotBlank(message = "Escolha o método de pagamento.")
                          @Pattern(regexp = "^(cash|mpesa|emola|mkesh|bank|card|other)$", message = "Método de pagamento inválido.") String method,
                          @Size(max = 120) String reference, String paidAt, String notes, @Size(max = 40) String clientUuid) {
    }

    // ---------------- Configurações ----------------
    public record Settings(String currency,
                           @Min(value = 1, message = "Prazo de pagamento: 1 a 120 dias.") @Max(value = 120, message = "Prazo de pagamento: 1 a 120 dias.") Integer invoiceDueDays,
                           @Min(1) @Max(28) Integer readingDay, Boolean autoBill,
                           @Pattern(regexp = "^(minimum|tiers)$", message = "Modo de tarifa inválido.") String tariffMode,
                           @Min(value = 0, message = "Consumo mínimo inválido.") Integer minimumM3,
                           @DecimalMin(value = "0", message = "Valor mínimo inválido.") BigDecimal minimumCharge,
                           @DecimalMin(value = "0", message = "Preço por m³ inválido.") BigDecimal pricePerM3,
                           @DecimalMin("0") BigDecimal fixedFee,
                           @DecimalMin("0") @DecimalMax(value = "100", message = "Saneamento: 0 a 100%.") BigDecimal sewerPercent,
                           Boolean fineEnabled, @Pattern(regexp = "^(percent|fixed)$") String fineType,
                           @DecimalMin("0") BigDecimal fineValue, @Min(0) @Max(365) Integer fineGraceDays,
                           Boolean interestEnabled, @DecimalMin("0") @DecimalMax("100") BigDecimal interestMonthlyPercent,
                           Boolean requirePaymentValidation,
                           @Pattern(regexp = "^[A-Z]{1,6}$", message = "Prefixo: 1 a 6 letras maiúsculas.") String invoicePrefix,
                           @Pattern(regexp = "^[A-Z]{1,6}$", message = "Prefixo: 1 a 6 letras maiúsculas.") String receiptPrefix,
                           @Pattern(regexp = "^(thermal58|thermal80|a5|a4)$") String receiptFormat,
                           @Pattern(regexp = "^(portrait|landscape)$") String receiptOrientation,
                           @Min(1) @Max(3) Integer receiptCopies, @Size(max = 60) String receiptTitle,
                           @Pattern(regexp = "^#[0-9a-fA-F]{6}$", message = "Cor inválida.") String receiptAccent,
                           Boolean receiptShowLogo, Boolean receiptShowReadings, Boolean receiptShowDebt,
                           Boolean receiptShowSignature, String receiptHeader, String receiptFooter, String receiptNotes,
                           String paymentInstructions, Boolean allowOfflineReadings, @Min(1) Integer consumptionAlert) {
    }

    public record Tier(@Pattern(regexp = "^(residential|commercial|public|industrial)$", message = "Categoria inválida.") String category,
                       @NotNull(message = "Indique o início do escalão.") @Min(0) Integer fromM3, Integer toM3,
                       @NotNull(message = "Indique o preço por m³.") @DecimalMin(value = "0", message = "Preço inválido.") BigDecimal priceM3,
                       String description) {
    }

    public record Tiers(@NotNull List<@Valid Tier> tiers) {
    }

    public record SyncBatch(@NotNull List<Reading> items) {
    }

    // ---------------- Mensagens (WhatsApp / SMS) ----------------
    /** Números e regras de mensagens da empresa. Tokens vazios = manter os atuais. */
    public record Messaging(@Pattern(regexp = PHONE, message = "Número de WhatsApp inválido.") String whatsappNumber,
                            @Pattern(regexp = "^(link|api)$", message = "Modo do WhatsApp inválido.") String whatsappMode,
                            @Size(max = 60) String whatsappPhoneId, @Size(max = 1000) String whatsappToken,
                            @Size(max = 40, message = "Número/remetente de SMS: até 40 caracteres.") String smsNumber,
                            @Pattern(regexp = "^(link|api)$", message = "Modo do SMS inválido.") String smsMode,
                            @Pattern(regexp = "^$|^https?://.{3,290}$", message = "Endereço do gateway de SMS inválido (http/https).") String smsApiUrl,
                            @Size(max = 1000) String smsApiToken,
                            @Pattern(regexp = "^(whatsapp|sms|both)$", message = "Canal inválido.") String msgChannel,
                            Boolean msgOnInvoice, Boolean msgOnPayment,
                            @Size(max = 1000) String msgInvoiceTemplate, @Size(max = 1000) String msgPaymentTemplate,
                            @Size(max = 1000) String msgReminderTemplate,
                            Boolean clearWhatsappToken, Boolean clearSmsApiToken) {
    }

    /** Envio a vários clientes: lista de ids, ou todos os devedores (filtros). Texto vazio = lembrete de dívida. */
    public record MessageSend(@NotBlank(message = "Escolha o canal.")
                              @Pattern(regexp = "^(whatsapp|sms)$", message = "Canal inválido.") String channel,
                              List<Long> customerIds, @Size(max = 1000, message = "Mensagem: até 1000 caracteres.") String text,
                              Boolean debtorsOnly, Boolean overdueOnly, @DecimalMin("0") BigDecimal minDebt) {
    }

    public record PaymentBatch(@NotNull List<Payment> items) {
    }
}
