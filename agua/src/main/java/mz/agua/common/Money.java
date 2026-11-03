package mz.agua.common;

import java.math.BigDecimal;
import java.math.RoundingMode;

/** Arredondamento monetário (2 casas, meio para cima). */
public final class Money {

    private Money() {
    }

    public static BigDecimal of(BigDecimal v) {
        return (v == null ? BigDecimal.ZERO : v).setScale(2, RoundingMode.HALF_UP);
    }

    public static BigDecimal nz(BigDecimal v) {
        return v == null ? BigDecimal.ZERO : v;
    }

    public static boolean positive(BigDecimal v) {
        return v != null && v.signum() > 0;
    }

    /** valor × percentagem / 100. */
    public static BigDecimal percent(BigDecimal base, BigDecimal pct) {
        if (base == null || pct == null) return BigDecimal.ZERO.setScale(2);
        return base.multiply(pct).divide(BigDecimal.valueOf(100), 2, RoundingMode.HALF_UP);
    }
}
