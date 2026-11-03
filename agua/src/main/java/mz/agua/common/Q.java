package mz.agua.common;

import java.time.LocalDate;
import java.util.HashMap;
import java.util.Map;

/**
 * Parâmetros das consultas nomeadas, sempre com valores válidos (nunca null):
 * texto vazio = sem filtro, 0 = sem filtro, datas entre 1900-01-01 e 2999-12-31.
 */
public final class Q {

    public static final int MAX_SIZE = 5000;
    private final Map<String, Object> map = new HashMap<>();
    private int page = 1;
    private int size = 20;

    private Q() {
        map.put("q", "");
        map.put("qr", "");
        map.put("qd", "");
        map.put("status", "");
        map.put("period", "");
        map.put("from", "1900-01-01");
        map.put("to", "2999-12-31");
        map.put("limit", 20);
        map.put("offset", 0);
    }

    public static Q of() {
        return new Q();
    }

    /** Parâmetros já com a empresa (:cid). */
    public static Q company(Long cid) {
        return new Q().set("cid", cid);
    }

    public Q set(String key, Object value) {
        map.put(key, value);
        return this;
    }

    public Q str(String key, String value) {
        map.put(key, value == null ? "" : value.trim());
        return this;
    }

    public Q id(String key, Long value) {
        map.put(key, value == null ? 0L : value);
        return this;
    }

    /** Pesquisa livre: :q (sem acentos), :qr (minúsculas), :qd (só dígitos, se tiver 3 ou mais). */
    public Q search(String text) {
        String t = text == null ? "" : text.trim();
        map.put("q", Text.key(t));
        map.put("qr", Text.lower(t));
        String d = Text.digits(t);
        map.put("qd", d.length() >= 3 ? d : "");
        return this;
    }

    public Q period(String p) {
        map.put("period", p == null || p.isBlank() ? "" : Periods.validate(p.trim()));
        return this;
    }

    public Q dates(String from, String to) {
        map.put("from", date(from, "1900-01-01"));
        map.put("to", date(to, "2999-12-31"));
        return this;
    }

    private static String date(String v, String def) {
        if (v == null || v.isBlank()) return def;
        try {
            return LocalDate.parse(v.trim()).toString();
        } catch (Exception e) {
            throw ApiException.badRequest("Data inválida: " + v + " (use AAAA-MM-DD).");
        }
    }

    /** Página (1…) e tamanho; tamanho até 5000 para imprimir/exportar a lista completa. */
    public Q paging(Integer page, Integer size) {
        this.page = page == null || page < 1 ? 1 : page;
        this.size = size == null || size < 1 ? 20 : Math.min(size, MAX_SIZE);
        map.put("limit", this.size);
        map.put("offset", (this.page - 1) * this.size);
        return this;
    }

    public Q limit(int limit) {
        this.size = limit;
        map.put("limit", limit);
        map.put("offset", 0);
        return this;
    }

    public int page() {
        return page;
    }

    public int size() {
        return size;
    }

    public Map<String, Object> map() {
        return map;
    }
}
