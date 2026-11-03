package mz.agua.service;

import lombok.RequiredArgsConstructor;
import mz.agua.common.ApiException;
import mz.agua.domain.CompanySetting;
import mz.agua.domain.TariffTier;
import mz.agua.repository.CompanySettingRepository;
import mz.agua.repository.TariffTierRepository;
import org.springframework.stereotype.Service;

import java.util.List;

/** Preço de um consumo segundo as regras da empresa (consumo mínimo OU escalões por categoria). */
@Service
@RequiredArgsConstructor
public class PricingService {

    private final CompanySettingRepository settings;
    private final TariffTierRepository tiers;

    public CompanySetting settings(Long companyId) {
        return settings.findByCompanyId(companyId).orElseGet(() -> settings.save(CompanyService.defaultSettings(companyId)));
    }

    public TariffCalculator.Result price(Long companyId, int consumption, String category) {
        return price(settings(companyId), consumption, category);
    }

    public TariffCalculator.Result price(CompanySetting s, int consumption, String category) {
        if ("tiers".equals(s.getTariffMode())) {
            List<TariffTier> all = tiers.findByCompanyIdOrderByCategoryAscFromM3Asc(s.getCompanyId()).stream()
                    .filter(t -> Boolean.TRUE.equals(t.getActive())).toList();
            List<TariffTier> mine = all.stream().filter(t -> t.getCategory().equals(category)).toList();
            if (mine.isEmpty()) mine = all.stream().filter(t -> "residential".equals(t.getCategory())).toList();
            if (mine.isEmpty()) throw ApiException.badRequest("Sem escalões de tarifa configurados. Vá a Tarifas.");
            List<TariffCalculator.Tier> list = mine.stream()
                    .map(t -> new TariffCalculator.Tier(t.getFromM3(), t.getToM3(), t.getPriceM3())).toList();
            return TariffCalculator.calculate(consumption, list,
                    new TariffCalculator.Options(s.getSewerPercent(), s.getFixedFee(), s.getMinimumCharge()));
        }
        return TariffCalculator.minimum(consumption, s.getMinimumM3() == null ? 0 : s.getMinimumM3(),
                s.getMinimumCharge(), s.getPricePerM3(), s.getSewerPercent(), s.getFixedFee());
    }
}
