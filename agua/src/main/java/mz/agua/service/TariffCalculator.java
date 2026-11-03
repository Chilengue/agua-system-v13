package mz.agua.service;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;

/**
 * Valor de uma fatura por escalões de consumo (Java puro, testado em TariffCalculatorTest).
 * Escalões lidos pelo limite superior: 0–10 e 11–20 (ou 0–10 e 10–20) com 15 m³
 * cobram 10 m³ no 1.º e 5 m³ no 2.º. Escalão sem "até" cobre o resto.
 */
public final class TariffCalculator {

    private TariffCalculator() {
    }

    public record Tier(int from, Integer to, BigDecimal price) {
    }

    public record Options(BigDecimal sewerPercent, BigDecimal fixedFee, BigDecimal minimumCharge) {
        public static Options none() {
            return new Options(BigDecimal.ZERO, BigDecimal.ZERO, BigDecimal.ZERO);
        }
    }

    public record Line(int from, Integer to, int units, BigDecimal price, BigDecimal amount) {
    }

    public record Result(int consumption, List<Line> lines, BigDecimal water, BigDecimal sewer,
                         BigDecimal fixedFee, BigDecimal total) {
    }

    public static Result calculate(int consumption, List<Tier> tiers, Options opt) {
        if (consumption < 0) throw new IllegalArgumentException("O consumo não pode ser negativo.");
        if (tiers == null || tiers.isEmpty()) throw new IllegalStateException("Sem escalões de tarifa configurados.");
        Options o = opt == null ? Options.none() : opt;
        List<Tier> sorted = new ArrayList<>(tiers);
        sorted.sort(Comparator.comparingInt(Tier::from));

        List<Line> lines = new ArrayList<>();
        BigDecimal water = BigDecimal.ZERO;
        long charged = 0;
        for (Tier t : sorted) {
            if (charged >= consumption) break;
            long limit = t.to() == null ? Long.MAX_VALUE : t.to();
            long units = Math.min(consumption, limit) - charged;
            if (units <= 0) continue;
            BigDecimal amount = money(t.price().multiply(BigDecimal.valueOf(units)));
            lines.add(new Line(t.from(), t.to(), (int) units, t.price(), amount));
            water = water.add(amount);
            charged += units;
        }
        if (charged < consumption) {
            Tier last = sorted.get(sorted.size() - 1);
            long rest = consumption - charged;
            BigDecimal amount = money(last.price().multiply(BigDecimal.valueOf(rest)));
            lines.add(new Line((int) charged + 1, null, (int) rest, last.price(), amount));
            water = water.add(amount);
        }
        water = money(water);
        BigDecimal min = nz(o.minimumCharge());
        if (water.compareTo(min) < 0) water = money(min);           // consumo mínimo
        BigDecimal sewer = money(water.multiply(nz(o.sewerPercent())).divide(BigDecimal.valueOf(100), 2, RoundingMode.HALF_UP));
        BigDecimal fixed = money(nz(o.fixedFee()));
        return new Result(consumption, List.copyOf(lines), water, sewer, fixed, water.add(sewer).add(fixed));
    }

    /**
     * Tarifa com consumo mínimo (ex.: até 5 m³ paga 350; cada m³ acima de 5 paga 70).
     * 3 m³ → 350 · 5 m³ → 350 · 8 m³ → 350 + 3 × 70 = 560.
     */
    public static Result minimum(int consumption, int minimumM3, BigDecimal minimumCharge, BigDecimal pricePerM3,
                                 BigDecimal sewerPercent, BigDecimal fixedFee) {
        if (consumption < 0) throw new IllegalArgumentException("O consumo não pode ser negativo.");
        int min = Math.max(minimumM3, 0);
        BigDecimal base = money(nz(minimumCharge));
        BigDecimal price = nz(pricePerM3);
        List<Line> lines = new ArrayList<>();
        lines.add(new Line(0, min, Math.min(consumption, min), null, base));
        BigDecimal water = base;
        if (consumption > min) {
            int extra = consumption - min;
            BigDecimal amount = money(price.multiply(BigDecimal.valueOf(extra)));
            lines.add(new Line(min + 1, null, extra, price, amount));
            water = water.add(amount);
        }
        water = money(water);
        BigDecimal sewer = money(water.multiply(nz(sewerPercent)).divide(BigDecimal.valueOf(100), 2, RoundingMode.HALF_UP));
        BigDecimal fixed = money(nz(fixedFee));
        return new Result(consumption, List.copyOf(lines), water, sewer, fixed, water.add(sewer).add(fixed));
    }

    static BigDecimal money(BigDecimal v) {
        return v.setScale(2, RoundingMode.HALF_UP);
    }

    static BigDecimal nz(BigDecimal v) {
        return v == null ? BigDecimal.ZERO : v;
    }
}
