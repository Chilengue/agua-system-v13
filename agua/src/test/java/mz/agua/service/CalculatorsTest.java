package mz.agua.service;

import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class CalculatorsTest {

    private static final List<TariffCalculator.Tier> TIERS = List.of(
            new TariffCalculator.Tier(0, 10, new BigDecimal("20")),
            new TariffCalculator.Tier(11, 20, new BigDecimal("35")),
            new TariffCalculator.Tier(21, null, new BigDecimal("50")));

    @Test
    void tiers() {
        var r = TariffCalculator.calculate(25, TIERS, TariffCalculator.Options.none());
        assertThat(r.water()).isEqualByComparingTo("800");           // 200 + 350 + 250
        assertThat(r.lines()).extracting(TariffCalculator.Line::units).containsExactly(10, 10, 5);
    }

    @Test
    void sewerFixedFeeAndMinimum() {
        var r = TariffCalculator.calculate(2, TIERS, new TariffCalculator.Options(new BigDecimal("10"), new BigDecimal("50"), new BigDecimal("100")));
        assertThat(r.water()).isEqualByComparingTo("100");           // 40 < mínimo 100
        assertThat(r.sewer()).isEqualByComparingTo("10");
        assertThat(r.total()).isEqualByComparingTo("160");
    }

    @Test
    void rejectsNegativeAndEmpty() {
        assertThatThrownBy(() -> TariffCalculator.calculate(-1, TIERS, null)).isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> TariffCalculator.calculate(5, List.of(), null)).isInstanceOf(IllegalStateException.class);
    }

    @Test
    void lateCharges() {
        var rules = new LateChargeCalculator.Rules(true, "percent", new BigDecimal("10"), 5, true, new BigDecimal("2"));
        LocalDate due = LocalDate.of(2026, 1, 31);
        // dentro da tolerância: sem multa
        var a = LateChargeCalculator.calculate(new BigDecimal("1000"), due, due.plusDays(3), rules);
        assertThat(a.fine()).isEqualByComparingTo("0");
        // 2 meses e meio de atraso: multa 10% + juros 2% × 2 meses
        var b = LateChargeCalculator.calculate(new BigDecimal("1000"), due, LocalDate.of(2026, 4, 15), rules);
        assertThat(b.fine()).isEqualByComparingTo("100");
        assertThat(b.interest()).isEqualByComparingTo("40");
        // multa fixa
        var fixed = new LateChargeCalculator.Rules(true, "fixed", new BigDecimal("75"), 0, false, BigDecimal.ZERO);
        assertThat(LateChargeCalculator.calculate(new BigDecimal("500"), due, due.plusDays(1), fixed).fine()).isEqualByComparingTo("75");
        // antes do vencimento: nada
        assertThat(LateChargeCalculator.calculate(new BigDecimal("500"), due, due, rules).fine()).isEqualByComparingTo("0");
    }

    @Test
    void minimumMode() {
        BigDecimal min = new BigDecimal("350"), p = new BigDecimal("70");
        assertThat(TariffCalculator.minimum(3, 5, min, p, null, null).total()).isEqualByComparingTo("350");
        assertThat(TariffCalculator.minimum(5, 5, min, p, null, null).total()).isEqualByComparingTo("350");
        assertThat(TariffCalculator.minimum(8, 5, min, p, null, null).total()).isEqualByComparingTo("560");
        assertThat(TariffCalculator.minimum(8, 5, min, p, new BigDecimal("10"), new BigDecimal("25")).total())
                .isEqualByComparingTo("641");                       // 560 + 56 + 25
    }
}
