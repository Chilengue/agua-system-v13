package mz.agua.security;

import mz.agua.common.ApiException;

import java.util.LinkedHashMap;
import java.util.Map;

/**
 * Planos de negócio de cada empresa (companies.plan_company):
 * <ul>
 *   <li><b>basic</b> — Básico: faturação, leituras, caixa e portal; sem WhatsApp e sem SMS;</li>
 *   <li><b>standard</b> — Standard: tudo do Básico + avisos de faturas, recibos e lembretes por WhatsApp;</li>
 *   <li><b>enterprise</b> — Enterprise: tudo do Standard + SMS.</li>
 * </ul>
 * O menu e os botões de mensagens só aparecem no plano certo; o servidor também confirma (require).
 */
public final class Plans {

    public static final String BASIC = "basic";
    public static final String STANDARD = "standard";
    public static final String ENTERPRISE = "enterprise";

    private Plans() {
    }

    public static boolean valid(String plan) {
        return BASIC.equals(plan) || STANDARD.equals(plan) || ENTERPRISE.equals(plan);
    }

    public static boolean whatsapp(String plan) {
        return STANDARD.equals(plan) || ENTERPRISE.equals(plan);
    }

    public static boolean sms(String plan) {
        return ENTERPRISE.equals(plan);
    }

    public static boolean allows(String plan, String channel) {
        return "sms".equals(channel) ? sms(plan) : "whatsapp".equals(channel) && whatsapp(plan);
    }

    public static String label(String plan) {
        return switch (plan == null ? BASIC : plan) {
            case STANDARD -> "Standard";
            case ENTERPRISE -> "Enterprise";
            default -> "Básico";
        };
    }

    /** Funcionalidades do plano, enviadas ao navegador para mostrar/esconder menus e botões. */
    public static Map<String, Object> features(String plan) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("plan", plan == null ? BASIC : plan);
        m.put("plan_label", label(plan));
        m.put("whatsapp", whatsapp(plan));
        m.put("sms", sms(plan));
        m.put("messages", whatsapp(plan) || sms(plan));
        return m;
    }

    public static void require(String plan, String channel) {
        if ("sms".equals(channel) && !sms(plan)) {
            throw ApiException.forbidden("O envio por SMS faz parte do plano Enterprise. Fale com o administrador da plataforma.");
        }
        if ("whatsapp".equals(channel) && !whatsapp(plan)) {
            throw ApiException.forbidden("O envio por WhatsApp faz parte dos planos Standard e Enterprise. Fale com o administrador da plataforma.");
        }
        if (!"sms".equals(channel) && !"whatsapp".equals(channel)) throw ApiException.badRequest("Canal inválido.");
    }
}
