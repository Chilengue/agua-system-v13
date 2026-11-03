package mz.agua.service;

/**
 * Eventos que podem gerar mensagens automáticas (planos Standard/Enterprise).
 * São tratados por MessageService só depois de a transação gravar (AFTER_COMMIT):
 * uma falha no envio nunca desfaz a fatura ou o pagamento.
 */
public final class MessageEvents {

    private MessageEvents() {
    }

    /** Fatura emitida (leitura faturada ou fatura avulsa). */
    public record InvoiceIssued(Long companyId, Long invoiceId) {
    }

    /** Pagamento confirmado (na caixa ou validado pelo gestor). */
    public record PaymentConfirmed(Long companyId, Long paymentId) {
    }
}
