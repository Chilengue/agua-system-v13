package mz.agua.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import mz.agua.common.Text;
import mz.agua.config.AppProperties;
import mz.agua.domain.CompanySetting;
import org.springframework.stereotype.Component;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.LinkedHashMap;
import java.util.Map;

/**
 * Envio efetivo das mensagens por API.
 * <ul>
 *   <li>WhatsApp: WhatsApp Cloud API (Meta) com o "Phone number ID" e o token da empresa;</li>
 *   <li>SMS: gateway HTTP (da empresa ou da plataforma) que recebe POST JSON {"from","to","message"}
 *       com o cabeçalho "Authorization: Bearer &lt;token&gt;".</li>
 * </ul>
 * Sem API configurada a mensagem fica em modo "link": o operador abre-a no WhatsApp/SMS do seu telemóvel.
 */
@Component
@RequiredArgsConstructor
public class MessageGateway {

    private static final HttpClient HTTP = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(10)).build();

    private final AppProperties props;
    private final ObjectMapper mapper;

    /** Resultado de um envio: ok + referência do fornecedor, ou o erro. */
    public record Result(boolean ok, String ref, String error) {
    }

    /** true = a empresa tem API configurada para este canal (envio automático); false = abre-se o link. */
    public boolean apiReady(CompanySetting s, String channel) {
        if ("whatsapp".equals(channel)) {
            return "api".equals(s.getWhatsappMode()) && !Text.blank(s.getWhatsappPhoneId()) && !Text.blank(s.getWhatsappToken());
        }
        if ("sms".equals(channel)) {
            return "api".equals(s.getSmsMode()) && !Text.blank(smsUrl(s));
        }
        return false;
    }

    public Result send(CompanySetting s, String channel, String phone, String text) {
        try {
            return "sms".equals(channel) ? sms(s, phone, text) : whatsapp(s, phone, text);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            return new Result(false, null, "Envio interrompido.");
        } catch (Exception e) {
            return new Result(false, null, "Falha de ligação ao fornecedor: " + e.getMessage());
        }
    }

    private Result whatsapp(CompanySetting s, String phone, String text) throws Exception {
        String base = Text.blank(props.whatsappApiUrl()) ? "https://graph.facebook.com/v20.0" : props.whatsappApiUrl().replaceAll("/+$", "");
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("messaging_product", "whatsapp");
        body.put("to", international(phone));
        body.put("type", "text");
        body.put("text", Map.of("preview_url", false, "body", text));
        HttpRequest req = HttpRequest.newBuilder(URI.create(base + "/" + s.getWhatsappPhoneId().trim() + "/messages"))
                .timeout(Duration.ofSeconds(20))
                .header("Authorization", "Bearer " + s.getWhatsappToken().trim())
                .header("Content-Type", "application/json")
                .POST(HttpRequest.BodyPublishers.ofString(mapper.writeValueAsString(body))).build();
        HttpResponse<String> res = HTTP.send(req, HttpResponse.BodyHandlers.ofString());
        if (res.statusCode() / 100 == 2) {
            String ref = null;
            try {
                ref = mapper.readTree(res.body()).path("messages").path(0).path("id").asText(null);
            } catch (Exception ignored) {
                // resposta sem id: o envio foi aceite na mesma
            }
            return new Result(true, ref, null);
        }
        return new Result(false, null, "WhatsApp respondeu " + res.statusCode() + ": " + shorten(res.body()));
    }

    private Result sms(CompanySetting s, String phone, String text) throws Exception {
        String url = smsUrl(s);
        String token = !Text.blank(s.getSmsApiUrl()) ? s.getSmsApiToken() : props.smsApiToken();
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("from", Text.blank(s.getSmsNumber()) ? "" : s.getSmsNumber().trim());
        body.put("to", international(phone));
        body.put("message", text);
        HttpRequest.Builder b = HttpRequest.newBuilder(URI.create(url.trim())).timeout(Duration.ofSeconds(20))
                .header("Content-Type", "application/json")
                .POST(HttpRequest.BodyPublishers.ofString(mapper.writeValueAsString(body)));
        if (!Text.blank(token)) b.header("Authorization", "Bearer " + token.trim());
        HttpResponse<String> res = HTTP.send(b.build(), HttpResponse.BodyHandlers.ofString());
        if (res.statusCode() / 100 == 2) return new Result(true, shorten(res.body()), null);
        return new Result(false, null, "Gateway de SMS respondeu " + res.statusCode() + ": " + shorten(res.body()));
    }

    private String smsUrl(CompanySetting s) {
        return !Text.blank(s.getSmsApiUrl()) ? s.getSmsApiUrl() : props.smsApiUrl();
    }

    /** 84 123 4567 → 258841234567 (Moçambique); números com indicativo ficam como estão. */
    public static String international(String phone) {
        String d = Text.digits(phone);
        if (d.startsWith("00")) d = d.substring(2);
        if (d.length() == 9 && d.charAt(0) == '8') d = "258" + d;
        return d;
    }

    private static String shorten(String s) {
        if (s == null) return "";
        return s.length() > 300 ? s.substring(0, 300) + "…" : s;
    }
}
