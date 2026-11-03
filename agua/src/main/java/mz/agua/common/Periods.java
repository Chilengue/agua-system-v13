package mz.agua.common;

import java.time.LocalDate;
import java.time.YearMonth;
import java.util.regex.Pattern;

/** Períodos de faturação no formato AAAA-MM. */
public final class Periods {

    private static final Pattern PERIOD = Pattern.compile("^\\d{4}-(0[1-9]|1[0-2])$");

    private Periods() {
    }

    public static String current() {
        return YearMonth.now().toString();
    }

    public static String of(LocalDate d) {
        return YearMonth.from(d).toString();
    }

    public static String validate(String period) {
        if (period == null || !PERIOD.matcher(period).matches()) {
            throw ApiException.badRequest("Período inválido (use AAAA-MM).");
        }
        return period;
    }
}
