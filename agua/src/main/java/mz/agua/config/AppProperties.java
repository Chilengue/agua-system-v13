package mz.agua.config;

import org.springframework.boot.context.properties.ConfigurationProperties;

import java.util.Arrays;
import java.util.Set;
import java.util.stream.Collectors;

/**
 * Configuração em application.properties (prefixo "app").
 *
 * @param supportPhone         contacto de suporte mostrado no login e no PDF de registo
 * @param autoApproveCompanies empresas registadas no login ficam logo ativas (senão aguardam o admin)
 * @param mailFrom             remetente dos emails (código de recuperação de senha)
 * @param devShowResetCode     SÓ para testes: mostra o código de recuperação no ecrã
 * @param smsApiUrl            gateway de SMS da plataforma (usado quando a empresa não tem um próprio)
 * @param smsApiToken          chave do gateway de SMS da plataforma (cabeçalho Authorization: Bearer)
 * @param whatsappApiUrl       endereço base da API do WhatsApp Cloud (Meta)
 */
@ConfigurationProperties(prefix = "app")
public record AppProperties(String version, String timezone, String allowedOrigins, String supportPhone,
                            String supportName, boolean autoApproveCompanies, String mailFrom,
                            boolean devShowResetCode, String smsApiUrl, String smsApiToken,
                            String whatsappApiUrl) {

    public Set<String> allowedOriginSet() {
        if (allowedOrigins == null || allowedOrigins.isBlank()) return Set.of();
        return Arrays.stream(allowedOrigins.split(",")).map(String::trim).filter(s -> !s.isEmpty())
                .collect(Collectors.toUnmodifiableSet());
    }
}
