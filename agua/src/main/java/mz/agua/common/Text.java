package mz.agua.common;

import java.text.Normalizer;
import java.util.Locale;

/** Normalização de textos para pesquisa e para detetar clientes duplicados. */
public final class Text {

    private Text() {
    }

    /** null/"" → null; caso contrário o texto sem espaços nas pontas. */
    public static String clean(String s) {
        if (s == null) return null;
        String t = s.trim().replaceAll("\\s+", " ");
        return t.isEmpty() ? null : t;
    }

    public static boolean blank(String s) {
        return s == null || s.isBlank();
    }

    /** "  João  Maria " → "joao maria" (sem acentos, minúsculas, espaços simples). */
    public static String key(String s) {
        if (s == null) return "";
        String n = Normalizer.normalize(s, Normalizer.Form.NFD).replaceAll("\\p{M}", "");
        return n.toLowerCase(Locale.ROOT).replaceAll("[^a-z0-9@._ -]", " ").trim().replaceAll("\\s+", " ");
    }

    /** Só dígitos; números moçambicanos ficam com 9 dígitos (sem +258). */
    public static String phoneKey(String s) {
        if (s == null) return null;
        String d = s.replaceAll("\\D", "");
        if (d.startsWith("258") && d.length() == 12) d = d.substring(3);
        return d.isEmpty() ? null : d;
    }

    public static String digits(String s) {
        return s == null ? "" : s.replaceAll("\\D", "");
    }

    public static String lower(String s) {
        return s == null ? "" : s.trim().toLowerCase(Locale.ROOT);
    }

    public static String email(String s) {
        String e = clean(s);
        return e == null ? null : e.toLowerCase(Locale.ROOT);
    }

    public static boolean validEmail(String e) {
        return e != null && e.matches("^[^\\s@]+@[^\\s@]+\\.[^\\s@]{2,}$");
    }

    /** j***@dominio.co.mz — para mostrar para onde foi enviado o código. */
    public static String maskEmail(String e) {
        if (e == null || !e.contains("@")) return "";
        int at = e.indexOf('@');
        return e.charAt(0) + "***" + e.substring(at);
    }
}
