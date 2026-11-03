package mz.agua.service;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;

/**
 * Multa e juros de mora (Java puro, testado em LateChargeCalculatorTest).
 * - Multa: aplicada uma vez, depois do vencimento + dias de tolerância.
 *   "percent" = % sobre o valor base; "fixed" = valor fixo.
 * - Juros: % ao mês sobre o valor base, por cada mês completo de atraso.
 * O valor base é água + saneamento + taxa fixa − desconto (sem multa nem juros).
 */
public final class LateChargeCalculator {

    private LateChargeCalculator() {
    }

    public record Rules(boolean fineEnabled, String fineType, BigDecimal fineValue, int graceDays,
                        boolean interestEnabled, BigDecimal interestMonthlyPercent) {
    }

    public record Charges(BigDecimal fine, BigDecimal interest, long daysLate, long monthsLate) {
    }

    public static Charges calculate(BigDecimal base, LocalDate dueDate, LocalDate today, Rules r) {
        BigDecimal zero = BigDecimal.ZERO.setScale(2);
        if (base == null || base.signum() <= 0 || dueDate == null || !today.isAfter(dueDate)) {
            return new Charges(zero, zero, 0, 0);
        }
        long days = ChronoUnit.DAYS.between(dueDate, today);
        long months = ChronoUnit.MONTHS.between(dueDate, today);
        BigDecimal fine = zero;
        if (r.fineEnabled() && days > r.graceDays() && r.fineValue() != null) {
            fine = "fixed".equalsIgnoreCase(r.fineType())
                    ? r.fineValue().setScale(2, RoundingMode.HALF_UP)
                    : base.multiply(r.fineValue()).divide(BigDecimal.valueOf(100), 2, RoundingMode.HALF_UP);
        }
        BigDecimal interest = zero;
        if (r.interestEnabled() && months > 0 && r.interestMonthlyPercent() != null) {
            interest = base.multiply(r.interestMonthlyPercent()).multiply(BigDecimal.valueOf(months))
                    .divide(BigDecimal.valueOf(100), 2, RoundingMode.HALF_UP);
        }
        return new Charges(fine, interest, days, months);
    }
}
